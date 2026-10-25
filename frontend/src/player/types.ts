export interface PlayerTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name?: string; images: { url: string }[] };
  duration_ms: number;
}

export interface PlayerApi {
  status: 'connecting' | 'ready' | 'error';
  message?: string; // help or error text shown on the iPod screen
  track: PlayerTrack | null;
  paused: boolean;
  position: number; // ms, ticks forward while playing
  volume: number; // 0..1
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ms: number) => void;
  setVolume: (volume: number) => void;
}
