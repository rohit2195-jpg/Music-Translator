import express, { response } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import he from 'he';
import { GoogleGenAI } from '@google/genai';
import { translate } from '@vitalets/google-translate-api';


dotenv.config();



const app = express();
app.use(express.json());




const port = 3000;

var spotify_client_id = process.env.SPOTIFY_CLIENT_ID
var spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET

const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY)


console.log("hello");
console.log(spotify_client_id);

let access_token = null;

const redirect_uri = "https://music-translator.onrender.com/auth/callback"

// http://127.0.0.1:3000/auth/callback
// https://music-translator.onrender.com/auth/callback

app.use(cors());
//app.use(express.json());



async function translateTextAdvanced(linesArray, target) {

  let fullstr = "";
  for (var i = 0 ; i < linesArray.length; i++) {
    fullstr += linesArray[i] + "\n";
  }

  const prompt = `
    You are a professional song lyrics translator.

    Translate the following song lyrics into ${target}.
    Preserve meaning, emotion, and artistic intent over literal word-for-word translation.
    Use natural, fluent ${target} that sounds appropriate for song lyrics.
    If a line is empty, output an empty line in the same position.
    The number of output lines MUST exactly match the number of input lines.

    Lyrics:
    ${fullstr}
  `;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: prompt,
    });
  const text = response.text;

  const lines = text.split("\n");


  return lines
  


}


async function translateTextStandard(linesArray, target) {
  let fullstr = "";
  for (var i = 0 ; i < linesArray.length; i++) {
    fullstr += linesArray[i] + "\n";
  }

  const text = await translate(fullstr, {to:target});


  const lines = text.text.split('\n');


  return lines;

}


app.get('/', (req, res) => {
  res.send('Hello World! This is the Node.js backend hello there.');
});

function normalize(str) {
  return str
    .replace(/[’‘]/g, "'")
    .trim();
}

app.post('/lyrics/lrc_synced_translate', async (req, res) => {
  try {
    console.log("Fetching translated lyrics from backend");
    // can input array into translate text

    const lines = req.body.lyrics.split("\n");

    const lyric_arr = [];
    const timestamp_arr = [];

    for (const line of lines) {
      const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (match) {
        timestamp_arr.push(`[${match[1]}]`);
        lyric_arr.push(match[2]);
      }
    }


    //console.log(lyric_arr);
    //console.log(timestamp_arr);

    // use AI or google translate based on user selection

    var translated = '';

    console.log(req.body.isStandard);
    if (req.body.isStandard) {
      translated = await translateTextStandard(lyric_arr, req.body.language);
    }
    else {
      translated = await translateTextAdvanced(lyric_arr, req.body.language);
    }

    

    const cleaned = translated.map(line => he.decode(line));
    //console.log(cleaned);

    const combined = cleaned.map((line, i) => {
      return `${timestamp_arr[i]} ${line}`;
    });

    //console.log(combined);

    res.json({ lyrics: combined.join("\n") });;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Translation failed' });
  }
});




app.post('/lyrics/lrc_synced_native', async (req, res) => {
  console.log("lyrics of the song are being fetched!")
  //console.log("inputs:", req.body);

  try {
    // trying to find lyrics for each artist name, returning first one that isnt null
    // new comment
    console.log(req.body);

    const duration_sec = Math.floor(req.body.duration_ms / 1000);
    const url1 = new URL("https://lrclib.net/api/search");
    var artists = '';
    for (let i = 0 ; i < req.body.artists.length; i++) {
      artists += req.body.artists[i] + ", ";
    }

    url1.searchParams.append("track_name", req.body.name);
    url1.searchParams.append("album_name", req.body.album.name);
    //url1.searchParams.append("duration", duration_sec);

    const response = await fetch(url1.toString());
    const data = await response.json();

    console.log("LRCLIB response:", data);


    // implement a better scoring system here for all possible lyrics using maybe artist name and duration
    // or allow user to pikc from the options

    const candidates = data
      .filter(e =>
        e.syncedLyrics &&
        Math.abs(e.duration - duration_sec) <= 2 
      );

    
    var syncedLyrics_arr = []
    var plainLyrics_arr = []
    for (var i = 0 ; i < candidates.length; i++) {
      syncedLyrics_arr.push(candidates[i].syncedLyrics)
      plainLyrics_arr.push(candidates[i].syncedLyrics)
    }

    console.log("number of available lyrics", candidates.length);

    if (candidates.length) {
      return res.json({
        lyrics: syncedLyrics_arr,
        plainLyrics: plainLyrics_arr
      });
    }



    


    // chekcing individual artist name

    /*

    for (let i = 0 ; i < req.body.artists.length; i++) {


      const url = new URL("https://lrclib.net/api/get");
      url.searchParams.append("track_name", normalize(req.body.name));
      url.searchParams.append("artist_name", normalize(req.body.artists[i].name));
      url.searchParams.append("album_name", normalize(req.body.album.name));
      url.searchParams.append("duration", duration_sec);

      const response = await fetch(url.toString());
      const data = await response.json();

      console.log("LRCLIB response:", data);

      if (data.syncedLyrics != null) {
        return res.json({ lyrics: data.syncedLyrics, plainLyrics: data.plainLyrics });
      }

    }
      */

  
    
    return res.status(500).json({ error: "Failed to fetch lyrics" });

    
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({ error: "Failed to fetch lyrics" });
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});


app.get("/auth/token", (req, res) => {
  if (!access_token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ access_token });
});

app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const params = new URLSearchParams();
    params.append('code', code);
    params.append('redirect_uri', redirect_uri);
    params.append('grant_type', 'authorization_code');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${spotify_client_id}:${spotify_client_secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Spotify token error:', text);
      return res.status(response.status).send(text);
    }

    const data = await response.json();
    access_token = data.access_token;
    const refresh_token = data.refresh_token;

    console.log('Access token:', access_token);
    console.log('Refresh token:', refresh_token);

    // this line
    // http://music-translator-app-frontend.s3-website.us-east-2.amazonaws.com
    // http://127.0.0.1:5174/
    res.redirect("dukz8h8o1lsds.cloudfront.net");

  } catch (error) {
    console.error('Error fetching Spotify token:', error);
    res.status(500).send('Internal Server Error');
  }
});




var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0 ; i < length; i++ ) {
    text += possible.charAt(Math.floor(Math.random()*possible.length));
  }
  return text;
}

app.get('/auth/login', (req, res) => {

  var scope = "streaming \
               user-read-email \
               user-read-private"

  var state = generateRandomString(16);

  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: spotify_client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
  })

  res.redirect('https://accounts.spotify.com/authorize/?' + auth_query_parameters.toString());
})
