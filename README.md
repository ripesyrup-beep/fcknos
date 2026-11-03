# Card Party
Phone-friendly multiplayer card game (Bryan's Shithead house rules). Node + WebSocket, installable PWA.

    npm install && npm start      # http://localhost:8080   (PORT env to change)
    npm test                      # rule-engine tests + 4-bot end-to-end game

## Host it permanently (free)
**Render (easiest):** push this folder to a GitHub repo → render.com → New → Blueprint → pick the repo (uses `render.yaml`) → Deploy.
You get `https://card-party-xxxx.onrender.com`. Free tier sleeps after 15 min idle; first open takes ~30-50 s to wake. Websockets work.
**Fly.io:** `fly launch` (uses the Dockerfile, internal port 8080) → `fly deploy`.
**Railway:** New Project → Deploy from GitHub repo → it runs `npm start`; add a public domain under Settings → Networking.

Note: games live in server memory; a restart/sleep ends open parties.
On the phone: open the URL → Share → "Add to Home Screen" (iPhone) / ⋮ → "Install app" (Android).
