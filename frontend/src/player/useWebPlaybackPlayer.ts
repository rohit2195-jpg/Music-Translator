import { useEffect, useRef, useState } from 'react';
import type { PlayerApi, PlayerTrack } from './types';
import { usePlaybackClock } from './usePlaybackClock';

// the small part of the Web Playback SDK this app uses
interface SpotifyState {
  paused: boolean;
  position: number;
  track_window: { current_track: PlayerTrack };
}

interface SpotifyPlayer {
  addListener(event: 'ready' | 'not_ready', cb: (e: { device_id: string }) => void): void;
  addListener(event: 'player_state_changed', cb: (state: SpotifyState | null) => void): void;
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error', cb: () => void): void;
  connect(): Promise<boolean>;
  activateElement(): Promise<void>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayer;
    };
  }
}

// plays music right in the browser tab (needs DRM, so Chrome / Firefox)
export function useWebPlaybackPlayer(token: string): PlayerApi {
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [status, setStatus] = useState<PlayerApi['status']>('connecting');
  const [message, setMessage] = useState<string>();
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [volume, setVolumeState] = useState(0.5);
  const deviceId = useRef<string | null>(null);
  const activated = useRef(false);
  const { position, sync } = usePlaybackClock(paused, track?.duration_ms ?? 0);

  useEffect(() => {
    let cancelled = false;
    let instance: SpotifyPlayer | null = null;

    const fail = (text: string) => {
      setStatus('error');
      setMessage(text);
    };

    function init() {
      if (cancelled || !window.Spotify) return;

      const created = new window.Spotify.Player({
        name: 'Music Translator iPod',
        getOAuthToken: (cb) => cb(tokenRef.current),
        volume: 0.5,
      });

      created.addListener('ready', ({ device_id }) => {
        deviceId.current = device_id;
        // make this tab the active Spotify device
        fetch('https://api.spotify.com/v1/me/player', {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        });
        setStatus('ready');
        setMessage(undefined);
      });

      created.addListener('not_ready', () => setStatus('connecting'));

      created.addListener('player_state_changed', (state) => {
        if (!state) {
          setTrack(null);
          return;
        }
        setPaused(state.paused);
        setTrack(state.track_window.current_track);
        sync(state.position);
      });

      created.addListener('initialization_error', () =>
        fail("This browser can't play Spotify. Try Chrome, Firefox, or the desktop app."));
      created.addListener('authentication_error', () =>
        fail('Spotify login failed. Press MENU and sign out, then log in again.'));
      created.addListener('account_error', () =>
        fail('Spotify Premium is needed to play music here.'));

      created.connect();
      instance = created;
      setPlayer(created);
    }

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.getElementById('spotify-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      instance?.disconnect();
    };
  }, [sync]);

  // browsers block audio until a click, the SDK needs this called from inside one
  const unlockAudio = () => {
    if (activated.current || !player) return;
    activated.current = true;
    player.activateElement().catch(() => {});
  };

  const takeOverPlayback = async () => {
    if (!deviceId.current) return;
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId.current], play: true }),
    }).catch(() => null);
    if (response?.status === 404) {
      setMessage('Pick a song in Spotify first, then choose "Music Translator iPod" as the device.');
    }
  };

  return {
    status,
    message: message ?? (status === 'ready' && !track
      ? 'Press ▶︎ to play, or pick "Music Translator iPod" as the device in Spotify.'
      : undefined),
    track,
    paused,
    position,
    volume,
    togglePlay: () => {
      if (!player) return;
      unlockAudio();
      if (track) {
        player.togglePlay().catch(() => {});
      } else {
        // this tab isn't the active Spotify device (e.g. music was last played on a phone), take over and play
        takeOverPlayback();
      }
    },
    next: () => { unlockAudio(); player?.nextTrack().catch(() => {}); },
    prev: () => { unlockAudio(); player?.previousTrack().catch(() => {}); },
    seek: (ms) => { player?.seek(ms).catch(() => {}); sync(ms); },
    setVolume: (v) => { player?.setVolume(v).catch(() => {}); setVolumeState(v); },
  };
}
