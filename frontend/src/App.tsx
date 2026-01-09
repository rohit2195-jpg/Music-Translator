import { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback.tsx'
import Login from './Login.tsx'
import './App.css';
import { API_BASE } from './ApiBase.tsx';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import About from './About.tsx';
import { FaGithub } from "react-icons/fa";


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

            <Login/> 



                  <p className='disclaimer'>This website can translate lyrics from a premium spotify account. Without a premium spotify account, this website will not be able to operate</p>
            
            <br></br>
            <p className='description'>How it works: First, this project links your music to Spotify account. We use spotify to to get track information, and allow you to play music directly from the project itself.
              Then, it fetches LRC lyrics from an API called LRCLIB. This project translates lyrics in 2 ways. 
              For simpler translations, google translate is used. For more advanced translation, like romanized text or more complex languages, I utilized an AI model to be able to provide accurate and engaging translations to the lyrics.
              </p>

              <br></br>
              <p>
                Currenlty, this project does not work in safari due to DRM issues in the browser. Please use Google Chrome or Firefox.
              </p>
            </div>


            <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <a
                      href="https://github.com/rohit2195-jpg/Music-Translator"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <FaGithub size={20} />
                    </a>

                  </div>
                </div>

    
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

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <a
                      href="https://github.com/rohit2195-jpg/Music-Translator"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <FaGithub size={20} />
                    </a>

                    <button onClick={() => setToken('')}>Sign out</button>
                  </div>
                </div>


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
