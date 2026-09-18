// An error whose status and message are returned to the client as-is.
export class HttpError extends Error {
  expose = true;

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Responds with a TypeSafe result, forwarding the TypeSafe request id for debugging and support.
export async function sendResult(res, apiPromise) {
  const { data, requestId } = await apiPromise.withResponse();
  if (requestId) res.set('x-typesafe-request-id', requestId);
  res.json(data);
}
