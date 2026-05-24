const express = require('express');
const morgan  = require('morgan');
const fs      = require('fs');
const path    = require('path');

const port = process.env.PORT || 8081;

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ type: 'application/vnd.api+json' }));

// Serve the Angular production build
app.use(express.static(path.join(__dirname, '..', 'app', 'dist', 'app', 'browser')));

app.post('/upload-survey', function(req, res) {
  const timestamp = Number(new Date);
  req.body['user-id'] = req.ip;
  const dir = path.join(__dirname, 'survey-results');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFile(
    path.join(dir, timestamp + '.json'),
    JSON.stringify(req.body),
    'utf8',
    function () {
      res.sendStatus(200);
    }
  );
});

// Fallback: serve index.html for SPA deep-links
app.get('/*', function(req, res) {
  res.sendFile(path.join(__dirname, '..', 'app', 'dist', 'app', 'browser', 'index.html'));
});

app.listen(port, function () {
  console.log('Legacy backend listening on port', port);
});
