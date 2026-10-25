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
// the smallest, cheapest Gemini that still works: translating lyrics doesn't need a big model
const gemini_model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const modelList = (value, fallback) => (value || fallback).split(',').map(m => m.trim()).filter(Boolean);

// each Gemini model has its own capacity, so when the main one is busy (503 "high demand")
// another one usually isn't
const gemini_backup_models = modelList(process.env.GEMINI_BACKUP_MODELS, 'gemini-3.5-flash-lite')
  .filter(m => m !== gemini_model);

// Groq (free tier, a different company's servers) for when Google is busy. skipped without a key
const groq_api_key = process.env.GROQ_API_KEY;
// (gpt-oss-20b is faster but often skips the romanization, Google does that better as the last step)
const groq_models = modelList(process.env.GROQ_MODELS, 'openai/gpt-oss-120b');

// tried in order until one answers. after these, Google Translate
const ai_providers = [
  ...[gemini_model, ...gemini_backup_models].map(model => ({ name: `Gemini ${model}`, call: callGemini, model })),
  ...(groq_api_key ? groq_models.map(model => ({ name: `Groq ${model}`, call: callGroq, model })) : []),
];

// AI gets this long in total, leaving time for Google Translate within the 25s Lambda timeout.
// each model gets at most PROVIDER_TIMEOUT_MS of it, so one stuck model still leaves time for the next
const AI_TIME_BUDGET_MS = 15000;
const PROVIDER_TIMEOUT_MS = 9000;

// local: http://127.0.0.1:3000/auth/callback and http://127.0.0.1:5173
// (Spotify no longer accepts "localhost" redirect URIs, use 127.0.0.1)
const redirect_uri = process.env.REDIRECT_URI || "https://music-translator.onrender.com/auth/callback";
const frontend_url = process.env.FRONTEND_URL || "https://dukz8h8o1lsds.cloudfront.net";

const LRCLIB_HEADERS = {
  'User-Agent': 'Music-Translator (https://github.com/rohit2195-jpg/Music-Translator)'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isBusyStatus = (status) => status === 429 || status >= 500;


// LRCLIB and Gemini both return "busy" errors (429 / 503) now and then, so retry those a few times.
// once the signal's time is up, stop instead (the error is the timeout itself, not a busy server)

async function withRetry(fn, { retries = 3, baseDelay = 500, signal } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status ?? 0;
      const retryable = status === 0 || isBusyStatus(status);
      if (!retryable || attempt >= retries || signal?.aborted) throw err;
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


// a letter from any script other than Latin (Devanagari, Hangul, Kana, Arabic...).
// those lines get a romanized version, lines already in Latin letters ("tum hi ho") don't need one
const NON_LATIN = /(?!\p{Script=Latin})\p{L}/u;
const needsRomanization = (text) => NON_LATIN.test(text);


// with romanize, returns { translation, romanized } per line instead of just the translated line

async function translateTextAdvanced(linesArray, target, romanize = false) {

  const romanizeRules = romanize ? `
    Also romanize each original line: write it in Latin letters the way a native speaker would casually type it,
    so a learner can sing along (Hindi as Hinglish like "tum hi ho", no diacritics; Japanese in Hepburn romaji;
    Chinese in pinyin with tone marks; Korean in Revised Romanization).
    If a line is already in Latin letters, use an empty string for its romanized value.
    Return exactly ${linesArray.length} objects, one per input line, in the same order,
    each with "translation" (the translated line) and "romanized" (the original line in Latin letters).
  ` : `
    Return exactly ${linesArray.length} strings, one translated line per input line, in the same order.
  `;

  const prompt = `
    You are a professional song lyrics translator.

    Translate each of the following song lyric lines into the language with code "${target}".
    Preserve meaning, emotion, and artistic intent over literal word-for-word translation.
    Use natural, fluent language that sounds appropriate for song lyrics.
    ${romanizeRules}

    Lines:
    ${JSON.stringify(linesArray)}
  `;

  const started = Date.now();
  const remaining = () => AI_TIME_BUDGET_MS - (Date.now() - started);
  let lastError;

  for (const provider of ai_providers) {
    if (remaining() <= 0) break;
    try {
      const signal = AbortSignal.timeout(Math.min(remaining(), PROVIDER_TIMEOUT_MS));
      const lines = await provider.call(provider.model, prompt, romanize, signal);

      // a model that skips or merges lines would put translations next to the wrong lyrics
      if (!Array.isArray(lines) || lines.length !== linesArray.length) {
        throw new Error(`expected ${linesArray.length} lines, got ${Array.isArray(lines) ? lines.length : typeof lines}`);
      }

      // small models sometimes copy the original script into "romanized" instead of converting it
      if (romanize) {
        const needed = linesArray.filter(needsRomanization).length;
        const unconverted = lines.filter((l, i) => needsRomanization(linesArray[i]) && needsRomanization(String(l?.romanized ?? ''))).length;
        if (unconverted > needed * 0.2) throw new Error(`${unconverted} of ${needed} lines were not romanized`);
      }
      if (provider !== ai_providers[0]) console.log(`AI translation used backup ${provider.name}`);
      return lines;
    } catch (err) {
      console.error(`${provider.name} failed:`, String(err.message).slice(0, 200));
      lastError = err;
    }
  }

  throw lastError ?? new Error('AI translation took too long');
}


async function callGemini(model, prompt, romanize, signal) {
  const items = romanize
    ? {
        type: Type.OBJECT,
        properties: { translation: { type: Type.STRING }, romanized: { type: Type.STRING } },
        required: ['translation', 'romanized'],
      }
    : { type: Type.STRING };

  // one quick retry per model, then move on: a busy model usually stays busy for a while.
  // the SDK only listens for the signal firing later, a request given an already-expired signal
  // would never time out, so check it before each try
  const response = await withRetry(() => {
    signal.throwIfAborted();
    return genAI.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items },
        abortSignal: signal,
      },
    });
  }, { retries: 1, baseDelay: 500, signal });

  return JSON.parse(response.text);
}


