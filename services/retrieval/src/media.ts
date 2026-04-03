import type { Photo, Video, Bhajan } from "@maa/shared";
import { sanitizeMediaPayload } from "@maa/shared";

const S3_IMG = "https://maa-aap-bucket.s3.us-east-1.amazonaws.com/media/images/";

const IMAGE_IDS = [
  "20250930_205031","20250930_205035","IMG-20250824-WA0011","IMG-20250824-WA0021",
  "IMG-20250824-WA0034","IMG-20250825-WA0000","IMG-20250825-WA0007","IMG-20250825-WA0008",
  "IMG-20250825-WA0011","IMG-20250825-WA0012","IMG-20250825-WA0013","IMG-20250826-WA0000",
  "IMG-20250826-WA0010","IMG-20250826-WA0016","IMG-20250826-WA0028","IMG-20250826-WA0029",
  "IMG-20250827-WA0002","IMG-20250827-WA0023","IMG-20250827-WA0026","IMG-20250827-WA0042",
  "IMG-20250828-WA0000","IMG-20250828-WA0013","IMG-20250828-WA0024","IMG-20250828-WA0026",
  "IMG-20250829-WA0001","IMG-20250829-WA0014","IMG-20250829-WA0029","IMG-20250829-WA0030",
  "IMG-20250830-WA0001","IMG-20250830-WA0005","IMG-20250830-WA0012","IMG-20250830-WA0028",
  "IMG-20250830-WA0029","IMG-20250831-WA0010","IMG-20250831-WA0017","IMG-20250831-WA0023",
  "IMG-20250831-WA0029","IMG-20250831-WA0030","IMG-20250901-WA0000","IMG-20250901-WA0007",
  "IMG-20250901-WA0011","IMG-20250901-WA0014","IMG-20250901-WA0015","IMG-20250902-WA0000",
  "IMG-20250902-WA0013","IMG-20250902-WA0014","IMG-20250902-WA0025","IMG-20250902-WA0027",
  "IMG-20250902-WA0028","IMG-20250903-WA0000","IMG-20250903-WA0012","IMG-20250903-WA0044",
  "IMG-20250903-WA0045","IMG-20250904-WA0000","IMG-20250904-WA0007","IMG-20250904-WA0025",
  "IMG-20250904-WA0026","IMG-20250905-WA0001","IMG-20250905-WA0011","IMG-20250905-WA0025",
  "IMG-20250906-WA0000","IMG-20250906-WA0005","IMG-20250906-WA0020","IMG-20250906-WA0021",
  "IMG-20250907-WA0001","IMG-20250907-WA0027","IMG-20250907-WA0032","IMG-20250907-WA0033",
  "IMG-20250908-WA0001","IMG-20250908-WA0014","IMG-20250908-WA0017","IMG-20250908-WA0026",
  "IMG-20250908-WA0027","IMG-20250909-WA0000","IMG-20250909-WA0020","IMG-20250909-WA0021",
  "IMG-20250909-WA0026","IMG-20250909-WA0027","IMG-20250910-WA0000","IMG-20250910-WA0008",
  "IMG-20250910-WA0024","IMG-20250910-WA0027","IMG-20250910-WA0028","IMG-20250911-WA0001",
  "IMG-20250911-WA0017","IMG-20250911-WA0018","IMG-20250911-WA0020","IMG-20250911-WA0029",
  "IMG-20250911-WA0030","IMG-20250912-WA0000","IMG-20250912-WA0005","IMG-20250912-WA0011",
  "IMG-20250912-WA0043","IMG-20250912-WA0046","IMG-20250912-WA0047","IMG-20250913-WA0000",
  "IMG-20250913-WA0006","IMG-20250913-WA0010","IMG-20250913-WA0026","IMG-20250914-WA0000",
  "IMG-20250914-WA0004","IMG-20250915-WA0000","IMG-20250915-WA0012","IMG-20250915-WA0013",
];

