import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import he from 'he';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { translate } from '@vitalets/google-translate-api';



dotenv.config();



const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());



const port = process.env.PORT || 3000;

const spotify_client_id = process.env.SPOTIFY_CLIENT_ID;
const spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET;

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const gemini_model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// local: http://127.0.0.1:3000/auth/callback and http://127.0.0.1:5173
// (Spotify no longer accepts "localhost" redirect URIs, use 127.0.0.1)
const redirect_uri = process.env.REDIRECT_URI || "https://music-translator.onrender.com/auth/callback";
const frontend_url = process.env.FRONTEND_URL || "https://dukz8h8o1lsds.cloudfront.net";

const LRCLIB_HEADERS = {
  'User-Agent': 'Music-Translator (https://github.com/rohit2195-jpg/Music-Translator)'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isBusyStatus = (status) => status === 429 || status >= 500;


// LRCLIB and Gemini both return "busy" errors (429 / 503) now and then, so retry those a few times

async function withRetry(fn, { retries = 3, baseDelay = 500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status ?? 0;
      const retryable = status === 0 || isBusyStatus(status);
      if (!retryable || attempt >= retries) throw err;
      await sleep(baseDelay * 2 ** attempt);
    }
  }
}



// translating only the non-empty lines, then putting them back in place,
// so empty lines (instrumental breaks) never shift the timestamps

async function translateLines(linesArray, translateFn) {
  const indexes = [];
  const toTranslate = [];
  linesArray.forEach((line, i) => {
    if (line.trim() !== '') {
      indexes.push(i);
      toTranslate.push(line);
    }
  });

  const result = [...linesArray];
  if (toTranslate.length === 0) return result;

  const translated = await translateFn(toTranslate);

  indexes.forEach((original_index, i) => {
    // fall back to the original line if the translator dropped one
    result[original_index] = translated[i] ?? linesArray[original_index];
  });

  return result;
}


async function translateTextAdvanced(linesArray, target) {

  const prompt = `
    You are a professional song lyrics translator.

    Translate each of the following song lyric lines into the language with code "${target}".
    Preserve meaning, emotion, and artistic intent over literal word-for-word translation.
    Use natural, fluent language that sounds appropriate for song lyrics.
    Return a JSON array of strings with exactly ${linesArray.length} items, one translated line per input line, in the same order.

    Lines:
    ${JSON.stringify(linesArray)}
  `;

  const response = await withRetry(() => genAI.models.generateContent({
    model: gemini_model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  }), { retries: 2, baseDelay: 1000 });

  const lines = JSON.parse(response.text);
  if (!Array.isArray(lines)) {
    throw new Error('Gemini did not return an array');
  }

  return lines;
}


async function translateTextStandard(linesArray, target) {

  // using google translate to translate lyrics, one line per row

  const text = await translate(linesArray.join('\n'), { to: target });

  return text.text.split('\n');
}


app.get('/', (req, res) => {
  res.send('Hello World! This is the Node.js backend hello there.');
});


app.post('/lyrics/lrc_synced_translate', async (req, res) => {
  try {
    const { lyrics, language, isStandard } = req.body;

    if (typeof lyrics !== 'string' || !language) {
      return res.status(400).json({ error: 'lyrics and language are required' });
    }

    const lines = lyrics.split("\n");

    const lyric_arr = [];
    const timestamp_arr = [];


    // extracting the time stamp and subsequent lyrics from the array
    // assuming format of [mm:ss.xx] Lyrics here

    for (const line of lines) {
      const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (match) {
        timestamp_arr.push(`[${match[1]}]`);
        lyric_arr.push(match[2]);
      }
    }



    // use AI or google translate based on user selection

    let translator = isStandard ? 'standard' : 'advanced';
    let translated;

    if (isStandard) {
      translated = await translateLines(lyric_arr, (arr) => translateTextStandard(arr, language));
    } else {
      try {
        translated = await translateLines(lyric_arr, (arr) => translateTextAdvanced(arr, language));
      } catch (err) {
        // Gemini still busy after retries, Google Translate is better than nothing
        console.error('AI translation failed, using standard instead:', err.message);
        translator = 'standard';
        translated = await translateLines(lyric_arr, (arr) => translateTextStandard(arr, language));
      }
    }


    // using decode to clean translated text
    const combined = timestamp_arr.map((timestamp, i) => {
      return `${timestamp} ${he.decode(translated[i] ?? '')}`;
    });


    res.json({ lyrics: combined.join("\n"), translator });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Translation failed' });
  }
});



// throws when LRCLIB is down / busy, so that isn't mistaken for "this song has no lyrics"

