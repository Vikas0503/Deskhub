/**
 * json-server + minimal /auth/* routes for local Deskhub demo.
 * Run: npm run api
 */
const path = require('node:path');
const cors = require('cors');
const jsonServer = require('json-server');

const PORT = Number(process.env.PORT) || 3001;
const DB = path.join(__dirname, 'db.json');

/** Demo password for every user (local only). */
const DEMO_PASSWORD = 'password';

const server = jsonServer.create();
const router = jsonServer.router(DB);
const middlewares = jsonServer.defaults({ noCors: true });

/** CORS first so the UI on another port (e.g. :5173) can POST /auth/login and use the REST routes. */
server.use(
  cors({
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

server.use(middlewares);
server.use(jsonServer.bodyParser);

server.post('/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const users = router.db.get('users').value();
  const user = users.find((u) => String(u.email).toLowerCase() === email);

  const expected =
    user && typeof user.password === 'string' && user.password.length > 0 ? user.password : DEMO_PASSWORD;

  if (!user || password !== expected) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = `demo-${user.id}`;
  const safeUser = { id: user.id, name: user.name, email: user.email };
  res.json({ token, user: safeUser });
});

server.post('/auth/register', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: 'Invalid registration data.' });
  }

  const users = router.db.get('users').value();
  if (users.some((u) => String(u.email).toLowerCase() === email)) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const ids = users.map((u) => Number(u.id)).filter(Number.isFinite);
  const nextId = (ids.length ? Math.max(...ids) : 0) + 1;
  const newUser = { id: nextId, name, email, password };
  router.db.get('users').push(newUser).write();

  res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email });
});

server.get('/auth/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const m = /^demo-(\d+)$/.exec(raw);
  if (!m) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const id = Number.parseInt(m[1], 10);
  const users = router.db.get('users').value();
  const user = users.find((u) => Number(u.id) === id);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  res.json({ id: user.id, name: user.name, email: user.email });
});

server.post('/auth/logout', (_req, res) => {
  res.sendStatus(204);
});

server.use(router);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Deskhub API http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Login: seed users use password "${DEMO_PASSWORD}"; registered users use their chosen password.`);
});
