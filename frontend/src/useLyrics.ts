import { useEffect, useMemo, useRef, useState } from 'react';
import { postJson } from './ApiBase';
import { parseLrc } from './lrc';
import type { PlayerTrack } from './player/types';

export type LyricsStatus = 'off' | 'loading' | 'ready' | 'none' | 'error';

interface Translation {
  lyrics: string;
  romanized: string | null;
}

interface Options {
  enabled: boolean;
  translate: boolean;
  language: string;
  isStandard: boolean;
  romanize: boolean;
}

export function useLyrics(track: PlayerTrack | null, { enabled, translate, language, isStandard, romanize }: Options) {
  const [candidates, setCandidates] = useState<{ trackId: string; lrcs: string[] } | null>(null);
  const [failedTrack, setFailedTrack] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [translations, setTranslations] = useState<Record<string, Translation | null>>({});
  const [fellBack, setFellBack] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [aiRetryKey, setAiRetryKey] = useState(0);
  const requested = useRef(new Set<string>());
  const aiRetried = useRef(new Set<string>());

  const trackId = track?.id ?? '';


  // fetch the possible lyrics whenever the song changes

  useEffect(() => {
    if (!enabled || !track || candidates?.trackId === trackId) return;

    const controller = new AbortController();

    async function load() {
      // the lyrics service is busy now and then (and the backend may be waking up), so retry a few times
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        try {
          const response = await postJson(
            '/lyrics/lrc_synced_native',
            { name: track!.name, artists: track!.artists, duration_ms: track!.duration_ms },
            { signal: controller.signal },
          );
          if (response.status >= 500) continue;

          const json = await response.json();
          setCandidates({ trackId, lrcs: json.lyrics ?? [] });
          setIndex(0);
          return;
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
        }
      }
      if (!controller.signal.aborted) setFailedTrack(trackId);
    }

    load();

    return () => controller.abort();
  }, [enabled, trackId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = candidates?.trackId === trackId ? candidates.lrcs : null;
  const lrc = current?.[index] ?? null;
  const translationKey = `${trackId}|${index}|${language}|${isStandard ? 'standard' : 'advanced'}`;


  // the romanized lines come with the AI translation, so fetch it for either one
  const wanted = translate || (romanize && !isStandard);


  // translate the chosen lyrics, cached so switching back and forth is instant

  useEffect(() => {
    if (!enabled || !wanted || !lrc || requested.current.has(translationKey)) return;
    requested.current.add(translationKey);

    postJson('/lyrics/lrc_synced_translate', { lyrics: lrc, language, isStandard })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error('translate failed'))))
      .then(json => {
        setTranslations(prev => ({ ...prev, [translationKey]: { lyrics: json.lyrics, romanized: json.romanized ?? null } }));
        // AI was busy, so the backend used Google Translate instead. keep that for now and
        // ask the AI once more in a bit, the busy spells usually pass quickly
        const usedGoogle = !isStandard && json.translator === 'standard';
        setFellBack(prev => ({ ...prev, [translationKey]: usedGoogle }));
        if (usedGoogle && !aiRetried.current.has(translationKey)) {
          aiRetried.current.add(translationKey);
          setTimeout(() => {
            requested.current.delete(translationKey);
            setAiRetryKey(k => k + 1);
          }, 20000);
        }
      })
      .catch(() => {
        requested.current.delete(translationKey);
        // a failed AI retry keeps the Google translation already on screen
        setTranslations(prev => (prev[translationKey] ? prev : { ...prev, [translationKey]: null }));
      });
  }, [enabled, wanted, lrc, translationKey, language, isStandard, aiRetryKey]);

  const translation = wanted ? translations[translationKey] : undefined;
  const lines = useMemo(
    () => (lrc ? parseLrc(lrc, translation?.lyrics, translation?.romanized) : []),
    [lrc, translation],
  );

  let status: LyricsStatus = 'loading';
  if (!enabled) status = 'off';
  else if (failedTrack === trackId) status = 'error';
  else if (current && current.length === 0) status = 'none';
  else if (lrc) status = 'ready';

  return {
    status,
    lines,
    translating: wanted && !!lrc && translation === undefined,
    translationFailed: wanted && translation === null,
    translationFellBack: wanted && !!fellBack[translationKey],
    candidateIndex: index,
    candidateCount: current?.length ?? 0,
    nextCandidate: () => setIndex(i => (current?.length ? (i + 1) % current.length : 0)),
    retry: () => {
      setFailedTrack(null);
      setReloadKey(k => k + 1);
    },
  };
}
