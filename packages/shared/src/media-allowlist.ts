import type { Bhajan, Photo, Video } from "./types.js";

/**
 * Defense-in-depth URL validation for media loaded in the browser.
 * Blocks unexpected origins if the API payload is ever tampered with or
 * a future code path accidentally merges untrusted data.
 */

function hasNoPathTraversal(pathname: string): boolean {
  return !pathname.includes("..") && !pathname.includes("//");
}

export function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "maa-aap-bucket.s3.us-east-1.amazonaws.com") return false;
    if (!hasNoPathTraversal(u.pathname)) return false;
    return u.pathname.startsWith("/media/images/");
  } catch {
    return false;
  }
}

export function isAllowedAudioUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!hasNoPathTraversal(u.pathname)) return false;
    if (u.hostname === "maa-aap-bucket.s3.us-east-1.amazonaws.com") {
      return u.pathname.startsWith("/media/audio/");
    }
    if (u.hostname === "www.anandamayi.org") {
      return u.pathname.startsWith("/mmedia/");
    }
    return false;
  } catch {
    return false;
  }
}

export function isAllowedYoutubeEmbedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "www.youtube.com") return false;
    return u.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}

export function isAllowedYoutubeWatchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "www.youtube.com") return false;
    return u.pathname === "/watch";
  } catch {
    return false;
  }
}

export function sanitizePhoto(photo: Photo): Photo | null {
  if (!isAllowedImageUrl(photo.src)) return null;
  return { ...photo, src: photo.src.trim() };
}

export function sanitizeVideo(video: Video): Video | null {
  if (!isAllowedYoutubeEmbedUrl(video.embedUrl)) return null;
  if (video.externalUrl && !isAllowedYoutubeWatchUrl(video.externalUrl)) return null;
  return video;
}

export function sanitizeBhajan(b: Bhajan): Bhajan | null {
  if (b.mediaType === "youtube") {
    if (!b.embedUrl || !isAllowedYoutubeEmbedUrl(b.embedUrl)) return null;
    if (b.externalUrl && !isAllowedYoutubeWatchUrl(b.externalUrl)) return null;
    return b;
  }

  const chain = [b.audioSrc, ...(b.fallbackAudioSrcs ?? [])].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  const allowed = chain.filter(isAllowedAudioUrl);
  if (allowed.length === 0) return null;

  const [audioSrc, ...fallbackAudioSrcs] = allowed;
  return {
    ...b,
    audioSrc,
    fallbackAudioSrcs: fallbackAudioSrcs.slice(0, 6),
  };
}

export function sanitizeMediaPayload(input: {
  photos: Photo[];
  videos: Video[];
  bhajan: Bhajan | null;
}): { photos: Photo[]; videos: Video[]; bhajan: Bhajan | null } {
  const photos = input.photos.map(sanitizePhoto).filter((p): p is Photo => p !== null);
  const videos = input.videos.map(sanitizeVideo).filter((v): v is Video => v !== null);
  const bhajan = input.bhajan ? sanitizeBhajan(input.bhajan) : null;
  return { photos, videos, bhajan };
}
