import { defineConfig, loadEnv } from 'vite';

// In development, serve the Netlify Function at /api/token so `npm run dev` works without the Netlify CLI.
function devTokenApi() {
  return {
    name: 'dev-token-api',
    configureServer(server) {
      server.middlewares.use('/api/token', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/netlify/functions/token.mjs');
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const request = new Request('http://localhost/api/token', {
          method: req.method,
          headers: req.headers,
          body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
        });
        const response = await handler(request);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [devTokenApi()] };
});
