import { useEffect, useRef, type ReactNode } from 'react';
import type { LyricLine } from '../lrc';
import type { PlayerTrack } from '../player/types';

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}


export function Screen({ title, playing, children }: { title: string; playing?: boolean | null; children: ReactNode }) {
  return (
    <>
      <div className="scr-header">
        <span className="scr-header__state">{playing == null ? '' : playing ? '▶' : '❚❚'}</span>
        <span className="scr-header__title">{title}</span>
        <span className="scr-battery" />
      </div>
      <div className="scr-body">{children}</div>
    </>
  );
}


export interface MenuItem {
  label: string;
  detail?: string;
  chevron?: boolean;
  checked?: boolean;
}

const VISIBLE_ROWS = 9;

export function MenuList({ items, selected }: { items: MenuItem[]; selected: number }) {
  // keep the selected row in view, like the iPod does
  const start = Math.min(Math.max(0, selected - VISIBLE_ROWS + 1), Math.max(0, items.length - VISIBLE_ROWS));

  return (
    <ul className="scr-menu">
      {items.slice(start, start + VISIBLE_ROWS).map((item, i) => (
        <li key={item.label} className={start + i === selected ? 'is-selected' : ''}>
          <span className="scr-menu__label">{item.checked ? '✓ ' : ''}{item.label}</span>
          {item.detail && <span className="scr-menu__detail">{item.detail}</span>}
          {item.chevron && <span className="scr-menu__chevron">›</span>}
        </li>
      ))}
    </ul>
  );
}


export function Message({ icon, title, children }: { icon?: string; title?: string; children?: ReactNode }) {
  return (
    <div className="scr-message">
      {icon && <div className="scr-message__icon">{icon}</div>}
      {title && <div className="scr-message__title">{title}</div>}
      {children && <div>{children}</div>}
    </div>
  );
}


export function ProgressBar({ position, duration, volume }: { position: number; duration: number; volume: number | null }) {
  if (volume !== null) {
    return (
      <div className="scr-progress">
        <div className="scr-volume">
          <span>🔈</span>
          <div className="scr-bar"><div className="scr-bar__fill" style={{ width: `${volume * 100}%` }} /></div>
          <span>🔊</span>
        </div>
      </div>
    );
  }

  const percent = duration ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="scr-progress">
      <div className="scr-bar"><div className="scr-bar__fill" style={{ width: `${percent}%` }} /></div>
      <div className="scr-progress__times">
        <span>{formatTime(position)}</span>
        <span>-{formatTime(duration - position)}</span>
      </div>
    </div>
  );
}


export function NowPlaying({ track, footer }: { track: PlayerTrack; footer: ReactNode }) {
  const art = track.album.images?.[0]?.url;
  return (
    <div className="scr-np">
      <div className="scr-np__main">
        {art ? <img className="scr-np__art" src={art} alt="" /> : <div className="scr-np__art" />}
        <div className="scr-np__text">
          <div className="scr-np__name">{track.name}</div>
          <div>{track.artists.map(a => a.name).join(', ')}</div>
          {track.album.name && <div>{track.album.name}</div>}
        </div>
      </div>
      {footer}
    </div>
  );
}


interface LyricsViewProps {
  lines: LyricLine[];
  active: number;
  showTranslation: boolean;
  showRomanized: boolean;
  badge?: string;
  footer: ReactNode;
}

export function LyricsView({ lines, active, showTranslation, showRomanized, badge, footer }: LyricsViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // keep the current line in the middle of the little screen
  useEffect(() => {
    const box = scrollRef.current;
    const line = activeRef.current;
    if (!box) return;
    const top = line ? line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2 : 0;
    box.scrollTo({ top, behavior: 'smooth' });
  }, [active, lines]);

  return (
    <div className="scr-lyrics">
      {badge && <span className="scr-badge">{badge}</span>}
      <div className="scr-lyrics__scroll" ref={scrollRef}>
        <div className="scr-lyrics__pad" />
        {lines.map((line, i) => (
          <div key={i} ref={i === active ? activeRef : undefined} className={`scr-line${i === active ? ' is-active' : ''}`}>
            <div className="scr-line__text">{line.text || '♪'}</div>
            {showRomanized && line.romanized && <div className="scr-line__rom">{line.romanized}</div>}
            {showTranslation && line.text && line.translation && line.translation !== line.text && (
              <div className="scr-line__tr">{line.translation}</div>
            )}
          </div>
        ))}
        <div className="scr-lyrics__pad" />
      </div>
      {footer}
    </div>
  );
}
