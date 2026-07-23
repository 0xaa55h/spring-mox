export type HttpMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "TRACE";

export type ParameterLocation = "QUERY" | "HEADER" | "PATH";

export interface Parameter {
  name: string;
  location: ParameterLocation;
  type: object;
  required: boolean;
  defaultValue: string | null;
}

export interface RequestPart {
  name: string;
  type: object;
  required: boolean;
}

export interface RequestBody {
  type: object;
  required: boolean;
  contentTypes: string[];
}

export interface Response {
  statusCode: number;
  type: object | null;
  contentTypes: string[];
}

export interface Route {
  id: string;
  annotation: string;
  cacheKey: string[];
  path: string[];
  method: HttpMethod[];
  invalidates: string[] | null;
  parameters: Parameter[];
  parts: RequestPart[];
  requestBody: RequestBody | null;
  responses: Response[];
}

export interface RouteExport {
  version: string;
  routes: Route[];
  schemas: object;
}
