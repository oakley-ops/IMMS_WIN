/** @type {import('next').NextConfig} */
const nextConfig = {
  // In development, proxy API calls and Socket.io to the MCS backend.
  // In production, Nginx handles this routing.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001';
    return [
      { source: '/api/:path*',       destination: `${backendUrl}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

module.exports = nextConfig;
