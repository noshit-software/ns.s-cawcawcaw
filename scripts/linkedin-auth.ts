#!/usr/bin/env npx tsx
/**
 * LinkedIn OAuth 2.0 setup — gets a token + URN and saves them to cawcawcaw.
 *
 * Usage:
 *   npm run linkedin-auth
 *
 * Prerequisites:
 *   - A LinkedIn developer app with "Share on LinkedIn" product enabled
 *   - LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in src/.env
 *   - http://localhost:3939/callback in your app's Authorized redirect URLs
 */

import http from 'node:http';
import { URL } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_PORT = 3939;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = 'w_member_social';

// Credential store path — same as the main app uses
const CAWCAWCAW_DIR = join(homedir(), '.cawcawcaw');
const CREDENTIALS_PATH = join(CAWCAWCAW_DIR, 'credentials.json');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n  Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET.');
  console.error('  Add them to src/.env\n');
  console.error('  Find them at: https://developer.linkedin.com/ → your app → Auth tab\n');
  process.exit(1);
}

const state = Math.random().toString(36).slice(2);

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization` +
  `?response_type=code` +
  `&client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${state}` +
  `&scope=${encodeURIComponent(SCOPES)}`;

function saveToCredentialStore(accessToken: string, authorUrn: string): void {
  mkdirSync(CAWCAWCAW_DIR, { recursive: true });
  let store: Record<string, Record<string, string>> = {};
  if (existsSync(CREDENTIALS_PATH)) {
    try { store = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8')); } catch {}
  }
  store.linkedin = { ...store.linkedin, access_token: accessToken, author_urn: authorUrn };
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (error) {
    const msg = `LinkedIn error: ${error}\n${errorDesc || ''}`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Error', msg));
    console.error(`\n  ${msg}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== state || !code) {
    const msg = !code ? 'No authorization code received.' : 'State mismatch — try again.';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Error', msg));
    server.close();
    process.exit(1);
  }

  // Exchange code for token
  console.log('  Exchanging code for access token...');

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    const msg = `Token exchange failed: ${err}`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Error', msg));
    console.error(`\n  ${msg}`);
    server.close();
    process.exit(1);
  }

  const tokenData = await tokenRes.json() as { access_token: string; expires_in: number };
  console.log('  Got access token. Fetching profile...');

  // Try multiple endpoints to get the person URN
  let authorUrn: string | null = null;

  // Attempt 1: /v2/me (needs r_liteprofile, but sometimes works with w_member_social)
  const meRes = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (meRes.ok) {
    const me = await meRes.json() as { id?: string };
    if (me.id) authorUrn = `urn:li:person:${me.id}`;
  } else {
    console.log(`  /v2/me returned ${meRes.status}, trying /v2/userinfo...`);
  }

  // Attempt 2: /v2/userinfo (needs openid scope, may not work)
  if (!authorUrn) {
    const infoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json() as { sub?: string };
      if (info.sub) authorUrn = `urn:li:person:${info.sub}`;
    } else {
      console.log(`  /v2/userinfo returned ${infoRes.status}`);
    }
  }

  // Attempt 3: introspect the token
  if (!authorUrn) {
    const introRes = await fetch('https://www.linkedin.com/oauth/v2/introspectToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: tokenData.access_token,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
      }),
    });
    if (introRes.ok) {
      const intro = await introRes.json() as { authorized_user_id?: string; sub?: string };
      const id = intro.authorized_user_id || intro.sub;
      if (id) authorUrn = `urn:li:person:${id}`;
    } else {
      console.log(`  Token introspection returned ${introRes.status}`);
    }
  }

  if (!authorUrn) {
    const msg = 'Got the access token but could not resolve your author URN.\n\n'
      + 'You may need to enable "Sign In with LinkedIn using OpenID Connect" on your app\'s Products tab, '
      + 'then run this script again.';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page('Partial Success', msg + `\n\nAccess token (saved anyway): ${tokenData.access_token}`));
    console.error(`\n  ${msg}`);
    // Save what we have
    saveToCredentialStore(tokenData.access_token, '');
    server.close();
    process.exit(1);
  }

  // Save both to credential store
  saveToCredentialStore(tokenData.access_token, authorUrn);

  const expiresDate = new Date(Date.now() + tokenData.expires_in * 1000).toLocaleDateString();

  console.log(`
════════════════════════════════════════════════
  LinkedIn configured!
════════════════════════════════════════════════

  AUTHOR URN:   ${authorUrn}
  EXPIRES:      ${expiresDate}

  Credentials saved to ${CREDENTIALS_PATH}
  LinkedIn is ready to use in cawcawcaw.
════════════════════════════════════════════════
`);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page('Done!', `LinkedIn configured. Credentials saved.<br><br>Author URN: ${authorUrn}<br>Expires: ${expiresDate}<br><br>You can close this tab.`));

  server.close();
  process.exit(0);
});

function page(title: string, body: string): string {
  return `<html><body style="background:#000;color:#33FF33;font-family:'Courier New',monospace;padding:2rem;line-height:1.6">
    <h2>${title}</h2><p style="white-space:pre-wrap">${body}</p>
  </body></html>`;
}

server.listen(REDIRECT_PORT, () => {
  console.log(`\n  Listening on http://localhost:${REDIRECT_PORT}/callback`);
  console.log('  Opening LinkedIn...\n');

  try {
    const cmd = process.platform === 'win32' ? `start "" "${authUrl}"`
      : process.platform === 'darwin' ? `open "${authUrl}"`
      : `xdg-open "${authUrl}"`;
    execSync(cmd, { stdio: 'ignore' });
  } catch {
    console.log(`  Could not open browser. Open this URL:\n\n  ${authUrl}\n`);
  }
});
