/**
 * Utility for parsing and sanitizing client IP addresses.
 * Crucial for PostgreSQL inet columns (users.last_login_ip, legal_acceptances.ip_address, audit_log.ip_address),
 * which fail with 22P02 invalid input syntax for type inet if passed a comma-separated list
 * (common with reverse proxies like Google Cloud Run / Cloudflare).
 */

export function sanitizeIp(rawIp?: string | string[] | null): string | null {
  if (!rawIp) return null;
  const ipStr = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
  // Take the first IP if there is a comma-separated list
  const first = ipStr.split(',')[0].trim();
  if (!first) return null;

  // Strip IPv6-mapped IPv4 prefix (e.g., ::ffff:192.0.2.1 -> 192.0.2.1)
  const normalized = first.replace(/^::ffff:/i, '');

  // Valid IPv4 check
  const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (ipv4Regex.test(normalized)) {
    return normalized;
  }

  // Valid IPv6 check
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(normalized)) {
    return normalized;
  }

  return '127.0.0.1';
}

export function extractClientIp(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (forwarded) {
    const sanitized = sanitizeIp(forwarded);
    if (sanitized) return sanitized;
  }
  const remote = req.socket?.remoteAddress;
  return sanitizeIp(remote) || '127.0.0.1';
}
