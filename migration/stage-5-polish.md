# Stage 5 — Polish: survey, modal help, tutorial, backend cleanup

## Goal

End state of this stage (= end state of the whole migration):
- The **survey** lives as a standalone Angular route `/survey`, ported from the legacy `survey.js` + `survey.pug`. The user can complete the 5-step flow (consent → demographics → 10 task entries → 2× NASA-TLX → 2× Likert) and the final submission POSTs to `/upload-survey` on the trimmed Express backend.
- The **getting-started modal** is shown via Angular CDK Dialog (or whatever modal lib the project landed on in Stage 0). Triggered by:
  - `main.modalHelp()` equivalent — a "Click here to display the getting started" link in the Help panel.
  - The "Need help?" overlay shown when the canvas is empty.
- The **interactive tutorial** is reimplemented using **Shepherd.js** (or driver.js, agent's call — pick one and document in the README). The 16 steps from the legacy IntroJS sequence are ported, with element selectors updated to point at the new components / DOM IDs (see Stage 4's "## DOM IDs" table or the rename map Stage 4 left).
- The **backend** is finalized:
  - `legacy/server.js` is moved to `server/` (or stays where it is — pick one) and trimmed to: static `app/dist/app/browser/` for production, `POST /upload-survey`, optional health check `GET /healthz`. Nothing else.
  - `legacy/package.json` reduced to express + morgan only (drop `pug`, `body-parser`, `request`).
  - Production build instructions documented in the root README.
- Static assets are reconciled: only assets actually referenced by the Angular app live in `app/src/assets/`. Anything orphaned in `legacy/public/images/` stays in `legacy/` for archival.
- The **root README** is updated with:
  - The new dev workflow (`cd app && ng serve` + `cd server && node server.js`).
  - The production build flow (`cd app && ng build` → `cd server && node server.js`).
  - A note that `legacy/` is preserved for reference and can be deleted once the user has validated the migration.
- All five tool buttons in the tools bar (describe / edit / sparql / settings / log / help) plus the "Need help?" overlay are wired correctly.

After this stage, the migration is **complete**. The user can do a side-by-side comparison vs. the legacy app and decide when to remove `legacy/`.

## Prerequisites

- Stages 0–4 complete. (Stage 5 *can* be done in parallel with stages 1–4 because the survey is a separate AngularJS module in legacy — but the modal + tutorial depend on the tool panels from Stage 4 existing.)

## Spec sections covered

