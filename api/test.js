export default function handler(req, res) {
  res.status(200).json({
    message: 'Serverless function works!',
    timestamp: new Date().toISOString()
  });
}
