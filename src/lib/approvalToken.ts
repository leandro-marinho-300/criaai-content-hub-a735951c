// Helpers para tokens e senhas de aprovação. Compatível com browser e Node Workers (Web Crypto).

export function generateApprovalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hashApprovalToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function approvalUrl(token: string): string {
  if (typeof window === "undefined") return `/approval/${token}`;
  return `${window.location.origin}/approval/${token}`;
}

// ----- senha (PBKDF2-SHA256, 150k iterações) -----
const PBKDF2_ITERATIONS = 150_000;

function bufToB64(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as ArrayBuffer, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bufToB64(new Uint8Array(bits));
}

export async function hashApprovalPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bufToB64(salt)}$${hash}`;
}

export async function verifyApprovalPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, itStr, saltB64, hashB64] = stored.split("$");
    if (scheme !== "pbkdf2") return false;
    const iterations = Number(itStr);
    const salt = b64ToBuf(saltB64);
    const hash = await pbkdf2(password, salt, iterations);
    // comparação constante-ish
    if (hash.length !== hashB64.length) return false;
    let diff = 0;
    for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashB64.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