- [SPECS.md §1 — Backend HTTP server](../SPECS.md#1-backend-http-server) (final form)
- [SPECS.md §15 — Help panel + modal](../SPECS.md#15-help-panel--modal--faq--example-drag-sources) (the modal portion + completing the FAQ)
- [SPECS.md §11 — Main controller — tutorial portion](../SPECS.md#11-main-controller--tool-toggle-tutorial-modal-help)
- [SPECS.md §16 — Survey](../SPECS.md#16-survey-separate-angularjs-app)

## Legacy files to consult (read-only)

| Path                                                       | What to focus on |
|------------------------------------------------------------|------------------|
| `legacy/server.js`                                         | The `POST /upload-survey` route + the routes you are dropping (`GET /survey`, `GET /modal/help`, `GET /*`). |
| `legacy/public/scripts/survey.js`                          | Whole file — port the `vm.data`, `vm.next`, `vm.upload`, `vm.subtitle` logic to an Angular standalone component using signals. |
| `legacy/public/views/survey.pug`                           | Whole file (178 lines) — the 5-step form layout. |
| `legacy/public/views/modal/help.pug`                       | The modal body content — port to a component. |
| `legacy/public/scripts/controllers/main.js`                | Lines 151–308 (`tutorial()` IntroJS sequence) + 310–317 (`modalHelp()`). Translate the 16 steps to Shepherd.js / driver.js syntax, updating element selectors. |
| `legacy/public/views/help.pug`                             | The "Click here" links (tutorial + modal) and the 4 example drag sources. |
| `legacy/public/views/index.pug`                            | The "Need help?" overlay markup + interaction. |

## Output paths

```
app/src/app/
├── pages/
│   └── survey/
│       ├── survey.component.ts            # The 5-step container
│       ├── survey.component.html
│       ├── survey.component.scss
│       ├── steps/
│       │   ├── consent.component.ts
│       │   ├── demographics.component.ts
│       │   ├── tasks.component.ts          # Task 1 of 10 ... Task 10
│       │   ├── tlx.component.ts            # NASA-TLX (×2)
│       │   └── likert.component.ts         # Likert (×2)
│       ├── survey.types.ts                 # SurveyData interface
│       ├── survey-submission.service.ts    # POST /upload-survey
│       └── *.spec.ts
├── tutorial/
│   ├── tutorial.service.ts                 # Wraps Shepherd / driver.js
│   ├── tutorial.steps.ts                   # The 16 steps as data
│   └── tutorial.service.spec.ts
├── modal/
│   ├── getting-started-dialog.component.ts
│   ├── getting-started-dialog.component.html
│   └── *.spec.ts
server/                                     # Or keep at legacy/server.js — agent's call
├── server.js                               # Trimmed (express + morgan + /upload-survey)
├── package.json                            # express + morgan only
└── survey-results/                         # Output directory
```

## Dependencies to install

In `app/`:

```
npm install shepherd.js          # or 'driver.js' — pick one and document
# Modal: use Angular CDK if not already installed
npm install @angular/cdk
```

## Detailed design notes

### Survey port

`survey.types.ts`:

```ts
export interface SurveyData {
  startUrl: 'https://explorer.csrg.cl' | 'https://query.wikidata.org';
  user: { gender: string; age: number | null; degree: string | null };
  tasks: ReadonlyArray<{ on: string | null; sparql: string | null; time: number | null }>;
  tlx:    ReadonlyArray<{ on: string | null; score: number[] /* length 6 */ }>;
  likert: ReadonlyArray<{ on: string | null; score: number[] /* length 3 */ }>;
}
```

`SurveyComponent` holds the data as a `signal<SurveyData>` and the step counter as a `signal<number>`. The state machine is the same as `legacy/public/scripts/survey.js` lines 86–144: each step's `next()` writes to the data signal and advances. **Do not** allow back navigation (legacy enforces this; preserve).

`SurveySubmissionService`:

```ts
@Injectable({ providedIn: 'root' })
export class SurveySubmissionService {
  async submit(data: SurveyData): Promise<void> {
    const res = await fetch('/upload-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Survey upload failed: ${res.status}`);
  }
  download(data: SurveyData): void { /* JSON blob + anchor click */ }
}
```

The view (`survey.component.html`) uses `@switch (step())` to render the right step component. Each step component emits an `(advance)` event that the container handles.

**Subtitle generation** — port `subtitle()` from `legacy/survey.js` lines 86–91.

**Tasks list** — port the 10 hard-coded natural-language tasks from `legacy/survey.js` lines 65–77 into a constant in `tasks.component.ts`.

**TLX dimensions and Likert prompts** — port from `legacy/survey.js` lines 50–63.

### Getting-started modal

The legacy modal body is in `legacy/public/views/modal/help.pug`. Port it directly into a `GettingStartedDialogComponent` template (Angular CDK Dialog or `@angular/material/dialog`). It's mostly static markdown-style content with image references — make sure the images are in `app/src/assets/`.

Trigger points:
1. The "Click here to display the getting started" link inside the Help panel (Stage 4 left this as a stub — wire it here).
2. The "Need help?" overlay (visible when `graph.nodes()` is empty) — clicking "getting started" opens the modal.

The overlay is in the Main view (Stage 0 placeholder may exist; if not, add it now):

```html
@if (graph.nodes().length === 0) {
  <div id="mid-help" class="overlay">
    Need help?
    <a (click)="openGettingStarted()">getting started</a> |
    <a (click)="startTutorial()">interactive tutorial</a>
  </div>
}
```

### Tutorial (replace IntroJS with Shepherd.js)

`tutorial.steps.ts` — array of 16 steps mirroring `legacy/public/scripts/controllers/main.js` lines 156–215. Each step has:
- `attachTo: { element: '#<selector>', on: 'right' | 'bottom' | ... }`
- `text` (HTML allowed, but rewrite the legacy `<b style="color: ...">` snippets to use Tailwind/utility classes or scoped CSS).
- `buttons: [{ text: 'Next', action: ... }, { text: 'Back', action: ... }]` — Shepherd handles back/next.

Critical: the legacy step 2 simulates typing "Einstein" via `$timeout` chain (lines 220–229 of main.js). Port this with Angular signals + `setTimeout` (or RxJS `timer` — your call). At each tick, push a character into the `searchPanelComponent.searchInput` signal; at the end, call the search.

Steps 4 and 8 simulate drags via CSS animations (`-webkit-animation: simulate-drag`). Port the animations (rename CSS keyframes to avoid the `-webkit-` prefix if cross-browser support matters). After the animation, programmatically create the node/property — exact same as legacy.

Step 13 toggles to the SPARQL tool — call `toolService.toggle('sparql')`.

If you settle on `driver.js` instead of Shepherd, the step shape is similar; pick one and stick with it. Document the choice in `migration/README.md`'s "Decisions taken" table.

### Backend trim

Final form of `server/server.js`:

```js
const express = require('express');
const morgan  = require('morgan');
const path    = require('path');
const fs      = require('fs');

const PORT     = process.env.PORT || 8081;
const APP_DIST = path.resolve(__dirname, '../app/dist/app/browser');
const RESULTS  = path.resolve(__dirname, './survey-results');

if (!fs.existsSync(RESULTS)) fs.mkdirSync(RESULTS, { recursive: true });

const app = express();
app.use(morgan('dev'));
app.use(express.json());                  // built-in, no body-parser
app.use(express.urlencoded({ extended: true }));
app.use(express.static(APP_DIST));

app.post('/upload-survey', (req, res) => {
  const ts = Date.now();
  req.body['user-id'] = req.ip;
  fs.writeFile(
    path.join(RESULTS, `${ts}.json`),
    JSON.stringify(req.body),
    'utf8',
    err => err ? res.sendStatus(500) : res.sendStatus(200)
  );
});

app.get('/healthz', (_req, res) => res.sendStatus(200));

// SPA fallback: any non-API GET serves index.html so client routing works.
app.get('*', (_req, res) => res.sendFile(path.join(APP_DIST, 'index.html')));

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
```

`server/package.json`:

```json
{
  "name": "rdfexplorer-server",
  "version": "2.0.0",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.19.0", "morgan": "^1.10.0" }
}
```

Drop `pug`, `body-parser`, `request` entirely.

Optional: a `migration/` note in README about migrating to Express 5 once the official release lands.

### Root README update

Replace the existing `README.md` with new content covering:
- What the app is.
- Local dev: `cd app && ng serve` (+ `cd server && npm start` in another terminal).
- Production build: `cd app && ng build && cd ../server && npm start`.
- Custom endpoints: now configurable from the Settings panel UI (re-exposed in Stage 4).
- A pointer to `migration/` and `SPECS.md`.
- The legacy CC-BY-NC-SA 4.0 license is preserved as `license.txt`.

Move the legacy README content to `legacy/README.md` for archive.

## Step-by-step plan

1. **Survey first** (independent of the rest):
   - Scaffold `app/src/app/pages/survey/` with the 5 step components.
   - Port `vm.data` to a signal.
   - Implement each step's UI matching `legacy/public/views/survey.pug` visually.
   - Implement `SurveySubmissionService` with `fetch` to `/upload-survey`.
   - Verify in browser: complete the flow end-to-end, confirm the server writes a JSON file to `server/survey-results/`.

2. **Backend trim**:
   - Create `server/` directory; move and trim `legacy/server.js` to `server/server.js` as shown above.
   - Move `legacy/survey-results/` to `server/survey-results/` (`git mv`).
   - Update `server/package.json`.
   - Verify: `cd server && npm install && npm start` → port 8081 → `curl http://localhost:8081/healthz` returns 200.
   - Update `app/proxy.conf.json` if needed (Stage 0 already configured it).

3. **Modal**:
   - Install `@angular/cdk` if not already present.
   - Create `GettingStartedDialogComponent` with the content from `legacy/public/views/modal/help.pug`.
   - Wire the help-panel link + the "Need help?" overlay.
   - Verify: modal opens, displays content, closes via Esc + backdrop click.

4. **Need-help overlay**:
   - Add to `MainComponent`'s template behind `@if (graph.nodes().length === 0)`.
   - Match the legacy positioning (centered in canvas).

5. **Tutorial**:
   - Install `shepherd.js`.
   - Create `TutorialService` + `tutorial.steps.ts`.
   - Port each of the 16 steps. Pay attention to:
     - Selectors (use DOM IDs from Stage 4's table or rename map).
     - The typing simulation in step 2.
     - The drag animations in steps 4 and 8.
     - The `toolService.toggle('sparql')` in step 13.
   - Wire the "Click here to run the interactive tutorial" link in the help panel.
   - Verify: tutorial runs end-to-end without errors. Simulated typing/drag animations look reasonable.

6. **Final wiring + README**:
   - Update `README.md` (root) with the new dev/build flow.
   - Move legacy README content to `legacy/README.md`.
   - Update `migration/README.md` status table — all 6 stages done.

7. **Production build smoke test**:
   - `cd app && ng build`.
   - `cd server && npm install && npm start`.
   - Visit http://localhost:8081, confirm the SPA loads (not via `ng serve`), confirm `/upload-survey` accepts a POST.

8. **(Optional) Comparison vs legacy**:
   - Walk through the canned examples (cats / w3c / mosquito / cancer) and confirm the generated SPARQL matches the legacy live demo at https://rdfexplorer.org for each.
   - Report any visual or behavioral differences to the user for sign-off.

## What NOT to do

- Do **not** delete anything in `legacy/`. The user decides when to remove it.
- Do **not** add new survey questions or change the tasks list. The 10 tasks + 6 TLX dimensions + 3 Likert items are fixed (a published user study used them).
- Do **not** change the wire format of `POST /upload-survey`. Existing data in `server/survey-results/` matches the current shape; breaking it makes old data unreadable.
- Do **not** rebuild the modal from a third-party UI library if the project already settled on Angular CDK in Stage 0 — be consistent.
- Do **not** introduce SSR / Angular Universal in this stage. The app is a SPA; SSR is a separate decision.
- Do **not** add analytics, telemetry, or Sentry. Not in scope.
- Do **not** delete `license.txt`. CC-BY-NC-SA 4.0 must remain visible.

## Acceptance criteria

- [ ] `/survey` route renders the consent step. Walking through every step finishes with a successful POST to `/upload-survey` and a new file in `server/survey-results/`.
- [ ] The "Need help?" overlay appears when the canvas is empty and disappears when a node exists.
- [ ] Clicking "getting started" (in the overlay or the help panel) opens the modal with the legacy content rendered correctly (images included).
- [ ] Clicking "interactive tutorial" starts Shepherd.js. The 16 steps run in order. Step 2's typing animation works. Steps 4 and 8's drag animations work. Step 13 switches to the SPARQL tool.
- [ ] `server/server.js` runs on port 8081 and serves `app/dist/app/browser/` correctly. SPA deep links (e.g. `/survey`) resolve via the `app.get('*')` fallback.
- [ ] `server/package.json` lists only `express` and `morgan` as dependencies. `pug`, `body-parser`, `request` are gone.
- [ ] Root `README.md` documents the new dev + build workflow.
- [ ] `migration/README.md` status table shows all 6 stages complete.
- [ ] `ng build` clean. `ng test` all green.
- [ ] License (`license.txt`) is present at repo root.

---

## Hand-off prompt for the agent

```
=====================================================================
Project: RDFExplorer — migrating to Angular 17+ standalone + cytoscape.js.
We are at Stage 5 of 6 (final stage). Stages 0–4 are done:
  - Angular 17 shell in app/
  - Core services + domain + canvas + all 7 tool panels working
  - End-to-end flow (search → drag → describe → edit → sparql) confirmed
Legacy is read-only under legacy/.

Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-5-polish.md  ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md sections 1, 11, 15, 16
  4. /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/survey.js
  5. /home/mmventurino/Documents/RDFExplorer/legacy/public/views/survey.pug
  6. /home/mmventurino/Documents/RDFExplorer/legacy/public/views/modal/help.pug
  7. /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/controllers/main.js
     (lines 151–317 — tutorial + modal)
  8. /home/mmventurino/Documents/RDFExplorer/legacy/server.js

Your goal is in stage-5-polish.md under "## Goal". This is the LAST
stage of the migration. After this the user has a side-by-side
comparison against the legacy app and decides when to delete legacy/.

Follow the "## Step-by-step plan" in order. The "## Acceptance criteria"
is what proves done.

Hard constraints (also in migration/README.md):
- legacy/ is READ-ONLY (you may MOVE legacy/server.js to server/server.js
  and trim it; that counts as the final disposition, not a modification).
- Angular 17 standalone components + signals.
- Do not delete legacy/. The user decides.
- Do not change the wire format of POST /upload-survey — existing survey
  data must remain readable.
- Do not introduce SSR, analytics, or any features beyond the spec.
- Preserve license.txt.

Survey: port the AngularJS 'survey' module to /survey route. 5 steps,
no back button (legacy enforces this — preserve). State as signals.
fetch() to POST /upload-survey.

Backend: trim to express + morgan only. Drop pug, body-parser, request.
Add SPA fallback so /survey deep-links via Angular routing.

Modal: Angular CDK Dialog (or whatever Stage 0 chose). Port the modal
body from legacy/public/views/modal/help.pug.

Tutorial: Shepherd.js (or driver.js — pick one and document in
migration/README.md "Decisions taken" table). Port the 16 IntroJS
steps. Selectors must match the DOM IDs from Stage 4's "## DOM IDs"
table (or the rename map Stage 4 left).

Critical animations to preserve from the legacy tutorial:
- Step 2: simulated typing of "Einstein" via timed setTimeout chain.
- Step 4: simulated drag from search result onto canvas + node creation.
- Step 8: simulated drag of a property + node creation + edge.
- Step 13: toolService.toggle('sparql').

Verification (mandatory):
- Run `cd app && ng build` (PROD build, not just serve).
- Run `cd server && npm install && npm start`.
- Visit http://localhost:8081 — confirm SPA loads.
- Complete the full survey flow and confirm a new JSON file in server/survey-results/.
- Start the tutorial and walk through all 16 steps.
- Open the getting-started modal from both the overlay and the help panel.

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface it.

Do not commit. When done, report:
  - The file tree of app/src/app/pages/survey/, app/src/app/tutorial/,
    app/src/app/modal/, and server/.
  - The trimmed server/package.json content.
  - End-to-end results: survey submitted ✓ / tutorial completed ✓ / modal opens ✓.
  - The decision you took for Shepherd vs driver.js (now documented in migration/README.md).
  - A short summary of any behavioral differences between the new app
    and the legacy at https://rdfexplorer.org that you noticed during testing.
=====================================================================
```
