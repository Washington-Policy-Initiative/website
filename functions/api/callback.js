/**
 * GET /api/callback: step 2 of Decap CMS's GitHub login (Cloudflare Pages Function).
 *
 * GitHub redirects here with ?code&state. We check `state`, exchange the code for an
 * access token (this is the only place the client SECRET is used, and it never leaves
 * the server), then hand the token to the CMS window that opened this popup.
 *
 * Security notes:
 *  - The token is sent with postMessage ONLY to this site's own origin, and only after
 *    the opener proves it's on that origin. Many example implementations use
 *    postMessage(…, '*'), which would hand the token to any page that opened the popup.
 *  - The response page has its own strict CSP with a per-request nonce, so its one
 *    inline script runs and nothing else can.
 *  - Errors never echo GitHub's raw response or the token.
 */

function htmlResponse(body, nonce, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      // Expire the one-time state cookie.
      'Set-Cookie': 'wpi_oauth_state=; Path=/api/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/** Constant-time string comparison, so timing doesn't reveal how much of `state` matched. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Page that completes Decap's popup handshake and posts the result to our own origin only. */
function handshakePage(origin, status, payload, nonce) {
  // JSON.stringify + escaping "<" so the values can't break out of the <script> element.
  const message = JSON.stringify(`authorization:github:${status}:${JSON.stringify(payload)}`).replace(
    /</g,
    '\\u003c',
  );
  const allowedOrigin = JSON.stringify(origin).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Signing in…</title></head>
<body><p>Completing sign-in…</p>
<script nonce="${nonce}">
(function () {
  var allowed = ${allowedOrigin};
  var message = ${message};
  if (!window.opener) { document.body.textContent = 'Sign-in window lost its connection. Close it and try again.'; return; }
  window.addEventListener('message', function (e) {
    if (e.origin !== allowed) return;
    window.opener.postMessage(message, allowed);
    window.close();
  });
  // Decap answers this announcement with a message from its own window; we then reply.
  window.opener.postMessage('authorizing:github', allowed);
})();
</script></body></html>`;
}

export async function onRequestGet({ request, env }) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = getCookie(request, 'wpi_oauth_state');

  if (!code || !state || !expected || !safeEqual(state, expected)) {
    return htmlResponse(
      handshakePage(origin, 'error', { message: 'Login could not be verified. Please try again.' }, nonce),
      nonce,
      400,
    );
  }

  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    return htmlResponse(handshakePage(origin, 'error', { message: 'OAuth is not configured.' }, nonce), nonce, 500);
  }

  let token;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'wpi-cms-oauth' },
      body: JSON.stringify({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/callback`,
      }),
    });
    const data = await res.json();
    token = data.access_token;
  } catch {
    token = undefined;
  }

  if (!token) {
    return htmlResponse(handshakePage(origin, 'error', { message: 'GitHub login failed. Please try again.' }, nonce), nonce, 502);
  }

  return htmlResponse(handshakePage(origin, 'success', { token, provider: 'github' }, nonce), nonce);
}
