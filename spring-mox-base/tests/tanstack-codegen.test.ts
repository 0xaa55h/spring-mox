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
  await fetchGen.endAndDumpTo(Bun.file(join(dir, "fetch.gen.ts")));

  const tanstackGen = new TanStackCodeGenerator(fixture);
  await tanstackGen.run();
  await tanstackGen.endAndDumpTo(Bun.file(join(dir, "tanstack.gen.ts")));

  const code = await Bun.file(join(dir, "tanstack.gen.ts")).text();
  return {dir, code};
}

test("GET-only route generates a query hook delegating to calls.<id>.queryOptions", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#xyz\nexport function useXyz(\n  params: Parameters<typeof calls.xyz.queryOptions>[0],\n  options?: Parameters<typeof calls.xyz.queryOptions>[1],\n) {",
    );
    expect(code).toContain("return useQuery(calls.xyz.queryOptions(params, options));");

    expect(code).not.toContain("useXyzMutation");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("mutation route with invalidates emits a mutation hook with onSuccess invalidation", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#single\nexport function useSingleMutation(\n  options?: Parameters<typeof calls.single.mutationOptions>[0],\n) {",
    );
    expect(code).toContain("const queryClient = useQueryClient();");
    expect(code).toContain("return useMutation(calls.single.mutationOptions({");
    expect(code).toContain("onSuccess: () => {");
    expect(code).toContain('queryClient.invalidateQueries({queryKey: ["xyzList"]});');
    expect(code).toContain("...options,\n  }));");

    expect(code).not.toContain("useSingle(");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("mutation route without invalidates omits onSuccess entirely", async () => {
  const {dir, code} = await setupGeneratedDir();
  try {
    expect(code).toContain(
      "// ItemController#optionalBody\nexport function useOptionalBodyMutation(\n  options?: Parameters<typeof calls.optionalBody.mutationOptions>[0],\n) {",
    );

    const fnStart = code.indexOf("export function useOptionalBodyMutation");
    const fnEnd = code.indexOf("\n}", fnStart);
    const fnBody = code.slice(fnStart, fnEnd);
    expect(fnBody).not.toContain("onSuccess");
    expect(fnBody).not.toContain("queryClient.invalidateQueries");
    expect(fnBody).not.toContain("useQueryClient");
    expect(fnBody).toContain("return useMutation(calls.optionalBody.mutationOptions({");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test("generated hooks are fully wired against a live fetch.gen.ts + schema.gen.ts", async () => {
  const {dir} = await setupGeneratedDir();
  try {
    const calls = await import(join(dir, "fetch.gen.ts"));
    calls.client.baseUrl = "http://x";
    calls.client.fetch = async () =>
      new Response(JSON.stringify({message: "hi"}), {status: 200, headers: {"content-type": "application/json"}});

    const queryOpts = calls.xyz.queryOptions({path: {id: "1"}});
    expect(queryOpts.queryKey).toEqual(["xyzList", {path: {id: "1"}}]);
    const result = await queryOpts.queryFn();
    expect(result.data).toEqual({message: "hi"});

    const mutationOpts = calls.single.mutationOptions();
    expect(typeof mutationOpts.mutationFn).toBe("function");
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
