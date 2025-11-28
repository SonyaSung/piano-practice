export interface LoopRegion {
  start: number;
  end: number;
}

// Changed from enum to const object to avoid TS1294 error in strict mode
export const PlaybackMode = {
  NORMAL: 'NORMAL',
  LOOP: 'LOOP',
  COMPARE: 'COMPARE',
} as const;

export type PlaybackMode = typeof PlaybackMode[keyof typeof PlaybackMode];

export interface RecordingSession {
  blob: Blob;
  url: string;
  timestamp: number;
}