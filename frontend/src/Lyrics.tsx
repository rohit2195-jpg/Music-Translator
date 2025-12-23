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

    const[language, setLanguage] = useState('');

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
            setTranslatedLyricsLRC(mergeTimestampsWithTranslatedText(lyrics, json.lyrics))
            console.log(mergeTimestampsWithTranslatedText(lyrics, json.lyrics))
        }

        getTranslatedLyrics();
    }, [lyrics, language]);



   

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value);
    }

    

    return (
                <div className="lyrics-window">
        {/* Language dropdown is always visible */}
        <select value={language} onChange={handleLanguageChange}>
            <option value="Arabic">Arabic</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
            <option value="French">French</option>
        </select>

        {/* Lyrics area */}
        {(!lyrics) ? (
            <div>Loading lyrics...</div>
        ) : (
            <Lrc
            lrc={lyrics}
            currentMillisecond={position}
            lineRenderer={({ line, active }) => (
                <p className={active ? 'active-line' : 'line'}>
                {line.content}
                {translatedLyrics}
                </p>
            )}
            />


            
        )}
        </div>

    );

}

export default Lyrics;