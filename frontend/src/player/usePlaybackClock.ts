import { useCallback, useEffect, useState } from 'react';

// Spotify only reports the position on changes, so count forward locally in between
export function usePlaybackClock(paused: boolean, duration: number) {
  const [anchor, setAnchor] = useState({ position: 0, at: 0 });
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, [paused]);

  const sync = useCallback((position: number) => {
    const at = Date.now();
    setAnchor({ position, at });
    setNow(at);
  }, []);

  const elapsed = paused ? 0 : Math.max(0, now - anchor.at);
  const position = Math.min(anchor.position + elapsed, duration || Infinity);

  return { position, sync };
}
