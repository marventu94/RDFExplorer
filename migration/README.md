# RDFExplorer — Migration to Angular 17+

This directory is the staged plan to migrate the legacy AngularJS 1.6 / Express / D3 v3 codebase to **Angular 17+ standalone + cytoscape.js**.

Read [`../SPECS.md`](../SPECS.md) first for the full feature inventory. Each stage doc below picks specific sections out of `SPECS.md`, scopes them, and ends with a **copy-paste prompt** for the agent that will do the work.

---

## Decisions taken (apply to every stage)

| Topic            | Decision |
|------------------|----------|
| Target framework | Angular 17+ standalone components, signals, new control flow (`@if`/`@for`/`@switch`). Bootstrap actually installed Angular 21 (current at the time) — fine, all signal/standalone features apply. |
| Repo layout      | Legacy moved to `legacy/` (read-only). New app under `app/`. |
| Package manager  | **pnpm** (not npm). `app/.npmrc` has `package-manager-strict=false` and `app/package.json` lists the approved postinstall scripts in `pnpm.onlyBuiltDependencies`. Agents in subsequent stages must use `pnpm install` / `pnpm exec ng …` — never `npm install`. |
| Graph lib        | cytoscape.js (replaces D3 v3 SVG canvas). Plugins: `cytoscape-context-menus`, `cytoscape-edgehandles`. |
| Editor           | CodeMirror 6 (replaces CodeMirror 5). SPARQL syntax via `codemirror-lang-sparql` or equivalent. |
| Backend          | Express kept minimal (static `app/dist/` + `POST /upload-survey`). Everything else moves to the SPA. |
| HTTP             | Native `fetch` + `AbortController`. No `$http`/`$q`. |
| State management | Angular signals. **Do not** add NgRx, RxJS `BehaviorSubject`, or services-as-state. |
| Modal/UI         | Angular CDK + Angular Material *or* PrimeNG — agent decides, **be consistent across stages**. |
| Styling          | SCSS modules / component-scoped styles. Keep the legacy color palette (see SPECS section 7). |

---

## Stage dependency graph

```
Stage 0 (bootstrap) ─┬─► Stage 1 (services)  ─┬─► Stage 2 (property graph) ──► Stage 3 (canvas) ──┐
                     │                        │                                                    ├─► Stage 4 (tools)
                     └────────────────────────┴────────────────────────────────────────────────────┘
                     │
                     └─► Stage 5 (polish: survey, help, tutorial)  ← depends on Stage 0 only
```

Stage 5 (polish) can technically be done in parallel with stages 1–4 because the survey is a separate AngularJS module already.

---

## Stage index

| #  | Stage                                  | File                                                       | Spec sections    | Status |
|----|----------------------------------------|------------------------------------------------------------|------------------|--------|
| 0  | Bootstrap Angular + layout shell       | [`stage-0-bootstrap.md`](stage-0-bootstrap.md)             | 1, 2, 11, 17     | ☐      |
| 1  | Core services (settings/req/query/log) | [`stage-1-services.md`](stage-1-services.md)               | 3, 4, 5, 6       | ☐      |
| 2  | Property graph domain model            | [`stage-2-property-graph.md`](stage-2-property-graph.md)   | 7                | ☐      |
| 3  | Visual canvas (cytoscape.js)           | [`stage-3-canvas.md`](stage-3-canvas.md)                   | 8, 17 (partial)  | ☐      |
| 4  | Tools panel (search/describe/edit/sparql/settings/help/log) | [`stage-4-tools.md`](stage-4-tools.md) | 9, 10, 11, 12, 13, 14, 3 (UI), 6 (UI), 15 (panel) | ☐ |
| 5  | Polish: survey, modal help, tutorial   | [`stage-5-polish.md`](stage-5-polish.md)                   | 1 (final), 15 (modal), 16 | ☐ |

Update the **Status** column as stages complete.

---

## How to delegate a stage

1. Open the stage's `.md` file.
2. Read it yourself end-to-end (10 minutes) — these prompts are detailed and you want to know what you're authorizing.
3. Copy the block under **"## Hand-off prompt for the agent"** into a fresh agent session (e.g., a new Claude Code conversation).
4. When the agent reports done, verify against the **"## Acceptance criteria"** section before marking the stage complete.
5. If the agent gets stuck or asks questions, answer using `SPECS.md` + the linked legacy files as the source of truth.

**Important:** do not ask one agent to do two stages. Each stage is sized to fit a coherent agent session.

---

## Conventions all agents must follow

These are repeated in every stage's hand-off prompt for safety, but they're the project-wide rules:

1. **Legacy is read-only.** Files under `legacy/` are reference material. Never modify them. Never delete them until the user confirms the migration is fully validated.
2. **No NgModules.** Angular 17 standalone components only.
3. **No `String.prototype` extensions.** The legacy code monkey-patches `String.prototype.getLabel/toPrefix/copyToClipboard/describe`. Cross-cutting concern #1 in SPECS.md. Replace with standalone helper functions.
4. **State via signals.** `signal()`, `computed()`, `effect()`. No `BehaviorSubject` for app state. Streams (`Observable`) are fine for one-shot async like `fetch` wrappers, but the state stores hold signals.
5. **`inject()` over constructor DI** where it makes the code cleaner. Both are valid Angular 17; prefer `inject()` in standalone components / functional guards / route resolvers.
6. **New control flow** in templates: `@if`, `@for`, `@switch`. Not `*ngIf`, not `*ngFor`.
7. **TypeScript strict mode on** in `tsconfig.json` (`strict: true`, `noImplicitAny`, `strictNullChecks`). Don't disable to silence errors.
8. **Code is the source of truth, not SPECS.md.** If the spec contradicts the legacy code, the legacy code wins. Surface contradictions back to the user — don't silently choose.
9. **Verify by running the app**, not by `ng build` alone. UI changes need a browser check.
10. **No commits unless the user asks.** When done, leave changes uncommitted so the user can review.

---

## Glossary (shared across stages)

- **Resource** — generic name for a node-or-property-or-literal on the canvas (legacy: `RDFResource` base class).
- **Node** — a graph node corresponding to a SPARQL variable or a set of constant URIs (subject/object in SPARQL terms).
- **Property** — an outgoing predicate from a Node. Drawn as a child rectangle inside the Node visually.
- **Literal** — a literal-mode Property; its value space is RDF literals, not IRIs.
- **Variable** — the SPARQL `?foo`-style binding owned by a Resource (alias + filter list + cached results).
- **Filter** — a SPARQL filter (`FILTER`, `bif:contains`, etc.) attached to a Variable.
- **Edge** — connects a Property (source) to a Node (target) — never node-to-node directly.
- **Endpoint adapter** — the strategy that varies SPARQL by `settings.endpoint.type` (`virtuoso` → `bif:contains`; `fuseki` → `text:query`; other → `FILTER regex`).
- **Wikidata-specific** — code paths that assume Wikidata's `wikibase:directClaim` model. Must be behind an adapter (Wikidata-only on master, DBpedia variant on the dbpedia branch).
- **dataTransfer protocol** — drag payload keys (`uri / prop / special / alias / type`) that the legacy `propertyGraphService.onDrop` reads. Drag sources (search/describe/help) write these; the canvas reads them. See SPECS cross-cutting #2.
