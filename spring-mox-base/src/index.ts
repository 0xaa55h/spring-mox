import * as path from "node:path";
import type { RouteExport } from "./core-types.ts";
import { FetchCodeGenerator } from "./gen/fetch.codegen.ts";
import { IndexCodeGenerator } from "./gen/index.codegen.ts";
import { SchemaCodeGenerator } from "./gen/schema.codegen.ts";
import { TanStackCodeGenerator } from "./gen/tanstack.codegen.ts";

export type { HttpMethod } from "./core-types.ts";
export {
  type ApiClient,
  type ApiResponse,
  ApiResponseError,
  createApiClient,
  type ErrorUnion,
  type FetchFn,
  type RouteCall,
  type RouteConfig,
  type RouteParams,
  type SuccessUnion,
} from "./runtime.ts";
export {
  FetchCodeGenerator,
  type RouteExport,
  SchemaCodeGenerator,
  TanStackCodeGenerator,
};

const generators = {
  "schema.gen.ts": SchemaCodeGenerator,
  "fetch.gen.ts": FetchCodeGenerator,
  "tanstack.gen.ts": TanStackCodeGenerator,
};

/**
 * Generate TypeScript route files
 * @param schema Path to the `routes.json` file
 * @param out Directory to which generate the files to
 * @param enabled Specify the enabled generators (all by default)
 * @param writeIndex Whether to create index file which reexports everything from the generated file (is generated in the same directory as out parameter specifies)
 */
export async function generate(
  schema: Bun.BunFile,
  out: Bun.BunFile,
  enabled: (keyof typeof generators)[] = [
    "schema.gen.ts",
    "fetch.gen.ts",
    "tanstack.gen.ts",
  ],
  writeIndex: boolean = true,
) {
  const sch = (await schema.json()) as RouteExport;
  const enabledGenerators = Object.entries(generators).filter(([name]) =>
    enabled.includes(name as keyof typeof generators),
  );

  for (const [name, generator] of enabledGenerators) {
    const gen = new generator(sch);
    await gen.run();
    await gen.endAndDumpTo(Bun.file(path.resolve(out.name || ".", name)));
  }

  if (writeIndex) {
    const index = new IndexCodeGenerator(
      enabledGenerators.map(([k]) => k).map((name) => `./${name}`),
    );
    await index.run();
    await index.endAndDumpTo(
      Bun.file(path.resolve(out.name || ".", "index.ts")),
    );
  }
}
