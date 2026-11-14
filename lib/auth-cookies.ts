// Options for the Supabase session cookies. The site never reads the session in the browser (there is no
// browser Supabase client), so the cookies are hidden from page scripts (httpOnly): a script-injection bug
// can no longer read a member's session. `secure` keeps them off plain HTTP outside local development.
export const AUTH_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' && !process.env.BKP_INSECURE_LOCAL_COOKIES,
  maxAge: 400 * 24 * 60 * 60,   // same lifetime as the library default; the session itself still expires and refreshes
};
