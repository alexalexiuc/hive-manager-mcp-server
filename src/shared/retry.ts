type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  isRetryable?: (error: unknown) => boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

export function isRetryableGoogleQuotaError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes('quota exceeded') ||
    message.includes('ratelimitexceeded') ||
    message.includes('rate_limit_exceeded') ||
    message.includes('resource_exhausted')
  ) {
    return true;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeStatus = (error as { status?: unknown; code?: unknown }).status;
    const maybeCode = (error as { status?: unknown; code?: unknown }).code;
    if (maybeStatus === 429 || maybeCode === 429) {
      return true;
    }
  }

  return false;
}

export async function execWithBackoffRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 8;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 60_000;
  const factor = options.factor ?? 2;
  const isRetryable = options.isRetryable ?? isRetryableGoogleQuotaError;

  let attempt = 0;
  let delayMs = initialDelayMs;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      if (!isRetryable(error) || attempt >= maxAttempts) {
        throw error;
      }

      await sleep(delayMs);
      delayMs = Math.min(maxDelayMs, Math.floor(delayMs * factor));
    }
  }

  throw lastError;
}
