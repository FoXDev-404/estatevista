/**
 * Small fixed-window rate limiter for unauthenticated endpoints. State lives
 * in the process, which is enough for the single-instance Release 1 server;
 * a shared store will be needed when the API runs on multiple instances.
 */
export function createRateLimiter({ windowMs, max, key }) {
  const buckets = new Map();

  return function limit(request) {
    const now = Date.now();
    const bucketKey = key(request) || 'unknown';
    let bucket = buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
      if (buckets.size > 10000) {
        for (const [entryKey, entry] of buckets) {
          if (entry.resetAt <= now) buckets.delete(entryKey);
        }
      }
    }

    bucket.count += 1;
    return bucket.count <= max;
  };
}

export default createRateLimiter;
