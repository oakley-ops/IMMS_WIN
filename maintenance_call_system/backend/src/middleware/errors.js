// Consistent error envelope helpers.
// Success responses keep their existing raw shape (resource, list, etc.).
// All error responses follow: { error: <code>, message: <human>, details?: any }.

const sendError = (res, status, code, message, details) => {
  const body = { error: code, message };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
};

const errors = {
  badRequest: (res, message, details) => sendError(res, 400, 'bad_request', message, details),
  unauthorized: (res, message = 'Authentication required') =>
    sendError(res, 401, 'unauthorized', message),
  forbidden: (res, message = 'Forbidden') => sendError(res, 403, 'forbidden', message),
  notFound: (res, message = 'Not found') => sendError(res, 404, 'not_found', message),
  conflict: (res, message, details) => sendError(res, 409, 'conflict', message, details),
  serverError: (res, message = 'Internal server error') =>
    sendError(res, 500, 'server_error', message),
};

module.exports = { sendError, errors };
