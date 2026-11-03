import crypto from 'node:crypto';
import type { MergeStrategy } from '../../config/src/index.js';

export interface PullRequestState { number: number; url: string; headSha: string; ciPassed: boolean; aiBlocks: boolean; approvals: number; conversationsResolved: boolean; }
export interface GitHubClient { createOrUpdatePullRequest(input: { owner: string; repo: string; head: string; base: string; title: string; body: string }): Promise<{ number: number; url: string }>; enableAutoMerge(input: { owner: string; repo: string; number: number }): Promise<void>; }

export function createAppJwt(appId: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT' });
  const payload = encode({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId });
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

export async function createInstallationToken(appId: string, privateKey: string, installationId: string): Promise<string> {
  const jwt = createAppJwt(appId, privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, { method: 'POST', headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${jwt}`, 'x-github-api-version': '2022-11-28' } });
  if (!response.ok) throw new Error(`GitHub installation token ${response.status}`);
  const body = await response.json() as { token?: string };
  if (!body.token) throw new Error('GitHub installation token 响应缺少 token');
  return body.token;
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function canMerge(state: PullRequestState, strategy: MergeStrategy, requiredHumanApprovals = 1): boolean {
  if (strategy === 'manual' || !state.ciPassed || state.aiBlocks || !state.conversationsResolved) return false;
  if (strategy === 'auto_after_human_approval' && state.approvals < requiredHumanApprovals) return false;
  return true;
}

export class GitHubFetchClient implements GitHubClient {
  constructor(private readonly token: string) {}
  private async request(path: string, init: RequestInit = {}) { const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) } }); if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`); return response.json(); }
  async createOrUpdatePullRequest(input: { owner: string; repo: string; head: string; base: string; title: string; body: string }) {
    const existing = await this.request(`/repos/${input.owner}/${input.repo}/pulls?state=open&head=${encodeURIComponent(input.head)}`) as Array<{ number: number; html_url: string }>;
    const response = existing[0]
      ? await this.request(`/repos/${input.owner}/${input.repo}/pulls/${existing[0].number}`, { method: 'PATCH', body: JSON.stringify({ title: input.title, body: input.body, base: input.base }), headers: { 'content-type': 'application/json' } }) as { number: number; html_url: string }
      : await this.request(`/repos/${input.owner}/${input.repo}/pulls`, { method: 'POST', body: JSON.stringify({ head: input.head, base: input.base, title: input.title, body: input.body }), headers: { 'content-type': 'application/json' } }) as { number: number; html_url: string };
    return { number: response.number, url: response.html_url };
  }
  async enableAutoMerge(input: { owner: string; repo: string; number: number }) {
    const query = `query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}}`;
    const mutation = `mutation($pullRequestId:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$pullRequestId,mergeMethod:SQUASH}){pullRequest{number}}}`;
    const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: `${query} ${mutation}`, variables: { owner: input.owner, repo: input.repo, number: input.number } }) });
    if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}`);
    const body = await response.json() as { errors?: Array<{ message: string }> };
    if (body.errors?.length) throw new Error(`GitHub auto-merge: ${body.errors.map(e => e.message).join('; ')}`);
  }
}
