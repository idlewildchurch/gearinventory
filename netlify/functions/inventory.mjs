// Idlewild Students Gear — the save function.
// GET  /api/inventory  → the current inventory (anyone with the link can view)
// POST /api/inventory  → apply changes, saved as a commit to data/inventory.json in GitHub
//
// Netlify environment variables (Site configuration → Environment variables):
//   GITHUB_TOKEN   fine-grained token with "Contents: Read and write" on this one repository
//   GITHUB_REPO    owner/name, for example  idlewild/student-gear
//   GITHUB_BRANCH  optional, defaults to main
//   TEAM_PASSWORD  optional; when set, changes need this password (viewing never does)

const FILE = 'data/inventory.json';
const MAX_OPS = 200;
const MAX_ITEM_BYTES = 20000;

function env(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function github(path, init = {}) {
  const repo = env('GITHUB_REPO');
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'idlewild-gear-site',
      ...(init.headers || {}),
    },
  });
  return res;
}

async function readFile() {
  const branch = env('GITHUB_BRANCH', 'main');
  const res = await github(`${FILE}?ref=${encodeURIComponent(branch)}`, { cache: 'no-store' });
  if (res.status === 404) return { data: { items: {} }, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
  const body = await res.json();
  const text = Buffer.from(body.content || '', 'base64').toString('utf8');
  return { data: text.trim() ? JSON.parse(text) : { items: {} }, sha: body.sha };
}

async function writeFile(data, sha, message) {
  const branch = env('GITHUB_BRANCH', 'main');
  const content = Buffer.from(JSON.stringify(data, null, 1) + '\n', 'utf8').toString('base64');
  const res = await github(FILE, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, content, branch, ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (!res.ok) throw new Error(`GitHub save failed (${res.status})`);
  return { conflict: false };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// nested objects merge; anything else (arrays included) replaces
function merge(base, patch) {
  const out = { ...(isObj(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  }
  return out;
}

function newId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function validId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
}

function applyOps(data, ops) {
  const items = { ...(data.items || {}) };
  const labels = [];
  for (const op of ops) {
    if (!op || typeof op !== 'object') throw new Error('bad change');
    if (op.op === 'add' || op.op === 'set') {
      if (!isObj(op.data) || JSON.stringify(op.data).length > MAX_ITEM_BYTES) throw new Error('bad item');
      const id = op.op === 'add' ? (validId(op.id) ? op.id : newId()) : op.id;
      if (!validId(id)) throw new Error('bad id');
      items[id] = op.data;
      labels.push(`${op.op === 'add' ? 'Add' : 'Update'} ${String(op.data.name || id).slice(0, 60)}`);
    } else if (op.op === 'update') {
      if (!validId(op.id) || !isObj(op.patch)) throw new Error('bad update');
      if (!items[op.id]) continue; // item was deleted by someone else; skip quietly
      items[op.id] = merge(items[op.id], op.patch);
      if (JSON.stringify(items[op.id]).length > MAX_ITEM_BYTES) throw new Error('item too large');
      labels.push(`Update ${String(items[op.id].name || op.id).slice(0, 60)}`);
    } else if (op.op === 'delete') {
      if (!validId(op.id)) throw new Error('bad id');
      if (items[op.id]) labels.push(`Delete ${String(items[op.id].name || op.id).slice(0, 60)}`);
      delete items[op.id];
    } else {
      throw new Error('unknown change');
    }
  }
  return { data: { ...data, items }, labels };
}

export default async (req) => {
  if (!env('GITHUB_TOKEN') || !env('GITHUB_REPO')) {
    return json({ error: 'The site is missing its GitHub settings. Add GITHUB_TOKEN and GITHUB_REPO in Netlify.' }, 500);
  }

  if (req.method === 'GET') {
    try {
      const { data, sha } = await readFile();
      return json({ items: data.items || {}, version: sha });
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const password = env('TEAM_PASSWORD');
  if (password && req.headers.get('x-team-password') !== password) {
    return json({ error: 'Team password needed' }, 401);
  }

  let ops;
  try {
    const body = await req.json();
    ops = body.ops;
    if (!Array.isArray(ops) || !ops.length || ops.length > MAX_OPS) throw new Error();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  // Apply each save to the newest copy of the file. If someone else saved in the
  // same moment, GitHub refuses the stale write and we re-read and try again.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const { data, sha } = await readFile();
      const { data: next, labels } = applyOps(data, ops);
      const summary = labels.length === 1 ? labels[0] : `${labels.length} changes`;
      const result = await writeFile(next, sha, `${summary} [skip netlify]`);
      if (!result.conflict) return json({ items: next.items });
    } catch (e) {
      return json({ error: e.message }, /bad|unknown|large/.test(e.message) ? 400 : 502);
    }
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
  }
  return json({ error: 'Too many people saving at once. Try again.' }, 503);
};

export const config = { path: '/api/inventory' };
