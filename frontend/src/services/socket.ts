import io from 'socket.io-client';

// Connect to the backend server's socket.io endpoint
// Use the same URL as the API but with the socket.io path
const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:4000', {
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