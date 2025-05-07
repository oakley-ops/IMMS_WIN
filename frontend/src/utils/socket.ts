 import { io } from 'socket.io-client';

// Extract API URL and port from the environment or use default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';
const SOCKET_URL = API_BASE_URL.split('/api/v1')[0]; // Remove API path to get base URL

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Add polling as fallback
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000, // Increase timeout
  forceNew: true, // Force a new connection
});

socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
  // Fall back to polling if websocket fails
  if (socket.io && socket.io.opts && socket.io.opts.transports && socket.io.opts.transports[0] === 'websocket') {
    console.log('Falling back to polling transport');
    socket.io.opts.transports = ['polling'];
  }
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

export default socket;