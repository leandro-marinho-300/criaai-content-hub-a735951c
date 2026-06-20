// Helpers para tokens de aprovação. Browser-safe (Web Crypto).

export function generateApprovalToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url
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
