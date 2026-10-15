function errorHandler(err, req, res, next) {
  console.error('Unhandled Server Error:', err);

  let statusCode = err.statusCode || err.status || 500;
  if (err.message && err.message.includes('CORS policy')) {
    statusCode = 403;
  }

  let message = err.message || 'Internal Server Error';
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = {
  errorHandler
};
