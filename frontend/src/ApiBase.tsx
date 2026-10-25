// set VITE_API_BASE to override, otherwise the local backend in dev, and in production the same
// domain the site is on (CloudFront sends /auth/* and /lyrics/* to the backend Lambda)
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://127.0.0.1:3000' : '');


// The Lambda only accepts requests that CloudFront has signed. CloudFront can't read a POST body
// to sign it, so AWS needs the browser to send the body's SHA-256 hash in x-amz-content-sha256.
async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function postJson(path: string, data: unknown, init: RequestInit = {}) {
  const body = JSON.stringify(data);
  return fetch(`${API_BASE}${path}`, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-amz-content-sha256': await sha256Hex(body) },
    body,
  });
}
