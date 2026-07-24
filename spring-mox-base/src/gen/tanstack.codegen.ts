import type {Route, RouteExport} from "../core-types.ts";
import {capitalize, CodeGenerator} from "./core.ts";

export class TanStackCodeGenerator extends CodeGenerator<RouteExport> {
  constructor(data: RouteExport) {
    super(data);
  }

  override async prepare(): Promise<void> {
    this.writeLines([
      `import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";`,
      `import * as calls from "./fetch.gen.ts";`,
      ``,
    ]);
  }

  override async emit(): Promise<void> {
    for (const route of this.data.routes) {
      for (const section of this.emitBindings(route)) {
        this.writeLine(section);
        this.writeLine("");
      }
    }
  }

  override async finalize(): Promise<void> {}

  private emitBindings(route: Route): string[] {
    const isQuery = route.method.length === 1 && route.method[0] === "GET";
    return isQuery ? this.emitQueryBindings(route) : this.emitMutationBindings(route);
  }

  private emitQueryBindings(route: Route): string[] {
    const name = capitalize(route.id);

    return [
      [
        `// ${route.annotation}`,
        `export function use${name}(`,
        `  params: Parameters<typeof calls.${route.id}.queryOptions>[0],`,
        `  options?: Parameters<typeof calls.${route.id}.queryOptions>[1],`,
        `) {`,
        `  return useQuery(calls.${route.id}.queryOptions(params, options));`,
        `}`,
      ].join("\n"),
    ];
  }

  private emitMutationBindings(route: Route): string[] {
    const name = capitalize(route.id);
    const invalidates = route.invalidates ?? [];

    return [
      [
        `// ${route.annotation}`,
        `export function use${name}Mutation(`,
        `  options?: Parameters<typeof calls.${route.id}.mutationOptions>[0],`,
        `) {`,
        ...(invalidates.length > 0 ? [`  const queryClient = useQueryClient();`] : []),
        `  return useMutation(calls.${route.id}.mutationOptions({`,
        ...(invalidates.length > 0
          ? [
            `    onSuccess: () => {`,
            ...invalidates.map((key) => `      queryClient.invalidateQueries({queryKey: [${JSON.stringify(key)}]});`),
            `    },`,
          ]
          : []),
        `    ...options,`,
        `  }));`,
        `}`,
      ].join("\n"),
    ];
  }
}
