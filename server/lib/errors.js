export class ApiError extends Error {
  constructor(status, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFound(message = 'Record not found.') {
  return new ApiError(404, message);
}

export function forbidden(message = 'You do not have permission to do that.') {
  return new ApiError(403, message);
}

export function validationError(fields, message = 'Please correct the highlighted fields.') {
  return new ApiError(422, message, fields);
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) return;

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  if (status >= 500) {
    console.error(`[api] ${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    error: status >= 500 ? 'Internal server error.' : err.message || 'Request failed.',
  };
  if (err?.fields && typeof err.fields === 'object') {
    body.fields = err.fields;
  }
  return res.status(status).json(body);
}
