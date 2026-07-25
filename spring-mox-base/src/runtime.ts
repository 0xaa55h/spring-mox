import {
  mutationOptions,
  type QueryKey,
  queryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { z } from "zod";
import type { HttpMethod } from "./core-types.ts";

export type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const PATH_PLACEHOLDER = /\{([^}]+)}/g;

export interface ApiResponse<S extends number, T> {
  status: S;
  data: T;
  headers: Headers;
  ok: true;
}

export class ApiResponseError<T = unknown> extends Error {
  constructor(
    readonly status: number,
    readonly data: T,
    readonly headers: Headers,
  ) {
    super(`Request failed with status ${status}`);
    this.name = "ApiResponseError";
  }
}

// === Type-level helpers ===

type Is2xx<K extends number> = `${K}` extends `2${string}` ? true : false;

type ResponsesMap = Record<number, z.ZodTypeAny | null>;

type SchemaData<T extends z.ZodTypeAny | null> = T extends z.ZodTypeAny
  ? z.infer<T>
  : null;

export type SuccessUnion<TResponses extends ResponsesMap> = {
  [K in keyof TResponses]: K extends number
    ? Is2xx<K> extends true
      ? ApiResponse<K, SchemaData<TResponses[K]>>
      : never
    : never;
}[keyof TResponses];

type ErrorDataUnion<TResponses extends ResponsesMap> = {
  [K in keyof TResponses]: K extends number
    ? Is2xx<K> extends true
      ? never
      : SchemaData<TResponses[K]>
    : never;
}[keyof TResponses];

export type ErrorUnion<TResponses extends ResponsesMap> = [
  ErrorDataUnion<TResponses>,
] extends [never]
  ? unknown
  : ErrorDataUnion<TResponses>;

type OptionalField<K extends string, T> = undefined extends T
  ? { [P in K]?: T }
  : { [P in K]: T };

type SchemaField<
  K extends string,
  TSchema extends z.ZodTypeAny | undefined,
> = TSchema extends z.ZodTypeAny ? OptionalField<K, z.infer<TSchema>> : {};

type MethodField<TMethods extends readonly HttpMethod[]> =
  TMethods["length"] extends 1
    ? { method?: TMethods[number] }
    : { method: TMethods[number] };

export type RouteParams<
  TMethods extends readonly HttpMethod[],
  TPath extends z.ZodTypeAny | undefined,
  TQuery extends z.ZodTypeAny | undefined,
  THeaders extends z.ZodTypeAny | undefined,
  TBody extends z.ZodTypeAny | undefined,
  TParts extends z.ZodTypeAny | undefined,
> = SchemaField<"path", TPath> &
  SchemaField<"query", TQuery> &
  SchemaField<"headers", THeaders> &
  SchemaField<"body", TBody> &
  SchemaField<"parts", TParts> &
  MethodField<TMethods>;

// === Public config / call shapes ===

export interface RouteConfig<
  TMethods extends readonly HttpMethod[],
  TPath extends z.ZodTypeAny | undefined,
  TQuery extends z.ZodTypeAny | undefined,
  THeaders extends z.ZodTypeAny | undefined,
  TBody extends z.ZodTypeAny | undefined,
  TParts extends z.ZodTypeAny | undefined,
  TResponses extends ResponsesMap,
> {
  method: TMethods;
  /** Path template using `{name}` placeholders, e.g. "/items/{id}". */
  path: string;
  pathParams?: TPath;
  queryParams?: TQuery;
  headers?: THeaders;
  body?: TBody;
  parts?: TParts;
  responses: TResponses;
  cacheKey?: readonly string[];
  invalidates?: readonly string[] | null;
}

export interface RouteCallMeta {
  cacheKey: readonly string[];
  invalidates: readonly string[] | null;
  method: readonly HttpMethod[];
}

type QueryCapability<TParams, TResponses extends ResponsesMap> = {
  queryOptions(
    params: TParams,
    options?: Partial<
      UseQueryOptions<
        SuccessUnion<TResponses>,
        ApiResponseError<ErrorUnion<TResponses>>
      >
    >,
  ): UseQueryOptions<
    SuccessUnion<TResponses>,
    ApiResponseError<ErrorUnion<TResponses>>,
    SuccessUnion<TResponses>,
    QueryKey
  >;
};

type MutationCapability<TParams, TResponses extends ResponsesMap> = {
  mutationOptions(
    options?: Partial<
      UseMutationOptions<
        SuccessUnion<TResponses>,
        ApiResponseError<ErrorUnion<TResponses>>,
        TParams
      >
    >,
  ): UseMutationOptions<
    SuccessUnion<TResponses>,
    ApiResponseError<ErrorUnion<TResponses>>,
    TParams
  >;
};

export type RouteCall<
  TParams,
  TResponses extends ResponsesMap,
  TMethods extends readonly HttpMethod[],
