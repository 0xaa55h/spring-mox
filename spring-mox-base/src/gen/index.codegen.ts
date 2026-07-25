import { CodeGenerator } from "./core.ts";

export class IndexCodeGenerator extends CodeGenerator<string[]> {
  async emit(): Promise<void> {
    this.writeLines(
      this.data.map((moduleName) => `export * from "${moduleName}";`),
    );
  }

  finalize(): Promise<void> {
    return Promise.resolve(undefined);
  }

  prepare(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
