import {expect, test} from "bun:test";
import {mkdtemp, rm} from "node:fs/promises";
import {join} from "node:path";
import {SchemaCodeGenerator} from "../src/gen/schema.codegen.ts";
import {FetchCodeGenerator} from "../src/gen/fetch.codegen.ts";
import type {RouteExport} from "../src/core-types.ts";

const fixture: RouteExport = {
  version: "https://json-schema.org/draft/2020-12/schema",
  routes: [
    {
      id: "xyz",
      annotation: "ItemController#xyz",
      cacheKey: ["xyz"],
      path: ["/items/{id}"],
      method: ["GET", "PUT"],
      invalidates: null,
      parameters: [
        {name: "q", location: "QUERY", type: {type: "string"}, required: true, defaultValue: null},
        {name: "limit", location: "QUERY", type: {type: "number"}, required: false, defaultValue: null},
        {name: "id", location: "PATH", type: {type: "string"}, required: true, defaultValue: null},
        {name: "x-auth", location: "HEADER", type: {type: "string"}, required: false, defaultValue: null},
      ],
      parts: [
        {name: "file", type: {type: "string"}, required: true},
        {name: "caption", type: {type: "string"}, required: false},
      ],
      requestBody: null,
      responses: [
        {statusCode: 200, type: {$ref: "#/$defs/Abc"}, contentTypes: ["application/json"]},
        {statusCode: 204, type: null, contentTypes: []},
        {statusCode: 404, type: null, contentTypes: []},
      ],
    },
    {
      id: "single",
      annotation: "ItemController#single",
      cacheKey: ["single"],
      path: ["/single"],
      method: ["POST"],
      invalidates: null,
      parameters: [],
      parts: [],
      requestBody: {type: {$ref: "#/$defs/Abc"}, required: true, contentTypes: ["application/json"]},
      responses: [{statusCode: 200, type: null, contentTypes: []}],
    },
    {
      id: "optionalBody",
      annotation: "ItemController#optionalBody",
      cacheKey: ["optionalBody"],
      path: ["/optional"],
      method: ["POST"],
      invalidates: null,
      parameters: [],
      parts: [],
      requestBody: {type: {$ref: "#/$defs/Abc"}, required: false, contentTypes: ["application/json"]},
      responses: [{statusCode: 200, type: null, contentTypes: []}],
    },
  ],
  schemas: {
    Abc: {
      type: "object",
      properties: {message: {type: "string", title: "String", minLength: 1}},
      required: ["message"],
      title: "Abc",
    },
  },
};

// Generated files import "zod" and "./schema.gen.ts" as bare/relative specifiers,
// so the output dir must sit inside this project's node_modules resolution chain
// (unlike os.tmpdir(), which resolves to nothing).
async function setupGeneratedDir(): Promise<string> {
  const dir = await mkdtemp(join(import.meta.dir, "..", ".test-tmp-"));
  await Bun.write(join(dir, "routes.json"), JSON.stringify(fixture));

  const schemaGen = new SchemaCodeGenerator(fixture);
  await schemaGen.run();
  await schemaGen.endAndDumpTo(Bun.file(join(dir, "schema.gen.ts")));

  const fetchGen = new FetchCodeGenerator(fixture);
  await fetchGen.run();
  await fetchGen.endAndDumpTo(Bun.file(join(dir, "calls.gen.ts")));

  return dir;
}

