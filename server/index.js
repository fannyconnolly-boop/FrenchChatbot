// Production server for Render (or any Node host): serves the built app from dist/
// and the private token endpoint at /api/token. No dependencies beyond Node itself.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import tokenHandler from './token.js';
import flagHandler from './flag.js';

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'permissions-policy': 'microphone=(self)',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

// Simple per-IP limit on token requests (each token = one conversation), to protect your Gemini quota.
const LIMIT_PER_HOUR = Number(process.env.SESSIONS_PER_HOUR_PER_IP) || 30;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return recent.length > LIMIT_PER_HOUR;
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();

async function handleApi(req, res, handler) {
  const ip = clientIp(req);
  if (handler === tokenHandler && req.method === 'POST' && rateLimited(ip)) {
    res.writeHead(429, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too many conversations started from this network. Try again later.' }));
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 10_000) {
      res.writeHead(413);
      return res.end();
    }
    chunks.push(c);
  }
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const response = await handler(request, ip);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT.replace(/[\\/]$/, '') + sep) && file + sep !== ROOT) {
    res.writeHead(403);
    return res.end();
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html'); // unknown paths fall back to the app
  }
  try {
    const body = await readFile(file);
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') return res.end('ok');
    if (req.url.startsWith('/api/token')) return await handleApi(req, res, tokenHandler);
    if (req.url.startsWith('/api/flag')) return await handleApi(req, res, flagHandler);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end();
    }
    return await serveStatic(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, () => console.log(`Parlons ! listening on port ${PORT}`));
