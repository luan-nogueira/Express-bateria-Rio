/**
 * Leitura e publicação das planilhas no repositório do GitHub.
 *
 * Publicar exige um token "fine-grained" do GitHub com permissão
 * Contents: Read and write SOMENTE neste repositório. O token fica salvo
 * apenas no navegador de quem o colou (localStorage) e nunca vai para o código.
 * Uma publicação = um commit com as três planilhas; o GitHub Actions valida
 * e atualiza o site em cerca de 1 minuto.
 */
export const REPO = { owner: 'luan-nogueira', repo: 'Express-bateria-Rio', branch: 'main' };
export const ACTIONS_URL = `https://github.com/${REPO.owner}/${REPO.repo}/actions`;

const TOKEN_KEY = 'ebr-admin-github-token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem armazenamento: o token vale só nesta página */
  }
}

export class GitHubError extends Error {}

const MESSAGES = {
  401: 'Token inválido ou expirado. Gere um novo token no GitHub.',
  403: 'O token não tem permissão de escrita neste repositório (Contents: Read and write).',
  404: 'Repositório não encontrado para este token. Confira se o token dá acesso ao repositório Express-bateria-Rio.',
  409: 'O repositório mudou durante a publicação. Tente publicar de novo.',
  422: 'O GitHub recusou a publicação. Tente de novo em alguns segundos.',
};

async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  if (!token) throw new GitHubError('Cole o token do GitHub na aba Publicar antes de continuar.');
  const res = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new GitHubError(MESSAGES[res.status] || `Erro ${res.status} ao falar com o GitHub.`);
  return res.status === 204 ? null : res.json();
}

const decodeBase64Utf8 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

/** Lê um arquivo do repositório. Com token usa a API (sempre atual); sem token, o endereço público. */
export async function readFile(path) {
  if (getToken()) {
    try {
      const data = await api(`/contents/${path}?ref=${REPO.branch}`);
      return decodeBase64Utf8(data.content);
    } catch (err) {
      if (err instanceof GitHubError && /não encontrado/.test(err.message)) return null;
      throw err;
    }
  }
  const res = await fetch(`https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/${path}?t=${Date.now()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(`Não foi possível ler ${path} (erro ${res.status}).`);
  return res.text();
}

/** Confere se o token funciona e pode escrever no repositório. */
export async function testConnection() {
  const repo = await api('');
  if (!repo.permissions?.push) throw new GitHubError(MESSAGES[403]);
  return repo.full_name;
}

/** Publica vários arquivos em um único commit na branch principal. */
export async function commitFiles(files, message) {
  const ref = await api(`/git/ref/heads/${REPO.branch}`);
  const parent = ref.object.sha;
  const parentCommit = await api(`/git/commits/${parent}`);
  const tree = await api('/git/trees', {
    method: 'POST',
    body: {
      base_tree: parentCommit.tree.sha,
      tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
    },
  });
  const commit = await api('/git/commits', {
    method: 'POST',
    body: { message, tree: tree.sha, parents: [parent] },
  });
  await api(`/git/refs/heads/${REPO.branch}`, { method: 'PATCH', body: { sha: commit.sha } });
  return commit.html_url || `https://github.com/${REPO.owner}/${REPO.repo}/commit/${commit.sha}`;
}