// Groq speaks the OpenAI API. strict json_schema makes it return exactly this shape
// (the top level has to be an object, so the lines go in "lines")

async function callGroq(model, prompt, romanize, signal) {
  const items = romanize
    ? {
        type: 'object',
        additionalProperties: false,
        required: ['translation', 'romanized'],
        properties: { translation: { type: 'string' }, romanized: { type: 'string' } },
      }
    : { type: 'string' };

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groq_api_key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      // gpt-oss "thinks" before answering, a little is plenty for lyrics
      reasoning_effort: 'low',
      max_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lyrics',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['lines'],
            properties: { lines: { type: 'array', items } },
          },
        },
      },
    }),
  });

  // no retry here: Groq's 429 means a free-tier limit was hit, which won't clear in a second
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Groq responded ${response.status}: ${JSON.stringify(data.error ?? data)}`);

  return JSON.parse(data.choices[0].message.content).lines;
}


// using google translate to translate lyrics, one line per row.
// Google also sends back the original in Latin letters ("src_translit"), used when AI is busy

// 15s of AI + 8s here stays under the 25s Lambda timeout
const GOOGLE_TIMEOUT_MS = 8000;

async function translateTextGoogle(linesArray, target) {
  const result = await translate(linesArray.join('\n'), {
    to: target,
    fetchOptions: { signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) },
  });

  const translit = result.raw?.sentences?.find(s => s.src_translit)?.src_translit?.split('\n');

  return {
    lines: result.text.split('\n'),
    romanized: translit?.length === linesArray.length ? translit : null,
  };
}

async function translateTextStandard(linesArray, target) {
  return (await translateTextGoogle(linesArray, target)).lines;
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



    // use AI or google translate based on user selection.
    // AI also romanizes lyrics written in another script (Devanagari, Hangul...)

    let translator = isStandard ? 'standard' : 'advanced';
    let translated;
    let romanized = null;

    if (isStandard) {
      translated = await translateLines(lyric_arr, (arr) => translateTextStandard(arr, language));
    } else {
      const romanize = lyric_arr.some(needsRomanization);
      let results;

      try {
        results = await translateLines(lyric_arr, (arr) => translateTextAdvanced(arr, language, romanize));
      } catch (err) {
        // every AI model was busy, Google Translate is better than nothing (and can romanize too)
        console.error('AI translation failed, using standard instead:', err.message);
        translator = 'standard';
        results = await translateLines(lyric_arr, async (arr) => {
          const { lines, romanized: translit } = await translateTextGoogle(arr, language);
          return romanize ? lines.map((translation, i) => ({ translation, romanized: translit?.[i] ?? '' })) : lines;
        });
      }

      if (romanize) {
        // results hold { translation, romanized } for lyric lines, and the original string
        // for empty lines (or a line the translator dropped)
        translated = results.map((r, i) => (typeof r === 'string' ? r : r.translation || lyric_arr[i]));
        romanized = results.map((r, i) =>
          typeof r === 'string' || !needsRomanization(lyric_arr[i]) || needsRomanization(String(r.romanized ?? ''))
            ? '' : String(r.romanized).replace(/\s+/g, ' ').trim());
      } else {
        translated = results;
      }
    }


    // using decode to clean translated text
    const combined = timestamp_arr.map((timestamp, i) => {
      return `${timestamp} ${he.decode(translated[i] ?? '')}`;
    });
    const romanized_lrc = romanized && timestamp_arr.map((timestamp, i) => `${timestamp} ${he.decode(romanized[i])}`);


    res.json({ lyrics: combined.join("\n"), romanized: romanized_lrc?.join("\n") ?? null, translator });
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
