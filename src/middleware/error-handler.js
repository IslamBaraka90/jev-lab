import { APIConnectionError, APIError, APITimeoutError, TypeSafeError } from '@typesafe-ai/sdk';

export function notFound(req, res) {
  res.status(404).json({ error: { message: `Cannot ${req.method} ${req.path}` } });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const { status, error } = describeError(err);
  if (status === 500) console.error(err);
  res.status(status).json({ error });
}

function describeError(err) {
  if (err instanceof APIError) {
    // TypeSafe 4xx errors describe the request we forwarded, so they pass through.
    // A rejected API key (401) or a TypeSafe failure (5xx, 529 overloaded) is a 502.
    const passThrough = err.status >= 400 && err.status < 500 && err.status !== 401;
    return {
      status: passThrough ? err.status : 502,
      error: {
        message:
          err.status === 401
            ? `TypeSafe rejected the API key (${err.message}). Check TYPESAFE_API_KEY in .env.`
            : err.message,
        typesafeStatus: err.status,
        requestId: err.requestId,
        details: err.body,
      },
    };
  }
  // Network failures and timeouts that outlasted the SDK's retries.
  if (err instanceof APITimeoutError) return { status: 504, error: { message: err.message } };
  if (err instanceof APIConnectionError) return { status: 502, error: { message: err.message } };
  // Thrown by the SDK before sending, e.g. no questions or a score with fewer than two levels.
  if (err instanceof TypeSafeError) return { status: 400, error: { message: err.message } };
  // HttpError from the routes, and body parser errors such as malformed JSON.
  if (err.expose && err.status >= 400 && err.status < 500) {
    return { status: err.status, error: { message: err.message } };
  }
  return { status: 500, error: { message: 'Internal server error' } };
}
