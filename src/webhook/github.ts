export interface GitHubCommit {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubPush {
  ref: string;
  repository: {
    name: string;
    full_name: string;
    default_branch: string;
  };
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
}

export interface CommitSummary {
  message: string;
  author: string;
}

export function extractCommits(push: GitHubPush): CommitSummary[] {
  return push.commits
    .map(c => ({
      message: c.message.split('\n')[0].trim(), // subject line only
      author: c.author.name,
    }))
    .filter(c => c.message.length > 0);
}

export function isDefaultBranch(push: GitHubPush): boolean {
  const branch = push.ref.replace('refs/heads/', '');
  return branch === push.repository.default_branch;
}
