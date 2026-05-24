const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 8081;
const APP_DIST = path.resolve(__dirname, '../app/dist/app/browser');
const RESULTS = path.resolve(__dirname, './survey-results');

if (!fs.existsSync(RESULTS)) fs.mkdirSync(RESULTS, { recursive: true });

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(APP_DIST));

app.post('/upload-survey', (req, res) => {
  const ts = Date.now();
  req.body['user-id'] = req.ip;
  fs.writeFile(
    path.join(RESULTS, `${ts}.json`),
    JSON.stringify(req.body),
    'utf8',
    (err) => (err ? res.sendStatus(500) : res.sendStatus(200))
  );
});

app.get('/healthz', (_req, res) => res.sendStatus(200));

app.get('*', (_req, res) => res.sendFile(path.join(APP_DIST, 'index.html')));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
