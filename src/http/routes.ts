import { match } from 'path-to-regexp';
import type { RouteDefinition } from './types.js';
import { handleHealthRequest } from './handlers/health.js';
import { handleMcpRequest } from './handlers/mcp.js';
import { handleCaloriesRequest } from './handlers/calories.js';
import {
  handleOAuthMetadata,
  handleOAuthAuthorizeGet,
  handleOAuthAuthorizePost,
  handleOAuthToken,
} from './handlers/oauth.js';

interface CompiledRoute extends RouteDefinition {
  matcher: ReturnType<typeof match>;
}

const routes: CompiledRoute[] = (
  [
    { method: 'GET',  path: '/health',                                   isPublic: true,  handler: handleHealthRequest },
    { method: 'GET',  path: '/.well-known/oauth-authorization-server',   isPublic: true,  handler: handleOAuthMetadata },
    { method: 'GET',  path: '/oauth/authorize',                          isPublic: true,  handler: handleOAuthAuthorizeGet },
    { method: 'POST', path: '/oauth/authorize',                          isPublic: true,  handler: handleOAuthAuthorizePost },
    { method: 'POST', path: '/oauth/token',                              isPublic: true,  handler: handleOAuthToken },
    { method: 'POST', path: '/apiary/:spreadsheetId',                    isPublic: false, handler: handleMcpRequest },
    { method: 'POST', path: '/calories/:spreadsheetId',                  isPublic: false, handler: handleCaloriesRequest },
  ] satisfies RouteDefinition[]
).map((route) => ({ ...route, matcher: match(route.path) }));

export function matchRoute(
  request: Request,
  pathname: string
): { route: RouteDefinition; params: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.method !== request.method) continue;
    const result = route.matcher(pathname);
    if (result) {
      return { route, params: result.params as Record<string, string> };
    }
  }
  return undefined;
}
