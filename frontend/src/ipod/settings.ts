import type { IpodTheme } from './Ipod';
import { useStoredState } from '../useStoredState';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'hi', label: 'Hindi' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh-CN', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
];

export function useIpodLook() {
  const [theme, setTheme] = useStoredState<IpodTheme>('ipod_theme', 'white');
  const [clicker, setClicker] = useStoredState('ipod_clicker', true);
  return { theme, setTheme, clicker, setClicker };
}
