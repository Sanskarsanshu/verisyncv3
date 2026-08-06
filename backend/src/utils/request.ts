import { Request } from 'express';

/** Best-effort client IP extraction (honors proxy headers, never trusts blindly). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

interface ParsedUserAgent {
  browser: string;
  device: string;
}

/** Minimal, dependency-free user-agent classifier for attendance metadata. */
export function parseUserAgent(userAgent?: string): ParsedUserAgent {
  const ua = userAgent ?? 'unknown';

  if (/android/i.test(ua)) {
    if (/mobile/i.test(ua)) {
      if (/chrome/i.test(ua)) return { browser: 'Chrome (Android)', device: 'Android Phone' };
      return { browser: 'Mobile Browser', device: 'Android Phone' };
    }
    return { browser: 'Mobile Browser', device: 'Android Tablet' };
  }

  if (/iphone|ipad|ipod/i.test(ua)) {
    if (/crios|crios/i.test(ua)) return { browser: 'Chrome (iOS)', device: 'iPhone' };
    if (/fxios/i.test(ua)) return { browser: 'Firefox (iOS)', device: 'iPhone' };
    return { browser: 'Safari (iOS)', device: 'iPhone' };
  }

  if (/windows/i.test(ua)) {
    if (/edg\//i.test(ua)) return { browser: 'Microsoft Edge', device: 'Windows PC' };
    if (/chrome/i.test(ua)) return { browser: 'Chrome', device: 'Windows PC' };
    if (/firefox/i.test(ua)) return { browser: 'Firefox', device: 'Windows PC' };
    return { browser: 'Desktop Browser', device: 'Windows PC' };
  }

  if (/mac os x/i.test(ua)) {
    if (/safari/i.test(ua)) return { browser: 'Safari', device: 'Mac' };
    return { browser: 'Desktop Browser', device: 'Mac' };
  }

  if (/linux/i.test(ua)) {
    if (/chrome/i.test(ua)) return { browser: 'Chrome', device: 'Linux PC' };
    return { browser: 'Desktop Browser', device: 'Linux PC' };
  }

  return { browser: 'Unknown', device: 'Unknown' };
}