> = ((params: TParams) => Promise<SuccessUnion<TResponses>>) &
  RouteCallMeta &
  (TMethods extends readonly ["GET"]
    ? QueryCapability<TParams, TResponses>
    : MutationCapability<TParams, TResponses>);

export interface ApiClient {
  baseUrl: string;
  fetch: FetchFn;
  defineRoute<
    const TMethods extends readonly HttpMethod[],
    TPath extends z.ZodTypeAny | undefined = undefined,
    TQuery extends z.ZodTypeAny | undefined = undefined,
    THeaders extends z.ZodTypeAny | undefined = undefined,
    TBody extends z.ZodTypeAny | undefined = undefined,
    TParts extends z.ZodTypeAny | undefined = undefined,
    TResponses extends ResponsesMap = {},
  >(
    config: RouteConfig<
      TMethods,
      TPath,
      TQuery,
      THeaders,
      TBody,
      TParts,
      TResponses
    >,
  ): RouteCall<
    RouteParams<TMethods, TPath, TQuery, THeaders, TBody, TParts>,
    TResponses,
    TMethods
  >;
}

// === Runtime ===

export function createApiClient(config: {
  baseUrl: string;
  fetch?: FetchFn;
}): ApiClient {
  const client: ApiClient = {
    baseUrl: config.baseUrl,
    fetch: config.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    defineRoute: ((
      routeConfig: RouteConfig<any, any, any, any, any, any, any>,
    ) => buildRouteCall(client, routeConfig)) as ApiClient["defineRoute"],
  };
  return client;
}

function buildRouteCall(
  client: ApiClient,
  config: RouteConfig<any, any, any, any, any, any, any>,
): any {
  const methods: readonly HttpMethod[] = config.method;
  const methodRequired = methods.length > 1;

  async function execute(
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const path = config.pathParams
      ? config.pathParams.parse(params.path)
      : undefined;
    const query =
      config.queryParams && params.query !== undefined
        ? config.queryParams.parse(params.query)
        : undefined;
    const headers =
      config.headers && params.headers !== undefined
        ? config.headers.parse(params.headers)
        : undefined;
    const body =
      config.body && params.body !== undefined
        ? config.body.parse(params.body)
        : undefined;
    const parts =
      config.parts && params.parts !== undefined
        ? config.parts.parse(params.parts)
        : undefined;

    const url =
      client.baseUrl + buildPath(config.path, path) + queryString(query);

    const requestHeaders: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined) requestHeaders[key] = String(value);
      }
    }

    let requestBody: RequestInit["body"];
    if (body !== undefined) {
      requestHeaders["content-type"] = "application/json";
      requestBody = JSON.stringify(body);
    } else if (parts !== undefined) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(parts)) {
        if (value === undefined) continue;
        formData.append(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
      requestBody = formData;
    }

    const method = methodRequired ? (params.method as HttpMethod) : methods[0];
    const res = await client.fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
    });
    return parseResponse(res, config.responses);
  }

  const call = execute as unknown as RouteCall<
    unknown,
    ResponsesMap,
    readonly HttpMethod[]
  > & {
    queryOptions: unknown;
    mutationOptions: unknown;
  };
  const meta: RouteCallMeta = {
    cacheKey: config.cacheKey ?? [],
    invalidates: config.invalidates ?? null,
    method: methods,
  };
  Object.assign(call, meta);

  if (methods.length === 1 && methods[0] === "GET") {
    (call as any).queryOptions = (params: unknown, options?: object) =>
      queryOptions({
        queryKey: [...meta.cacheKey, params],
        queryFn: () => execute(params as Record<string, unknown>),
        ...options,
      });
  } else {
    (call as any).mutationOptions = (options?: object) =>
      mutationOptions({
        mutationFn: (params: Record<string, unknown>) => execute(params),
        ...options,
      });
  }

  return call;
}

function buildPath(
  pattern: string,
  pathParams: Record<string, unknown> | undefined,
): string {
  return pattern.replace(PATH_PLACEHOLDER, (_match, name: string) => {
    if (!pathParams) return "";
    return encodeURIComponent(String(pathParams[name]));
  });
}

function queryString(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

async function readBody(res: Response): Promise<unknown> {
  return res.headers.get("content-type")?.includes("json")
    ? res.json()
    : res.text();
}

async function parseResponse(
  res: Response,
  responses: ResponsesMap,
): Promise<unknown> {
  if (!(res.status in responses)) {
    throw new ApiResponseError(res.status, await readBody(res), res.headers);
  }
  const schema = responses[res.status];
  const data = schema == null ? null : schema.parse(await readBody(res));
  if (!res.ok) throw new ApiResponseError(res.status, data, res.headers);
  return { status: res.status, data, headers: res.headers, ok: true };
}
