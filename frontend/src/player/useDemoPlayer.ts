import { useEffect, useState } from 'react';
import type { PlayerApi, PlayerTrack } from './types';
import { usePlaybackClock } from './usePlaybackClock';

// dev only (open /?demo): a fake player so the iPod can be tested without Spotify
const DEMO_TRACKS: PlayerTrack[] = [
  { id: 'demo-1', name: 'Despacito', artists: [{ name: 'Luis Fonsi' }, { name: 'Daddy Yankee' }], album: { name: 'VIDA', images: [] }, duration_ms: 229000 },
  { id: 'demo-2', name: 'Dynamite', artists: [{ name: 'BTS' }], album: { name: 'BE', images: [] }, duration_ms: 199000 },
  // Devanagari lyrics (AI translator romanizes them) and already-romanized Hindi (nothing to romanize)
  { id: 'demo-3', name: 'Kesariya', artists: [{ name: 'Arijit Singh' }], album: { name: 'Brahmastra', images: [] }, duration_ms: 268000 },
  { id: 'demo-4', name: 'Tum Hi Ho', artists: [{ name: 'Arijit Singh' }], album: { name: 'Aashiqui 2', images: [] }, duration_ms: 262000 },
];

export function useDemoPlayer(): PlayerApi {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const track = DEMO_TRACKS[index];
  const { position, sync } = usePlaybackClock(paused, track.duration_ms);

  useEffect(() => { sync(0); }, [index, sync]);

  return {
    status: 'ready',
    track,
    paused,
    position,
    volume,
    togglePlay: () => { sync(position); setPaused(p => !p); },
    next: () => setIndex(i => (i + 1) % DEMO_TRACKS.length),
    prev: () => setIndex(i => (i + DEMO_TRACKS.length - 1) % DEMO_TRACKS.length),
    seek: (ms) => sync(ms),
    setVolume,
  };
}
