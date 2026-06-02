import io from 'socket.io-client';

// Connect to the backend server's socket.io endpoint.
// In production the socket server shares the frontend's origin, so connect
// to the current origin; only fall back to localhost in development.
const SOCKET_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:4000');
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Try websocket first, then fall back to polling
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000, // Increase timeout
  withCredentials: true,
  forceNew: true // Force a new connection
});

// Add connection event handlers for debugging
socket.on('connect', () => {
  console.log('Socket.io connected successfully');
});

socket.on('disconnect', (reason) => {
  console.log('Socket.io disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Socket.io connection error:', error);
  // Fall back to polling if websocket fails
  if (socket.io && socket.io.opts && socket.io.opts.transports && socket.io.opts.transports[0] === 'websocket') {
    console.log('Falling back to polling transport');
    socket.io.opts.transports = ['polling'];
  }
});

socket.on('error', (error) => {
  console.error('Socket.io error:', error);
});

export default socket; 