import type {Parameter, ParameterLocation, Route} from "../core-types.ts";

export const LOCATION_SUFFIX: Record<ParameterLocation, string> = {
  QUERY: "QueryParams",
  HEADER: "HeaderParams",
  PATH: "PathParams",
};

export function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function groupParametersByLocation(route: Route): Map<ParameterLocation, Parameter[]> {
  const byLocation = new Map<ParameterLocation, Parameter[]>();
  for (const parameter of route.parameters) {
    const bucket = byLocation.get(parameter.location) ?? [];
    bucket.push(parameter);
    byLocation.set(parameter.location, bucket);
  }
  return byLocation;
}

export abstract class CodeGenerator<TData> {
  public constructor(protected readonly data: TData, private writable: Bun.ArrayBufferSink = new Bun.ArrayBufferSink()) {}

  abstract prepare(): Promise<void>;
  abstract emit(): Promise<void>;
  abstract finalize(): Promise<void>;

  async run(): Promise<void> {
    await this.prepare();
    await this.emit();
    await this.finalize();
  }

  writeLine(line: string) {
    return this.writable.write(`${line}\n`);
  }
  writeLines(lines: string[]) {
    return lines.map(it => this.writable.write(`${it}\n`))
  }
  write(line: string) {
    return this.writable.write(line);
  }
  end() {
    return this.writable.end();
  }
  async endAndDumpTo(file: Bun.BunFile) {
    await file.write(this.end());
  }
}