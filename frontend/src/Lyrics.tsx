import React, { useState, useEffect } from 'react';
import { Lrc, MultipleLrc} from 'react-lrc';
import "./Lyrics.css";


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

    const [lyrics, setLyrics] = useState(null);
    const [plainLyrics, setPlainLyrics] = useState(null);

    const[language, setLanguage] = useState('None');

    const [translatedLyrics, setTranslatedLyrics] = useState(null);
    const [translatedLyricsLRC, setTranslatedLyricsLRC] = useState('');


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
        setTranslatedLyrics(null); 
    }

        getNativeLyricsSynced();
    }, [track?.id]); 


    function mergeTimestampsWithTranslatedText(originalLrc, translatedText) {
        const lrcLines = originalLrc.split('\n').map(line => line.trim()).filter(Boolean);

        const translatedLines = translatedText.split('\n').map(line => line.trim());

        const result = [];

        for (let i = 0; i < lrcLines.length; i++) {
            const lrcLine = lrcLines[i];
            const translatedLine = translatedLines[i] ?? '';

            const timestampMatch = lrcLine.match(/^(\[[0-9:.]+\])/);

            if (!timestampMatch) continue;

            const timestamp = timestampMatch[1];
            result.push(`${timestamp}${translatedLine}`);
        }

        return result.join('\n');
    }





    useEffect(() => {
        if (!lyrics) return;
        if (!language) return;


        

        async function getTranslatedLyrics() {
            console.log(lyrics);
            if (language=='None') return;
            const response = await fetch('/lyrics/lrc_synced_translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lyrics,
                plainLyrics,
                language,
            }),
            });

            const json = await response.json();
            console.log('translated:', json.lyrics);
            setTranslatedLyricsLRC(json.lyrics)
            //setTranslatedLyricsLRC(mergeTimestampsWithTranslatedText(lyrics, json.lyrics))
            //console.log(mergeTimestampsWithTranslatedText(lyrics, json.lyrics))
        }

        getTranslatedLyrics();
    }, [lyrics, language]);



   

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value);
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

    {/* Lyrics area */}
    {!lyrics ? (
      <div>Loading lyrics...</div>
    ) : language === "None" ? (
      <Lrc
        lrc={lyrics}
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