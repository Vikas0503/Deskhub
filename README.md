# Deskhub

Small static helpdesk UI: **login**, **dashboard** (ticket counts + recent items), **ticket list** with filters, pagination, **ticket detail in a modal** (edit, comments, delete), and CSV export. No bundler: plain ES modules and shared CSS.

## How to run (default: real API)

The app **defaults to HTTP** against **`http://localhost:3001`** (`src/api/mode.js`, `src/api/client.js`). You should see **Network** requests for login, signup, tickets, comments, and users.

1. **Terminal A — API**

   ```bash
   npm install
   npm run api
   ```

2. **Terminal B — static UI** (from repo root)

   ```bash
   npm start
   ```

   Open **`http://localhost:5173/`** (or the URL `serve` prints). Use **`http://`**, not `file://`, so API calls work.

   If login shows **“Failed to fetch”** in DevTools, confirm **`npm run api` is running** and restart it after updating `server.cjs`. The API enables **CORS** for the UI origin (e.g. `:5173` → `:3001`).

3. **Sign in:** any **`email`** from `db.json` → `users` (e.g. `alice@example.com`) and password **`password`** (seed users have no stored password; the server uses this default).

4. **Sign up:** `POST /auth/register` creates a user in **`db.json`** via the API; sign in with the password you chose (min 6 characters).

Paths the static server must expose:

- `/index.html`, `/signup.html`, `/dashboard.html`
- `/public/tickets.html` (ticket detail modal; deep link `?ticket=<id>`). Legacy `/public/ticket-detail.html?id=` redirects here.
- `/src/…`, `/styles/main.css`, `/db.json` (only used in **local / offline** mode)

---

## Data mode: remote (default) vs local-only

### Default: JSON Server API (`npm run api`)

- Auth: **`POST /auth/login`**, **`POST /auth/register`**, **`GET /auth/me`**, **`POST /auth/logout`**
- Data: **`GET/POST/PATCH/DELETE /tickets`**, **`GET/POST /comments`**, **`GET /users`**

Override the API origin (optional):

```html
<script>
  window.DESKHUB_API_BASE = 'http://localhost:3001';
</script>
```

Place **before** `<script type="module" src="./src/main.js"></script>` if you use a custom base.

Verify the API is up:

```bash
npm run verify:api
```

### Offline: `db.json` + `localStorage` only

No REST for tickets/auth (except one **`GET db.json`** for the seed). Set **before** `main.js`:

```html
<script>
  window.DESKHUB_USE_LOCAL_API = true;
</script>
```

Optional: `window.DESKHUB_DB_JSON_URL` to point at a different seed file.

You can also force remote off with `window.DESKHUB_USE_REMOTE_API = false`.

---

## Feature map

| Area | Behavior |
|------|----------|
| **Dashboard** | One `listTickets()` call; four stat cards; **Recent 5** tickets link to the list with `?ticket=`. |
| **Tickets list** | Search, status (including **`resolved + closed`** → URL `status=done`), priority, assignee, sort, pagination; URL sync via `history.replaceState`. Reset filters + Export CSV on this page. |
| **Ticket detail** | Modal on list page: save fields + optional comment; delete with confirm. |
| **Theme** | Light / dark toggle (sun/moon); stored in `localStorage` under `deskhub-theme`. |
| **UI** | Toasts, full-screen loader, confirm dialog. |
| **Keyboard** | **`?`** or **Shift+/** — shortcut help (toast). **Tickets:** **`/`** search, **`n`** new ticket, **`r`** reset filters, **`e`** export CSV, **`d`** dashboard (not while typing in a field). **Dashboard:** **`t`** tickets. **Login / signup:** **`/`** focus first form field. **Esc** closes modals on the tickets page (existing). |

---

## Optional HTML flags (before `main.js`)

```html
<script>
  // window.DESKHUB_USE_LOCAL_API = true;  // offline: db.json + localStorage
  // window.DESKHUB_USE_REMOTE_API = false; // same as local API mode
  // window.DESKHUB_API_BASE = 'http://localhost:3001';
  // window.DESKHUB_DB_JSON_URL = '/custom/path/db.json';
  // window.DESKHUB_LOGIN_PATH = '/auth/login';
  // window.DESKHUB_REGISTER_PATH = '/auth/register';
  // window.DESKHUB_ME_PATH = '/auth/me';
  // window.DESKHUB_LOGOUT_PATH = '/auth/logout';
</script>
```

---

## Architecture (short)

- **`src/main.js`** — `data-page` on `<body>` dispatches to page modules.
- **`src/api/*.js`** — auth, users, tickets; **remote vs local** via `useRemoteApi()` in `src/api/mode.js`.
- **`server.cjs`** — json-server + `/auth/*` for local development.
- **`src/utils/ticketQuery.js`** — client-side list filtering, sort, pagination, URL query parse/build.
- **`src/modules/ui.js`** — toasts, confirm, page loader.
- **`src/modules/keyboardShortcuts.js`** — global shortcuts (`?` help, `/` `n` `r` `e` `d` `t` by page).

---

## Limitations

- **Demo API:** passwords are handled in plain text on the server for local dev only; **`GET /users`** returns full rows from `db.json` (including `password` for users that have one).
- **Remote:** response shapes must match what the UI expects, or adapt the API layer.
- **Local mode:** GitHub Pages–style hosting has no shared server; data stays in the browser after the seed load.

---

## Smoke test (fresh clone)

1. `npm run api` and `npm start`; open `http://localhost:5173/`.
2. Log in with `alice@example.com` / `password`; confirm redirect to dashboard.
3. Open **Tickets**; create a ticket; filter; open a row → detail modal; save / comment / delete.
4. **Sign up** a new user; log in with that email and password.
5. **Log out** from dashboard; confirm login page.

---

## Screenshots

Add your own under `docs/screenshots/` when you ship; none are committed here by default.

## GitHub Pages

Ship `index.html`, `signup.html`, `dashboard.html`, `db.json`, `public/`, `src/`, `styles/`, and `.nojekyll` if needed. For static-only behavior, set `DESKHUB_USE_LOCAL_API` in an inline script. For a hosted API, set `DESKHUB_API_BASE` to your backend URL (CORS must allow your Pages origin).
