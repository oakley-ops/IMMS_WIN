// Get API URL from environment or use default
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Production: use relative URLs so the frontend calls the same server that served it
  if (process.env.NODE_ENV === 'production') {
    return '';
  }
  return 'http://localhost:4000';
};

export const API_URL = getApiUrl();
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', API_URL);