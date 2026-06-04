/**
 * json-server + minimal /auth/* routes for local Deskhub demo.
 * Run: npm run api
 */
const path = require('node:path');
const jsonServer = require('json-server');

const PORT = Number(process.env.PORT) || 3001;
const DB = path.join(__dirname, 'db.json');

/** Demo password for every user (local only). */
const DEMO_PASSWORD = 'password';

const server = jsonServer.create();
const router = jsonServer.router(DB);
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

server.post('/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  const users = router.db.get('users').value();
  const user = users.find((u) => String(u.email).toLowerCase() === email);

  if (!user || password !== DEMO_PASSWORD) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = `demo-${user.id}`;
  const safeUser = { id: user.id, name: user.name, email: user.email };
  res.json({ token, user: safeUser });
});

server.get('/auth/me', (req, res) => {
  const auth = req.headers.authorization || '';
  const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const m = /^demo-(\d+)$/.exec(raw);
  if (!m) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const id = Number(m[1], 10);
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
  console.log(`Login: email from db.json (e.g. alice@example.com) / password: ${DEMO_PASSWORD}`);
});
