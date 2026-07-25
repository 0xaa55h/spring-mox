import { generate, type generators } from "@spring-mox/base";
import type { Plugin } from "vite";

export interface SpringMoxPluginConfig {
  input: Bun.BunFile;
  output: Bun.BunFile;
  writeIndex?: boolean;
  enabled?: (keyof typeof generators)[];
}

export default function springMox({
  writeIndex = true,
  enabled = ["schema.gen.ts", "fetch.gen.ts", "tanstack.gen.ts"],
  input,
  output,
}: SpringMoxPluginConfig): Plugin {
  return {
    name: "vite-plugin-react-spring-mox",
    configResolved: async () => {
      await generate(input, output, enabled, writeIndex);
    },
  };
}

springMox({
  input: Bun.file(""),
  output: Bun.file(""),
});
