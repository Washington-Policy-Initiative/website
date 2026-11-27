/**
 * GET /api/auth: step 1 of Decap CMS's GitHub login (Cloudflare Pages Function).
 *
 * Redirects the login popup to GitHub's OAuth consent screen.
 *
 * Security notes:
 *  - `state` is a random, single-use value stored in an HttpOnly cookie and checked in
 *    /api/callback. It stops login CSRF: an attacker can't complete a login flow they
 *    started and trick an editor's browser into finishing it.
 *  - Scope is `public_repo` (least privilege for a public repo), not `repo`, which would
 *    grant access to all of the editor's private repositories.
 *  - The client ID comes from Cloudflare environment variables, not from the repo.
 */
export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_OAUTH_CLIENT_ID) {
    return new Response('OAuth is not configured.', { status: 500 });
  }

  const url = new URL(request.url);
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('');

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/callback`);
  authorize.searchParams.set('scope', 'public_repo');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `wpi_oauth_state=${state}; Path=/api/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
