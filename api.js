// Thin fetch wrapper around /api/db — reads and writes one encrypted blob.
// The access token is a per-device string stored in localStorage.

const TOKEN_KEY = 'wp-studio-access-token';
const API_URL = '/api/db';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t.trim());
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchBlob() {
  const r = await fetch(API_URL, {
    headers: { 'x-access-token': getToken() }
  });
  if (r.status === 404) return null;
  if (r.status === 401) throw new Error('BAD_TOKEN');
  if (!r.ok) throw new Error('FETCH_FAILED_' + r.status);
  const buf = await r.arrayBuffer();
  return new Uint8Array(buf);
}

export async function putBlob(bytes) {
  const r = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'x-access-token': getToken(),
      'content-type': 'application/octet-stream'
    },
    body: bytes
  });
  if (r.status === 401) throw new Error('BAD_TOKEN');
  if (!r.ok) throw new Error('PUT_FAILED_' + r.status);
  return r.json();
}

// ─── vault files (one ciphertext blob per file) ─────────────────────
const VAULT_URL = '/api/vault/';

export async function fetchVaultFile(id) {
  const r = await fetch(VAULT_URL + encodeURIComponent(id), {
    headers: { 'x-access-token': getToken() }
  });
  if (r.status === 404) return null;
  if (r.status === 401) throw new Error('BAD_TOKEN');
  if (!r.ok) throw new Error('FETCH_FILE_FAILED_' + r.status);
  const buf = await r.arrayBuffer();
  return new Uint8Array(buf);
}

export async function putVaultFile(id, bytes) {
  const r = await fetch(VAULT_URL + encodeURIComponent(id), {
    method: 'PUT',
    headers: {
      'x-access-token': getToken(),
      'content-type': 'application/octet-stream'
    },
    body: bytes
  });
  if (r.status === 401) throw new Error('BAD_TOKEN');
  if (r.status === 413) throw new Error('FILE_TOO_LARGE');
  if (!r.ok) throw new Error('PUT_FILE_FAILED_' + r.status);
  return r.json();
}

export async function deleteVaultFile(id) {
  const r = await fetch(VAULT_URL + encodeURIComponent(id), {
    method: 'DELETE',
    headers: { 'x-access-token': getToken() }
  });
  if (r.status === 401) throw new Error('BAD_TOKEN');
  if (!r.ok) throw new Error('DEL_FILE_FAILED_' + r.status);
  return r.json();
}
