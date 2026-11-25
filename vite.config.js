import { defineConfig, loadEnv } from 'vite';

// In development, serve /api/token and /api/flag so `npm run dev` works without the Netlify CLI.
function devTokenApi() {
  return {
    name: 'dev-token-api',
    configureServer(server) {
      for (const [path, file] of [['/api/token', '/server/token.js'], ['/api/flag', '/server/flag.js']]) {
        server.middlewares.use(path, async (req, res) => {
          const { default: handler } = await server.ssrLoadModule(file);
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const request = new Request(`http://localhost${path}`, {
            method: req.method,
            headers: req.headers,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          const response = await handler(request, req.socket.remoteAddress);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [devTokenApi()] };
});
