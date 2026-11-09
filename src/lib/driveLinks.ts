// Helpers for Google Drive links attached to calendar events.
//
// A Drive share link (https://drive.google.com/file/d/<id>/view) is a web page,
// not a media file, so it can't be used as an <img> or <video> source. Drive
// does offer an embeddable player at /file/d/<id>/preview, which plays videos
// and shows images inline, as long as the file is shared "anyone with the link".

const FILE_ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?(?:.*&)?id=([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/[a-z]+\/d\/([a-zA-Z0-9_-]+)/,
];

/** Returns the Drive file id for a Drive file link, or null for anything else. */
export function getDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  for (const pattern of FILE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** True for links to Google Drive (files or folders). */
export function isDriveLink(url?: string | null): boolean {
  return !!url && typeof url === 'string' && /(^|\/\/)(drive|docs)\.google\.com\//.test(url);
}

/** Embeddable preview URL for a Drive file link, or null if it isn't one. */
export function getDrivePreviewUrl(url?: string | null): string | null {
  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

/** Best guess at "image" vs "video" for a media URL. Drive links default to video. */
export function guessMediaType(url?: string | null): 'image' | 'video' | '' {
  if (!url) return '';
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|webm|avi|mkv|m4v)(\?|$)/.test(lower)) return 'video';
  if (/\.(jpe?g|png|gif|webp|heic|avif)(\?|$)/.test(lower)) return 'image';
  if (isDriveLink(url)) return 'video';
  return 'image';
}

/**
 * Direct image URL for a Drive file, usable as an <img> src (the file must be
 * shared "anyone with the link"). Used for carousel slides so they can be
 * swiped like a post instead of each loading Drive's full viewer.
 */
export function getDriveImageUrl(url?: string | null, width = 1080): string | null {
  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : null;
}

/** Cleans a list of media links: strings only, trimmed, empties and duplicates dropped. */
export function cleanMediaUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
