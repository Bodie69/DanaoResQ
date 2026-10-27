// Maps Mongoose errors to proper HTTP responses.
function errorHandler(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err.code === 11000) {
    return res.status(409).json({ error: `Duplicate value for ${Object.keys(err.keyValue).join(', ')}` });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
}

module.exports = errorHandler;
