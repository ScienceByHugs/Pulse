import type { Session } from '@supabase/supabase-js';

export const AUTH_LINK_ERROR =
  'This link could not be verified. Request a new email and open its latest link on this device.';

type AuthResult = { data: { session: Session | null }; error: unknown };
type AuthClient = {
  verifyOtp: (args: { token_hash: string; type: 'recovery' | 'email' | 'signup' }) => PromiseLike<AuthResult>;
  exchangeCodeForSession: (code: string) => PromiseLike<AuthResult>;
  setSession: (args: { access_token: string; refresh_token: string }) => PromiseLike<AuthResult>;
};

export function isAuthUrl(url: string) {
  return /^pulse:\/\/(?:\/)?auth\/(?:callback|reset-password)\/?(?:[?#]|$)/.test(url);
}

// Native URLSearchParams implementations differ from the browser implementation.
// Decode exactly once and retain '=' inside token values. Never log these params.
function paramsFromUrl(url: string) {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  const parts = [
    queryIndex < 0 ? '' : beforeHash.slice(queryIndex + 1),
    hashIndex < 0 ? '' : url.slice(hashIndex + 1),
  ];
  const params = new Map<string, string>();
  for (const pair of parts.join('&').split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const decode = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '));
    const key = decode(separator < 0 ? pair : pair.slice(0, separator));
    const value = decode(separator < 0 ? '' : pair.slice(separator + 1));
    if (params.has(key)) throw new Error(AUTH_LINK_ERROR);
    params.set(key, value);
  }
  return params;
}

// Both initial-URL and foreground listeners can deliver the same single-use link.
// Share only the in-flight operation; release the URL and tokens on settlement.
export function createAuthLinkConsumer(auth: AuthClient) {
  let pending: { url: string; result: Promise<Session> } | null = null;
  return function consumeAuthUrl(url: string): Promise<Session> {
    if (pending?.url === url) return pending.result;
    const result = (async () => {
      try {
        if (!isAuthUrl(url)) throw new Error(AUTH_LINK_ERROR);
        const params = paramsFromUrl(url);
        if (params.has('error') || params.has('error_code')) throw new Error(AUTH_LINK_ERROR);
        const tokenHash = params.get('token_hash');
        const type = params.get('type');
        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        let response: AuthResult;
        if (tokenHash && (type === 'recovery' || type === 'email' || type === 'signup')) {
          response = await auth.verifyOtp({ token_hash: tokenHash, type });
        } else if (code) {
          response = await auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          response = await auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else {
          throw new Error(AUTH_LINK_ERROR);
        }
        if (response.error || !response.data.session) throw new Error(AUTH_LINK_ERROR);
        return response.data.session;
      } catch {
        // Provider errors can include credential-bearing URL details.
        throw new Error(AUTH_LINK_ERROR);
      }
    })();
    pending = { url, result };
    const clear = () => { if (pending?.result === result) pending = null; };
    void result.then(clear, clear);
    return result;
  };
}
