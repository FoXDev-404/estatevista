/**
 * Small fixed-window rate limiter for unauthenticated endpoints. State lives
 * in the process, which is enough for the single-instance Release 1 server;
 * a shared store will be needed when the API runs on multiple instances.
 *
 * Keys come from the trusted-proxy-aware client address, and the bucket map is
 * capped so a burst of distinct keys cannot grow memory without bound.
 */
const DEFAULT_MAX_KEYS = 10000;

export function createRateLimiter({ windowMs, max, key, maxKeys = DEFAULT_MAX_KEYS }) {
  const buckets = new Map();
  let nextSweepAt = 0;

  function sweep(now) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
    nextSweepAt = now + windowMs;
  }

  function limit(request) {
    const now = Date.now();
    const bucketKey = key(request) || 'unknown';
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      // Expired buckets are swept at most once per window, then the oldest
      // entry is evicted if the map is still full. The trusted-proxy IP key
      // keeps the key space small in normal operation.
      if (now >= nextSweepAt) sweep(now);
      if (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }

      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    return bucket.count <= max;
  }

  limit.bucketCount = () => buckets.size;
  return limit;
}

export default createRateLimiter;
