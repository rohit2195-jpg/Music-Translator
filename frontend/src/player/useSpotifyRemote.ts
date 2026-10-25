import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerApi, PlayerTrack } from './types';
import { usePlaybackClock } from './usePlaybackClock';

const POLL_MS = 3000;

// controls whatever is playing in the user's own Spotify app (desktop app mode, no DRM needed)
export function useSpotifyRemote(token: string): PlayerApi {
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [status, setStatus] = useState<PlayerApi['status']>('connecting');
  const [message, setMessage] = useState<string>();
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [volume, setVolumeState] = useState(0.5);
  const { position, sync } = usePlaybackClock(paused, track?.duration_ms ?? 0);

  const pollNow = useRef<() => void>(() => {});
  const volumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const api = useCallback((path: string, method = 'GET') =>
    fetch(`https://api.spotify.com/v1${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${tokenRef.current}` },
    }), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function poll() {
      clearTimeout(timer);
      let delay = POLL_MS;

      try {
        const response = await api('/me/player');
        if (stopped) return;

        if (response.status === 204) {
          setTrack(null);
          setStatus('ready');
          setMessage('Play something in Spotify and the lyrics show up here.');
        } else if (response.status === 429) {
          delay = Number(response.headers.get('Retry-After') || 10) * 1000;
        } else if (!response.ok) {
          setStatus('error');
          setMessage('Spotify login failed. Press MENU and sign out, then log in again.');
        } else {
          const json = await response.json();
          setStatus('ready');
          setMessage(json.item ? undefined : 'Podcasts and ads have no lyrics.');
          setPaused(!json.is_playing);
          setTrack(json.item && json.item.type === 'track' ? json.item : null);
          sync(json.progress_ms ?? 0);
          if (json.device?.volume_percent != null) setVolumeState(json.device.volume_percent / 100);

          // check again right when the song ends so the next one shows up quickly
          if (json.is_playing && json.item) {
            delay = Math.min(delay, Math.max(json.item.duration_ms - json.progress_ms + 300, 500));
          }
        }
      } catch {
        setMessage('Can\'t reach Spotify. Check your internet.');
      }

      if (!stopped) timer = setTimeout(poll, delay);
    }

    // Spotify takes a moment to apply a command, checking too soon shows the old state
    pollNow.current = () => {
      clearTimeout(timer);
      timer = setTimeout(poll, 1000);
    };
    poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [api, sync]);

  const command = async (path: string, method: string) => {
    try {
      const response = await api(path, method);
      if (response.status === 404) {
        setMessage('Open Spotify on any device first.');
      } else if (response.status === 403) {
        // 403 also means "already paused / nothing to skip to", only Premium is worth telling the user about
        const body = await response.json().catch(() => null);
        if (body?.error?.reason === 'PREMIUM_REQUIRED') setMessage('Spotify Premium is needed for the controls.');
      } else if (response.status === 401) {
        setMessage('Spotify login failed. Press MENU and sign out, then log in again.');
      }
    } catch {
      setMessage('Can\'t reach Spotify. Check your internet.');
    }
    pollNow.current();
  };

  return {
    status,
    message,
    track,
    paused,
    position,
    volume,
    togglePlay: () => {
      setPaused(!paused);
      sync(position);
      command(paused ? '/me/player/play' : '/me/player/pause', 'PUT');
    },
    next: () => command('/me/player/next', 'POST'),
    prev: () => command('/me/player/previous', 'POST'),
    seek: (ms) => {
      sync(ms);
      command(`/me/player/seek?position_ms=${Math.round(ms)}`, 'PUT');
    },
    setVolume: (v) => {
      setVolumeState(v);
      // wheel spins fire lots of steps, only send the last one
      clearTimeout(volumeTimer.current);
      volumeTimer.current = setTimeout(() => {
        command(`/me/player/volume?volume_percent=${Math.round(v * 100)}`, 'PUT');
      }, 250);
    },
  };
}
