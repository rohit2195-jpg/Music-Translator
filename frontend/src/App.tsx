import { useState, useEffect } from 'react';
import WebPlayback from './WebPlayback.tsx'
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
        { <WebPlayback token={token} /> }
    </>
  );
}

export default App;
