## Project snapshot

- Single-page React app bootstrapped with Vite (`/src/*`).
- Minimal Express server in `server.js` that uses Socket.IO for realtime rooms (`port 3001` by default).
- Static assets live under `/public` (see `/public/emojis`).

## What an AI coding agent needs to know to be productive

- Dev/run commands (see `package.json`):
  - `npm run dev` — start the Vite dev server (client).
  - `npm run server` — start the backend Express + Socket.IO server (runs on port 3001).
  - Run both (two terminals) to test full realtime behavior.
  - `npm run build` / `npm run preview` for production build and preview.

- Primary integration points:
  - `server.js` defines the server-side room shape and Socket.IO events. Key functions: `getRoom(roomCode)` and `emitRoom(roomCode)`.
  - `src/App.jsx` is the single large client component. It imports `socket.io-client` and connects to `SERVER_URL` (default `http://localhost:3001`). It listens for `room_state` and emits events like `join_room` and `chat_message`.
  - Data shape to preserve when changing server/client: rooms include { players, feed, phase, round, judgeIndex, activePlayerIndex, submissions, selectedByPlayer, revealOrder, scores, centerImage, turnEndsAt } — keep these keys when modifying protocol.

## Project-specific conventions & patterns

- Single-file React app: most UI + logic lives in `src/App.jsx`. Prefer modifying smaller units carefully (preserve helper functions such as `normalizeName`, `normalizeRoom`, localStorage keys and utils).
- Local persistence keys (used by client):
  - `STORAGE_KEY = "jusdepomme-player-stats-v1"`
  - `LAST_NAME_KEY = "jusdepomme-last-player"`
  - `LAST_ROOM_KEY = "jusdepomme-last-room"`
  Keep these keys stable to avoid breaking player state.
- Theme definitions and UI constants are in `src/App.jsx` under `themes` and top-level constants (`TURN_SECONDS`, `EMOJI_FOLDER`, `EMOJI_FILES`).

## Editing guidance / safe change checklist

1. When changing the realtime protocol, update both `server.js` and `src/App.jsx` together. Example: adding an event `request_hint` requires adding socket handling in `server.js` and adding `socket.emit('request_hint', ...)` / `socket.on('hint', ...)` in `App.jsx`.
2. Preserve room state keys listed above. If you must rename a key, update both sides and migrate existing clients carefully.
3. Server: CORS is open (`origin: '*'`) for dev; be explicit if you restrict it.
4. To run full integration locally: open two terminals — `npm run server` and `npm run dev` — then open the Vite URL (index.html loads `/src/main.jsx`).

## Helpful examples (where to look)

- Realtime events and room model: `server.js` (search `io.on("connection")`, `getRoom`, `emitRoom`).
- Client socket usage: `src/App.jsx` (look for `socket.connect()`, `socket.on('room_state', ...)`, and `socket` event emits like `join_room`).
- Dev scripts and dependencies: `package.json` (vite, socket.io, express). Use `npm run lint` to run ESLint.

## Prompts & guardrails for AI edits

- If modifying game logic, add a short migration note at the top of `server.js` and a unit-test-style manual QA checklist in PR description (how to reproduce one round).
- Avoid moving large chunks out of `App.jsx` without running the app — it's the functional core. If you split it, keep behavior identical and run `npm run dev` + `npm run server` to validate.

If anything in here looks wrong or you want more examples (API event list, sample room JSON), tell me which area to expand.