async function searchLrclib(params) {
  const url = new URL("https://lrclib.net/api/search");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.append(key, value);
  }

  return withRetry(async () => {
    const response = await fetch(url, { headers: LRCLIB_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      const err = new Error(`LRCLIB responded ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  });
}


// "Song - Remastered 2011", "Song (feat. X)", "Song (From "Movie")" -> "Song"
function cleanTitle(name) {
  return name
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s*[([][^)\]]*(feat\.?|ft\.|with |from |remaster|version|live|edit|mix)[^)\]]*[)\]]/gi, '')
    .trim();
}


// recent lookups, so replaying / skipping back doesn't hit LRCLIB again
const lyrics_cache = new Map();
const LYRICS_CACHE_SIZE = 500;

function cacheLyrics(key, value) {
  lyrics_cache.delete(key);
  lyrics_cache.set(key, value);
  if (lyrics_cache.size > LYRICS_CACHE_SIZE) {
    lyrics_cache.delete(lyrics_cache.keys().next().value);
  }
}


app.post('/lyrics/lrc_synced_native', async (req, res) => {
  const { name, artists, duration_ms } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Track name is required' });
  }

  const artist_name = artists?.[0]?.name;
  const duration_sec = Math.round((duration_ms || 0) / 1000);
  const cache_key = `${name}|${artist_name}|${duration_sec}`;

  if (lyrics_cache.has(cache_key)) {
    const cached = lyrics_cache.get(cache_key);
    if (cached.lyrics.length === 0) {
      return res.status(404).json({ error: "No synced lyrics found", ...cached });
    }
    return res.json(cached);
  }

  try {
    // searching by track + main artist first, then the title without "- Remastered" / "(feat. ...)",
    // then a looser free text search (album names often differ between Spotify and LRCLIB, so they are not used)

    const hasSynced = (results) => results.some(c => c.syncedLyrics);
    const clean = cleanTitle(name);

    let data = await searchLrclib({ track_name: name, artist_name });
    if (!hasSynced(data) && clean && clean !== name) {
      data = await searchLrclib({ track_name: clean, artist_name });
    }
    if (!hasSynced(data)) {
      data = await searchLrclib({ q: `${clean || name} ${artist_name || ''}`.trim() });
    }


    // closest duration first, so the most likely match is shown by default.
    // the rest are kept so the user can easily change lyrics if they are incorrect

    const candidates = data
      .filter(c => c.syncedLyrics)
      .sort((a, b) =>
        Math.abs(a.duration - duration_sec) - Math.abs(b.duration - duration_sec)
      );


    console.log(`lyrics: "${name}" by ${artist_name} -> ${candidates.length} synced`);

    const result = {
      lyrics: candidates.map(c => c.syncedLyrics),
      plainLyrics: candidates.map(c => c.plainLyrics ?? '')
    };
    cacheLyrics(cache_key, result);

    if (candidates.length === 0) {
      return res.status(404).json({ error: "No synced lyrics found", ...result });
    }
    return res.json(result);

  } catch (error) {
    // LRCLIB busy / unreachable: tell the frontend to try again rather than "no lyrics"
    console.error(`lyrics: "${name}" by ${artist_name} -> lookup failed:`, error.message);
    return res.status(503).json({ error: "Lyrics service is busy, try again", retryable: true, lyrics: [], plainLyrics: [] });
  }
});



async function requestSpotifyToken(params) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${spotify_client_id}:${spotify_client_secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString()
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}


// login state is signed instead of stored, so the callback can't be forged even when it lands on a
// different server instance than /auth/login did (Lambda runs many short-lived copies)

const STATE_TTL_MS = 10 * 60 * 1000;

const signState = (payload) =>
  crypto.createHmac('sha256', spotify_client_secret).update(payload).digest('hex');

function createState() {
  const payload = `${Date.now() + STATE_TTL_MS}.${crypto.randomBytes(16).toString('hex')}`;
  return `${payload}.${signState(payload)}`;
}

function isValidState(state) {
  const [expires, nonce, signature] = String(state ?? '').split('.');
  if (!expires || !nonce || !signature) return false;

  const expected = Buffer.from(signState(`${expires}.${nonce}`));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) && Number(expires) > Date.now();
}


app.get('/auth/login', (req, res) => {

  const scope = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";

  const state = createState();

  const auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: spotify_client_id,
    scope: scope,
    redirect_uri: redirect_uri,
    state: state
  });

  res.redirect('https://accounts.spotify.com/authorize?' + auth_query_parameters.toString());
});


app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${frontend_url}/#error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send('No code provided');
  }

  if (!isValidState(state)) {
    return res.status(400).send('Invalid or expired login state, please try logging in again');
  }

  try {
    const { ok, status, data } = await requestSpotifyToken({
      code,
      redirect_uri,
      grant_type: 'authorization_code',
    });

    if (!ok) {
      console.error('Spotify token error:', data);
      return res.status(status).send(data.error_description || 'Spotify login failed');
    }


    // tokens go back to this user's browser only (in the hash, so they never hit server logs)
    const hash = new URLSearchParams({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: String(data.expires_in),
    });

    res.redirect(`${frontend_url}/#${hash.toString()}`);

  } catch (error) {
    console.error('Error fetching Spotify token:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/auth/refresh', async (req, res) => {
  const refresh_token = req.body?.refresh_token;
  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' });
  }

  try {
    const { ok, status, data } = await requestSpotifyToken({
      grant_type: 'refresh_token',
      refresh_token,
    });

    if (!ok) {
      console.error('Spotify refresh error:', data);
      return res.status(status).json({ error: data.error_description || 'Refresh failed' });
    }

    res.json({
      access_token: data.access_token,
      // Spotify may rotate the refresh token, otherwise keep the old one
      refresh_token: data.refresh_token || refresh_token,
      expires_in: data.expires_in,
    });

  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// on Lambda, lambda.js hands requests to the app instead of it listening on a port
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
  });
}

export default app;
