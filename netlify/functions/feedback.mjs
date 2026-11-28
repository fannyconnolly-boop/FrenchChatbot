// Netlify adapter (optional host). The real logic lives in server/feedback.js.
import feedbackHandler from '../../server/feedback.js';
export default (req, context) => feedbackHandler(req, context?.ip);
export const config = { path: '/api/feedback' };
