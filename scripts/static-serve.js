// Minimal static file server with SPA fallback — Node built-ins only, no deps.
//
// Replaces PM2's built-in `pm2 serve`, which 403s every nested path on Windows:
// its within-root guard compares the resolved path against `root + '/'` (forward
// slash) while Windows file paths use backslashes, so `build\static\...` never
// matches and is rejected. This server resolves and range-checks paths with
// path.sep correctly, serves the right Content-Type, and falls back to
// index.html for client-side routes.
//
// Config via env (or argv): SERVE_PATH (directory), SERVE_PORT (port).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.SERVE_PATH || process.argv[2] || '.');
const PORT = parseInt(process.env.SERVE_PORT || process.argv[3] || '8080', 10);
const INDEX = path.join(ROOT, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

function serveIndex(res) {
  fs.readFile(INDEX, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad Request');
  }

  const resolved = path.resolve(ROOT, urlPath.replace(/^\/+/, ''));
  // Range-check with path.sep so Windows backslash paths are handled correctly.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden');
  }

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      // CRA hashes /static/ asset filenames, so they're safe to cache forever.
      headers['Cache-Control'] = urlPath.startsWith('/static/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache';
      res.writeHead(200, headers);
      return fs.createReadStream(resolved).pipe(res);
    }
    // Not a real file → client-side route: serve the SPA shell.
    serveIndex(res);
  });
});

server.listen(PORT, () => console.log('static-serve: %s on :%d', ROOT, PORT));
