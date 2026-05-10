import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

function redis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // dev-mode: sin redis, no rate limit
  _redis = new Redis({ url, token });
  return _redis;
}

const limiters = new Map<string, Ratelimit>();

function limiter(name: string, count: number, window: `${number} ${'s' | 'm' | 'h'}`): Ratelimit | null {
  const r = redis();
  if (!r) return null;
  const key = `${name}:${count}:${window}`;
  let rl = limiters.get(key);
  if (!rl) {
    rl = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(count, window),
      analytics: false,
      prefix: `rl:${name}`,
    });
    limiters.set(key, rl);
  }
  return rl;
}

export async function rateLimit(args: {
  name: string;
  identifier: string;
  count: number;
  window: `${number} ${'s' | 'm' | 'h'}`;
}): Promise<{ ok: boolean; limit: number; remaining: number; reset: number }> {
  const rl = limiter(args.name, args.count, args.window);
  if (!rl) return { ok: true, limit: args.count, remaining: args.count, reset: 0 };
  const res = await rl.limit(args.identifier);
  return { ok: res.success, limit: res.limit, remaining: res.remaining, reset: res.reset };
}
