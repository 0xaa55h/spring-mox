import type {RouteExport} from "./core-types.ts";
import {SchemaCodeGenerator} from "./gen/schema.codegen.ts";
import {FetchCodeGenerator} from "./gen/fetch.codegen.ts";
import {TanStackCodeGenerator} from "./gen/tanstack.codegen.ts";
import * as path from "node:path";
import {IndexCodeGenerator} from "./gen/index.codegen.ts";

export { SchemaCodeGenerator, FetchCodeGenerator, TanStackCodeGenerator, type RouteExport };

export async function generate(schema: Bun.BunFile, out: Bun.BunFile, writeIndex: boolean = true) {
  const sch = (await schema.json()) as RouteExport;
  const generators = {
    "schema.gen.ts": SchemaCodeGenerator,
    "fetch.gen.ts": FetchCodeGenerator,
    "tanstack.gen.ts": TanStackCodeGenerator,
  };

  for (const [name, generator] of Object.entries(generators)) {
    const gen = new generator(sch);
    await gen.run();
    await gen.endAndDumpTo(Bun.file(path.resolve(out.name || ".", name)))
  }

  if (writeIndex) {
    const index = new IndexCodeGenerator(Object.keys(generators).map(name => `./${name}`));
    await index.run();
    await index.endAndDumpTo(Bun.file(path.resolve(out.name || ".", "index.ts")));
  }
}

await generate(Bun.file("../routes.json"), Bun.file("./generated"));