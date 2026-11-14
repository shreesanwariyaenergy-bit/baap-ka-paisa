// Optional request tracing for performance work. Off unless BKP_TRACE=1. Logs one line per outbound call:
//   [bkp-trace] <ms> <label>
// Never logs headers, tokens or bodies.
export const traceOn = () => process.env.BKP_TRACE === '1';
export const tracedFetch: typeof fetch = async (input, init) => {
  if (!traceOn()) return fetch(input, init);
  const t0 = performance.now();
  try { return await fetch(input, init); }
  finally {
    const u = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    console.log(`[bkp-trace] ${Math.round(performance.now() - t0)} ${u.pathname.replace(/^\/rest\/v1\/rpc\//, 'rpc:').replace(/^\/auth\/v1\//, 'auth:')} @${Math.round(t0)}`);
  }
};
