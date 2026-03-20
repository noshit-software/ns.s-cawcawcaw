import { Router } from 'express';
import { config } from '../config.js';
import { setCredentials } from '../store/credentials.js';

const router = Router();

function getRedirectUri(req: { protocol: string; get(name: string): string | undefined }): string {
  const host = req.get('host') || `localhost:${config.port}`;
  // Use the protocol the request came in on (handles proxies if x-forwarded-proto is set)
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http');
  return `${proto}://${host}/auth/linkedin/callback`;
}

// Step 1: Redirect user to LinkedIn consent screen
router.get('/linkedin', (req, res) => {
  if (!config.linkedin.clientId || !config.linkedin.clientSecret) {
    res.status(500).json({
      error: 'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set in src/.env',
    });
    return;
  }

  const state = Math.random().toString(36).slice(2);
  // Store state in a cookie so we can verify on callback
  res.cookie('linkedin_oauth_state', state, { httpOnly: true, maxAge: 600_000 });

  const redirectUri = getRedirectUri(req);
  const authUrl =
    `https://www.linkedin.com/oauth/v2/authorization` +
    `?response_type=code` +
    `&client_id=${config.linkedin.clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}` +
    `&scope=${encodeURIComponent('w_member_social')}`;

  res.redirect(authUrl);
});

// Step 2: LinkedIn redirects back here with ?code=...
router.get('/linkedin/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query as Record<string, string>;

  if (error) {
    res.status(400).send(page('LinkedIn Error', `${error}: ${error_description || 'Unknown error'}`));
    return;
  }

  // Verify state
  const expectedState = req.cookies?.linkedin_oauth_state;
  if (!expectedState || state !== expectedState) {
    res.status(400).send(page('Error', 'State mismatch — possible CSRF. Try again from the Platforms tab.'));
    return;
  }

  if (!code) {
    res.status(400).send(page('Error', 'No authorization code received.'));
    return;
  }

  const redirectUri = getRedirectUri(req);

  // Exchange code for token
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.linkedin.clientId!,
      client_secret: config.linkedin.clientSecret!,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    res.status(500).send(page('Token Error', `LinkedIn rejected the code exchange: ${err}`));
    return;
  }

  const tokenData = await tokenRes.json() as { access_token: string; expires_in: number };

  // Resolve author URN — try multiple endpoints
  let authorUrn: string | null = null;

  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (meRes.ok) {
    const me = await meRes.json() as { id?: string };
    if (me.id) authorUrn = `urn:li:person:${me.id}`;
  }

  if (!authorUrn) {
    const infoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json() as { sub?: string };
      if (info.sub) authorUrn = `urn:li:person:${info.sub}`;
    }
  }

  if (!authorUrn) {
    const introRes = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: tokenData.access_token,
        client_id: config.linkedin.clientId!,
        client_secret: config.linkedin.clientSecret!,
      }),
    });
    if (introRes.ok) {
      const intro = await introRes.json() as { authorized_user_id?: string; sub?: string };
      const id = intro.authorized_user_id || intro.sub;
      if (id) authorUrn = `urn:li:person:${id}`;
    }
  }

  if (!authorUrn) {
    // Save the token anyway so they can manually add the URN
    setCredentials('linkedin', { access_token: tokenData.access_token });
    res.send(page('Partial Success',
      'Got the access token but could not resolve your author URN.<br><br>' +
      'Try enabling "Sign In with LinkedIn using OpenID Connect" on your app\'s Products tab, ' +
      'then reconnect.<br><br>' +
      'Token has been saved — you can add the URN manually in the Platforms tab.<br><br>' +
      '<a href="/" style="color:#33FF33">← Back to console</a>'
    ));
    return;
  }

  // Save both
  setCredentials('linkedin', { access_token: tokenData.access_token, author_urn: authorUrn });

  const expiresDate = new Date(Date.now() + tokenData.expires_in * 1000).toLocaleDateString();

  console.log(`[auth] LinkedIn connected — ${authorUrn}, expires ${expiresDate}`);

  res.send(page('LinkedIn Connected',
    `Author URN: ${authorUrn}<br>` +
    `Token expires: ${expiresDate}<br><br>` +
    `Credentials saved. LinkedIn is ready to post.<br><br>` +
    '<a href="/" style="color:#33FF33">← Back to console</a>'
  ));
});

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title} — CAWCAWCAW</title>
<link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
<style>
  body { background:#000; color:#33FF33; font-family:'VT323',monospace; font-size:20px;
         padding:3rem; line-height:1.6; text-shadow:0 0 6px rgba(51,255,51,0.45); }
  h2 { color:#80FF80; letter-spacing:.12em; margin-bottom:1rem; }
  a { color:#33FF33; }
</style></head>
<body><h2>${title}</h2><p>${body}</p></body></html>`;
}

export default router;
