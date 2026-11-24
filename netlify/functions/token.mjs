// Netlify adapter (optional host). The real logic lives in server/token.js.
export { default } from '../../server/token.js';
export const config = { path: '/api/token' };
