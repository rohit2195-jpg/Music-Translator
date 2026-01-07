import { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback.tsx'
import Login from './Login.tsx'
import './App.css';
import { API_BASE } from './ApiBase.tsx';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import About from './About.tsx';

function App() {

  const [token, setToken] = useState('');

  useEffect(() => {

    async function getToken() {
      const response = await fetch(`${API_BASE}/auth/token`);
      const json = await response.json();
      setToken(json.access_token);
      console.log(json.access_token);

    }

    getToken();

  }, []);

  if (token === '') {
    return (
      <div>
        <h1 className='header'>Welcome to the Spotify Music Translator service</h1> 
            <div className='container'>
                  <p className='disclaimer'>This website can translate lyrics from a premium spotify account. Without a premium spotify account, this website will not be able to operate</p>
            <p className='description'>How it works: First, this project links your music to Spotify account. We use spotify to to get track information, and allow you to play music directly from the project itself.
              Then, it fetches LRC lyrics from an API called LRCLIB. This project translates lyrics in 2 ways. 
              For simpler translations, google translate is used. For more advanced translation, like romanized text or more complex languages, I utilized an AI model to be able to provide accurate and engaging translations to the lyrics.
              </p>
            </div>

             <Login/> 
      </div>
    )
  }
  else {
    return (
      <div>
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={
                <div>
                  <h1>Spotify Web Translator</h1>
                    <Link to="/about">About</Link>

                  <WebPlayback token={token} setToken={setToken} />
                  <button onClick={() => setToken('')}>Sign out</button>
                </div>
              }
            />
            <Route path="/about" element={<About />} />
          </Routes>
        </BrowserRouter>
      </div>
    )
  }

}

export default App;
