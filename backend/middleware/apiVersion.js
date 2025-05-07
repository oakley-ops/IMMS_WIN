const semver = require('semver');
const { logger } = require('./logger');

// API version configuration
const API_VERSIONS = {
  'v1': {
    status: 'current',
    deprecated: false,
    sunset: null
  },
  'v2': {
    status: 'beta',
    deprecated: false,
    sunset: null
  }
};

// Default version if none specified
const DEFAULT_VERSION = 'v1';

// Version header names
const VERSION_HEADERS = {
  request: 'x-api-version',
  response: 'x-api-version',
  deprecation: 'deprecation',
  sunset: 'sunset',
  stability: 'x-api-stability'
};

// Middleware to handle API versioning
const apiVersionMiddleware = (req, res, next) => {
  // Get requested version from header or URL
  const requestedVersion = req.headers[VERSION_HEADERS.request] || 
                          req.path.split('/')[2] || 
                          DEFAULT_VERSION;

  // Validate and normalize version
  const version = normalizeVersion(requestedVersion);
  
  if (!version) {
    return res.status(400).json({
      error: 'Invalid API version',
      supportedVersions: Object.keys(API_VERSIONS)
    });
  }

  // Set version info in request object
  req.apiVersion = version;
  req.apiVersionInfo = API_VERSIONS[version];

  // Set response headers
  setVersionHeaders(res, version);

  // Log version usage
  logger.debug('API version used', {
    version,
    path: req.path,
    requestId: req.id,
    client: req.get('user-agent')
  });

  next();
};

// Helper to normalize version string
const normalizeVersion = (version) => {
  // Remove 'v' prefix if present
  version = version.toLowerCase().replace(/^v/, '');
  
  // Map version number to version key
  const versionKey = `v${version}`;
  
  return API_VERSIONS[versionKey] ? versionKey : null;
};

// Helper to set version-related response headers
const setVersionHeaders = (res, version) => {
  const versionInfo = API_VERSIONS[version];

  // Set current API version
  res.set(VERSION_HEADERS.response, version);
  
  // Set stability indicator
  res.set(VERSION_HEADERS.stability, versionInfo.status);

  // Set deprecation notice if applicable
  if (versionInfo.deprecated) {
    res.set(VERSION_HEADERS.deprecation, 'true');
    if (versionInfo.sunset) {
      res.set(VERSION_HEADERS.sunset, versionInfo.sunset);
    }
  }
};

// Middleware to check for deprecated versions
const deprecationCheck = (req, res, next) => {
  const version = req.apiVersion;
  const versionInfo = API_VERSIONS[version];

  if (versionInfo.deprecated) {
    // Log deprecated version usage
    logger.warn('Deprecated API version used', {
      version,
      path: req.path,
      requestId: req.id,
      client: req.get('user-agent')
    });

    // Add deprecation warning to response
    const warning = {
      code: 'API_VERSION_DEPRECATED',
      message: `API version ${version} is deprecated`,
      details: {
        suggestedVersion: 'v1',
        sunsetDate: versionInfo.sunset
      }
    };

    // Attach warning to response
    const oldJson = res.json;
    res.json = function(body) {
      if (body && typeof body === 'object') {
        body.warning = warning;
      }
      return oldJson.call(this, body);
    };
  }

  next();
};

// Function to register a new API version
const registerApiVersion = (version, status = 'current', options = {}) => {
  const versionKey = normalizeVersion(version);
  if (!versionKey) {
    throw new Error(`Invalid version format: ${version}`);
  }

  API_VERSIONS[versionKey] = {
    status,
    deprecated: options.deprecated || false,
    sunset: options.sunset || null
  };

  logger.info(`API version ${versionKey} registered`, {
    status,
    options
  });
};

// Function to deprecate an API version
const deprecateApiVersion = (version, sunsetDate) => {
  const versionKey = normalizeVersion(version);
  if (!versionKey || !API_VERSIONS[versionKey]) {
    throw new Error(`Invalid or unknown version: ${version}`);
  }

  API_VERSIONS[versionKey].deprecated = true;
  API_VERSIONS[versionKey].sunset = sunsetDate;

  logger.info(`API version ${versionKey} marked as deprecated`, {
    sunsetDate
  });
};

module.exports = {
  apiVersionMiddleware,
  deprecationCheck,
  registerApiVersion,
  deprecateApiVersion,
  API_VERSIONS
}; 