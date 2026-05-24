# Stage 0 — Bootstrap Angular 17 + layout shell

## Goal

End state of this stage:
- The current source has been moved into a read-only `legacy/` directory (preserving git history via `git mv`).
- A fresh Angular 17+ standalone project lives in `app/`.
- `ng serve` from `app/` boots a 3-pane shell that visually matches the legacy layout (top-left search box, center canvas placeholder, top-right tool toggle buttons opening a right side panel).
- Tool toggle buttons exist (`describe`, `edit`, `sparql`, `settings`, `log`, `help`) and switching them shows an empty placeholder panel labeled with the tool name. **No tool logic yet — just the chrome.**
- A minimal Express server in `legacy/server.js` is trimmed to serve `app/dist/` + handle `POST /upload-survey`. Dev workflow uses `ng serve` proxy to it.

After this stage the user sees an Angular shell that *looks* right but does nothing useful yet. Stages 1–5 fill it in.

## Prerequisites

None.

## Spec sections covered

- [SPECS.md §1 — Backend HTTP server](../SPECS.md#1-backend-http-server) (partial — keep `/upload-survey` + static)
- [SPECS.md §2 — App bootstrap & module wiring](../SPECS.md#2-app-bootstrap--module-wiring) (replace entirely)
- [SPECS.md §11 — Main controller / tools panel](../SPECS.md#11-main-controller--tool-toggle-tutorial-modal-help) (just the toggle skeleton — tutorial/modal come in stage 5)
- [SPECS.md §17 — Styles](../SPECS.md#17-styles) (set up SCSS pipeline; full restyle is incremental)

## Legacy files to consult (read-only)

| Path                                        | Why                                                                 |
|---------------------------------------------|---------------------------------------------------------------------|
| `legacy/server.js`                          | Routes to preserve (`/upload-survey`, `/modal/help`), port, body parsers. |
| `legacy/package.json`                       | Current deps — figure out what stays in the new backend.            |
| `legacy/public/views/layout.pug`            | CDN deps list, script load order, root markup, `ng-app` placement.  |
| `legacy/public/views/index.pug`             | The shell structure: search panel + tools + canvas, plus the "Need help?" overlay when graph is empty. |
| `legacy/public/views/tools.pug`             | Tool toggle button bar + right panel inclusion order. **Note: settings + log buttons are commented out in legacy — leave them out of the new UI for now.** |
| `legacy/public/styles/style.css`            | Global layout (grid / pane positions), color palette, utility classes. Skim — re-implementing fully later. |
| `legacy/public/styles/graph.css`            | Canvas-specific styles (don't copy verbatim — cytoscape styling is done in stage 3). |

## Output paths (new code)

```
app/                                  # Angular 17 project root
├── angular.json
├── package.json
├── tsconfig.json                     # strict: true
├── src/
│   ├── main.ts                       # bootstrapApplication(AppComponent, appConfig)
│   ├── app/
│   │   ├── app.component.ts          # Root layout
│   │   ├── app.component.html        # 3-pane grid
│   │   ├── app.component.scss
│   │   ├── app.config.ts             # provideRouter, etc.
│   │   ├── app.routes.ts             # '/' → MainView, '/survey' → SurveyPlaceholder
│   │   ├── shell/
│   │   │   ├── search-panel/         # Empty placeholder component
│   │   │   ├── canvas-panel/         # Empty placeholder component
│   │   │   └── tools-panel/          # Tool buttons + right slot
│   │   ├── tool/
│   │   │   └── tool.service.ts       # signal<ToolName | 'none'> + toggle()
│   │   └── pages/
│   │       ├── main/main.component.ts          # Composes search + canvas + tools
│   │       └── survey/survey-placeholder.ts    # Just a "coming soon" stub for now
│   ├── assets/
│   │   └── images/                   # Copy from legacy/public/images/
│   └── styles.scss                   # Global resets + color tokens
└── proxy.conf.json                   # Proxy /upload-survey → http://localhost:8081

legacy/                               # Read-only mirror of current code
├── server.js
├── package.json
├── public/
│   └── ...
└── survey-results/                   # Or leave at repo root
```

The trimmed backend (decide with user later) stays at `legacy/server.js` for now, on port 8081 during dev.

## Step-by-step plan

1. **Move legacy.** Use `git mv` to move `server.js`, `package.json`, `package-lock.json` (if present), `public/`, `survey-results/`, and `license.txt` into `legacy/`. Keep `README.md`, `SPECS.md`, `migration/`, `.gitignore` at the repo root. Verify with `git status` that everything shows as renames, not delete+add (so history is preserved).

2. **Update root `.gitignore`** to add `app/node_modules/`, `app/dist/`, `app/.angular/`.

3. **Create Angular project.** From the repo root: `npx -p @angular/cli@latest ng new app --standalone --routing --style=scss --skip-git --strict`. Confirm Angular 17+ in `app/package.json`.

4. **Enable strict TS.** Verify `app/tsconfig.json` has `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, and `"strictTemplates": true` in `angularCompilerOptions`.

5. **Set up the routing skeleton** in `app/src/app/app.routes.ts`:
   - `''` → `MainComponent` (search + canvas + tools)
   - `'survey'` → `SurveyPlaceholderComponent`
   - wildcard → redirect to `''`

6. **Build the shell layout.** `MainComponent` template uses CSS Grid with three areas: `search` (top-left, ~300px wide), `tools` (right side, ~400px wide, collapsible), `canvas` (fills the rest). Match the spacing roughly — pixel-perfect is for later. Reference: `legacy/public/views/index.pug` + `legacy/public/styles/style.css`.

7. **Implement `ToolService`** (`app/src/app/tool/tool.service.ts`):
   ```ts
   export type ToolName = 'describe' | 'edit' | 'sparql' | 'settings' | 'log' | 'help';
   // signal<ToolName | 'none'>; toggle(name) flips between name and 'none'.
   ```
   Inject it into `MainComponent` and the tool buttons.

8. **Placeholder tool panels.** In `tools-panel/`, render the button bar at the top + a slot below that shows a placeholder div like `<div>Tool: describe (not implemented)</div>` based on `ToolService`'s current value. Stage 4 will replace these with real components.

9. **Copy static assets.** Copy `legacy/public/images/` into `app/src/assets/images/`. Reference them from the eventual help panel via `assets/images/00.gif` etc.

10. **Trim `legacy/server.js`.** Reduce it to:
    - serve `app/dist/app/browser/` (Angular 17 default output path) at `/` for production.
    - keep `POST /upload-survey` exactly as-is.
    - drop `GET /modal/help` (modal content moves to the SPA in stage 5).
    - drop the catch-all that renders `index.pug`.
    - port = `process.env.PORT || 8081`.
    Update `legacy/package.json` to remove `pug` and `body-parser` (Express 4 has built-in JSON parsing). Keep `express` and `morgan`.
    **Don't delete legacy yet** — leave `server.js` running as the dev backend.

11. **Configure dev proxy.** `app/proxy.conf.json`:
    ```json
    { "/upload-survey": { "target": "http://localhost:8081", "secure": false } }
    ```
    Wire it into `angular.json` (`projects.app.architect.serve.options.proxyConfig`). Now `ng serve` (port 4200) proxies survey submissions to the legacy server (port 8081).

12. **Verify.** Run:
    - From `legacy/`: `npm install && node server.js` (background, port 8081).
    - From `app/`: `npm install && ng serve`.
    - Open `http://localhost:4200`. Confirm shell renders, tool buttons toggle the right panel, no console errors.
    - Run `ng build` and confirm clean output in `app/dist/`.

## What NOT to do

- Do **not** port `legacy/public/scripts/*.js` content yet. Subsequent stages do that — putting half-ported logic into Stage 0 muddies the contract.
- Do **not** install cytoscape, CodeMirror, or any tool library — those come in their respective stages.
- Do **not** add a UI library (Angular Material / PrimeNG) without first writing it as a decision in the README's "Decisions taken" table. If you add one, update the README.
- Do **not** add NgModules. Standalone components only.
- Do **not** monkey-patch `String.prototype`. Cross-cutting concern #1.
- Do **not** modify anything inside `legacy/` after the move except for `legacy/server.js` (trim only — don't add features) and `legacy/package.json` (dep cleanup only).
- Do **not** delete `legacy/public/scripts/survey.js` or `legacy/public/views/survey.pug`. Survey migration is stage 5.

## Acceptance criteria

Each item must be visibly true:

- [ ] `git log --follow legacy/server.js` shows the same commits as the original `server.js` (rename preserved history).
- [ ] `app/` builds clean: `cd app && ng build` exits 0 with no warnings about NgModule or `*ngIf`.
- [ ] `app/` serves clean: `cd app && ng serve` starts on port 4200 with zero console errors.
- [ ] Visiting `http://localhost:4200/` shows a 3-pane layout that visually echoes the legacy site (search box top-left, canvas area center, tool button strip top-right, right panel collapsible).
- [ ] Clicking each of the 6 tool buttons toggles a labeled placeholder panel on the right (`describe`, `edit`, `sparql`, `settings`, `log`, `help`). Clicking the same tool again closes it.
- [ ] `http://localhost:4200/survey` renders the survey placeholder.
- [ ] The legacy backend on port 8081 still responds to `POST /upload-survey` (test with `curl -X POST -H 'Content-Type: application/json' -d '{"test":1}' http://localhost:8081/upload-survey`; expect 200; new file in `legacy/survey-results/` or wherever you re-pointed it).
- [ ] `ng serve` proxies `POST /upload-survey` to the legacy backend successfully.
- [ ] `app/tsconfig.json` has strict mode enabled.

---

## Hand-off prompt for the agent

Copy everything between the `=====` markers into the new agent session.

```
=====================================================================
Project: RDFExplorer — migrating from AngularJS 1.6 / Express / D3 v3
to Angular 17+ standalone + cytoscape.js. We are at Stage 0 of 6.

You are bootstrapping. Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-0-bootstrap.md  ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md sections 1, 2, 11, 17
     (skim — the stage doc tells you which fields/routes you need)

Your goal is in stage-0-bootstrap.md under "## Goal". Follow the
"## Step-by-step plan" in order. The "## Acceptance criteria" is what
proves you're done — verify every checkbox before declaring success.

Hard constraints (also listed in migration/README.md "Conventions"):
- Legacy code goes to legacy/ via `git mv` (preserve git history).
  Once moved, legacy/ is READ-ONLY. The only legacy files you may
  modify in this stage are legacy/server.js (trim only) and
  legacy/package.json (dep cleanup only).
- Angular 17+ standalone components only. No NgModules.
- Signals for state. No BehaviorSubject for app state.
- New control flow in templates: @if, @for, @switch. Not *ngIf/*ngFor.
- TypeScript strict mode on. Do not disable strictness to silence errors.
- No String.prototype extensions (legacy code monkey-patches String —
  do NOT copy that pattern; SPECS Cross-cutting concern #1).
- Do not install cytoscape, CodeMirror, IntroJS, or any tool library yet.
  Those come in later stages.
- Do not port the content of any script in legacy/public/scripts/ yet.
  Stage 0 is chrome only — empty placeholders for every tool panel.

Verification:
- Do not declare done based on `ng build` passing. You MUST run `ng serve`
  AND open the page in a browser AND click every tool toggle button to
  confirm placeholder panels appear/disappear correctly.
- If you cannot launch a browser, say so explicitly and ask the user to verify.

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface the contradiction to the user — do not silently
pick one.

Do not commit anything. When done, leave changes uncommitted for review
and report:
  - The final tree (output of `ls app/` and `ls legacy/`).
  - The git status (so the user can see the renames).
  - Which acceptance checkboxes you verified and how.
=====================================================================
```
