import { withAuthorization } from './middleware/auth.js';
import { createRequestId, withRequestLogging } from './middleware/logging.js';
import { routeRequest, withRouteResolution } from './middleware/routing.js';
import type { Env } from '../types.js';

const handler = withRequestLogging(
  withRouteResolution(withAuthorization(routeRequest))
);

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handler({
      request,
      env,
      requestId: createRequestId(),
      startedAt: Date.now(),
      url: new URL(request.url),
      params: {},
    });
  },
};

export default worker;
