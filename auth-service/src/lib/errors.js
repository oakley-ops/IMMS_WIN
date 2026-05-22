// src/lib/errors.js
class DomainError extends Error {
  constructor(code, message, status, details) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { DomainError };
