/**
 * Same-origin proxy for images/audio so the browser does not hit S3 / third-party
 * hosts directly (avoids referrer hotlink blocks, CSP quirks, and mixed policies).
 */
export function proxiedMediaUrl(originalUrl: string): string {
  return `/api/media?u=${encodeURIComponent(originalUrl)}`;
}
