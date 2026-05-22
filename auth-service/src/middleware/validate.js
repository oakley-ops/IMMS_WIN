// src/middleware/validate.js
const validate = (schemas) => (req, res, next) => {
  for (const key of ['body', 'query', 'params']) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: `Invalid request ${key}`,
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req[key] = result.data;
  }
  return next();
};

module.exports = validate;
