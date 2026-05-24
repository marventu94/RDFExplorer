# RDFExplorer

SPARQL visual query builder and RDF explorer.

Angular 17+ standalone application with cytoscape.js graph visualisation, replacing the legacy AngularJS 1.6 + D3 v3 codebase. The legacy code lives under `legacy/` for reference and can be deleted once the migration is validated.

## Local development

```bash
# Terminal 1: Angular dev server (port 4200, proxies /upload-survey to :8081)
cd app && npm install && npm start

# Terminal 2: Express backend (port 8081)
cd server && npm install && npm start
```

Open http://localhost:4200.

## Production build

```bash
# Build the Angular SPA
cd app && npm run build

# Serve the built app + API
cd server && npm install && npm start
```

Open http://localhost:8081. The Express server serves `app/dist/app/browser/` as static assets and handles `POST /upload-survey` (survey submissions) on port 8081. All SPA deep-links (e.g. `/survey`) resolve via the `*` fallback.

## Custom endpoints

The SPARQL endpoint is configurable from the **Settings** panel (click the gear icon in the toolbar). Supports Virtuoso, Fuseki, and generic SPARQL endpoints.

## Project structure

```
app/         Angular application (src/app/)
server/      Express backend (port 8081, static + POST /upload-survey)
legacy/      Original AngularJS 1.6 codebase (read-only, for reference)
migration/   Stage-by-stage migration plan and status
SPECS.md     Full feature specification
license.txt  CC-BY-NC-SA 4.0
```

## Migration

The migration from AngularJS to Angular 17+ is complete. See `migration/README.md` for the full stage plan and decisions.

## License

<a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc-sa/4.0/">Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License</a>.
