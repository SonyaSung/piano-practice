export interface LoopRegion {
  start: number;
  end: number;
}

export enum PlaybackMode {
  NORMAL = 'NORMAL',
  LOOP = 'LOOP',
  COMPARE = 'COMPARE',
}

export interface RecordingSession {
  blob: Blob;
  url: string;
  timestamp: number;
}