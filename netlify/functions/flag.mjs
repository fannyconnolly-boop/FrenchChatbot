// Netlify adapter (optional host). The real logic lives in server/flag.js.
import flagHandler from '../../server/flag.js';
export default (req, context) => flagHandler(req, context?.ip);
export const config = { path: '/api/flag' };
