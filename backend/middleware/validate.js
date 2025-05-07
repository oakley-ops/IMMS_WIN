const { body, query, param, validationResult } = require('express-validator');
const { AppError, errorTypes } = require('./errorHandler');

// Common validation rules
const rules = {
  // String validations
  string: (field, options = {}) => {
    const chain = body(field)
      .trim()
      .isString()
      .withMessage(`${field} must be a string`);
    
    if (options.required) {
      chain.notEmpty().withMessage(`${field} is required`);
    }
    if (options.min) {
      chain.isLength({ min: options.min }).withMessage(`${field} must be at least ${options.min} characters`);
    }
    if (options.max) {
      chain.isLength({ max: options.max }).withMessage(`${field} must be at most ${options.max} characters`);
    }
    if (options.pattern) {
      chain.matches(options.pattern).withMessage(`${field} format is invalid`);
    }
    
    return chain;
  },

  // Number validations
  number: (field, options = {}) => {
    const chain = body(field)
      .isNumeric()
      .withMessage(`${field} must be a number`);
    
    if (options.required) {
      chain.notEmpty().withMessage(`${field} is required`);
    }
    if (options.min !== undefined) {
      chain.isFloat({ min: options.min }).withMessage(`${field} must be at least ${options.min}`);
    }
    if (options.max !== undefined) {
      chain.isFloat({ max: options.max }).withMessage(`${field} must be at most ${options.max}`);
    }
    
    return chain;
  },

  // Email validation
  email: (field = 'email') => {
    return body(field)
      .trim()
      .normalizeEmail()
      .isEmail()
      .withMessage('Invalid email address');
  },

  // Password validation
  password: (field = 'password') => {
    return body(field)
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
  },

  // Date validation
  date: (field, options = {}) => {
    const chain = body(field)
      .isISO8601()
      .withMessage(`${field} must be a valid date`);
    
    if (options.required) {
      chain.notEmpty().withMessage(`${field} is required`);
    }
    if (options.past) {
      chain.custom(value => new Date(value) < new Date())
        .withMessage(`${field} must be in the past`);
    }
    if (options.future) {
      chain.custom(value => new Date(value) > new Date())
        .withMessage(`${field} must be in the future`);
    }
    
    return chain;
  },

  // Array validation
  array: (field, options = {}) => {
    const chain = body(field)
      .isArray()
      .withMessage(`${field} must be an array`);
    
    if (options.required) {
      chain.notEmpty().withMessage(`${field} cannot be empty`);
    }
    if (options.min !== undefined) {
      chain.custom(arr => arr.length >= options.min)
        .withMessage(`${field} must contain at least ${options.min} items`);
    }
    if (options.max !== undefined) {
      chain.custom(arr => arr.length <= options.max)
        .withMessage(`${field} must contain at most ${options.max} items`);
    }
    
    return chain;
  },

  // ID parameter validation
  id: (field = 'id') => {
    return param(field)
      .isInt({ min: 1 })
      .withMessage('Invalid ID parameter');
  },

  // Query parameter validation
  queryParam: (field, type = 'string', options = {}) => {
    let chain = query(field);
    
    switch (type) {
      case 'number':
        chain = chain.optional().isNumeric().withMessage(`${field} must be a number`);
        break;
      case 'boolean':
        chain = chain.optional().isBoolean().withMessage(`${field} must be a boolean`);
        break;
      case 'date':
        chain = chain.optional().isISO8601().withMessage(`${field} must be a valid date`);
        break;
      default:
        chain = chain.optional().isString().withMessage(`${field} must be a string`);
    }
    
    return chain;
  }
};

// Validation schemas for different entities
const schemas = {
  // Part validation schema
  part: [
    rules.string('name', { required: true, max: 255 }),
    rules.string('description', { max: 1000 }),
    rules.string('manufacturer_part_number', { max: 100 }),
    rules.string('fiserv_part_number', { required: true, max: 100 }),
    rules.number('quantity', { required: true, min: 0 }),
    rules.number('minimum_quantity', { min: 0 }),
    rules.string('manufacturer', { max: 255 }),
    rules.number('cost', { min: 0 }),
    rules.string('location', { max: 255 }),
    rules.string('notes', { max: 1000 }),
    rules.string('status').optional().isIn(['active', 'inactive', 'discontinued'])
  ],

  // Machine validation schema
  machine: [
    rules.string('name', { required: true, max: 255 }),
    rules.string('serial_number', { required: true, max: 100 }),
    rules.string('model', { max: 100 }),
    rules.string('location', { max: 255 }),
    rules.string('status').optional().isIn(['active', 'inactive', 'maintenance'])
  ],

  // User validation schema
  user: [
    rules.string('username', { required: true, min: 3, max: 50 }),
    rules.password('password'),
    rules.string('role').optional().isIn(['admin', 'user']),
    body('is_active').optional().isBoolean()
  ],

  // Login validation schema
  login: [
    rules.string('username', { required: true }),
    rules.string('password', { required: true })
  ],

  // Parts usage validation schema
  partsUsage: [
    rules.number('part_id', { required: true, min: 1 }),
    rules.number('machine_id', { required: true, min: 1 }),
    rules.number('quantity', { required: true, min: 1 }),
    rules.string('reason', { max: 500 })
  ],

  // Pagination and filtering schema
  pagination: [
    rules.queryParam('page', 'number', { min: 0 }),
    rules.queryParam('limit', 'number', { min: 1, max: 100 }),
    rules.queryParam('search', 'string'),
    rules.queryParam('sortBy', 'string'),
    rules.queryParam('sortOrder', 'string').optional().isIn(['asc', 'desc'])
  ]
};

// Validation middleware
const validate = (schema) => {
  return async (req, res, next) => {
    // Apply validation rules
    await Promise.all(schema.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(
        errorTypes.ValidationError,
        'Validation failed',
        400,
        errors.array()
      );
    }

    next();
  };
};

// Sanitization middleware
const sanitize = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }

  next();
};

module.exports = {
  validate,
  sanitize,
  schemas,
  rules
}; 