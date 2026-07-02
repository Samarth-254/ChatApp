const { verifyAuthToken } = require('../utils/auth');

function getBearerToken(headerValue) {
  if (typeof headerValue !== 'string') {
    return '';
  }

  const [scheme, token] = headerValue.split(' ');

  return scheme === 'Bearer' ? token || '' : '';
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = verifyAuthToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
