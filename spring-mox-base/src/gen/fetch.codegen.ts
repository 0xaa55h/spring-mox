import type {ParameterLocation, Route, RouteExport} from "../core-types.ts";
import {capitalize, CodeGenerator, groupParametersByLocation, LOCATION_SUFFIX} from "./core.ts";

const LOCATION_CALL_KEY: Record<ParameterLocation, string> = {
  QUERY: "query",
  HEADER: "headers",
  PATH: "path",
};

const PATH_PLACEHOLDER = /\{([^}:]+)(?::[^}]*)?}/g;

export class FetchCodeGenerator extends CodeGenerator<RouteExport> {
  constructor(data: RouteExport) {
    super(data);
  }

  override async prepare(): Promise<void> {
    this.writeLines([
      `import * as schemas from "./schema.gen.ts";`,
      ``,
      `type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;`,
      ``,
      `export const config: { baseUrl: string; fetch: FetchFn } = {`,
      `  baseUrl: "",`,
      `  fetch: (input, init) => globalThis.fetch(input, init),`,
      `};`,
      ``,
      `export interface ApiResponse<S extends number, T> {`,
      `  status: S;`,
      `  data: T;`,
      `  headers: Headers;`,
      `}`,
      ``,
      `export class ApiResponseError<T = unknown> extends Error {`,
      `  constructor(readonly status: number, readonly data: T, readonly headers: Headers) {`,
      `    super(\`Request failed with status \${status}\`);`,
      `    this.name = "ApiResponseError";`,
      `  }`,
      `}`,
      ``,
      `async function readBody(res: Response): Promise<unknown> {`,
      `  return res.headers.get("content-type")?.includes("json") ? res.json() : res.text();`,
      `}`,
      ``,
      `async function parseResponse<TResponse extends ApiResponse<number, unknown>, TErrorData = unknown>(`,
      `  res: Response,`,
      `  parsers: Record<number, ((data: unknown) => unknown) | null>,`,
      `): Promise<TResponse> {`,
      `  const parser = parsers[res.status];`,
      `  if (parser === undefined) {`,
      `    throw new ApiResponseError<TErrorData>(res.status, (await readBody(res)) as TErrorData, res.headers);`,
      `  }`,
      `  const data = parser === null ? null : parser(await readBody(res));`,
      `  if (!res.ok) throw new ApiResponseError<TErrorData>(res.status, data as TErrorData, res.headers);`,
      `  return {status: res.status, data, headers: res.headers} as TResponse;`,
      `}`,
      ``,
      `function queryString(query: Record<string, unknown> | undefined): string {`,
      `  if (!query) return "";`,
      `  const search = new URLSearchParams();`,
      `  for (const [key, value] of Object.entries(query)) {`,
      `    if (value !== undefined) search.set(key, String(value));`,
      `  }`,
      `  const s = search.toString();`,
      `  return s ? \`?\${s}\` : "";`,
      `}`,
      ``,
    ]);
  }

  override async emit(): Promise<void> {
    for (const route of this.data.routes) {
      for (const section of this.emitCall(route)) {
        this.writeLine(section);
        this.writeLine("");
      }
    }
  }

  override async finalize(): Promise<void> {}

