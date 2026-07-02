export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http and https URLs are supported');
    }
    return parsed.toString();
  } catch {
    throw new Error('Please enter a valid URL');
  }
}

export function getSiteLabel(url: string, siteName?: string): string {
  if (siteName) return siteName;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
