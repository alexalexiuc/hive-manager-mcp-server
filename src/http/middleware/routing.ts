import { matchRoute } from '../routes';
import { notFoundResponse } from '../responses';
import type { RequestContext, WorkerHandler } from '../types';

export function withRouteResolution(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    const match = matchRoute(context.request, context.url.pathname);
    if (match) {
      context.route = match.route;
      context.params = match.params;
    }
    return next(context);
  };
}

export async function routeRequest(context: RequestContext): Promise<Response> {
  if (!context.route) {
    return notFoundResponse(context);
  }

  return context.route.handler(context);
}
