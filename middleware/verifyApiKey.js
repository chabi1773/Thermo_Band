module.exports = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.ESP32_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};