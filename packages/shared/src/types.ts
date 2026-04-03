export const MAX_QUESTION_LENGTH = 500;
export const MIN_QUESTION_LENGTH = 2;

export type Language = "en" | "bn" | "hi";

export interface Quote {
  text: string;
  source: string;
  page: number | null;
}

export interface Citation {
  book: string;
  pages: string;
}

export interface AskRequest {
  question: string;
  language?: Language;
}

export interface Photo {
  src: string;
  title: string;
  caption: string;
}

export interface Video {
  title: string;
  embedUrl: string;
  externalUrl: string;
}

export interface Bhajan {
  title: string;
  artist: string;
  mediaType: "audio" | "youtube";
  audioSrc?: string;
  embedUrl?: string;
  externalUrl?: string;
  mood: string;
  fallbackAudioSrcs?: string[];
}

export interface AskResponse {
  answer: string;
  essence: string;
  quotes: Quote[];
  citations: Citation[];
  photos: Photo[];
  videos: Video[];
  bhajan: Bhajan | null;
  disclaimer: string;
}

export interface RetrievedChunk {
  id: string;
  text: string;
  tokenCount: number;
  chunkIndex: number;
  bookTitle: string | null;
  s3Key: string;
  pageNumber: number;
  similarity: number;
}

export const DISCLAIMER =
  "This experience is grounded in Maa Anandmayee's books and related source material " +
  "and does not claim to be Maa herself or her living essence. " +
  "It is a knowledge-grounded companion for spiritual reflection.";
