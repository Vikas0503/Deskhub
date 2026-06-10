# Deskhub

Small static helpdesk UI: **login**, **dashboard** (ticket counts + recent items), **ticket list** with filters, pagination, **ticket detail in a modal** (edit, comments, delete), and CSV export. No bundler: plain ES modules and shared CSS.

## How to run

Serve the **repository root** so these paths work together:

- `/index.html`, `/signup.html`, `/dashboard.html`
- `/public/tickets.html` (includes ticket detail modal; deep link `?ticket=<id>`). Legacy `/public/ticket-detail.html?id=` redirects here.
- `/src/…`, `/styles/main.css`, `/db.json`

```bash
npm start
```

Or use any static server (e.g. VS Code Live Server) with the project root as the web root.

Then open **`/`** for login. After sign-in you land on **`/dashboard.html`**.

**Demo login (default, in-browser data):** any **`email`** from `db.json` → `users` (for example `alice@example.com`) and password **`password`**.

You can also **sign up** on `/signup.html`; new users are merged into local storage and appear in assignee pickers.

## Data mode (default vs remote API)

### Default: `db.json` in the browser

The app loads **`db.json`** with `fetch`. The URL is resolved from the current page; override with **`window.DESKHUB_DB_JSON_URL`** if needed.

In this mode, **tickets and comments are read and written in the browser** (local persistence layer in `src/api/tickets.js` and related modules). You do **not** need `npm run api` for normal local development.

### Optional: JSON Server on port 3001

1. `npm install`
2. Before `./src/main.js`, set for example:

   ```html
   <script>
     window.DESKHUB_USE_REMOTE_API = true;
     window.DESKHUB_API_BASE = 'http://localhost:3001';
   </script>
   ```

3. Run **`npm run api`** in another terminal.

Verify the API (remote only):

```bash
npm run verify:api
```

## Feature map

| Area | Behavior |
|------|----------|
| **Dashboard** | One `listTickets()` call; four stat cards; **Recent 5** tickets; **Reset list filters** opens the ticket list with no query string; **Export CSV** downloads the loaded tickets. |
| **Tickets list** | Search, status (including **`resolved + closed`** → URL `status=done`), priority, assignee, sort, pagination; URL sync via `history.replaceState`. |
| **Ticket detail** | **Save changes** for fields + optional comment; delete with confirm. |
| **Theme** | **Light / dark** toggle (header or floating on minimal pages); choice stored in `localStorage` under `deskhub-theme`. |
| **UI** | Toast stack, **full-screen loader** on list refresh, login, signup, create ticket, save, delete, and dashboard load; confirm dialog and modal motion. |

## Optional HTML flags (before `main.js`)

```html
<script>
  // window.DESKHUB_USE_REMOTE_API = true;
  // window.DESKHUB_API_BASE = 'http://localhost:3001';
  // window.DESKHUB_DB_JSON_URL = '/custom/path/db.json';
  // window.DESKHUB_LOGIN_PATH = '/auth/login';
  // window.DESKHUB_ME_PATH = '/auth/me';
  // window.DESKHUB_LOGOUT_PATH = '/auth/logout';
</script>
```

## Architecture (short)

- **`src/main.js`** — `data-page` on `<body>` dispatches to page modules.
- **`src/api/*.js`** — auth, users, tickets; local vs remote decided by `DESKHUB_USE_REMOTE_API`.
- **`src/utils/ticketQuery.js`** — client-side list filtering, sort, pagination, URL query parse/build (includes `status=done` for resolved + closed).
- **`src/modules/ui.js`** — toasts, confirm, page loader.
- **`src/modules/theme.js`** — light/dark `data-theme` on `<html>` + toggle.
- **`styles/main.css`** — CSS variables for dark (default) and `[data-theme='light']`, layout, responsive tweaks from **768px** up.

## Limitations

- **GitHub Pages / static hosting:** writes stay in **session** unless you add a real backend or a service worker persistence strategy; `db.json` is the seed, not a live shared database.
- **Remote API:** must match the shapes expected by the modules (tickets, users, comments) or adapt the API layer.
- **Screens:** layout is tuned for phones first and **768px+** for wider grids; very small viewports may scroll more on the tickets toolbar.

## Smoke test (fresh clone)

1. `npm start` from repo root; open `/`.
2. Log in with a `db.json` user / `password`; confirm redirect to dashboard.
3. Dashboard: four counts load; **Recent** links open detail.
4. Open **Tickets**; create a ticket; filter by status including **resolved + closed**; open row → detail.
5. Change status/priority/assignee; add a comment; confirm empty state when there are no comments on a new ticket.
6. Delete ticket from detail (confirm); ensure list updates.
7. **Log out** from dashboard; confirm login page.

## Screenshots

Add your own under `docs/screenshots/` (or the host of your choice) when you ship; none are committed here by default.

## GitHub Pages

Ship `index.html`, `signup.html`, `dashboard.html`, `db.json`, `public/`, `src/`, `styles/`, and `.nojekyll` if needed. For remote API, inject the `window.DESKHUB_*` script as above.
