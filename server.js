
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const host = '0.0.0.0';
const port = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set([
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

if (process.env.FRONTEND_URL) {
  allowedOrigins.add(new URL(process.env.FRONTEND_URL).origin);
}

app.use((req, res, next) => {
  const origin = req.get('Origin');

  if (!origin) {
    return next();
  }

  if (!allowedOrigins.has(origin)) {
    return res.status(403).json({ mensagem: 'Origem não autorizada.' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
    return res.sendStatus(204);
  }

  next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-esta-chave',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(authRoutes);
app.use(viewRoutes);
app.use(userRoutes);

function startServer(currentPort) {
  const server = app.listen(currentPort, host, () => {
    console.log(`Servidor rodando na porta ${currentPort}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Porta ${currentPort} em uso. Tentando ${currentPort + 1}...`);
      server.close(() => startServer(currentPort + 1));
      return;
    }

    console.error(err);
    process.exit(1);
  });
}

startServer(port);
