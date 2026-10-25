import { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import About from './About.tsx';
import { FaGithub } from "react-icons/fa";
import { loadAuth, refreshAuth, clearAuth, type Auth } from './auth.ts';
import { API_BASE } from './ApiBase.tsx';
import { desktop } from './desktop.ts';
import IpodPlayer from './ipod/IpodPlayer.tsx';
import IpodLogin from './ipod/IpodLogin.tsx';
import { useWebPlaybackPlayer } from './player/useWebPlaybackPlayer.ts';
import { useSpotifyRemote } from './player/useSpotifyRemote.ts';
import { useDemoPlayer } from './player/useDemoPlayer.ts';


interface PlayerProps {
  token: string;
  onSignOut: () => void;
}

// website: music plays in this tab
function WebIpod({ token, onSignOut }: PlayerProps) {
  return <IpodPlayer player={useWebPlaybackPlayer(token)} onSignOut={onSignOut} />;
}

// desktop app: remote for the user's own Spotify app
function RemoteIpod({ token, onSignOut }: PlayerProps) {
  return <IpodPlayer player={useSpotifyRemote(token)} onSignOut={onSignOut} onClose={desktop?.close} />;
}


function DemoIpod() {
  return <IpodPlayer player={useDemoPlayer()} onSignOut={() => { window.location.search = ''; }} />;
}

const isDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');


function login() {
  const url = `${API_BASE}/auth/login`;
  if (desktop) {
    // the desktop app opens Spotify's login in its own window, the token comes back via localStorage
    window.open(url, 'spotify-login', 'width=480,height=760');
  } else {
    window.location.href = url;
  }
}


function App() {

  const [auth, setAuth] = useState<Auth | null>(loadAuth);
  const [loginError] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error'));
  const token = auth?.access_token ?? '';

  // refresh the Spotify token a minute before it expires (they only last an hour)
  useEffect(() => {
    if (!auth) return;

    const delay = Math.max(auth.expires_at - Date.now() - 60_000, 0);
    const timeout = setTimeout(async () => {
      setAuth(await refreshAuth(auth));
    }, delay);

    return () => clearTimeout(timeout);
  }, [auth]);

  // pick up a login that finished in another window (desktop login window, other tabs)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'spotify_auth') setAuth(loadAuth());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signOut = () => {
    clearAuth();
    setAuth(null);
  };


  if (desktop) {
    return token
      ? <RemoteIpod key={auth?.refresh_token} token={token} onSignOut={signOut} />
      : <IpodLogin onLogin={login} error={loginError} onClose={desktop.close} />;
  }

  const footer = (
    <div className="page__footer">
      <Link to="/about">About</Link>
      <a href="https://github.com/rohit2195-jpg/Music-Translator" target="_blank" rel="noopener noreferrer">
        <FaGithub size={18} /> GitHub
      </a>
    </div>
  );

  const home = (
    <div className="page">
      <header>
        <h1 className="page__title">Music Translator</h1>
        <p className="page__subtitle">Synced, translated lyrics on a tiny iPod</p>
      </header>

      {isDemo ? (
        <DemoIpod />
      ) : token ? (
        <>
          <WebIpod token={token} onSignOut={signOut} />
          <p className="page__hint">
            Spin the wheel (or scroll) · MENU for lyrics, translation &amp; colors · center button switches views
          </p>
        </>
      ) : (
        <>
          <IpodLogin onLogin={login} error={loginError} />
          <div className="page__card">
            <p>
              Connect your Spotify account and play music right here. Lyrics come from LRCLIB and are
              translated line by line, with Google Translate for quick translations or an AI model for
              more natural, nuanced ones.
            </p>
            <p>
              Needs Spotify Premium. Playback works in Chrome and Firefox (Safari's DRM isn't supported).
            </p>
          </div>
        </>
      )}

      {footer}
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
