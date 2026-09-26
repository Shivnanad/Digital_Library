/**
 * Global error-handling middleware for Express.
 * Catches unhandled errors from route handlers and returns
 * a clean JSON response instead of crashing or hanging.
 *
 * IMPORTANT: Never logs passwords, tokens, or secrets.
 */
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500
    ? "Internal server error"
    : (err.message || "Something went wrong");

  // Production-safe logging
  console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${status}:`, err.message || err);

  if (!res.headersSent) {
    res.status(status).json({ message });
  }
}

/**
 * Request logging middleware.
 * Logs method, URL, status, and duration for every request.
 * Never logs request bodies (which may contain passwords/tokens).
 */
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    // Only log slow requests or errors to keep logs manageable
    if (duration > 500 || res.statusCode >= 400) {
      console.log(
        `[${level}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
      );
    }
  });

  next();
}

module.exports = { errorHandler, requestLogger };
