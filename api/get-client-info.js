export default function handler(req, res) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  const ua = req.headers['user-agent'] || 'unknown';

  res.status(200).json({ ip, ua });
}
