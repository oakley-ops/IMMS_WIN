const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

// Password complexity requirements
const passwordRequirements = {
  minLength: 8,
  minLowercase: 1,
  minUppercase: 1,
  minNumbers: 1,
  minSymbols: 1
};

// Sanitize request body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }
  next();
};

// Validate password complexity
const validatePassword = body('password')
  .isLength({ min: passwordRequirements.minLength })
  .withMessage(`Password must be at least ${passwordRequirements.minLength} characters long`)
  .matches(/[a-z]/)
  .withMessage('Password must contain at least one lowercase letter')
  .matches(/[A-Z]/)
  .withMessage('Password must contain at least one uppercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain at least one number')
  .matches(/[!@#$%^&*]/)
  .withMessage('Password must contain at least one special character');

// Validate username
const validateUsername = body('username')
  .trim()
  .isLength({ min: 3, max: 50 })
  .withMessage('Username must be between 3 and 50 characters long')
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage('Username can only contain letters, numbers, and underscores');

// Validate email
const validateEmail = body('email')
  .trim()
  .isEmail()
  .withMessage('Must be a valid email address')
  .normalizeEmail();

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation chains for different routes
const validateLogin = [
  validateUsername,
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateRegistration = [
  validateUsername,
  validatePassword,
  validateEmail,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters long'),
  handleValidationErrors
];

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  validatePassword.optional({ checkFalsy: true }),
  handleValidationErrors
];

module.exports = {
  sanitizeBody,
  validateLogin,
  validateRegistration,
  validatePasswordChange,
  passwordRequirements
}; 