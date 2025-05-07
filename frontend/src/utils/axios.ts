import axios from 'axios';
import { API_URL } from '../config';

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');

    // More verbose logging for debugging
    console.log('Request Token Debug:', {
      hasToken: !!token,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
      endpoint: config.url
    });
    
    // Log request details
    console.log('Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: {
        ...config.headers,
        Authorization: token ? 'Bearer [HIDDEN]' : undefined
      }
    });
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // Log response details
    console.log('Response:', {
      status: response.status,
      url: response.config.url,
      baseURL: response.config.baseURL,
      fullURL: `${response.config.baseURL}${response.config.url}`,
      data: response.data
    });
    return response;
  },
  (error) => {
    // Log error details
    console.error('Response error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : undefined,
      data: error.response?.data
    });

    // Handle unauthorized errors
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
