import type { RouteDefinition } from './types.js';
import { handleHealthRequest } from './handlers/health.js';
import { handleMcpRequest } from './handlers/mcp.js';

const routes: RouteDefinition[] = [
  {
    method: 'GET',
    path: '/health',
    isPublic: true,
    handler: handleHealthRequest,
  },
  { method: 'POST', path: '/mcp', isPublic: false, handler: handleMcpRequest },
];

export function getRoute(
  request: Request,
  pathname: string
): RouteDefinition | undefined {
  return routes.find(
    (route) => route.method === request.method && route.path === pathname
  );
}
