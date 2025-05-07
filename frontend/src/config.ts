const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://fiserv-inventory-api.fly.dev';
  }
  // Development environment
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', API_URL);