const BHAJANS: Array<{
  title: string;
  artist: string;
  mood: string;
  mediaType: "audio" | "youtube";
  audioSrc?: string;
  embedUrl?: string;
  externalUrl?: string;
}> = [
  { title: "Ma's Voice", artist: "Sri Ma Anandamayi", mood: "flowing", mediaType: "audio", audioSrc: "https://www.anandamayi.org/mmedia/mp/Mavoice.mp3" },
  { title: "Sri Guru Sharanam", artist: "Sri Ma Anandamayi", mood: "still", mediaType: "audio", audioSrc: "https://www.anandamayi.org/mmedia/mp/Sriguru.mp3" },
  { title: "Jai Guru Ma, Bhagavan", artist: "Jaya", mood: "radiant", mediaType: "audio", audioSrc: "https://www.anandamayi.org/mmedia/mp3/Jaya1.mp3" },
  { title: "Maa Singing", artist: "Sri Ma Anandamayi", mood: "ecstatic", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/Q5033Xzver8", externalUrl: "https://www.youtube.com/watch?v=Q5033Xzver8" },
  { title: "Maa Jay Bhagavan", artist: "Sri Ma Anandamayi", mood: "devotional", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/j-Ui7jrJlhA", externalUrl: "https://www.youtube.com/watch?v=j-Ui7jrJlhA" },
  { title: "Maa Vasudevaya Bhajan", artist: "Sri Ma Anandamayi", mood: "peaceful", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/_tirboamOaQ", externalUrl: "https://www.youtube.com/watch?v=_tirboamOaQ" },
  { title: "Krishna Das — Bhagavan", artist: "Krishna Das", mood: "expansive", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/0cxFqqXLGXA", externalUrl: "https://www.youtube.com/watch?v=0cxFqqXLGXA" },
  { title: "Maa's Sacred Names", artist: "Devotees", mood: "meditative", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/d635CO7-Ikw", externalUrl: "https://www.youtube.com/watch?v=d635CO7-Ikw" },
  { title: "Devotee Bhajan", artist: "Devotees", mood: "communal", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/DrrtXUCp5mI", externalUrl: "https://www.youtube.com/watch?v=DrrtXUCp5mI" },
  { title: "Advait — Non-Duality", artist: "Sri Ma Anandamayi", mood: "meditative", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/vkAJXhi37Sw", externalUrl: "https://www.youtube.com/watch?v=vkAJXhi37Sw" },
  { title: "Maa Life Documentary", artist: "Documentary", mood: "journey", mediaType: "youtube", embedUrl: "https://www.youtube.com/embed/fSUI4Sn-hr4", externalUrl: "https://www.youtube.com/watch?v=fSUI4Sn-hr4" },
];

const S3_AUDIO = "https://maa-aap-bucket.s3.us-east-1.amazonaws.com/media/audio/";
const S3_AUDIO_IDS = Array.from({ length: 33 }, (_, i) =>
  `maa-audio-${String(i + 1).padStart(3, "0")}`,
);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function selectMedia(): {
  photos: Photo[];
  videos: Video[];
  bhajan: Bhajan | null;
} {
  // Send 12 candidates so the frontend can cycle through fallbacks
  // when individual images fail to load (S3 CORS / 404).
  const photoSample = pickN(IMAGE_IDS, Math.min(12, IMAGE_IDS.length));
  const photos: Photo[] = photoSample.map((id) => ({
    src: `${S3_IMG}${id}.jpg`,
    title: `Maa Darshan`,
    caption: "Sri Ma Anandamayi",
  }));

  const ytBhajans = BHAJANS.filter((b) => b.mediaType === "youtube");
  const videoEntry = pick(ytBhajans);
  const videos: Video[] = videoEntry
    ? [{ title: videoEntry.title, embedUrl: videoEntry.embedUrl!, externalUrl: videoEntry.externalUrl! }]
    : [];

  const audioBhajans = BHAJANS.filter((b) => b.mediaType === "audio");
  const useDirectAudio = Math.random() > 0.5 && audioBhajans.length > 0;
  let bhajan: Bhajan | null = null;

  if (useDirectAudio) {
    const entry = pick(audioBhajans);
    const fallbacks = audioBhajans
      .filter((b) => b.audioSrc !== entry.audioSrc)
      .map((b) => b.audioSrc!)
      .slice(0, 3);
    bhajan = {
      title: entry.title, artist: entry.artist, mood: entry.mood,
      mediaType: "audio", audioSrc: entry.audioSrc,
      fallbackAudioSrcs: fallbacks,
    };
  } else if (S3_AUDIO_IDS.length > 0) {
    const audioId = pick(S3_AUDIO_IDS);
    const num = parseInt(audioId.split("-").pop()!, 10);
    const fallbacks = audioBhajans.map((b) => b.audioSrc!).slice(0, 3);
    bhajan = {
      title: `Maa Vani ${num}`, artist: "Sri Ma Anandamayi", mood: "meditative",
      mediaType: "audio", audioSrc: `${S3_AUDIO}${audioId}.mp3`,
      fallbackAudioSrcs: fallbacks,
    };
  }

  return sanitizeMediaPayload({ photos, videos, bhajan });
}
