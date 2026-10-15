/** Serve a fixed build artifact only. No proxy, database binding or request body. */
export function createStaticHost(assets, csp) {
  const files = Object.freeze({ ...assets });
  return {
    /** @param {Request} request @returns {Response} */
    fetch(request) {
      const headers = {
        'Content-Security-Policy': csp,
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      };
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return new Response('Method not allowed', {
          status: 405,
          headers: { ...headers, Allow: 'GET, HEAD' },
        });
      const pathname = new URL(request.url).pathname;
      const key = pathname === '/' ? '/index.html' : pathname;
      if (!Object.hasOwn(files, key))
        return new Response(request.method === 'HEAD' ? null : 'Not found', {
          status: 404,
          headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
        });
      const file = files[key];
      return new Response(request.method === 'HEAD' ? null : file.body, {
        headers: { ...headers, 'Content-Type': file.type },
      });
    },
  };
}
