// set VITE_API_BASE to override, otherwise local backend in dev and Render in production
export const API_BASE: string =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? 'http://127.0.0.1:3000' : 'https://music-translator.onrender.com');
