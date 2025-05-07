const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
console.log('Current API URL:', apiUrl);

export const API_URL = apiUrl;
export const ENV = process.env.NODE_ENV || 'development';

export const APP_CONFIG = {
  apiUrl: API_URL,
  environment: ENV,
  appName: 'Fiserv Inventory',
  version: '1.0.0',
  maxUploadSize: 5 * 1024 * 1024, // 5MB
  supportEmail: 'support@yourdomain.com'
};

// Debug output
console.log('APP_CONFIG:', APP_CONFIG);