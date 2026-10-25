# Music-Translator

Synced, translated lyrics on a tiny iPod. Play a song on Spotify and read along line by line, in the original language and in yours.

### Why did I create this project?
My goal was for individuals to be able to explore new genres, learn new languages, and understand/appreciate the significance and richness of lyrics in other songs.

### Check out the project!
I appreciate all the feedback.

[dukz8h8o1lsds.cloudfront.net](https://dukz8h8o1lsds.cloudfront.net)

### How does it work?
 1. First, this project links to your Spotify account. On the website, music plays right in the browser tab. In the desktop app, the iPod works as a remote for your own Spotify app.
 2. Then, it fetches synced (LRC) lyrics from an API called LRCLIB, matching on title, artist and song length.
 3. This project translates lyrics in 2 ways:

    a. **Standard:** Google Translate, for quick translations.

    b. **AI:** Google Gemini, for more natural and nuanced translations, like romanized text or more complex languages. If Gemini is busy, it falls back to Google Translate and the iPod tells you.

### The iPod
 - Spin the click wheel (drag around the ring, scroll, or use the arrow keys) to move through menus. On the Now Playing screen it changes the volume.
 - **MENU** opens the settings: lyrics on/off, translation on/off, language (13 options), translator (Standard / AI), other lyric versions, iPod color, and the clicker sound.
 - The **center button** switches between lyrics and the album art view.
 - Keyboard: ←/→ previous/next, Space play/pause, Enter select, Esc menu.

### Website vs desktop app
Both use the same React frontend and the same backend. The only difference is playback:

| | Website | Desktop app |
|---|---|---|
| Music plays in | The browser tab (Spotify Web Playback SDK) | Your Spotify app (controlled through the Spotify Web API) |
| Login | Redirects to Spotify | Opens a Spotify login window |
| Window | Normal web page | Small floating iPod that stays on top |

The desktop app (Electron) loads the deployed website, so it picks up updates without reinstalling.

### Tech stack
    Frontend - React, TypeScript, Vite
    Backend - Node.js, Express
    Desktop - Electron
    APIs used - Spotify, LRCLIB, Google Gemini, Google Translate

    Hosting: AWS S3, AWS CloudFront, Render (backend)

### Project structure
    backend/    Express server: Spotify login + token refresh, lyrics search, translation
    frontend/   React app: iPod UI (src/ipod), players (src/player), lyrics (src/useLyrics.ts)
    desktop/    Electron wrapper for the floating iPod

### Running locally

1. In the Spotify developer dashboard, add `http://127.0.0.1:3000/auth/callback` as a Redirect URI (Spotify no longer allows `localhost`), and add anyone testing under User Management. Development Mode allows 5 users, and the app owner needs Spotify Premium.
2. Create `backend/.env`:

    ```
    SPOTIFY_CLIENT_ID=...
    SPOTIFY_CLIENT_SECRET=...
    GEMINI_API_KEY=...        # from Google AI Studio
    # GEMINI_MODEL=...        # optional, overrides the default Gemini model
    ```

3. Backend: `cd backend && npm install && REDIRECT_URI=http://127.0.0.1:3000/auth/callback FRONTEND_URL=http://127.0.0.1:5173 npm start`
4. Frontend: `cd frontend && npm install && npx vite --host 127.0.0.1` and open http://127.0.0.1:5173. Add `?demo` to the URL to try the iPod with a fake player, no Spotify needed.
5. Desktop app (optional): `cd desktop && npm install && npm start` (with the frontend running). `npm run dist` builds a .dmg that loads the deployed site.

In production, set `REDIRECT_URI`, `FRONTEND_URL`, and the `.env` values as environment variables on the backend host, and `VITE_API_BASE` on the frontend build if the backend URL changes.

### Deploying the backend (AWS Lambda)

Every push to `main` that changes `backend/` runs `.github/workflows/deploy-backend.yml`, which zips the backend and uploads it to the `music-translator-backend` Lambda. GitHub has no stored AWS keys: it logs in with OIDC (a short-lived token that proves which repo and branch is running) and gets a role that can only update this one function.

One-time setup (AWS CLI, as an admin):

1. Let AWS trust GitHub's login tokens (once per AWS account; skip if it already exists):

    ```
    aws iam create-open-id-connect-provider \
      --url https://token.actions.githubusercontent.com \
      --client-id-list sts.amazonaws.com
    ```

2. Create the deploy role. Only workflows on this repo's `main` branch can use it:

    ```
    cat > trust.json <<'EOF'
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": { "Federated": "arn:aws:iam::769297868172:oidc-provider/token.actions.githubusercontent.com" },
        "Action": "sts:AssumeRoleWithWebIdentity",
        "Condition": {
          "StringEquals": {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": "repo:rohit2195-jpg/Music-Translator:ref:refs/heads/main"
          }
        }
      }]
    }
    EOF
    aws iam create-role --role-name github-deploy-music-translator --assume-role-policy-document file://trust.json
    ```

3. Allow the role to update only this function:

    ```
    cat > deploy-policy.json <<'EOF'
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": ["lambda:UpdateFunctionCode", "lambda:GetFunction", "lambda:GetFunctionConfiguration"],
        "Resource": "arn:aws:lambda:us-east-1:769297868172:function:music-translator-backend"
      }]
    }
    EOF
    aws iam put-role-policy --role-name github-deploy-music-translator \
      --policy-name deploy-lambda --policy-document file://deploy-policy.json
    ```

4. Configure the function (CI only uploads code, it doesn't change these):
    - Runtime Node.js 22.x, handler `lambda.handler`, timeout 30 seconds (the 3 second default is too short for lyrics + translation).
    - Environment variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `GEMINI_API_KEY`, `REDIRECT_URI` (`https://dukz8h8o1lsds.cloudfront.net/auth/callback`, also added in the Spotify dashboard) and `FRONTEND_URL`.
    - A Function URL with auth type `AWS_IAM`, used as a CloudFront origin (see below). It is not public: only CloudFront can call it.

### How requests reach the backend (CloudFront)

One CloudFront distribution serves everything on `https://dukz8h8o1lsds.cloudfront.net`:

| Path | Goes to | Caching |
|---|---|---|
| `/auth/*`, `/lyrics/*` | Lambda Function URL | Off (`CachingDisabled`, origin request policy `AllViewerExceptHostHeader`) |
| everything else | S3 bucket `music-translator-app-frontend` | On; the `spa-rewrite` CloudFront Function serves `index.html` for app routes like `/about` |

- **Locked down with Origin Access Control (OAC):** CloudFront signs every request to the Lambda, and the Lambda's permissions only accept requests signed by this distribution. Calling the Function URL directly returns 403, so all traffic goes through CloudFront (and its firewall). The S3 bucket is private the same way.
- **POST bodies:** CloudFront can't sign a request body itself, so the frontend sends its SHA-256 hash in an `x-amz-content-sha256` header (`postJson` in `frontend/src/ApiBase.tsx`). A POST without it is rejected.
- **Same domain:** the frontend calls `/lyrics/...` on its own domain (`API_BASE` is empty in production), so there's no CORS in production.

### Deploying the frontend

Every push to `main` that changes `frontend/` runs `.github/workflows/deploy-frontend.yml`: lint, build, upload to S3, then clear CloudFront's cache. Hashed files in `assets/` are cached for a year; `index.html` is `no-cache` so a new build shows up right away. It logs in with the `update-frontend-s3` role (GitHub secret `AWS_FRONTEND_ROLE_ARN`), which can only write to the bucket and invalidate this distribution.

5. In GitHub: Settings → Secrets and variables → Actions → New repository secret, named `AWS_DEPLOY_ROLE_ARN`, value `arn:aws:iam::769297868172:role/github-deploy-music-translator`.

Then push to `main`, or run it by hand from the Actions tab ("Deploy backend" → Run workflow).

### Notable Challenges

One notable challenge that I faced was determining how I wanted to translate lyrics. I compared the benefits and drawbacks of word by word, line by line, and literal vs more nuanced translations. Thanks to my friend Aneesh's help, I ended up translating line by line, as the user would be able to understand the context and nuance of lyrics, compared to other translations (like everyday language). Overall, this was a very fun project to undertake because the documentation for these resources was very clear and helpful.

Another challenge was reliability. LRCLIB and Gemini are sometimes overloaded, which used to look like "no lyrics found". The backend now retries, caches lyrics, and retries with a cleaned-up title (dropping things like "- Remastered" or "(feat. ...)"), and the iPod has a Retry Lyrics option.

### Next Steps
 - **Literal vs natural translations:** a word-for-word mode (keeping the original word order) alongside the natural translation, so learners can map each word to its meaning.
 - **Word details:** select a lyric line to see each word's meaning and grammar.
 - **Mobile:** right now playback only works on laptops (Google Chrome & Firefox) due to DRM constraints. My next step will be to make this project as accessible as possible.
