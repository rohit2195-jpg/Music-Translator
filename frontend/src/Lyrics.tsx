import React, { useState, useEffect } from 'react';
import { Lrc, MultipleLrc} from 'react-lrc';
import "./Lyrics.css";
import ToggleButton from './ToggleComp';


const track = {
    name: "",
    album: {
        images: [
            { url: "" }
        ]
    },
    artists: [
        { name: "" }
    ]
}



function Lyrics({track, position}) {

    const [lyrics, setLyrics] = useState([]);
    const [plainLyrics, setPlainLyrics] = useState([]);
    const [index_lyrics, setIndexLyrics] = useState(0);

    const[language, setLanguage] = useState('None');

    const [translatedLyrics, setTranslatedLyrics] = useState(null);
    const [translatedLyricsLRC, setTranslatedLyricsLRC] = useState('');


    const [isStandard, setIsStandard] = useState(true);




    useEffect(() => {
  if (!track?.name) return;

  async function getNativeLyricsSynced() {
        const response = await fetch('/lyrics/lrc_synced_native', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
        });

        const json = await response.json();
        setLyrics(json.lyrics );
        setPlainLyrics(json.plainLyrics)
        console.log(json.plainLyrics)
        setIndexLyrics(0);
        setTranslatedLyrics(null); 
    }

        getNativeLyricsSynced();
    }, [track?.id]); 






    useEffect(() => {
        if (lyrics.length == 0) return;
        if (!language) return;


        

        async function getTranslatedLyrics() {
            if (language=='None') return;
            setTranslatedLyricsLRC('');
            const response = await fetch('/lyrics/lrc_synced_translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lyrics: lyrics[index_lyrics],
                plainLyrics: plainLyrics[index_lyrics],
                language,
                isStandard,
            }),
            });

            const json = await response.json();
            console.log('translated:', json.lyrics);
            setTranslatedLyricsLRC(json.lyrics)
            //setTranslatedLyricsLRC(mergeTimestampsWithTranslatedText(lyrics, json.lyrics))
        }

        getTranslatedLyrics();
    }, [lyrics, language, isStandard, index_lyrics]);



   

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value);
    }

    if (!lyrics[index_lyrics]) {
      return <div>Loading lyrics…</div>;
    }


    

    return (
  <div className="lyrics-window">
    {/* Language dropdown */}
    <select value={language} onChange={handleLanguageChange} disabled={!lyrics} >
      <option value="None">None</option>
      <option value="en">English</option>
      <option value="hi">Hindi</option>
      <option value="es">Spanish</option>
    </select>

    <button
      disabled={index_lyrics >= lyrics.length}
      onClick={() =>
        setIndexLyrics(prev =>
        (prev + 1) % lyrics.length
        )

      }
    >
      Wrong lyrics
    </button>

    Lyric number : {index_lyrics}




    <ToggleButton
      isStandard={isStandard}
      setIsStandard={setIsStandard}
      disabled = {language == 'None'}
    />

    



    {/* Lyrics area */}
    {lyrics.length === 0 ? (
      <div>Loading lyrics...</div>
    ) : language === "None" ? (
      <Lrc
        lrc={lyrics[index_lyrics]}
        currentMillisecond={position}
        lineRenderer={({ line, active }) => (
          <p className={active ? "active-line" : "line"}>
            {line.content}
          </p>
        )}
      />
    ) : !translatedLyricsLRC ? (
      <div>Translating lyrics...</div>
    ) : (
      <Lrc
        lrc={translatedLyricsLRC}
        currentMillisecond={position}
        lineRenderer={({ line, active }) => (
            <p className={active ? "active-line" : "line"}>
            {line.content}
            </p>
        )}
        />
    )}
  </div>
);

}

export default Lyrics;