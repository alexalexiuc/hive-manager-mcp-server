import { getRoute } from '../routes.js';
import type { RequestContext, WorkerHandler } from '../types.js';

export function withRouteResolution(next: WorkerHandler): WorkerHandler {
  return async (context) => {
    context.route = getRoute(context.request, context.url.pathname);
    return next(context);
  };
}

export async function routeRequest(context: RequestContext): Promise<Response> {
  if (!context.route) {
    return new Response('Not Found', { status: 404 });
  }

  return context.route.handler(context.request, context.env);
}
