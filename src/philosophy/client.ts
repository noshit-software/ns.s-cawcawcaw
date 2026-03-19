import { config } from '../config.js';

export interface ProjectPhilosophy {
  statement: string;
  narrativeArc: string;
  doNotPublishPatterns: string[];
}

interface McpTopic {
  key: string;
  value: string;
}

async function fetchTopic(key: string): Promise<McpTopic | null> {
  const url = new URL('/topics/' + encodeURIComponent(key), config.knightsrookMcpUrl);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MCP fetch failed for ${key}: ${res.status}`);
  return res.json() as Promise<McpTopic>;
}

function parsePhilosophy(raw: string): ProjectPhilosophy {
  // The philosophy docs are markdown — extract what we can, treat full text as statement
  // Projects can structure as they like; we pass the full text to Claude
  const arcMatch = raw.match(/##\s*[Nn]arrative\s*[Aa]rc\s*\n([\s\S]*?)(?=\n##|$)/);
  const suppressMatch = raw.match(/##\s*[Dd]o\s*[Nn]ot\s*[Pp]ublish\s*\n([\s\S]*?)(?=\n##|$)/);

  const narrativeArc = arcMatch ? arcMatch[1].trim() : '';
  const doNotPublishPatterns = suppressMatch
    ? suppressMatch[1]
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    : [];

  return { statement: raw, narrativeArc, doNotPublishPatterns };
}

export async function fetchPhilosophy(repoName: string): Promise<ProjectPhilosophy> {
  const projectKey = `project:${repoName}:philosophy`;
  const defaultKey = 'project:default:philosophy';

  const topic = (await fetchTopic(projectKey)) ?? (await fetchTopic(defaultKey));

  if (!topic) {
    throw new Error(
      `No philosophy found for project "${repoName}" and no default philosophy exists. ` +
        `Create a topic at key "${projectKey}" in the Knightsrook MCP before pushing.`
    );
  }

  return parsePhilosophy(topic.value);
}
