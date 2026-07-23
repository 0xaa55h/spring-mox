import type {Route, RouteExport} from "../core-types.ts";
import {jsonSchemaToZod} from "json-schema-to-zod";
import {capitalize, CodeGenerator, groupParametersByLocation, LOCATION_SUFFIX} from "./core.ts";

function refDefName(schema: any): string | null {
  if (schema && typeof schema === "object" && typeof schema.$ref === "string") {
    return schema.$ref.split("/").pop()!;
  }
  return null;
}

function refInterceptor(schema: any) {
  const defName = refDefName(schema);
  if (defName) {
    return `z.lazy(() => z${defName})`;
  }
}

export class SchemaCodeGenerator extends CodeGenerator<RouteExport> {
  constructor(data: RouteExport) {
    super(data);
  }

  override async prepare(): Promise<void> {
    this.writeLine(`import { z } from "zod";`);
    this.writeLine("");
    this.writeLine(this.emitDefs(this.data));
    this.writeLine("");
  }

  override async emit(): Promise<void> {
    for (const route of this.data.routes) {
      for (const section of this.emitRoute(this.data, route)) {
        this.writeLine(section);
        this.writeLine("");
      }
    }
  }

  override async finalize(): Promise<void> {}

  private emitDefs(exp: RouteExport): string {
    return Object.entries(exp.schemas)
      .map(([defName, defSchema]) =>
        jsonSchemaToZod(defSchema, {
          name: `z${defName}`,
          module: "esm",
          type: defName,
          parserOverride: refInterceptor,
        }).replace(/^import\s*\{\s*z\s*}\s*from\s*"zod"\s*;?\n+/, "")
      )
      .join("\n\n");
  }

  private emitRoute(exp: RouteExport, route: Route): string[] {
    const out: string[] = [];

    if (route.requestBody) {
      out.push(
        this.emitTypeDecl(
          exp,
          route.requestBody.type,
          `${capitalize(route.id)}RequestBody`,
        ),
      );
    }

    out.push(...this.emitParameters(exp, route));

    const parts = this.emitParts(exp, route);
    if (parts) out.push(parts);

    for (const response of route.responses) {
      if (response.type === null) continue;
      out.push(
        this.emitTypeDecl(
          exp,
          response.type,
          `${capitalize(route.id)}Response${response.statusCode}`,
        ),
      );
    }

    return out;
  }

  private emitParameters(exp: RouteExport, route: Route): string[] {
    const byLocation = groupParametersByLocation(route);
    const out: string[] = [];
    for (const [location, parameters] of byLocation) {
      const name = `${capitalize(route.id)}${LOCATION_SUFFIX[location]}`;
      const shape = parameters
        .map((parameter) => {
          const expr = this.toZodExpr(exp, parameter.type);
          const value = parameter.required ? expr : `${expr}.optional()`;
          return `  ${JSON.stringify(parameter.name)}: ${value}`;
        })
        .join(",\n");
      out.push(this.emitNamed(name, `z.object({\n${shape}\n})`));
    }
    return out;
  }

  private emitParts(exp: RouteExport, route: Route): string | null {
    if (route.parts.length === 0) return null;

    const shape = route.parts
      .map((part) => {
        const expr = this.toZodExpr(exp, part.type);
        const value = part.required ? expr : `${expr}.optional()`;
        return `  ${JSON.stringify(part.name)}: ${value}`;
      })
      .join(",\n");
    return this.emitNamed(
      `${capitalize(route.id)}Parts`,
      `z.object({\n${shape}\n})`,
    );
  }

  private emitTypeDecl(exp: RouteExport, type: object, name: string): string {
    const defName = refDefName(type);
    if (defName) {
      return `export const z${name} = z${defName};\nexport type ${name} = ${defName};`;
    }
    return this.emitNamed(name, this.toZodExpr(exp, type));
  }

  private emitNamed(name: string, expr: string): string {
    return `export const z${name} = ${expr};\nexport type ${name} = z.infer<typeof z${name}>;`;
  }

  private toZodExpr(exp: RouteExport, type: object): string {
    return jsonSchemaToZod(
      {$schema: exp.version, $defs: exp.schemas, ...type},
      {parserOverride: refInterceptor},
    );
  }
}
