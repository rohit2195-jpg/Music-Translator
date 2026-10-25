// set VITE_API_BASE to override, otherwise the local backend in dev, and in production the same
// domain the site is on (CloudFront sends /auth/* and /lyrics/* to the backend Lambda)
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://127.0.0.1:3000' : '');
