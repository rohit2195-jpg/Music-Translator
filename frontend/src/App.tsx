import { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback.tsx'
import Login from './Login.tsx'
import './App.css';

function App() {

  const [token, setToken] = useState('');

  useEffect(() => {

    async function getToken() {
      const response = await fetch('https://music-translator.onrender.com/auth/token');
      const json = await response.json();
      setToken(json.access_token);
      console.log(json.access_token);

    }

    getToken();

  }, []);

  return (
    <>
    <p>This website can translate lyrics from a premium spotify account. Without a premium spotify account, this website will not be able to operate</p>
        { (token === '') ? <Login/> : <WebPlayback token={token} /> }
    </>
  );
}

export default App;
