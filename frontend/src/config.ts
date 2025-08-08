// Get API URL from environment or use default
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return 'http://192.168.50.1:4000';
};

export const API_URL = getApiUrl();
console.log('Environment:', process.env.NODE_ENV);
console.log('API URL:', API_URL);