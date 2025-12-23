import express, { response } from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import he from 'he';
import pkg from '@google-cloud/translate';
const { Translate } = pkg.v2;



dotenv.config();



const app = express();
app.use(express.json());




const port = 3000;

var spotify_client_id = process.env.SPOTIFY_CLIENT_ID
var spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET

console.log("hello");
console.log(spotify_client_id);

let access_token = null;

const redirect_uri = "http://127.0.0.1:5174/auth/callback"


app.use(cors());
//app.use(express.json());




const translate = new Translate({
  key: process.env.GOOGLE_API_KEY,
});


async function translateText(text, target) {
  const [translation] = await translate.translate(text, target);
  return translation;
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
    const translated = await translateText(req.body.plainLyrics, 'en');
    const cleaned = he.decode(translated);

    console.log("cleaned translate lyrics", cleaned)

    res.json({ lyrics: cleaned });
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
    for (let i = 0 ; i < req.body.artists.length; i++) {
      const duration_sec = Math.floor(req.body.duration_ms / 1000);


      const url = new URL("https://lrclib.net/api/get");
      url.searchParams.append("track_name", normalize(req.body.name));
      url.searchParams.append("artist_name", normalize(req.body.artists[i].name));
      url.searchParams.append("album_name", normalize(req.body.album.name));
      url.searchParams.append("duration", duration_sec);

      const response = await fetch(url.toString());
      const data = await response.json();

      //console.log("LRCLIB response:", data);

      if (data.syncedLyrics != null) {
        return res.json({ lyrics: data.syncedLyrics, plainLyrics: data.plainLyrics });
      }

    }
    
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

    res.redirect("/");

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
