const crypto = require('crypto');

const SECRET = process.env.AUTH_SECRET || 'bus-booking-system-secret-key-2024';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function generateToken(username) {
  const payload = {
    username,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadStr)
    .digest('hex');
  const token = Buffer.from(payloadStr).toString('base64url') + '.' + signature;
  return token;
}

function verifyToken(token) {
  try {
    const [payloadB64, signature] = token.split('.');
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString();
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payloadStr)
      .digest('hex');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ code: 401, message: '未登录或登录已过期' });
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.json({ code: 401, message: '登录已过期，请重新登录' });
  }
  req.adminUser = payload;
  next();
}

module.exports = { generateToken, verifyToken, authMiddleware };
