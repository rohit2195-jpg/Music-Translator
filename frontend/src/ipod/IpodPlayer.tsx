import { useEffect, useRef, useState } from 'react';
import Ipod, { THEMES } from './Ipod';
import { LANGUAGES, useIpodLook } from './settings';
import { Screen, MenuList, Message, ProgressBar, NowPlaying, LyricsView, type MenuItem } from './Screens';
import type { PlayerApi } from '../player/types';
import { useLyrics } from '../useLyrics';
import { activeLineIndex } from '../lrc';
import { useStoredState } from '../useStoredState';

type MenuId = 'main' | 'language' | 'theme';

interface IpodPlayerProps {
  player: PlayerApi;
  onSignOut: () => void;
  onClose?: () => void;
}

function IpodPlayer({ player, onSignOut, onClose }: IpodPlayerProps) {
  const { theme, setTheme, clicker, setClicker } = useIpodLook();
  const [lyricsOn, setLyricsOn] = useStoredState('ipod_lyrics', true);
  const [translationOn, setTranslationOn] = useStoredState('ipod_translation', true);
  const [language, setLanguage] = useStoredState('ipod_language', 'en');
  const [isStandard, setIsStandard] = useStoredState('ipod_standard', true);
  const [romanizedOn, setRomanizedOn] = useStoredState('ipod_romanized', true);

  const [stack, setStack] = useState<{ id: MenuId; selected: number }[]>([]);
  const [infoView, setInfoView] = useState(false);
  const [volumeShown, setVolumeShown] = useState(false);
  const volumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(volumeTimer.current), []);

  const lyrics = useLyrics(player.track, { enabled: lyricsOn, translate: translationOn, language, isStandard, romanize: romanizedOn });
  const languageLabel = LANGUAGES.find(l => l.code === language)?.label ?? language;


  // ---------- menus ----------

  const closeMenus = () => setStack([]);
  const openMenu = (id: MenuId, selected = 0) => setStack(s => [...s, { id, selected }]);

  const menus: Record<MenuId, { title: string; items: (MenuItem & { action: () => void })[] }> = {
    main: {
      title: 'iPod',
      items: [
        { label: 'Now Playing', chevron: true, action: closeMenus },
        { label: 'Lyrics', detail: lyricsOn ? 'On' : 'Off', action: () => setLyricsOn(v => !v) },
        { label: 'Translation', detail: translationOn ? 'On' : 'Off', action: () => setTranslationOn(v => !v) },
        {
          label: 'Language', detail: languageLabel, chevron: true,
          action: () => openMenu('language', Math.max(0, LANGUAGES.findIndex(l => l.code === language))),
        },
        { label: 'Translator', detail: isStandard ? 'Standard' : 'AI', action: () => setIsStandard(v => !v) },
        {
          // only the AI translator can romanize, so choosing this on Standard switches to AI
          label: 'Romanized',
          detail: isStandard ? 'AI only' : romanizedOn ? 'On' : 'Off',
          action: () => {
            if (isStandard) { setIsStandard(false); setRomanizedOn(true); }
            else setRomanizedOn(v => !v);
          },
        },
        {
          label: lyrics.status === 'error' ? 'Retry Lyrics' : 'Other Lyrics',
          detail: lyrics.candidateCount ? `${lyrics.candidateIndex + 1}/${lyrics.candidateCount}` : '–',
          action: () => {
            if (lyrics.status === 'error') lyrics.retry();
            else lyrics.nextCandidate();
            closeMenus();
          },
        },
        {
          label: 'iPod Color', chevron: true,
          action: () => openMenu('theme', Math.max(0, THEMES.findIndex(t => t.id === theme))),
        },
        { label: 'Clicker', detail: clicker ? 'On' : 'Off', action: () => setClicker(v => !v) },
        { label: 'Sign Out', action: onSignOut },
      ],
    },
    language: {
      title: 'Language',
      items: LANGUAGES.map(l => ({
        label: l.label,
        checked: l.code === language,
        action: () => { setLanguage(l.code); setTranslationOn(true); setStack(s => s.slice(0, -1)); },
      })),
    },
    theme: {
      title: 'iPod Color',
      items: THEMES.map(t => ({
        label: t.label,
        checked: t.id === theme,
        action: () => { setTheme(t.id); setStack(s => s.slice(0, -1)); },
      })),
    },
  };

  const current = stack[stack.length - 1];


  // ---------- wheel + buttons ----------

  const onScroll = (steps: number) => {
    if (current) {
      const count = menus[current.id].items.length;
      setStack(s => s.map((m, i) => (
        i === s.length - 1 ? { ...m, selected: Math.min(count - 1, Math.max(0, m.selected + steps)) } : m
      )));
      return;
    }

    // on the Now Playing screen the wheel changes volume, like the real thing
    player.setVolume(Math.min(1, Math.max(0, Math.round((player.volume + steps * 0.05) * 100) / 100)));
    setVolumeShown(true);
    clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => setVolumeShown(false), 1500);
  };

  const onSelect = () => {
    if (current) menus[current.id].items[current.selected]?.action();
    else setInfoView(v => !v);
  };

  const onMenu = () => {
    if (stack.length === 0) openMenu('main');
    else setStack(s => s.slice(0, -1));
  };


  // ---------- screen ----------

  let screen;
  if (current) {
    const menu = menus[current.id];
    screen = (
      <Screen title={menu.title} playing={player.track ? !player.paused : null}>
        <MenuList items={menu.items} selected={current.selected} />
      </Screen>
    );
  } else {
    const footer = (
      <ProgressBar
        position={player.position}
        duration={player.track?.duration_ms ?? 0}
        volume={volumeShown ? player.volume : null}
      />
    );

    let body;
    if (!player.track) {
      body = player.status === 'connecting' && !player.message
        ? <Message icon="⏳" title="Connecting…">Getting Spotify ready</Message>
        : <Message icon="♫" title="Nothing playing">{player.message}</Message>;
    } else if (!lyricsOn || infoView || lyrics.status === 'none' || lyrics.status === 'error') {
      const note = lyricsOn && !infoView && (lyrics.status === 'none' ? 'No lyrics found' : lyrics.status === 'error' ? 'Lyrics busy · MENU to retry' : '');
      body = (
        <>
          {note && <span className="scr-badge">{note}</span>}
          <NowPlaying track={player.track} footer={footer} />
        </>
      );
    } else if (lyrics.status === 'loading') {
      body = <Message icon="♪" title={player.track.name}>Finding lyrics…</Message>;
    } else {
      const badge = lyrics.translating ? (translationOn ? `Translating to ${languageLabel}…` : 'Romanizing…')
        : lyrics.translationFailed ? 'Translation failed'
        : lyrics.translationFellBack ? 'AI busy · used Google' : undefined;
      body = (
        <LyricsView
          lines={lyrics.lines}
          active={activeLineIndex(lyrics.lines, player.position)}
          showTranslation={translationOn}
          showRomanized={romanizedOn && !isStandard}
          badge={badge}
          footer={footer}
        />
      );
    }

    const title = player.track && lyricsOn && !infoView ? player.track.name : 'Now Playing';
    screen = (
      <Screen title={title} playing={player.track ? !player.paused : null}>
        {body}
      </Screen>
    );
  }

  return (
    <Ipod
      theme={theme}
      clicker={clicker}
      screen={screen}
      onMenu={onMenu}
      onPrev={() => (player.position > 3000 ? player.seek(0) : player.prev())}
      onNext={player.next}
      onPlayPause={player.togglePlay}
      onSelect={onSelect}
      onScroll={onScroll}
      onClose={onClose}
    />
  );
}

export default IpodPlayer;
