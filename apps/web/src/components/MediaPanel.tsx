import { useCallback, useMemo, useRef, useState } from "react";
import type { Photo, Video, Bhajan } from "@maa/shared";
import { sanitizeMediaPayload } from "@maa/shared";

const MAX_IMG_RETRIES = 4;
const MAX_AUDIO_RETRIES = 3;
const DISPLAY_COUNT = 3;

interface Props {
  photos: Photo[];
  videos: Video[];
  bhajan: Bhajan | null;
}

function FallbackImage({ pool }: { pool: Photo[] }) {
  const [index, setIndex] = useState(0);
  const tried = useRef(new Set<number>());

  const handleError = useCallback(() => {
    tried.current.add(index);
    const next = pool.findIndex((_, i) => i > index && !tried.current.has(i));
    if (next !== -1 && tried.current.size < MAX_IMG_RETRIES) {
      setIndex(next);
    } else {
      setIndex(-1);
    }
  }, [index, pool]);

  if (index < 0 || index >= pool.length) return null;
  const photo = pool[index];

  return (
    <img
      src={photo.src}
      alt={photo.caption}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-24 w-24 shrink-0 rounded-md object-cover shadow-sm transition-opacity duration-300"
      onError={handleError}
    />
  );
}

function PhotoStrip({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null;

  const slots: Photo[][] = [];
  let cursor = 0;
  for (let s = 0; s < DISPLAY_COUNT && cursor < photos.length; s++) {
    const slotPool: Photo[] = [];
    const count = Math.ceil((photos.length - cursor) / (DISPLAY_COUNT - s));
    for (let j = 0; j < count && cursor < photos.length; j++) {
      slotPool.push(photos[cursor++]);
    }
    slots.push(slotPool);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {slots.map((pool, i) => (
        <FallbackImage key={`slot-${i}-${pool[0]?.src}`} pool={pool} />
      ))}
    </div>
  );
}

function FallbackAudio({ bhajan }: { bhajan: Bhajan }) {
  const allSrcs = [
    bhajan.audioSrc,
    ...(bhajan.fallbackAudioSrcs ?? []),
  ].filter(Boolean) as string[];

  const [srcIndex, setSrcIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const retries = useRef(0);

  const handleError = useCallback(() => {
    retries.current++;
    const next = srcIndex + 1;
    if (next < allSrcs.length && retries.current <= MAX_AUDIO_RETRIES) {
      setSrcIndex(next);
    } else {
      setFailed(true);
    }
  }, [srcIndex, allSrcs.length]);

  if (failed || allSrcs.length === 0) {
    return (
      <p className="text-[10px] italic text-muted-brown/60">
        Audio unavailable — please try again later.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-brown">
        {bhajan.title} — {bhajan.artist}
      </p>
      <audio
        key={allSrcs[srcIndex]}
        src={allSrcs[srcIndex]}
        controls
        autoPlay
        className="h-8 w-full max-w-[280px]"
        onLoadStart={(e) => {
          (e.target as HTMLAudioElement).volume = 0.25;
        }}
        onError={handleError}
      />
    </div>
  );
}

export default function MediaPanel({ photos, videos, bhajan }: Props) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const safe = useMemo(
    () => sanitizeMediaPayload({ photos, videos, bhajan }),
    [photos, videos, bhajan],
  );

  const hasContent =
    safe.photos.length > 0 || safe.videos.length > 0 || safe.bhajan;

  if (!hasContent) return null;

  return (
    <div className="mt-4 space-y-3 rounded-lg bg-cream-dark/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-brown">
        Atmosphere
      </p>

      <PhotoStrip photos={safe.photos} />

      {safe.videos.length > 0 && (
        <div className="space-y-2">
          {safe.videos.map((v) =>
            showVideo ? (
              <div key={v.embedUrl} className="aspect-video w-full max-w-xs overflow-hidden rounded-md">
                <iframe
                  src={`${v.embedUrl}?autoplay=0&rel=0`}
                  title={v.title}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            ) : (
              <button
                key={v.embedUrl}
                onClick={() => setShowVideo(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/60 px-3 py-1.5 text-xs text-warm-brown transition hover:bg-white"
              >
                <span>▶</span> {v.title}
              </button>
            ),
          )}
        </div>
      )}

      {safe.bhajan && (
        <div>
          {!audioPlaying ? (
            <button
              onClick={() => setAudioPlaying(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/60 px-3 py-1.5 text-xs text-warm-brown transition hover:bg-white"
            >
              <span>♫</span>
              <span>{safe.bhajan.title}</span>
              <span className="text-muted-brown/60">— {safe.bhajan.artist}</span>
            </button>
          ) : safe.bhajan.audioSrc ? (
            <FallbackAudio bhajan={safe.bhajan} />
          ) : safe.bhajan.embedUrl ? (
            <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md">
              <iframe
                src={`${safe.bhajan.embedUrl}?autoplay=1&rel=0`}
                title={safe.bhajan.title}
                allow="autoplay; encrypted-media"
                className="h-full w-full"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
