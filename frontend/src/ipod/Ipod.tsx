import { useEffect, useRef, type ReactNode } from 'react';
import { playClick } from './clicker';
import './Ipod.css';

export const THEMES = [
  { id: 'white', label: 'Classic White' },
  { id: 'black', label: 'Midnight Black' },
  { id: 'pink', label: 'Bubblegum Pink' },
  { id: 'blue', label: 'Sky Blue' },
  { id: 'mint', label: 'Mint' },
  { id: 'lavender', label: 'Lavender' },
] as const;

export type IpodTheme = (typeof THEMES)[number]['id'];

interface IpodProps {
  theme: IpodTheme;
  clicker: boolean;
  screen: ReactNode;
  onMenu: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onSelect: () => void;
  onScroll: (steps: number) => void; // + is clockwise / down
  onClose?: () => void; // desktop app only
}

const STEP_DEGREES = 18;
const WHEEL_PIXELS = 40;

function Ipod({ theme, clicker, screen, onMenu, onPrev, onNext, onPlayPause, onSelect, onScroll, onClose }: IpodProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ angle: number; acc: number; rotating: boolean } | null>(null);
  const suppressClick = useRef(false);

  // latest handlers for the native listeners below
  const handlers = useRef({ onMenu, onPrev, onNext, onPlayPause, onSelect, onScroll, clicker });
  useEffect(() => {
    handlers.current = { onMenu, onPrev, onNext, onPlayPause, onSelect, onScroll, clicker };
  });

  const scroll = (steps: number) => {
    if (handlers.current.clicker) playClick();
    handlers.current.onScroll(steps);
  };

  const press = (action: () => void) => () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (clicker) playClick();
    action();
  };

  const angleOf = (e: React.PointerEvent) => {
    const rect = wheelRef.current!.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(y, x) * 180) / Math.PI;
  };


  // spinning a finger / mouse around the ring scrolls, like the real click wheel

  const onPointerDown = (e: React.PointerEvent) => {
    suppressClick.current = false;
    if ((e.target as HTMLElement).closest('.ipod-center')) return;
    drag.current = { angle: angleOf(e), acc: 0, rotating: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;

    const angle = angleOf(e);
    let delta = angle - d.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.angle = angle;
    d.acc += delta;

    if (!d.rotating && Math.abs(d.acc) > 10) {
      d.rotating = true;
      suppressClick.current = true;
      wheelRef.current?.setPointerCapture(e.pointerId);
    }
    if (!d.rotating) return;

    while (d.acc >= STEP_DEGREES) { scroll(1); d.acc -= STEP_DEGREES; }
    while (d.acc <= -STEP_DEGREES) { scroll(-1); d.acc += STEP_DEGREES; }
  };

  const endDrag = () => { drag.current = null; };


  // trackpad / mouse wheel and keyboard also work

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    let acc = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      while (acc >= WHEEL_PIXELS) { scroll(1); acc -= WHEEL_PIXELS; }
      while (acc <= -WHEEL_PIXELS) { scroll(-1); acc += WHEEL_PIXELS; }
    };

    wheel.addEventListener('wheel', onWheel, { passive: false });
    return () => wheel.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = handlers.current;
      const actions: Record<string, () => void> = {
        ArrowDown: () => scroll(1),
        ArrowUp: () => scroll(-1),
        ArrowLeft: h.onPrev,
        ArrowRight: h.onNext,
        Enter: h.onSelect,
        ' ': h.onPlayPause,
        Escape: h.onMenu,
        Backspace: h.onMenu,
      };
      const action = actions[e.key];
      if (!action || (e.target instanceof Element && e.target.closest('input, textarea, select'))) return;

      e.preventDefault();
      // up / down already click through scroll()
      if (h.clicker && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') playClick();
      action();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`ipod ipod--${theme}`}>
      {onClose && (
        <button className="ipod-close" onClick={onClose} aria-label="Close">×</button>
      )}

      <div className="ipod-screen-bezel">
        <div className="ipod-screen">{screen}</div>
      </div>

      <div
        className="ipod-wheel"
        ref={wheelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button className="ipod-wheel-btn ipod-wheel-btn--menu" onClick={press(onMenu)}>MENU</button>
        <button className="ipod-wheel-btn ipod-wheel-btn--prev" onClick={press(onPrev)} aria-label="Previous track">
          <svg viewBox="0 0 24 12" aria-hidden="true"><path d="M11 0v12L3 6zM21 0v12L13 6zM1 0h2v12H1z" /></svg>
        </button>
        <button className="ipod-wheel-btn ipod-wheel-btn--next" onClick={press(onNext)} aria-label="Next track">
          <svg viewBox="0 0 24 12" aria-hidden="true"><path d="M3 0v12l8-6zM13 0v12l8-6zM21 0h2v12h-2z" /></svg>
        </button>
        <button className="ipod-wheel-btn ipod-wheel-btn--play" onClick={press(onPlayPause)} aria-label="Play or pause">
          <svg viewBox="0 0 24 12" aria-hidden="true"><path d="M2 0v12l9-6zM14 0h3v12h-3zM19 0h3v12h-3z" /></svg>
        </button>

        <button className="ipod-center" onClick={press(onSelect)} aria-label="Select" />
      </div>
    </div>
  );
}

export default Ipod;
