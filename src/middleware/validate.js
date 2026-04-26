/**
 * validate(schema) — Joi validation middleware factory.
 *
 * Usage:
 *   router.post('/route', validate(schemas.createGroup), handler)
 *
 * By default validates req.body. Pass a second argument to validate
 * req.query or req.params instead:
 *   router.get('/route', validate(schemas.checkDevice, 'query'), handler)
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const data =
      source === "body"
        ? req.body
        : source === "query"
        ? req.query
        : req.params;

    const { error, value } = schema.validate(data, {
      abortEarly: false,    // return ALL errors, not just the first
      stripUnknown: true,   // silently drop fields not in the schema
    });

    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(422).json({
        success: false,
        error: "Validation failed",
        details: messages,
      });
    }

    // Replace req.body/query/params with the sanitized value
    if (source === "body") req.body = value;
    else if (source === "query") req.query = value;
    else req.params = value;

    next();
  };
}

module.exports = validate;

/**
 * validate(schema) — Joi validation middleware factory.
 * Usage: router.post('/route', validate(schemas.createGroup), handler)
 
function validate(schema, source = "body") {
  return (req, res, next) => {
    const data = source === "body" ? req.body : source === "query" ? req.query : req.params;
    const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(422).json({ success: false, error: "Validation failed", details: messages });
    }
    if (source === "body") req.body = value;
    next();
  };
}

module.exports = validate;

*/



