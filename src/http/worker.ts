import { withAuthorization } from './middleware/auth';
import { createRequestId, withRequestLogging } from './middleware/logging';
import { routeRequest, withRouteResolution } from './middleware/routing';
import type { Env } from '../types';

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
