export interface LyricLine {
  time: number; // ms
  text: string;
  translation?: string;
  romanized?: string; // the original line in Latin letters, AI translator only
}

// same line matching as the backend, so original and translated lines pair up by index
function rawLines(lrc: string) {
  const out: { tag: string; text: string }[] = [];
  for (const line of lrc.split('\n')) {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) out.push({ tag: match[1], text: match[2] });
  }
  return out;
}

// "mm:ss.xx" -> ms, null for metadata tags like [ar:Artist]
function parseTime(tag: string): number | null {
  const match = tag.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return Math.round((Number(match[1]) * 60 + Number(match[2])) * 1000);
}

export function parseLrc(lrc: string, translatedLrc?: string | null, romanizedLrc?: string | null): LyricLine[] {
  const original = rawLines(lrc);
  const translated = translatedLrc ? rawLines(translatedLrc) : null;
  const romanized = romanizedLrc ? rawLines(romanizedLrc) : null;

  const lines: LyricLine[] = [];
  original.forEach((line, i) => {
    const time = parseTime(line.tag);
    if (time === null) return;
    lines.push({ time, text: line.text, translation: translated?.[i]?.text, romanized: romanized?.[i]?.text || undefined });
  });
  return lines;
}

export function activeLineIndex(lines: LyricLine[], position: number) {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= position) active = i;
    else break;
  }
  return active;
}
