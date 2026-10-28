// WebCrypto AES-GCM + PBKDF2-SHA256 (300k iterations).
// Blob layout: [16 bytes salt][12 bytes IV][ciphertext]
// Session key is held in memory only; never persisted.

const ITERS = 300000;
const SALT_LEN = 16;
const IV_LEN = 12;

let sKey = null;
let sSalt = null;

async function derive(password, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function setup(password) {
  sSalt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  sKey = await derive(password, sSalt);
}

export async function unlock(password, blobBytes) {
  if (blobBytes.length < SALT_LEN + IV_LEN + 16) {
    throw new Error('CORRUPT_BLOB');
  }
  const salt = blobBytes.slice(0, SALT_LEN);
  const iv = blobBytes.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = blobBytes.slice(SALT_LEN + IV_LEN);
  const key = await derive(password, salt);
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new Error('WRONG_PASSWORD');
  }
  sKey = key;
  sSalt = salt;
  return JSON.parse(new TextDecoder().decode(pt));
}

export function lock() {
  sKey = null;
  sSalt = null;
}

export function isUnlocked() {
  return sKey !== null;
}

export async function encrypt(data) {
  if (!sKey || !sSalt) throw new Error('LOCKED');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const pt = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sKey, pt);
  const out = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength);
  out.set(sSalt, 0);
  out.set(iv, SALT_LEN);
  out.set(new Uint8Array(ct), SALT_LEN + IV_LEN);
  return out;
}

// Encrypt raw bytes (for file vault). Same session key, no JSON step.
export async function encryptBytes(bytes) {
  if (!sKey || !sSalt) throw new Error('LOCKED');
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sKey, bytes);
  const out = new Uint8Array(SALT_LEN + IV_LEN + ct.byteLength);
  out.set(sSalt, 0);
  out.set(iv, SALT_LEN);
  out.set(new Uint8Array(ct), SALT_LEN + IV_LEN);
  return out;
}

// Decrypt bytes previously produced by encryptBytes. Returns a Uint8Array.
export async function decryptBytes(blobBytes) {
  if (!sKey) throw new Error('LOCKED');
  if (blobBytes.length < SALT_LEN + IV_LEN + 16) throw new Error('CORRUPT_BLOB');
  const iv = blobBytes.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const ct = blobBytes.slice(SALT_LEN + IV_LEN);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sKey, ct);
  return new Uint8Array(pt);
}
