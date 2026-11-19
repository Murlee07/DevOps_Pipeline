'use strict';

/**
 * Minimal Prometheus-compatible metrics (no external dependency).
 * Exposes request counts and a latency histogram at GET /metrics.
 */
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

function createMetrics() {
  const requests = new Map(); // key: method|route|status -> count
  const histogram = { buckets: BUCKETS.map(() => 0), sum: 0, count: 0 };
  const startedAt = Date.now();

  function middleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
      const key = `${req.method}|${route}|${res.statusCode}`;
      requests.set(key, (requests.get(key) || 0) + 1);
      histogram.sum += seconds;
      histogram.count += 1;
      BUCKETS.forEach((b, i) => {
        if (seconds <= b) histogram.buckets[i] += 1;
      });
    });
    next();
  }

  function render() {
    const lines = [];
    lines.push('# HELP http_requests_total Total HTTP requests.', '# TYPE http_requests_total counter');
    for (const [key, count] of requests) {
      const [method, route, status] = key.split('|');
      lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }
    lines.push('# HELP http_request_duration_seconds Request latency.', '# TYPE http_request_duration_seconds histogram');
    BUCKETS.forEach((b, i) => lines.push(`http_request_duration_seconds_bucket{le="${b}"} ${histogram.buckets[i]}`));
    lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${histogram.count}`);
    lines.push(`http_request_duration_seconds_sum ${histogram.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count ${histogram.count}`);
    const mem = process.memoryUsage();
    lines.push('# HELP process_resident_memory_bytes Resident memory size.', '# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);
    lines.push('# HELP process_uptime_seconds Process uptime.', '# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(0)}`);
    return `${lines.join('\n')}\n`;
  }

  return { middleware, render, startedAt };
}

module.exports = { createMetrics };
