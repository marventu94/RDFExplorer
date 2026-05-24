# RDFExplorer — Functional Specifications

Specs of every feature in the current (legacy AngularJS 1.6 / Express / D3 v3) codebase, partitioned so each section can be handed to an independent modernization agent.

Each section follows the same template:
- **Purpose** — what the feature does for the user.
- **Source files** — exact paths of the current implementation.
- **External deps** — third‑party libs loaded for this feature.
- **Public API / contract** — what other modules call, what events / DOM hooks it exposes.
- **Current behavior** — implementation notes that must be preserved.
- **Known issues / TODOs in current code** — what's already broken or hacky.
- **Modernization notes** — suggested target stack / pitfalls.

---

## 0. Module dependency map (current state)

```
server.js ── Express ──┬─ GET /            → views/index.pug      (SPA shell)
                       ├─ GET /survey      → views/survey.pug
                       ├─ GET /modal/help  → views/modal/help.pug (ng-bootstrap modal body)
                       └─ POST /upload-survey  → fs.writeFile survey-results/<ts>.json

Browser SPA (AngularJS 1.6 module "rdfvis"):
  app.js (module wiring)
   ├─ services
   │   ├─ settingsService     ← settings.js
   │   ├─ requestService      ← request.js          (depends on settingsService)
   │   ├─ queryService        ← query.js           (depends on settingsService)
   │   ├─ logService          ← logs.js
   │   └─ propertyGraphService← property-graph.js  (depends on requestService, logService, settingsService)
   ├─ controllers
   │   ├─ MainCtrl         ← controllers/main.js     (search, tutorial, modal, drag sources)
   │   ├─ DescribeCtrl     ← controllers/describe.js
   │   ├─ EditCtrl         ← controllers/edit.js
   │   ├─ SparqlCtrl       ← controllers/sparql.js
   │   └─ SettingsCtrl     ← controllers/settings.js
   └─ directives
       ├─ visualQueryBuilder ← directives/visual-query-builder.js (D3 v3 SVG canvas)
       └─ sparqlEdit         ← directives/sparql-edit.js          (CodeMirror)

Standalone survey SPA (AngularJS module "survey"):
  scripts/survey.js + views/survey.pug
```

External CDNs loaded by `layout.pug` (must be kept compatible during incremental modernization):
- AngularJS 1.6.9, angular-animate, angular-loading-bar 0.9.0, angular-ui-bootstrap 2.5.0
- D3 v3.x (note: v3, **not** v4+ — API is incompatible with newer D3)
- IntroJS 2.9.3, CodeMirror 5.39.2 + sparql mode
- Bootstrap 4.1.3 + Popper + jQuery 3.3.1 (slim) + Font Awesome 4.7.0

---

## 1. Backend HTTP server

**Purpose.** Serve static assets, render Pug views, accept survey submissions.

**Source files.** `server.js`, `views/*.pug`, `survey-results/` (output dir).

**External deps.** `express ^4.13`, `body-parser ^1.4`, `morgan >=1.9.1`, `pug ^2.0.0-beta6`. `request ^2.85` is declared in `package.json` but **not used** in `server.js` — it can be removed.

**Public API / contract.**
- `GET /survey` → renders `views/survey.pug`.
- `GET /modal/help` → renders `views/modal/help.pug` (loaded by `$uibModal` from the SPA).
- `GET /*` (catch-all) → renders `views/index.pug` (so client routing/hash works).
- `POST /upload-survey` → body JSON-or-form, augmented with `user-id = req.ip`, persisted as `survey-results/<Date.now()>.json`. Always responds `200` after the file write callback fires.
- Static `/scripts/...`, `/styles/...`, `/images/...`, `/views/...` served from `public/` via `express.static`.
- Listens on hard-coded port `8080`.

**Current behavior.**
- `app.locals.pretty = true` (HTML pretty-printed; comment in code says "TODO check in all brow").
- Logs every request via `morgan('dev')`.
- Three `bodyParser` middlewares: urlencoded, json, and `application/vnd.api+json`.

**Known issues / TODOs.**
- Hard-coded port (no `process.env.PORT`).
- No content validation / size limits on `/upload-survey`. Stores `req.ip` as user identifier (potentially PII).
- `survey-results/` is committed to the repo with a `readme` file.

**Modernization notes.**
- Target: Express 4 → Express 5 or Fastify; or fold this into the new frontend's framework (e.g., Vite + a tiny API route).
- If client becomes a full SPA (Vue/React/Svelte), the catch-all `GET /*` must keep returning the SPA shell for deep links.
- `pug` is only used for the SPA shell + a single modal body + the survey page. If templates become JSX/Vue/etc., the modal body served at `/modal/help` either needs to live inside the SPA bundle or be served as static HTML.

---

## 2. App bootstrap & module wiring

**Purpose.** Define the three AngularJS sub-modules (`rdfvis.services`, `rdfvis.controllers`, `rdfvis.directives`) and the umbrella `rdfvis` module, plus disable the loading-bar spinner.

**Source files.** `public/scripts/app.js`, `public/views/layout.pug`.

**Public API.** Just module registration. `layout.pug` is the SPA shell; it loads all CDN deps then every local script in fixed order.