  private emitCall(route: Route): string[] {
    const primaryPath = route.path[0];
    if (primaryPath === undefined) {
      throw new Error(`Route ${route.id} has no path`);
    }
    const name = capitalize(route.id);
    const byLocation = groupParametersByLocation(route);
    const methods = [...route.method];
    const methodType = methods.map((m) => JSON.stringify(m)).join(" | ");

    type Field = {key: string; typeName: string; required: boolean};
    const fields: Field[] = [];
    for (const location of ["PATH", "QUERY", "HEADER"] as ParameterLocation[]) {
      const parameters = byLocation.get(location);
      if (!parameters || parameters.length === 0) continue;
      fields.push({
        key: LOCATION_CALL_KEY[location],
        typeName: `schemas.${name}${LOCATION_SUFFIX[location]}`,
        required: location === "PATH" || parameters.some((p) => p.required),
      });
    }
    if (route.requestBody) {
      fields.push({
        key: "body",
        typeName: `schemas.${name}RequestBody`,
        required: route.requestBody.required,
      });
    }
    if (route.parts.length > 0) {
      fields.push({
        key: "parts",
        typeName: `schemas.${name}Parts`,
        required: route.parts.some((p) => p.required),
      });
    }
    const methodRequired = methods.length > 1;
    fields.push({key: "method", typeName: methodType, required: methodRequired});

    const paramsTypeName = `${name}CallParams`;
    const typeDecl = [
      `export interface ${paramsTypeName} {`,
      ...fields.map((f) => `  ${f.key}${f.required ? "" : "?"}: ${f.typeName};`),
      `}`,
    ].join("\n");

    const allOptional = fields.every((f) => !f.required);
    const responsesByStatus = new Map(route.responses.map((r) => [r.statusCode, r]));

    type ResponseEntry = {statusCode: number; dataType: string};
    const successEntries: ResponseEntry[] = [];
    const errorEntries: ResponseEntry[] = [];
    const parserEntries: string[] = [];
    for (const [statusCode, response] of responsesByStatus) {
      const dataType = response.type === null ? "null" : `schemas.${name}Response${statusCode}`;
      parserEntries.push(
        response.type === null
          ? `  ${statusCode}: null`
          : `  ${statusCode}: (d) => schemas.z${name}Response${statusCode}.parse(d) as ${dataType}`,
      );
      const isOk = statusCode >= 200 && statusCode < 300;
      (isOk ? successEntries : errorEntries).push({statusCode, dataType});
    }

    const responseType = successEntries.length > 0
      ? successEntries.map((e) => `ApiResponse<${e.statusCode}, ${e.dataType}>`).join(" | ")
      : "ApiResponse<number, null>";
    const errorDataType = errorEntries.length > 0
      ? [...new Set(errorEntries.map((e) => e.dataType))].join(" | ")
      : "unknown";

    const responseTypeName = `${name}Response`;
    const errorTypeName = `${name}Error`;
    const responseTypeDecl = [
      `export type ${responseTypeName} = ${responseType};`,
      `export type ${errorTypeName} = ApiResponseError<${errorDataType}>;`,
    ].join("\n");

    const body: string[] = [];
    const hasPath = fields.some((f) => f.key === "path");
    const hasQuery = fields.some((f) => f.key === "query");
    const hasHeaders = fields.some((f) => f.key === "headers");
    const hasBody = fields.some((f) => f.key === "body");
    const hasParts = fields.some((f) => f.key === "parts");

    if (hasPath) body.push(`  const path = schemas.z${name}PathParams.parse(params.path);`);
    if (hasQuery) {
      body.push(
        `  const query = params.query !== undefined ? schemas.z${name}QueryParams.parse(params.query) : undefined;`,
      );
    }
    if (hasHeaders) {
      body.push(
        `  const headers = params.headers !== undefined ? schemas.z${name}HeaderParams.parse(params.headers) : undefined;`,
      );
    }
    if (hasBody) {
      body.push(
        `  const body = params.body !== undefined ? schemas.z${name}RequestBody.parse(params.body) : undefined;`,
      );
    }
    if (hasParts) {
      body.push(
        `  const parts = params.parts !== undefined ? schemas.z${name}Parts.parse(params.parts) : undefined;`,
      );
    }

    body.push(`  const url = config.baseUrl + ${this.buildPathTemplate(primaryPath, hasPath)}${hasQuery ? " + queryString(query)" : ""};`);

    body.push(`  const requestHeaders: Record<string, string> = {};`);
    if (hasHeaders) {
      for (const parameter of byLocation.get("HEADER") ?? []) {
        const key = JSON.stringify(parameter.name);
        body.push(
          `  if (headers?.[${key}] !== undefined) requestHeaders[${key}] = String(headers![${key}]);`,
        );
      }
    }

    body.push(`  let requestBody: RequestInit["body"];`);
    if (hasBody) {
      const contentType = route.requestBody?.contentTypes[0] ?? "application/json";
      body.push(`  if (body !== undefined) {`);
      body.push(`    requestHeaders["content-type"] = ${JSON.stringify(contentType)};`);
      body.push(`    requestBody = JSON.stringify(body);`);
      body.push(`  }`);
    }
    if (hasParts) {
      body.push(`  ${hasBody ? "else " : ""}if (parts !== undefined) {`);
      body.push(`    const formData = new FormData();`);
      for (const part of route.parts) {
        const key = JSON.stringify(part.name);
        body.push(
          `    if (parts[${key}] !== undefined) formData.append(${key}, typeof parts[${key}] === "string" ? parts[${key}] as string : JSON.stringify(parts[${key}]));`,
        );
      }
      body.push(`    requestBody = formData;`);
      body.push(`  }`);
    }

    const methodExpr = methodRequired ? `params.method` : JSON.stringify(methods[0]);
    body.push(`  const method = ${methodExpr};`);
    body.push(`  const res = await config.fetch(url, {method, headers: requestHeaders, body: requestBody});`);
    body.push(`  return parseResponse<${responseTypeName}, ${errorDataType}>(res, {\n${parserEntries.join(",\n")}\n  });`);

    const fnDecl = [
      `// ${route.annotation}`,
      `export async function ${route.id}(params: ${paramsTypeName}${allOptional ? " = {}" : ""}): Promise<${responseTypeName}> {`,
      ...body,
      `}`,
    ].join("\n");

    return [typeDecl, responseTypeDecl, fnDecl];
  }

  private buildPathTemplate(pattern: string, hasPath: boolean): string {
    let out = "";
    let lastIndex = 0;
    PATH_PLACEHOLDER.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PATH_PLACEHOLDER.exec(pattern))) {
      out += this.escapeTemplateLiteral(pattern.slice(lastIndex, match.index));
      const paramName = match[1];
      out += hasPath
        ? "${encodeURIComponent(String(path[" + JSON.stringify(paramName) + "]))}"
        : "";
      lastIndex = PATH_PLACEHOLDER.lastIndex;
    }
    out += this.escapeTemplateLiteral(pattern.slice(lastIndex));
    return "`" + out + "`";
  }

  private escapeTemplateLiteral(text: string): string {
    return text.replace(/[`\\]/g, "\\$&").replace(/\$\{/g, "\\${");
  }
}
