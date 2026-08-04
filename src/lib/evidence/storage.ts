/**
 * Evidence file storage. Uploads go browser → Supabase Storage directly, so raw
 * CSV bytes never travel through a Server Action body (capped ~4.5MB on Vercel,
 * regardless of next.config.ts). The action receives only object paths.
 *
 * Bucket + RLS live in /supabase/evidence-storage.sql.
 */

export const EVIDENCE_BUCKET = "evidence-files";

/** Matches the bucket's file_size_limit in /supabase/evidence-storage.sql. */
export const MAX_EVIDENCE_FILE_BYTES = 25 * 1024 * 1024;

/** One uploaded object, as handed from the browser to the Server Action. */
export type EvidenceUpload = {
  path: string;
  name: string;
  size: number;
};

/** Strips anything that would confuse a storage key, keeping the extension. */
function safeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120)
    .toLowerCase();
}

/**
 * Path layout is `{workspaceId}/{clientId}/{uuid}-{filename}`. The leading
 * workspace segment is what the storage RLS policies check, so it must stay
 * first — see evidence-storage.sql.
 */
export function evidenceObjectPath(
  workspaceId: string,
  clientId: string,
  fileName: string,
): string {
  return `${workspaceId}/${clientId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
}

/** Defence in depth behind RLS: the path must sit under this workspace + client. */
export function isPathInScope(path: string, workspaceId: string, clientId: string): boolean {
  if (path.includes("..") || path.startsWith("/")) return false;
  const segments = path.split("/");
  return segments.length === 3 && segments[0] === workspaceId && segments[1] === clientId;
}