test("generateSchemas covers requestBody, parameters, parts, and responses", async () => {
  const dir = await setupGeneratedDir();
  try {
    const code = await Bun.file(join(dir, "schema.gen.ts")).text();

    expect(code).toContain("export const zAbc =");
    expect(code).toContain("export type Abc =");

    expect(code).toContain("export const zSingleRequestBody = zAbc;");
    expect(code).toContain("export type SingleRequestBody = Abc;");

    expect(code).toContain("export const zXyzQueryParams = z.object({");
    expect(code).toContain('"q": z.string()');
    expect(code).toContain('"limit": z.number().optional()');
    expect(code).toContain("export const zXyzPathParams = z.object({");
    expect(code).toContain('"id": z.string()');
    expect(code).toContain("export const zXyzHeaderParams = z.object({");
    expect(code).toContain('"x-auth": z.string().optional()');

    expect(code).toContain("export const zXyzParts = z.object({");
    expect(code).toContain('"file": z.string()');
    expect(code).toContain('"caption": z.string().optional()');

    expect(code).toContain("export const zXyzResponse200 = zAbc;");
    expect(code).toContain("export type XyzResponse200 = Abc;");

    expect(code).not.toContain("Response204");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generateCalls builds a CallParams type + call fn per route", async () => {
  const dir = await setupGeneratedDir();
  try {
    const code = await Bun.file(join(dir, "calls.gen.ts")).text();

    // annotation comment precedes the generated call fn
    expect(code).toContain("// ItemController#xyz\nexport async function xyz(");

    // multi-method route: method required, no default
    expect(code).toContain("export interface XyzCallParams {");
    expect(code).toContain("path: schemas.XyzPathParams;");
    expect(code).toContain("query: schemas.XyzQueryParams;"); // has a required param (q)
    expect(code).toContain("headers?: schemas.XyzHeaderParams;"); // all header params optional
    expect(code).toContain("parts: schemas.XyzParts;"); // has a required part (file)
    expect(code).toMatch(/method: "GET" \| "PUT";/);
    // discriminated union of only the ok (2xx) responses; 404 is an error status, excluded here
    expect(code).toContain(
      "export type XyzResponse = ApiResponse<200, schemas.XyzResponse200> | ApiResponse<204, null>;",
    );
    expect(code).toContain("export type XyzError = ApiResponseError<null>;");
    expect(code).toContain("export async function xyz(params: XyzCallParams): Promise<XyzResponse> {");
    expect(code).toContain("return parseResponse<XyzResponse, null>(res, {");

    // single-method + required body: method optional, but body required -> no default
    expect(code).toContain("export interface SingleCallParams {");
    expect(code).toContain("body: schemas.SingleRequestBody;");
    expect(code).toMatch(/method\?: "POST";/);
    expect(code).toContain("export type SingleResponse = ApiResponse<200, null>;");
    expect(code).toContain("export type SingleError = ApiResponseError<unknown>;");
    expect(code).toContain("export async function single(params: SingleCallParams): Promise<SingleResponse> {");

    // single-method + optional body: every key optional -> params gets a default
    expect(code).toContain("export interface OptionalBodyCallParams {");
    expect(code).toContain("body?: schemas.OptionalBodyRequestBody;");
    expect(code).toContain("export type OptionalBodyResponse = ApiResponse<200, null>;");
    expect(code).toContain(
      "export async function optionalBody(params: OptionalBodyCallParams = {}): Promise<OptionalBodyResponse> {",
    );
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generated call fn builds URL, query, headers, parts, and validates response by status", async () => {
  const dir = await setupGeneratedDir();
  try {
    const calls = await import(join(dir, "calls.gen.ts"));

    const requests: {url: string; init: RequestInit}[] = [];
    calls.config.baseUrl = "http://x";
    calls.config.fetch = async (input: string, init: RequestInit) => {
      requests.push({url: input, init});
      return new Response(JSON.stringify({message: "hi"}), {
        status: 200,
        headers: {"content-type": "application/json"},
      });
    };

    const result = await calls.xyz({
      path: {id: "abc123"},
      query: {q: "search", limit: 5},
      headers: {"x-auth": "token"},
      parts: {file: "data", caption: "a caption"},
      method: "PUT",
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({message: "hi"});
    expect(result.headers).toBeInstanceOf(Headers);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("http://x/items/abc123?q=search&limit=5");
    expect(requests[0]!.init.method).toBe("PUT");
    expect((requests[0]!.init.headers as Record<string, string>)["x-auth"]).toBe("token");
    const sentParts = requests[0]!.init.body as FormData;
    expect(sentParts.get("file")).toBe("data");
    expect(sentParts.get("caption")).toBe("a caption");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generated call fn resolves data to null for null-typed responses without reading the body", async () => {
  const dir = await setupGeneratedDir();
  try {
    const calls = await import(join(dir, "calls.gen.ts"));

    calls.config.baseUrl = "http://x";
    calls.config.fetch = async () => new Response(null, {status: 204});

    const result = await calls.xyz({
      path: {id: "abc123"},
      query: {q: "search"},
      method: "GET",
    });

    expect(result.status).toBe(204);
    expect(result.data).toBeNull();
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generated call fn throws ApiResponseError on an unlisted response status", async () => {
  const dir = await setupGeneratedDir();
  try {
    const calls = await import(join(dir, "calls.gen.ts"));

    calls.config.baseUrl = "http://x";
    calls.config.fetch = async () => new Response(null, {status: 500});

    let caught: unknown;
    try {
      await calls.xyz({path: {id: "abc123"}, query: {q: "search"}, method: "GET"});
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(calls.ApiResponseError);
    expect((caught as InstanceType<typeof calls.ApiResponseError>).status).toBe(500);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generated call fn throws ApiResponseError with typed data for a declared non-ok status", async () => {
  const dir = await setupGeneratedDir();
  try {
    const calls = await import(join(dir, "calls.gen.ts"));

    calls.config.baseUrl = "http://x";
    calls.config.fetch = async () => new Response(null, {status: 404});

    let caught: unknown;
    try {
      await calls.xyz({path: {id: "abc123"}, query: {q: "search"}, method: "GET"});
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(calls.ApiResponseError);
    const apiErr = caught as InstanceType<typeof calls.ApiResponseError>;
    expect(apiErr.status).toBe(404);
    expect(apiErr.data).toBeNull();
    expect(apiErr.headers).toBeInstanceOf(Headers);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
