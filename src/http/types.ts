import type { Env } from '../types.js';

export type RouteHandler = (request: Request, env: Env) => Promise<Response>;

export interface RouteDefinition {
  method: string;
  path: string;
  isPublic: boolean;
  handler: RouteHandler;
}

export interface RequestContext {
  request: Request;
  env: Env;
  requestId: string;
  startedAt: number;
  url: URL;
  route?: RouteDefinition;
}

export type WorkerHandler = (context: RequestContext) => Promise<Response>;
