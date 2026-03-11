import type { Env } from '../types';

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
  params: Record<string, string>;
}

export type RouteHandler = (context: RequestContext) => Promise<Response>;

export type WorkerHandler = (context: RequestContext) => Promise<Response>;
