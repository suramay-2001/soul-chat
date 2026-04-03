import { useState } from "react";
import type { Photo, Video, Bhajan } from "@maa/shared";

interface Props {
  photos: Photo[];
  videos: Video[];
  bhajan: Bhajan | null;
}

export default function MediaPanel({ photos, videos, bhajan }: Props) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const hasContent = photos.length > 0 || videos.length > 0 || bhajan;

  if (!hasContent) return null;

  const audioSrc = bhajan?.audioSrc;

  return (
    <div className="mt-4 space-y-3 rounded-lg bg-cream-dark/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-brown">
        Atmosphere
      </p>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            <img
              key={p.src}
              src={p.src}
              alt={p.caption}
              loading="lazy"
              className="h-24 w-24 shrink-0 rounded-md object-cover shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((v) =>
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

      {bhajan && (
        <div>
          {!audioPlaying ? (
            <button
              onClick={() => setAudioPlaying(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/60 px-3 py-1.5 text-xs text-warm-brown transition hover:bg-white"
            >
              <span>♫</span>
              <span>{bhajan.title}</span>
              <span className="text-muted-brown/60">— {bhajan.artist}</span>
            </button>
          ) : audioSrc ? (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-brown">
                {bhajan.title} — {bhajan.artist}
              </p>
              <audio
                src={audioSrc}
                controls
                autoPlay
                className="h-8 w-full max-w-[280px]"
                onLoadStart={(e) => {
                  (e.target as HTMLAudioElement).volume = 0.25;
                }}
              />
            </div>
          ) : bhajan.embedUrl ? (
            <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md">
              <iframe
                src={`${bhajan.embedUrl}?autoplay=1&rel=0`}
                title={bhajan.title}
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
