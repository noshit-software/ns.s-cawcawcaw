// Per-account GitHub PATs, keyed by repo owner — lets catchup/webhook auth
// against private repos on any number of GitHub accounts without per-project
// secrets. Include every account you use, primary included — there is no
// separate fallback token.
//
// .env: GITHUB_TOKENS='{"my-main-account":"ghp_xxx","some-other-account":"ghp_yyy"}'

let cachedMap: Record<string, string> | null = null;

function loadMap(): Record<string, string> {
  if (cachedMap) return cachedMap;
  const raw = process.env.GITHUB_TOKENS;
  if (!raw) {
    cachedMap = {};
    return cachedMap;
  }
  try {
    cachedMap = JSON.parse(raw) as Record<string, string>;
  } catch {
    console.error('[cawcawcaw] GITHUB_TOKENS is not valid JSON — ignoring it');
    cachedMap = {};
  }
  return cachedMap;
}

export function getGitHubToken(repo: string): string | undefined {
  const owner = repo.split('/')[0];
  return loadMap()[owner];
}
