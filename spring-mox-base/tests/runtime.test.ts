import {describe, expect, test} from "bun:test";
import {z} from "zod";
import {ApiResponseError, createApiClient} from "../src/runtime.ts";

function client(fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  return createApiClient({baseUrl: "http://x", fetch: fetchImpl});
}

describe("path templating + query building", () => {
  test("substitutes path params and appends query string", async () => {
    const requests: {url: string; init: RequestInit}[] = [];
    const c = client(async (url, init) => {
      requests.push({url: String(url), init: init!});
      return new Response(null, {status: 204});
    });

    const route = c.defineRoute({
      method: ["GET"],
      path: "/items/{id}",
      pathParams: z.object({id: z.string()}),
      queryParams: z.object({q: z.string(), limit: z.number().optional()}),
      responses: {204: null},
    });

    await route({path: {id: "abc"}, query: {q: "search", limit: 5}});

    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("http://x/items/abc?q=search&limit=5");
    expect(requests[0]!.init.method).toBe("GET");
  });

  test("skips undefined query values", async () => {
    const requests: {url: string}[] = [];
    const c = client(async (url) => {
      requests.push({url: String(url)});
      return new Response(null, {status: 204});
    });

    const route = c.defineRoute({
      method: ["GET"],
      path: "/items",
      queryParams: z.object({q: z.string().optional()}).optional(),
      responses: {204: null},
    });

    await route({});
    expect(requests[0]!.url).toBe("http://x/items");
  });
});

describe("headers", () => {
  test("forwards parsed headers onto the request", async () => {
    const requests: {init: RequestInit}[] = [];
    const c = client(async (_url, init) => {
      requests.push({init: init!});
      return new Response(null, {status: 204});
    });

    const route = c.defineRoute({
      method: ["GET"],
      path: "/items",
      headers: z.object({"x-auth": z.string().optional()}).optional(),
      responses: {204: null},
    });

    await route({headers: {"x-auth": "token"}});
    expect((requests[0]!.init.headers as Record<string, string>)["x-auth"]).toBe("token");
  });
});

describe("body vs parts", () => {
  test("JSON body sets content-type and stringifies", async () => {
    const requests: {init: RequestInit}[] = [];
    const c = client(async (_url, init) => {
      requests.push({init: init!});
      return new Response(null, {status: 200});
    });

    const route = c.defineRoute({
      method: ["POST"],
      path: "/items",
      body: z.object({message: z.string()}),
      responses: {200: null},
    });

    await route({body: {message: "hi"}});
    expect((requests[0]!.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(requests[0]!.init.body).toBe(JSON.stringify({message: "hi"}));
  });

  test("multipart parts build FormData, JSON-stringifying non-string values", async () => {
    const requests: {init: RequestInit}[] = [];
    const c = client(async (_url, init) => {
      requests.push({init: init!});
      return new Response(null, {status: 200});
    });

    const route = c.defineRoute({
      method: ["POST"],
      path: "/items",
      parts: z.object({file: z.string(), meta: z.object({a: z.number()}).optional()}),
      responses: {200: null},
    });

    await route({parts: {file: "data", meta: {a: 1}}});
    const formData = requests[0]!.init.body as FormData;
    expect(formData.get("file")).toBe("data");
    expect(formData.get("meta")).toBe(JSON.stringify({a: 1}));
  });
});

describe("response parsing", () => {
  test("2xx declared status parses body and resolves", async () => {
    const c = client(async () => new Response(JSON.stringify({message: "hi"}), {
      status: 200,
      headers: {"content-type": "application/json"},
    }));

    const route = c.defineRoute({
      method: ["GET"],
      path: "/items",
      responses: {200: z.object({message: z.string()})},
    });

    const result = await route({});
    expect(result.status).toBe(200);
    expect(result.data).toEqual({message: "hi"});
    expect(result.headers).toBeInstanceOf(Headers);
    expect(result.ok).toBe(true);
  });

  test("null-typed response resolves data to null without reading the body", async () => {
    const c = client(async () => new Response(null, {status: 204}));

    const route = c.defineRoute({
      method: ["GET"],
      path: "/items",
      responses: {204: null},
    });

    const result = await route({});
    expect(result.status).toBe(204);
    expect(result.data).toBeNull();
  });

  test("undeclared status throws ApiResponseError with raw body", async () => {
    const c = client(async () => new Response(null, {status: 500}));
    const route = c.defineRoute({method: ["GET"], path: "/items", responses: {200: null}});

    let caught: unknown;
    try {
      await route({});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiResponseError);
    expect((caught as ApiResponseError).status).toBe(500);
  });

  test("declared non-ok status throws ApiResponseError with typed data", async () => {
    const c = client(async () => new Response(null, {status: 404}));
    const route = c.defineRoute({method: ["GET"], path: "/items", responses: {200: null, 404: null}});

    let caught: unknown;
    try {
      await route({});
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiResponseError);
    const apiErr = caught as ApiResponseError;
    expect(apiErr.status).toBe(404);
    expect(apiErr.data).toBeNull();
    expect(apiErr.headers).toBeInstanceOf(Headers);
  });
});

describe("method handling", () => {
  test("single declared method needs no call-time method", async () => {
    const requests: {init: RequestInit}[] = [];
    const c = client(async (_url, init) => {
      requests.push({init: init!});
      return new Response(null, {status: 204});
    });
    const route = c.defineRoute({method: ["POST"], path: "/items", responses: {204: null}});

    await route({});
    expect(requests[0]!.init.method).toBe("POST");
  });

  test("multiple declared methods require a call-time method", async () => {
    const requests: {init: RequestInit}[] = [];
    const c = client(async (_url, init) => {
      requests.push({init: init!});
      return new Response(null, {status: 204});
    });
    const route = c.defineRoute({method: ["GET", "PUT"], path: "/items", responses: {204: null}});

    await route({method: "PUT"});
    expect(requests[0]!.init.method).toBe("PUT");
  });
});

describe("metadata + tanstack option builders", () => {
  test("GET-only route exposes queryOptions and cacheKey", () => {
    const c = client(async () => new Response(null, {status: 200}));
    const route = c.defineRoute({
      method: ["GET"],
      path: "/items",
      responses: {200: null},
      cacheKey: ["items"],
    });

    expect(route.cacheKey).toEqual(["items"]);
    expect(route.method).toEqual(["GET"]);
    expect(typeof (route as any).queryOptions).toBe("function");
    const opts = (route as any).queryOptions({});
    expect(opts.queryKey).toEqual(["items", {}]);
  });

  test("non-GET-only route exposes mutationOptions and invalidates", () => {
    const c = client(async () => new Response(null, {status: 200}));
    const route = c.defineRoute({
      method: ["POST"],
      path: "/items",
      responses: {200: null},
      invalidates: ["items"],
    });

    expect(route.invalidates).toEqual(["items"]);
    expect(typeof (route as any).mutationOptions).toBe("function");
    const opts = (route as any).mutationOptions();
    expect(typeof opts.mutationFn).toBe("function");
  });
});
