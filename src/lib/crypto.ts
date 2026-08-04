/**
 * AES-GCM encryption for LLM API keys stored in workspace_settings.
 * Iron rule #5: encrypted at rest, masked in UI, never logged.
 * Key = ENCRYPTION_KEY env var (32 bytes hex).
 */

function getKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return key;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encrypt(plaintext: string): Promise<string> {
  const keyBytes = hexToBytes(getKey());
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded,
  );
  // Store as iv:ciphertext (both hex-encoded)
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

export async function decrypt(encryptedHex: string): Promise<string> {
  const [ivHex, ciphertextHex] = encryptedHex.split(":");
  if (!ivHex || !ciphertextHex) throw new Error("Invalid encrypted format");

  const keyBytes = hexToBytes(getKey());
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(ciphertextHex);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

/** Returns "**** **** **** {last4}" — safe to send to client */
export function maskKey(encryptedHex: string): string {
  // We can't decrypt on the client, so we just show a fixed mask
  // The last 4 chars of the enc string are meaningless — we show ••••••••
  return "sk-••••••••••••••••••••••••••••••";
}
