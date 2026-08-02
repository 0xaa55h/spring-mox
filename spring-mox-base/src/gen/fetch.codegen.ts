import type { ParameterLocation, Route, RouteExport } from "../core-types.ts";
import {
  CodeGenerator,
  capitalize,
  groupParametersByLocation,
  LOCATION_SUFFIX,
} from "./core.ts";

const LOCATION_CONFIG_KEY: Record<ParameterLocation, string> = {
  QUERY: "queryParams",
  HEADER: "headers",
  PATH: "pathParams",
};

export class FetchCodeGenerator extends CodeGenerator<RouteExport> {

  override async prepare(): Promise<void> {
    this.writeLines([
      `import {createApiClient} from "@spring-mox/base";`,
      `import * as schemas from "./schema.gen.ts";`,
      ``,
      `export const client = createApiClient({baseUrl: ""});`,
      ``,
    ]);
  }

  override async emit(): Promise<void> {
    for (const route of this.data.routes) {
      this.writeLine(this.emitRoute(route));
      this.writeLine("");
    }
  }

  override async finalize(): Promise<void> {}

  private emitRoute(route: Route): string {
    const primaryPath = route.path[0];
    if (primaryPath === undefined) {
      throw new Error(`Route ${route.id} has no path`);
    }
    const name = capitalize(route.id);
    const byLocation = groupParametersByLocation(route);

    const configFields: string[] = [];
    configFields.push(`  method: ${JSON.stringify(route.method)},`);
    configFields.push(`  path: ${JSON.stringify(primaryPath)},`);

    for (const location of ["PATH", "QUERY", "HEADER"] as ParameterLocation[]) {
      const parameters = byLocation.get(location);
      if (!parameters || parameters.length === 0) continue;
      const required =
        location === "PATH" || parameters.some((p) => p.required);
      const schemaExpr = `schemas.z${name}${LOCATION_SUFFIX[location]}`;
      configFields.push(
        `  ${LOCATION_CONFIG_KEY[location]}: ${schemaExpr}${required ? "" : ".optional()"},`,
      );
    }

    if (route.requestBody) {
      const schemaExpr = `schemas.z${name}RequestBody`;
      configFields.push(
        `  body: ${schemaExpr}${route.requestBody.required ? "" : ".optional()"},`,
      );
    }

    if (route.parts.length > 0) {
      const required = route.parts.some((p) => p.required);
      const schemaExpr = `schemas.z${name}Parts`;
      configFields.push(
        `  parts: ${schemaExpr}${required ? "" : ".optional()"},`,
      );
    }

    const responseEntries = route.responses
      .map(
        (r) =>
          `    ${r.statusCode}: ${r.type === null ? "null" : `schemas.z${name}Response${r.statusCode}`},`,
      )
      .join("\n");
    configFields.push(`  responses: {\n${responseEntries}\n  },`);
    configFields.push(`  cacheKey: ${JSON.stringify(route.cacheKey)},`);
    configFields.push(`  invalidates: ${JSON.stringify(route.invalidates)},`);

    return [
      `// ${route.annotation}`,
      `export const ${route.id} = client.defineRoute({`,
      ...configFields,
      `});`,
    ].join("\n");
  }
}
