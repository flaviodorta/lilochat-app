/**
 * Keyset pagination cursor for the directory: (createdAt DESC, roomId DESC).
 * Opaque base64url of `<iso>|<uuid>` — stable under inserts, no OFFSET drift.
 */
export interface DirectoryCursor {
  createdAt: Date;
  roomId: string;
}

export function encodeCursor(cursor: DirectoryCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.roomId}`).toString('base64url');
}

export function decodeCursor(raw: string): DirectoryCursor | null {
  try {
    const [iso, roomId] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!iso || !roomId) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, roomId };
  } catch {
    return null;
  }
}