**Modernization notes.**
- This is the entry point for any framework swap. The natural unit-of-replacement is the umbrella module → a new app bootstrap (`main.ts` / `app.tsx`).
- `cfpLoadingBarProvider.includeSpinner = false` is the only configuration — replace with whatever loading indicator the new framework uses (or none).

---

## 3. Settings service & settings panel

**Purpose.** Holds the SPARQL endpoint URL/type, default search class, language, result limit, RDF prefix table, and "describe" categorization config. Exposes a settings UI panel.

**Source files.** `public/scripts/services/settings.js`, `public/scripts/controllers/settings.js`, `public/views/settings.pug`.

**Public API.**
- Factory `settingsService` returns a mutable object with:
  - `lang` (`'en'`), `labelUri` (rdfs:label URI), `endpoint {url, type, label}` where `type ∈ {'', 'virtuoso', 'fuseki', 'other'}`,
  - `searchClass {uri, label}`, `resultLimit` (default 20),
  - `prefixes` (array of `{prefix, uri}` — 31 entries covering wd*, dbo*, rdfs, owl, schema, foaf, etc.),
  - `describe { exclude, objects, datatype, text, image, external }` — URI allow/deny lists used by the Describe controller,
  - `default` — shallow clone of the initial settings, used by "Default" button. **Note:** `default` is captured by `Object.assign({}, settings)` before `prefixes`/`describe` are attached, so resetting via `setDefault()` does **not** reset prefixes/describe (that's the current — and probably intentional — behavior).
- `SettingsCtrl` exposes `getClasses(label)` (typeahead via SPARQL `?uri a owl:Class . ?uri rdfs:label`), `save()`, `cancel()` (re-reads), `default()` (restores), and broadcasts `$emit('newSettings', 1)` on save (consumed by `MainCtrl` to clear `lastSearch`).

**Current behavior.**
- Master branch ships with Wikidata endpoint; DBpedia branch ships with the DBpedia endpoint. Endpoint `type` switches the SPARQL templating in `query.js` and the filter templating in `property-graph.js` (virtuoso = `bif:contains`, fuseki = `text:query`, other = `FILTER regex`).
- The settings panel is **hidden in the UI** — the toggle button in `tools.pug` (`ng-click="main.toolToggle('settings')"`) is commented out (`//button…`). The route still works if `main.tool` is set to `'settings'` programmatically.

**Known issues / TODOs.**
- Endpoint URL is not validated.
- Hidden settings panel = users can't change endpoint at runtime through UI.
- `searchClass` is only used by `query.search()` when no `type` arg is passed; in practice `MainCtrl.search` bypasses this and hits the Wikidata `wbsearchentities` REST API directly.

**Modernization notes.**
- Move from mutable shared service to a typed store (Pinia / Redux / Zustand / Svelte stores).
- Persist to localStorage so endpoint choice survives reload.
- Re-expose the settings toggle in the UI.
- Endpoint `type` enum should be modeled explicitly; the string compare appears in 3 places (query.js, property-graph.js Filter.apply for `'text'`, request.js implicit).

---

## 4. SPARQL query templates (queryService)

**Purpose.** Build SPARQL strings for fixed query patterns used by Describe / Settings / search.

**Source files.** `public/scripts/services/query.js`.

**Public API.**
- `search(keyword, type?, limit?, offset?)` → string. Selects `?uri ?label ?type ?tlabel` for an `rdfs:label` match, dispatching per `settings.endpoint.type`:
  - `virtuoso` → `?label bif:contains "'<kw>'"`
  - `fuseki`  → `?uri text:query (rdfs:label "<kw>" <limit>)`
  - other     → `FILTER regex(?label, "<kw>", "i")`
- `getClasses(uri, limit?, offset?)` → string. `SELECT ?uri ?label WHERE { <uri> a ?uri . ?uri rdfs:label ?label FILTER lang(?label)="en" }`.
- `getProperties(uri)` → string, Wikidata-specific (relies on `wikibase:directClaim`); for each `?property` of `<uri>` returns `?propertyLabel` and a `?kind` ∈ {0,1,2} (unknown / ObjectProperty / DatatypeProperty).
- `countValuesType(uri, prop)` → string. `SELECT (sum(?u) AS ?uris)(sum(?l) AS ?lits)` deciding whether values of `?o` are IRIs vs literals — used by Describe when `?kind = 0`.
- `getPropUri(uri, prop)` → string. Plain `SELECT ?uri` of `<uri> <prop> ?uri`.
- `getPropObject(uri, prop)` → string. As above, with optional `rdfs:label`.
- `getPropDatatype(uri, prop)` → string. `SELECT ?lit WHERE { <uri> <prop> ?lit . FILTER (lang(?lit)="" || lang(?lit)="en") }`.

**Known issues / TODOs.**
- Comment in code: `/* TODO: fix language filter and exact match for bif*/`.
- No escaping of user-controlled `keyword` — risk of SPARQL injection if a less trusted UI ever calls `search` directly.
- `header(prefixes)` is exported only implicitly (used internally) and only knows 4 prefixes; everywhere else queries are built with inline `PREFIX` strings.

**Modernization notes.**
- Replace string concatenation with a query builder (sparql-builder, RDF/JS Algebra, Comunica, sparqljs). At minimum, parameterize and escape inputs.
- `getProperties` is Wikidata-specific. Consider per-endpoint adapters (Strategy pattern keyed off `settings.endpoint.type`).
- This file should not need the `settingsService` (only uses `endpoint.type`, `searchClass.uri.value`, `resultLimit`) — easy to extract.

---

## 5. HTTP/SPARQL request layer (requestService)

**Purpose.** Wrap `$http` for SPARQL endpoint calls, throttle concurrent requests, and maintain an in-memory URI→label cache. Also installs three `String.prototype` extensions used everywhere.

**Source files.** `public/scripts/services/request.js`.

**Public API.**
- `execQuery(query, config?)` → `$q` promise.
  - `config.callback(data)` — success handler (passed `response.data`).
  - `config.cErr(response)` — error handler.
  - `config.canceller` — a `$q` deferred's `.promise`, wired to `$http`'s `timeout` so calls can be aborted.
  - Request format: `POST <endpoint.url>?origin=*` with query params `{format: 'json', query}`.
- `getLabel(uri)` / `setLabel(uri, label)` — direct accessors to the label cache.
- **Side effects on `String.prototype`** — these are relied on by views and other modules:
  - `String.prototype.getLabel()` → cached label OR a prefixed CURIE (`wd:Q146`) OR the original URI. Falls through `settings.prefixes` to compute the CURIE.
  - `String.prototype.toPrefix()` → `[curie, prefixObj]` if any prefix matched, else `['<uri>', null]`.
  - `String.prototype.copyToClipboard()` → DOM hack with a hidden textarea + `document.execCommand('copy')`.

**Current behavior.**
- 100ms staggered scheduling via `$timeout` based on `running` counter — soft throttle, not a real queue.
- `onSuccess` auto-correlates `?foo` and `?fooLabel` columns in SPARQL responses and seeds the label cache from `?fooLabel` literals.
- Hardcoded seed labels for Wikidata items used in the canned examples (P31, Q146, etc.) — see top of file.

**Known issues / TODOs.**
- `console.log('Error:', response)` on every non-abort failure, no user feedback hook.
- Comment: `//FIXME result cant have '/'` in `getLabel`.
- Mutating `String.prototype` is a major footgun (collides with any library that probes string objects; survives across the entire global runtime).
- `req.ip` cache and label cache live forever; no eviction.

**Modernization notes.**
- Replace `$http`+`$timeout` with `fetch` / `axios`; replace `$q.defer().promise` cancel pattern with `AbortController`.
- **Eliminate the `String.prototype` extensions** — turn into helper functions (`labelOf(uri, prefixes, cache)`, `toCurie(uri, prefixes)`, `copyToClipboard(text)`). Every `value.uri.getLabel()` in pug/HTML and every `r.getUri().getLabel()` in JS must be migrated.
- `execCommand('copy')` is deprecated — switch to `navigator.clipboard.writeText`.
- Label cache → React Query / TanStack Query / Vue useQuery, keyed by URI, with optional persistence.
- Add real error surface (toast/notification).

---

## 6. Logging service (logService)

**Purpose.** Append-only in-memory event log + JSON download. Used to record user actions for the survey.

**Source files.** `public/scripts/services/logs.js`, `public/views/log.pug`.

**Public API.**
- `log.add(msg)` — pushes `{date: new Date(), info: msg}`.
- `log.download()` — triggers browser download of `log.json` (anchor-tag hack).
- `log.logs` — exposed array (read directly by `log.pug`).

**Current behavior.**
- Called from `propertyGraphService` (node/edge/property/filter creation & deletion, URI add, search results, describe action, mkVariable/mkConst) and `MainCtrl` (search, tutorial start).
- The "Log" tool toggle button is commented out in `tools.pug` — only reachable by setting `main.tool = 'log'` programmatically. The download icon at the top of the log view triggers `main.log.download()`.

**Modernization notes.**
- Trivial to keep; convert array-push to a store. Consider rotating / size-capping the log.
- Date formatting in `log.pug` (`l.date.getHours() + ':' + ...`) does not zero-pad — fix or use `Intl.DateTimeFormat`.

---

## 7. Property graph domain model (propertyGraphService)

**Purpose.** The core domain. Models the user's visual query as an in-memory graph of `Node` / `Property` / `Literal` resources connected by `Edge`s, each with a `Variable` (alias + filters + cached results). Also generates SPARQL `Query` objects from connected sub-graphs and handles drag-drop onto the canvas.

**Source files.** `public/scripts/services/property-graph.js` (1038 lines — the largest file; modernize last or split first).

**Public state.**
```
propertyGraph = {
  selected: <RDFResource|null>,
  nodes:   [Node],
  edges:   [Edge],   // {source: Property, target: Node}
  filters: { text, lang, regex, leq, geq }   // filter-type catalog with UI metadata
  colors:  { rConst, rVar, pConst, pVar, pLit }   // hex colors used by directives
  // wired by other controllers:
  describe: (resource) => void  // set by DescribeCtrl
  edit:     (resource) => void  // set by EditCtrl
  getQueries: () => void        // set by SparqlCtrl
  // wired by the visualQueryBuilder directive:
  element: HTMLElement
  visual:  GraphCreator
}
```

**Types (constructors, prototype methods listed by responsibility).**
- **Filter(variable, type, data)** — `.apply()` returns the SPARQL fragment (BGP or FILTER). Supports `lang`, `text` (Virtuoso `bif:contains`), `regex`, `leq`, `geq`, `isuri`, `isliteral`.
- **Variable(parent)** — id auto-numbered with prefix (`var*` for Node, `prop*` for Property/Literal, plain integer for free). `alias`, `filters[]`, `options {show, count}`, `results[]`. Methods: `toString`/`get` (returns `?alias` or `?id`), `setAlias` (deduplicated against `usedAlias`), `addFilter`, `removeFilter`. **`setOptions`** is marked `//TODO: unused`.
- **RDFResource (base)** — `isVar`, `variable`, `uris[]`, `cur`. Methods: `select`/`isSelected`, `mkVariable`/`mkConst`/`isVariable`, `addUri`/`removeUri`/`hasUris`/`getUri`/`nextUri`/`prevUri`, `getRepr` (display label, supports multi-URI `(2/5) label` and `star` wildcard), `describe`/`edit` (delegate to controller-injected functions), `onClick` (selects + opens describe for constants with URIs, else edit), `createQuery(config)`, `hasResults`/`getResult`.
- **Node : RDFResource** — `properties[]`, `width=220`, `baseHeight=30`. `addUri` also indexes into `uriToNode`. `delete` cascades through edges and selected resource. `loadPreview(config)` builds a query with a label triple and (Wikidata-specific) a `wikibase:directClaim` patch.
- **Property : RDFResource** — `parentNode`, `index`, `literal?`, `star?` (wildcard SPARQL `*` operator). Geometry getters: `getX/getY/getOffsetY` (lays out below its node). `mkLiteral()` returns a new `Literal` (refuses if the property already has an outgoing edge). `loadPreview` is Wikidata-specific.
- **Literal : RDFResource** — owned by a Property. `getPath()` returns an SVG path for the connector. `delete` cascades to the parent property.
- **Edge(source: Property, target: Node)** — `contains(resource)` helper.

**Top-level functions (returned from the factory).**
- `addNode()`, `addEdge(source, target)` (source can be Node or Property), `getNodeByUri(uri)`, `connect(element, graph)` (wires the directive's element/D3 graph + installs DOM `drop`/`dragover` handlers), `refresh()` (= `visual.updateGraph()`), `reset()` (clears all state).

**Drag-and-drop semantics on the canvas (`onDrop`).** Reads `dataTransfer` keys set by drag sources:
- `special = 'example'` + `type ∈ {cats, w3c, mosquito, cancer}` → `createExample` builds a canned scenario.
- `special = 'search'` + `alias` → creates a Node with a label literal pre-filtered by lang=en and bif:contains alias.
- `special = 'literal'` + `prop` → adds `prop` as a literal property of the currently selected node.
- `uri` + `prop` (no special) → creates a property edge from the selected node to a (new or existing) node carrying `uri`.
- `uri` only → creates / re-uses a node with that URI as a constant.

**Query generation (`Query` inner class).**
- `new Query(seedResource)` does BFS over `propertyGraph.edges` plus each node's literal relations to collect triples needed for that connected component. Deduplicates triples by identity.
- `Query.get()` serializes `SELECT DISTINCT … WHERE { … }` with: triples, then `OPTIONAL { … }` blocks, then `VALUES ?x { … }` blocks for multi-URI constants. Adds `FILTER isIRI(?x)` / `FILTER isLiteral(?x)` for fully-variable property triples. Prepends `PREFIX` lines for any prefix actually used. Appends `LIMIT`/`OFFSET` if set. Caches result on `this.q`.
- `Query.update(resource)` rebuilds the dependency set + triples (called from constructor; could be called again to refresh).
- `Query.createTripleLabel(resource)`, `Query.addLabel(resource)`, `Query.addOptLabel(resource)`, `Query.addLabels()` — append rdfs:label (or `settings.labelUri`) lookups.
- `Query.selectAll()` — exposes every dependent variable in the SELECT (used by `SparqlCtrl`).
- `Query.retrieve(config)` — actually executes via `requestService`, dedupes results, writes them onto each resource's `variable.results`.

**Canned examples (`createExample(type, ev)`):** `cats`, `w3c`, `mosquito`, `cancer`. Each one hard-codes Wikidata property/entity URIs (P31, Q146, P1462, Q37033, etc.) and a layout offset relative to the drop coordinates.

**Known issues / TODOs.**
- File comment `//TODO this to the end;` at top of state block.
- `getOffsetY()` is documented `//FIXME: this is executed a lot of times` — performance concern.
- `addEdge` comment: `/* FIXME: duplicate edges */`.
- `addSearchAsFilter` in EditCtrl references a method on this layer but is marked "// should work but not used".
- `Variable.setOptions` is unused.
- Heavy Wikidata-specific code in `loadPreview` (Property + Node) baked into the domain model.

**Modernization notes.**
- This is by far the highest-value file to rewrite and the one with the most surface area. Specs for an isolated rewrite:
  - Inputs: settings (endpoint config + labelUri + prefixes), request layer (execQuery / labels), log layer (events).
  - Outputs: a reactive graph store + a `serializeQuery(seedResource)` function. The directive layer (Section 8) only needs to read positions, colors, and label text.
- Pull the OO `Node/Property/Literal/Edge/Variable/Filter/Query` model into a typed module (TS) with no Angular dependency. Wrap with a reactive store for the new framework.
- Replace prototype inheritance with classes or composition.
- The `loadPreview` Wikidata patch and the `Filter.apply 'text'` branch (Virtuoso `bif:contains` literal) are endpoint-specific — extract into endpoint adapters.
- Watch out for the implicit string-prototype use (`u.toPrefix()`, `uri.getLabel()`) — those have to be replaced when migrating away from `requestService`.

---

## 8. Visual query builder directive (D3 SVG canvas)

**Purpose.** Render the property graph as an SVG, handle pan/zoom, drag, shift-drag (new edge), shift-click (new node), keyboard delete, and right-click context menus.

**Source files.** `public/scripts/directives/visual-query-builder.js`, `public/styles/graph.css`.

**External deps.** D3 **v3** (`d3.behavior.drag`, `d3.behavior.zoom`, `d3.event.translate`, etc. — v4+ API is different). Inline SVG only.

**Public API.**
- Directive `<visual-query-builder>` (also usable as attribute). No isolate-scope bindings; reads from injected `propertyGraphService`.
- On link, appends an `<svg id="d3vqb">` to the host element, creates a `GraphCreator(svg, pGraph.nodes, pGraph.edges)`, calls `graph.updateGraph()`, then `pGraph.connect(element, graph)` to register the D3 graph back into the service.
- `GraphCreator.prototype.updateGraph()` is the D3 enter/update/exit re-render. Called by `propertyGraphService.refresh()` from every controller.
- `GraphCreator.prototype.getZoom()` returns `[tx, ty, scale]` — consumed by `propertyGraphService.onDrop` and the context menus to map screen coords → graph coords.

**Interactions.**
- **Pan**: drag empty SVG (zoom behavior). **Zoom**: wheel (currently `.on("wheel.zoom", null)` — wheel zoom disabled!). Double-click zoom also disabled.
- **Shift-click on empty SVG** → new variable node at click coords.
- **Shift-drag from a node** → drag a "rubber band" line; release on another node creates an edge (`pGraph.addEdge(srcNode, dstNode)`).
- **Click node / property / literal** → `d.onClick()` (selects + opens describe or edit).
- **Right-click** → context menu (custom D3-rendered SVG menu, *not* a native browser menu):
  - Empty canvas (`gMenu`): "New variable", "New property".
  - Node (`rMenu`): "Describe", "Edit", "New property" (auto-positioned), "New literal", "Copy URI", "Remove".
  - Property (`pMenu`): "Describe", "Edit", "Copy URI", "Remove".
  - Literal (`lMenu`): "Edit", "Remove".
- **Delete / Backspace** → splice selected node (with its edges) or selected edge.
- **Resize** → `window.onresize` rescales the SVG to the parent element's client width/height.

**Visual details.**
- Highlight effect via SVG filter (`feGaussianBlur`+`feFlood`+`feComposite`+`feMerge` → `url(#highlight)`).
- Arrow markers: `end-arrow`, `mark-end-arrow`, `start-circle` (defs).
- Text ellipsis: temp SVG `<text>` measured with `getComputedTextLength`, then truncate by ratio.
- Colors come from `pGraph.colors` and per-resource `getColor()`.

**Known issues / TODOs.**
- Comments: `// listen for key events TODO FIXME`, `//Do no show context menu, the default menu can break the tools ouside the svg.`
- `window.onresize` assignment clobbers any other resize handler.
- Click-vs-drag detection uses `state.justDragged` (one-bool latch). Edge cases noted in comments.
- Shift-click on a node and `state.clickedProperty` two-bool trick to suppress double events.

**Modernization notes.**
- D3 v3 → v6/v7 (or replace with a higher-level lib: dagre-d3, cytoscape.js, react-flow / svelte-flow / vue-flow / `xyflow`). Most modern stacks favor `react-flow`-style declarative graphs.
- The custom context menu can be replaced with native `<menu>` or a UI library popover.
- Disabling wheel-zoom is intentional (collides with page scroll); modern UIs typically gate zoom behind Ctrl+wheel.
- Resize handler should become a `ResizeObserver`.

---

## 9. SPARQL editor directive (CodeMirror wrapper)

**Purpose.** Render a generated SPARQL query in a read-display CodeMirror widget with `sparql` mode + line numbers.

**Source files.** `public/scripts/directives/sparql-edit.js` (26 lines).

**External deps.** CodeMirror 5.39.2 + `mode/sparql/sparql.min.js`.

**Public API.** `<sparql-edit query="queryObj">` — isolate scope `{query: '='}`. Calls `scope.query.get()` after a 200ms `$timeout` (waits for the DOM to settle inside `ng-if`).

**Known issues.**
- Read-only-by-convention; CodeMirror is editable but no save-back path exists.
- The 200ms delay is fragile.

**Modernization notes.**
- CodeMirror 5 → CodeMirror 6 (or Monaco). CM6 ships ES modules and has a SPARQL grammar in the `lezer-sparql` ecosystem.
- Replace the `$timeout` hack with the framework's "after DOM mount" hook.

---

## 10. Search feature (Wikidata wbsearchentities + results panel)

**Purpose.** Type-ahead search box that hits Wikidata's REST search API and lists draggable results.

**Source files.** `public/scripts/controllers/main.js` (`search`, `searchChange`, `onSearch`, `onSearchErr`, drag fns), `public/views/search.pug`, plus drag handlers wired in `index.pug`.

**External deps.** Wikidata `wbsearchentities` REST API (CORS, `origin=*`).

**Public API / contract.**
- `vm.searchInput` (`ng-model`), `vm.searchChange()` (`ng-change`) — debounces 400ms then runs `search()` if the input hasn't changed.
- `search()` issues `GET https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&uselang=en&type=item&continue=0&limit=20&search=<input>&origin=*`.
- `onSearch(data)` populates `vm.searchResults = [{uri, label, desc}]` (mapped from `data.search[]`'s `concepturi`/`label`/`description`) and caches each label via `requestService.setLabel`.
- `vm.searchResults` UI: each result is a draggable `.fakeRect`. Drag handlers (defined on `$scope`): `drag(ev, uri, prop, special?)`, `dragSearch(ev)`, `dragExample(ev, type)`. These set `dataTransfer.uri / .prop / .special / .alias / .type` — these keys are read by `property-graph.js#onDrop`.

**Known issues / TODOs.**
- The original SPARQL-based search code is commented out (`request.execQuery(query.search(input), …)`). The endpoint-agnostic search path is dead.
- `onSearchErr` swallows errors silently aside from `console.log`.
- `searchInput != lastSearch` comparison fails when input is set to `null` (`//TODO: fix when null;`).

**Modernization notes.**
- Decouple search backend: either Wikidata REST (current) or SPARQL `query.search()`. Strategy keyed off endpoint.
- Use a real debounce primitive (RxJS, lodash, `useDeferredValue`).
- The drag payload (`dataTransfer` keys `uri/prop/special/alias/type`) is a **wire protocol** between this section and Section 7 — must be preserved or migrated jointly.

---

## 11. Main controller — tool toggle, tutorial, modal help

**Purpose.** Top-level orchestrator. Owns the right-side "tool" (none / describe / edit / sparql / settings / log / help), runs the IntroJS tutorial, opens the modal help.

**Source files.** `public/scripts/controllers/main.js`, `public/views/index.pug`, `public/views/tools.pug`.

**External deps.** angular-ui-bootstrap `$uibModal`, IntroJS 2.9.3.

**Public API.**
- `vm.tool` ∈ `{'none', 'describe', 'edit', 'sparql', 'settings', 'log', 'help'}`. `toolToggle(panel)` flips between `panel` and `'none'`; also kicks off the right-panel data (describe/edit on `getSelected()`, sparql via `pGraph.getQueries()`).
- `$on('tool', data)` listener — controllers (`DescribeCtrl`, `EditCtrl`) emit this to switch panel when they're activated remotely (e.g., from a context menu).
- `$on('newSettings')` — clears `lastSearch`.
- `tutorial()` — 16-step IntroJS walkthrough with hard-coded coordinates, simulated typing for "Einstein", and a fake drag animation (`-webkit-animation: simulate-drag`). Sequence is **fragile**: it queries `#step1`, `#search-container`, `#search-results-panel`, `#vqb-main`, `#right-panel`, `#right-buttons`, `#help-button`, `#result0`, `#propId0`, `#objptitle`.
- `modalHelp()` — opens `$uibModal` with `templateUrl: '/modal/help'` (server route renders the pug fragment).

**Known issues / TODOs.**
- Settings + log buttons in `tools.pug` are commented out — feature exists but is unreachable via UI.
- The tutorial relies on Webkit-only CSS animation names.

**Modernization notes.**
- IntroJS 2.9.3 is old; consider `intro.js` ≥ 7 (commercial license issues) or alternatives (Shepherd, Driver.js, react-joyride). Tutorial steps anchor on DOM IDs that **must be preserved** during the UI migration or the tutorial breaks silently.
- `$uibModal` → framework-native dialog.

---

## 12. Describe tool

**Purpose.** Given an RDF resource, fetch its outgoing properties, categorize them (image / external link / long text / object / datatype), and render a structured panel with draggable property/value rectangles.

**Source files.** `public/scripts/controllers/describe.js`, `public/views/describe.pug`.

**Public API.**
- `propertyGraphService.describe` is **set** here (`pGraph.describe = describeObj`).
- `String.prototype.describe = function() { describe(this); }` — installed here. Called from `edit.pug` (`ng-click="value.describe()"`) and `describe.pug` (`ng-click="elem.value.describe()"`).
- `describeObj(obj)` — entry from a resource on the canvas; resolves to `obj.getUri()` or first variable result.
- `describe(uri)` — by URI.
- `vm.getNext()` / `vm.getPrev()` — iterates within the source variable's results OR within the resource's URI list.
- `vm.show {datatype, objects, external}` — collapsible sections (datatype/external default closed, objects default open).

**Behavior.**
- Heuristic: if `uri` contains `prop/direct` it's rewritten to `entity` for property metadata fetching.
- Caches up to 10 most-recent `selected` objects in memory.
- Categorizes each property URI by checking `settings.describe.exclude/image/external/text/objects/datatype` first; falls back to `kind` from `getProperties` query (`1`=ObjectProperty, `2`=DatatypeProperty); for `kind=0` runs `countValuesType` to decide bucket.
- Image bucket shows first image inline (`<img>`). Text bucket has `[more]`/`[less]` toggles. Datatype is rendered as a 2-col responsive table. Object properties are draggable rectangles + each property has a sub-search input (`prop.filter`).
- All categories' rectangles are draggable: drag payload is set by `MainCtrl.drag` (uri/prop/special). External links are rendered as `<a target="_blank">`.

**Known issues / TODOs.**
- Comment: `//TODO: add disable on chevron when no next or prev.`
- Comment: `// TODO: Carousel or something to see more images.`
- `getPropUri` is used for both image and external buckets — assumes literal-or-URI shape.

**Modernization notes.**
- Move heuristics + per-endpoint URI lists into the endpoint adapter.
- Categorization config (`settings.describe.*`) is Wikidata-tuned; DBpedia branch likely needs different lists.

---

## 13. Edit tool

**Purpose.** Edit panel for the currently selected canvas resource. Lets the user switch variable↔constant, add/remove constant URIs (or literals), add/remove filters, view a live preview of possible matching results.

**Source files.** `public/scripts/controllers/edit.js`, `public/views/edit.pug`.

**Public API.**
- `pGraph.edit = editResource;` (controller is bound into the service).
- `mkVariable() / mkConst()` — flip the selected resource's nature; constant path resets `vm.added` (the badge for "values added during this edit session").
- `addValue(newV?)` — adds a URI/literal; if first value, also auto-switches to constant.
- `rmValue(value)` — removes from `uris[]`.
- `newFilter(targetVar) / rmFilter(targetVar, filter)` — add/remove `Filter` objects; uses `pGraph.filters` catalog for the dropdown's filter-type metadata + dynamic data inputs.
- `loadPreview()` — debounced (400 ms) preview using `selected.loadPreview({limit:10, callback, canceller, varFilter})`. Cancels any in-flight request via the `$q` deferred. Uses `vm.resultFilterValue` as a varFilter (regex).
- `addSearchAsFilter()` — "should work but not used" per comment; would add an rdfs:label literal property pre-filtered by the search box content.
- `addValue` from the preview list — clicking the `+` next to a partial result adds that URI as a constant.

**View behavior.**
- Tabs: Variable | Constraint (the "Constraint" tab pulses with `+N` if values were added during this session).
- For literals: input becomes `type="text"` with placeholder "add a new literal", else `type="url"` with "add a new URI".
- Constraint tab shows the list of values with describe link + delete; for properties also shows "Wildcard property" (`p.star`) checkbox → SPARQL `*` operator.
- Variable tab shows alias input (renders `?<alias>`), debounced previews, a list of partial results (clickable for describe; `+` to capture), and a filter authoring panel.

**Known issues / TODOs.**
- Comment in `addValue`: `// FIXME: check if this is a literal` (uses `!!selected.parent` as the literal test).
- `addSearchAsFilter` references `p.getLiteral.addFilter` (missing `()` — would throw).
- Newly-added URIs auto-flip to constant; users can be surprised.

**Modernization notes.**
- The filter UI is generated dynamically from `pGraph.filters` metadata — keep that shape if Section 7's filter catalog moves.

---

## 14. SPARQL tool (queries panel)

**Purpose.** Aggregate the SPARQL query(s) implied by the current property graph (one per connected component of variables), render each with the `<sparql-edit>` directive plus a header listing the SELECT'd resources.

**Source files.** `public/scripts/controllers/sparql.js`, `public/views/sparql.pug`.

**Public API.**
- `pGraph.getQueries = updateQueries;` (controller registers itself).
- `updateQueries()` — collects every `Variable` resource (nodes, properties, and literal-mode properties' literals), pops them through `createQuery` and `selectAll`, deduplicating across components (resources already covered by a previous query are removed from the queue).
- `vm.queries` — array of Query objects (rendered via `sparql-edit`).
- `vm.empty` — variables that produced no query (no triples).
- `onClick(res)` — selects a resource in the canvas + refreshes.

**View behavior.**
- Each query has a collapsible header showing the selected resources as colored chips (`getColor` / `getRepr`).
- `<sparql-edit query="query">` lazily mounts the CodeMirror only when `query.show` is true.

**Modernization notes.**
- The N×M deduplication via `queue.indexOf` is fine for small graphs; not a perf concern in practice but document it.

---

## 15. Help (panel + modal + FAQ + example drag sources)

**Purpose.** Static help content. Two surfaces:
- A right-panel help view (`help.pug`) with FAQ + draggable canned examples.
- A modal "Getting started" (`modal/help.pug`) rendered by `MainCtrl.modalHelp` via `$uibModal` and server-rendered Pug.

**Source files.** `public/views/help.pug`, `public/views/modal/help.pug`, plus references to `public/images/*.gif` and `images/colors.png`.

**Public API.**
- Drag sources for canned examples: `dragExample(event, 'cats'|'w3c'|'mosquito'|'cancer')` → drop is consumed by `propertyGraphService#createExample`.
- `main.modalHelp()` / `main.tutorial()` hyperlinks in `help.pug`.

**Modernization notes.**
- Pure content; the easiest piece to migrate (could become MDX/markdown).
- `/modal/help` server route can disappear if the modal body is bundled with the SPA.
- Asset list to migrate: `images/00.gif`…`04.gif`, `t1.gif`…`t8.gif`, `colors.png`, `example1.png`, `example2.png`, `error.svg`, `spin.svg`.

---

## 16. Survey (separate AngularJS app)

**Purpose.** Standalone user-study form. Asks for demographics, presents 10 SPARQL tasks (user pastes their queries from each evaluated UI), then NASA-TLX (6 sliders × 2 tools) and Likert (3 questions × 2 tools). Posts to `/upload-survey` at the end.

**Source files.** `public/scripts/survey.js`, `public/views/survey.pug`, served by `server.js#GET /survey`.

**Module.** A **distinct** AngularJS module (`survey`, not `rdfvis`) — does **not** share state with the main app. Loads its own CDN deps (Bootstrap, Font Awesome, angular-loading-bar, CodeMirror) plus core AngularJS (loaded again per page).

**Public API / contract.**
- `vm.step ∈ 0..5`: consent (0) → demographics (1) → 10 tasks (2) → 2× TLX (3) → 2× Likert (4) → done (5, uploads).
- `vm.data` shape persisted:
  ```
  { startUrl, user{gender, age, degree}, tasks[10]{on, sparql, time},
    tlx[2]{on, score[6]}, likert[2]{on, score[3]} }
  ```
- `vm.url` is a 2-tuple — order randomized only by the user's starting choice (`https://explorer.csrg.cl` vs `https://query.wikidata.org`); `urlStep` toggles between them per task.
- `download()` → JSON file download. `upload()` → `POST /upload-survey`.

**Tasks list.** 10 hard-coded English natural-language descriptions (see lines 65–77 of `survey.js`).

**Known issues / TODOs.**
- "No back button" is enforced only by the UI — refreshing the page wipes progress (data is in-memory only).
- Compared tools URLs are hard-coded.
- No anonymization step before persisting (server adds `req.ip`).

**Modernization notes.**
- This is essentially a separate single-page form; could be extracted to its own micro-app or removed entirely if surveys are done.
- The two AngularJS apps share zero state — migration of section 1–15 can be done independently of the survey app, but the `/upload-survey` server route + `survey-results/` directory must be kept in sync.

---

## 17. Styles

**Purpose.** App look & feel. Two stylesheets, loaded in `layout.pug` after Bootstrap 4.

**Source files.** `public/styles/style.css` (576 lines — global layout, components, utilities), `public/styles/graph.css` (120 lines — SVG node/edge/menu classes used by Section 8).

**Modernization notes.**
- Migrate to the new framework's styling solution (Tailwind, CSS modules, scoped styles). The visual-query-builder selectors in `graph.css` are tightly coupled to the class names emitted by `visual-query-builder.js` (`thisGraph.classes`); migrate both at once.

---

## Cross-cutting concerns (please address during *any* feature migration)

1. **`String.prototype` extensions** (Section 5) leak into every controller and view. Removing them is a global refactor: every `.getLabel()`, `.toPrefix()`, `.copyToClipboard()`, `.describe()` call in views and JS must be replaced.
2. **The `dataTransfer` drag protocol** (`uri / prop / special / alias / type`) is the contract between Sections 10/12/15 (drag sources) and Section 7 (`onDrop`). Migrate together or formalize the protocol.
3. **`propertyGraphService.{describe, edit, getQueries}`** is filled in *by the controllers* (Sections 12/13/14). This is reverse-injection. If the property graph is moved to a typed store, define explicit hooks/events instead.
4. **DOM IDs** (`#vqb-main`, `#right-panel`, `#right-buttons`, `#search-container`, `#search-input`, `#search-results-panel`, `#help-button`, `#step1`, `#result0`, `#propId0`, `#objptitle`, `#mid-help`, `#top`) are anchors for IntroJS — preserve or update the tutorial in lockstep.
5. **D3 v3 → newer** is a single hard cut for Section 8; do **not** attempt incremental upgrade of D3 across calls.
6. **Endpoint type switch** (`settings.endpoint.type ∈ '' | 'virtuoso' | 'fuseki' | 'other'`) appears in Sections 4 (queryService.search), 5 (request), 7 (Filter.apply 'text'). Centralize behind an endpoint adapter before, or during, the framework swap.
7. **Wikidata-specific code paths** that must be flagged for endpoint-agnostic rewrites: `queryService.getProperties` (uses `wikibase:directClaim`), `propertyGraphService.Node.loadPreview` & `Property.loadPreview` (also `wikibase:directClaim`), the hardcoded label seed in `requestService` (P31, Q146, Q7367, Q7432, Q12078, Q16521, Q37033, Q14818032), and `createExample` (all four canned scenarios use Wikidata Q/P URIs).
