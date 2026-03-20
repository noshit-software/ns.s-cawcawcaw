import { getProjectConfig } from '../store/project-config.js';

export interface ProjectPhilosophy {
  statement: string;
  narrativeArc: string;
  doNotPublishPatterns: string[];
}

function parsePhilosophy(raw: string): ProjectPhilosophy {
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

export async function fetchPhilosophy(projectName: string): Promise<ProjectPhilosophy> {
  const config = getProjectConfig(projectName);

  if (!config.philosophy) {
    throw new Error(
      `No philosophy set for project "${projectName}". ` +
      `Add one in the Projects tab before running catchup.`
    );
  }

  return parsePhilosophy(config.philosophy);
}
