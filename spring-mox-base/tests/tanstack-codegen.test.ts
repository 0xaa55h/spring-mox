import {expect, test} from "bun:test";
import {mkdtemp, rm} from "node:fs/promises";
import {join} from "node:path";
import {SchemaCodeGenerator} from "../src/gen/schema.codegen.ts";
import {FetchCodeGenerator} from "../src/gen/fetch.codegen.ts";
import {TanStackCodeGenerator} from "../src/gen/tanstack.codegen.ts";
import type {RouteExport} from "../src/core-types.ts";

const fixture: RouteExport = {
  version: "https://json-schema.org/draft/2020-12/schema",
  routes: [
    {
      id: "xyz",
      annotation: "ItemController#xyz",
      cacheKey: ["xyzList"],
      path: ["/items/{id}"],
      method: ["GET"],
      invalidates: null,
      parameters: [
        {name: "id", location: "PATH", type: {type: "string"}, required: true, defaultValue: null},
        {name: "q", location: "QUERY", type: {type: "string"}, required: false, defaultValue: null},
      ],
      parts: [],
      requestBody: null,
      responses: [
        {statusCode: 200, type: {$ref: "#/$defs/Abc"}, contentTypes: ["application/json"]},
      ],
    },
    {
      id: "single",
      annotation: "ItemController#single",
      cacheKey: ["single"],
      path: ["/single"],
      method: ["POST"],
      invalidates: ["xyzList"],
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

async function setupGeneratedDir(): Promise<{dir: string; code: string}> {
  const dir = await mkdtemp(join(import.meta.dir, "..", ".test-tmp-"));

  const schemaGen = new SchemaCodeGenerator(fixture);
  await schemaGen.run();
  await schemaGen.endAndDumpTo(Bun.file(join(dir, "schema.gen.ts")));

  const fetchGen = new FetchCodeGenerator(fixture);
  await fetchGen.run();
  await fetchGen.endAndDumpTo(Bun.file(join(dir, "calls.gen.ts")));

  const tanstackGen = new TanStackCodeGenerator(fixture);
  await tanstackGen.run();
  await tanstackGen.endAndDumpTo(Bun.file(join(dir, "tanstack.gen.ts")));

  const code = await Bun.file(join(dir, "tanstack.gen.ts")).text();
  return {dir, code};
}

test("GET-only route generates queryOptions + query hook", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#xyz\nexport function xyzQueryOptions(params: calls.XyzCallParams, options?: Partial<UseQueryOptions<calls.XyzResponse, calls.XyzError>>) {",
    );
    expect(code).toContain("return queryOptions({");
    expect(code).toContain('queryKey: [...["xyzList"], params],');
    expect(code).toContain("queryFn: () => calls.xyz(params),");
    expect(code).toContain("...options,\n  });");

    expect(code).toContain(
      "export function useXyz(params: calls.XyzCallParams, options?: Partial<UseQueryOptions<calls.XyzResponse, calls.XyzError>>) {",
    );
    expect(code).toContain("return useQuery(xyzQueryOptions(params, options));");

    expect(code).not.toContain("xyzMutationOptions");
    expect(code).not.toContain("useXyzMutation");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("mutation route with invalidates emits mutationOptions + invalidateQueries on success", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#single\nexport function singleMutationOptions(options?: Partial<UseMutationOptions<calls.SingleResponse, calls.SingleError, calls.SingleCallParams>>): UseMutationOptions<calls.SingleResponse, calls.SingleError, calls.SingleCallParams> {",
    );
    expect(code).toContain("mutationFn: (params: calls.SingleCallParams) => calls.single(params),");

    expect(code).toContain(
      "export function useSingleMutation(options?: Partial<UseMutationOptions<calls.SingleResponse, calls.SingleError, calls.SingleCallParams>>) {",
    );
    expect(code).toContain("const queryClient = useQueryClient();");
    expect(code).toContain("return useMutation(singleMutationOptions({");
    expect(code).toContain("onSuccess: () => {");
    expect(code).toContain('queryClient.invalidateQueries({ queryKey: ["xyzList"] });');
    expect(code).toContain("...options,\n  }));");

    expect(code).not.toContain("singleQueryOptions");
    expect(code).not.toContain("useSingle(");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("mutation route without invalidates omits onSuccess entirely", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#optionalBody\nexport function optionalBodyMutationOptions(options?: Partial<UseMutationOptions<calls.OptionalBodyResponse, calls.OptionalBodyError, calls.OptionalBodyCallParams>>): UseMutationOptions<calls.OptionalBodyResponse, calls.OptionalBodyError, calls.OptionalBodyCallParams> {",
    );
    expect(code).toContain("mutationFn: (params: calls.OptionalBodyCallParams) => calls.optionalBody(params),");

    const fnStart = code.indexOf("export function useOptionalBodyMutation");
    const fnEnd = code.indexOf("\n}", fnStart);
    const fnBody = code.slice(fnStart, fnEnd);
    expect(fnBody).not.toContain("onSuccess");
    expect(fnBody).not.toContain("queryClient.invalidateQueries");
    expect(fnBody).not.toContain("useQueryClient");
    expect(fnBody).toContain("return useMutation(optionalBodyMutationOptions({");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
