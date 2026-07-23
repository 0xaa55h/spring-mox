import type {ParameterLocation, Route, RouteExport} from "../core-types.ts";
import {capitalize, CodeGenerator, groupParametersByLocation} from "./core.ts";

export class TanStackCodeGenerator extends CodeGenerator<RouteExport> {
  constructor(data: RouteExport) {
    super(data);
  }

  override async prepare(): Promise<void> {
    this.writeLines([
      `import {`,
      `  mutationOptions,`,
      `  queryOptions,`,
      `  useMutation,`,
      `  useQuery,`,
      `  type UseMutationOptions,`,
      `  type UseQueryOptions,`,
      `} from "@tanstack/react-query";`,
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
    const paramsTypeName = `${name}CallParams`;
    const allOptional = this.computeAllOptional(route);
    const returnType = `calls.${name}Response`;
    const errorType = `calls.${name}Error`;
    const paramsArg = `params: calls.${paramsTypeName}${allOptional ? " = {}" : ""}`;

    const optionsFn = [
      `// ${route.annotation}`,
      `export function ${route.id}QueryOptions(${paramsArg}, options?: Partial<UseQueryOptions<${returnType}, ${errorType}>>) {`,
      `  return queryOptions({`,
      `    queryKey: [...${JSON.stringify(route.cacheKey)}, params],`,
      `    queryFn: () => calls.${route.id}(params),`,
      `    ...options,`,
      `  });`,
      `}`,
    ].join("\n");

    const hookFn = [
      `export function use${name}(${paramsArg}, options?: Partial<UseQueryOptions<${returnType}, ${errorType}>>) {`,
      `  return useQuery(${route.id}QueryOptions(params, options));`,
      `}`,
    ].join("\n");

    return [optionsFn, hookFn];
  }

  private emitMutationBindings(route: Route): string[] {
    const name = capitalize(route.id);
    const paramsTypeName = `${name}CallParams`;
    const returnType = `calls.${name}Response`;
    const errorType = `calls.${name}Error`;
    const invalidates = route.invalidates ?? [];

    const mutationOptionsType = `UseMutationOptions<${returnType}, ${errorType}, calls.${paramsTypeName}>`;

    const optionsFn = [
      `// ${route.annotation}`,
      `export function ${route.id}MutationOptions(options?: Partial<${mutationOptionsType}>): ${mutationOptionsType} {`,
      `  return mutationOptions({`,
      `    mutationFn: (params: calls.${paramsTypeName}) => calls.${route.id}(params),`,
      `    ...options,`,
      `  });`,
      `}`,
    ].join("\n");

    const hookFn = [
      `export function use${name}Mutation(options?: Partial<${mutationOptionsType}>) {`,
      ...(invalidates.length > 0 ? [`  const queryClient = useQueryClient();`] : []),
      `  return useMutation(${route.id}MutationOptions({`,
      ...(invalidates.length > 0
        ? [
          `    onSuccess: () => {`,
          ...invalidates.map((key) => `      queryClient.invalidateQueries({ queryKey: [${JSON.stringify(key)}] });`),
          `    },`,
        ]
        : []),
      `    ...options,`,
      `  }));`,
      `}`,
    ].join("\n");

    return [optionsFn, hookFn];
  }

  private computeAllOptional(route: Route): boolean {
    const byLocation = groupParametersByLocation(route);
    for (const location of ["PATH", "QUERY", "HEADER"] as ParameterLocation[]) {
      const parameters = byLocation.get(location);
      if (!parameters || parameters.length === 0) continue;
      if (location === "PATH" || parameters.some((p) => p.required)) return false;
    }
    if (route.requestBody?.required) return false;
    if (route.parts.some((p) => p.required)) return false;
    return route.method.length <= 1;
  }
}
