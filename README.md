# Deskhub

Static front-end: login, `deskhub:` storage keys, and ticket list. **By default everything runs in the browser** using `db.json` served from the same site — **no `npm run api` or port 3001 required.**

## Run the site (default, no API)

Serve the **repo root** so `/index.html`, `/db.json`, `/src/…`, and `/styles/…` are all reachable:

```bash
npm start
```

Or use VS Code **Live Server** with the workspace root as this folder.

Then open **`/`** (login), **`/dashboard.html`**, or **`/public/tickets.html`**.

**Demo login (local mode):** any **`email`** from `db.json` → `users` (e.g. `alice@example.com`) and password **`password`**.

Data is loaded with `fetch` from **`/db.json`**. Ticket writes (`create` / `update` / `delete` / `addComment`) stay disabled in local mode until you enable the remote API (below).

## Optional: real HTTP API on port 3001

If you want `json-server` + `/auth/*` again:

1. `npm install` (installs `json-server` for `server.cjs`).
2. `window.DESKHUB_USE_REMOTE_API = true` in a `<script>` **before** `./src/main.js` in your HTML (and usually `window.DESKHUB_API_BASE = 'http://localhost:3001'`).
3. **`npm run api`** in another terminal.

## Verify the API (remote only)

With **`npm run api`** (or any server) on port **3001**:

```bash
npm run verify:api
```

Or open `http://localhost:3001/tickets` in a browser.

## Tickets list (`public/tickets.html`)

Open **`/public/tickets.html`** after signing in on **`/`**. In **local mode**, users and tickets come from **`db.json`**. Use **Retry** if loading `db.json` fails (wrong server root or missing file).

## Optional config (in HTML before `main.js`)

```html
<script>
  // Use real API + server.cjs instead of in-browser db.json:
  // window.DESKHUB_USE_REMOTE_API = true;
  // window.DESKHUB_API_BASE = 'http://localhost:3001';
  // window.DESKHUB_LOGIN_PATH = '/auth/login';
  // window.DESKHUB_ME_PATH = '/auth/me';
  // window.DESKHUB_LOGOUT_PATH = '/auth/logout';
</script>
```

## Remote auth endpoints (when `DESKHUB_USE_REMOTE_API` is true)

| Action | Path |
|--------|------|
| Login | `POST /auth/login` — body `{ email, password }` |
| Current user | `GET /auth/me` — `Authorization: Bearer <token>` |
| Logout | `POST /auth/logout` — bearer; local storage is always cleared |

## GitHub Pages

Push `index.html`, `dashboard.html`, **`db.json`**, `public/tickets.html`, `styles/`, `src/`, and `.nojekyll` as needed. No build step. For **remote** API, set `window.DESKHUB_USE_REMOTE_API` and `window.DESKHUB_API_BASE` in HTML.
