# Stage 4 — Tools panel (search, describe, edit, sparql, settings, help, log)

## Goal

End state of this stage:
- The right-side tools panel is **fully wired**. Clicking a tool button shows the real tool component (not a placeholder). Clicking a node in the canvas opens the matching tool (`describe` for constants with URIs, `edit` for everything else) — exactly like the legacy `onClick` behavior, but routed through `GraphInteractionService` (the signal bus from Stage 3) instead of reverse-injection.
- Seven standalone components exist under `app/src/app/tools/`:
  1. `SearchPanelComponent` — top-left search box + draggable results (Wikidata `wbsearchentities`).
  2. `DescribePanelComponent` — fetch + categorize properties of the current resource.
  3. `EditPanelComponent` — variable ⇄ constant toggle, URI list, filter authoring, live preview.
  4. `SparqlPanelComponent` — list of generated SPARQL queries with CodeMirror 6 viewers.
  5. `SettingsPanelComponent` — endpoint config, search-class typeahead, save/cancel/default. (Re-exposed in the UI — legacy had it commented out.)
  6. `HelpPanelComponent` — FAQ + draggable canned-example launchers.
  7. `LogPanelComponent` — log entries view + JSON download button. (Also re-exposed.)
- `ToolService` from Stage 0 is upgraded to subscribe to `GraphInteractionService.requestedTool`: when the canvas sets a `{ tool: 'describe' | 'edit', target }`, `ToolService` switches the active tool to that one and the panel reads `selected` from `PropertyGraphService` (single source of truth — the panel does NOT carry the target itself).
- The CodeMirror 6 editor is integrated via a small `<sparql-viewer>` component that wraps `@codemirror/view` + `@codemirror/state` + a SPARQL language package.
- The user can perform the full end-to-end flow from the live demo:
  1. Type "Einstein" in the search box → draggable results appear.
  2. Drag a result to the canvas → node appears.
  3. Click the node → describe panel opens with properties categorized.
  4. Drag an "Object property" (e.g. `instance of`) to the canvas → a new property + target node appear.
  5. Click the new variable node → edit panel opens.
  6. Add a filter or rename the variable → preview updates.
  7. Click the SPARQL button → see the generated query in the CodeMirror viewer.

## Prerequisites

- Stages 0, 1, 2, 3 complete.

## Spec sections covered

- [SPECS.md §3 — Settings (UI part)](../SPECS.md#3-settings-service--settings-panel)
- [SPECS.md §6 — Log (UI part)](../SPECS.md#6-logging-service-logservice)
- [SPECS.md §9 — sparql-edit / CodeMirror](../SPECS.md#9-sparql-editor-directive-codemirror-wrapper)
- [SPECS.md §10 — Search feature](../SPECS.md#10-search-feature-wikidata-wbsearchentities--results-panel)
- [SPECS.md §11 — Main controller / tool toggle](../SPECS.md#11-main-controller--tool-toggle-tutorial-modal-help) (toggle wiring; tutorial + modal in Stage 5)
- [SPECS.md §12 — Describe tool](../SPECS.md#12-describe-tool)
- [SPECS.md §13 — Edit tool](../SPECS.md#13-edit-tool)
- [SPECS.md §14 — SPARQL tool](../SPECS.md#14-sparql-tool-queries-panel)
- [SPECS.md §15 — Help panel (panel only; modal is Stage 5)](../SPECS.md#15-help-panel--modal--faq--example-drag-sources)
- Cross-cutting #2 (DataTransfer protocol writers), #3 (reverse injection — kill it), #4 (DOM IDs that the tutorial in Stage 5 will need).

## Legacy files to consult (read-only)

| Path                                                       | What to focus on |
|------------------------------------------------------------|------------------|
| `legacy/public/scripts/controllers/main.js`                | Lines 57–125 (`search`, `searchChange`, `onSearch`, `onSearchErr`) + 134–149 (drag handlers `drag`, `dragExample`, `dragSearch`). Tutorial + modal are Stage 5. |
| `legacy/public/scripts/controllers/describe.js`            | Whole file. Pay attention to `load(uri)` categorization heuristics (lines 34–93), `loadPropUri / loadDatatype / loadObject`, and `getNext / getPrev` (which traverses either the resource's URI list OR the variable's results). |
| `legacy/public/scripts/controllers/edit.js`                | Whole file. `editResource`, `mkVariable/mkConst`, `addValue/rmValue`, `newFilter/rmFilter`, `loadPreview` debounce (400ms). |
| `legacy/public/scripts/controllers/sparql.js`              | All 49 lines. `updateQueries` builds a list of connected-component queries and dedupes overlap. |
| `legacy/public/scripts/controllers/settings.js`            | Settings save/cancel/default + `getClasses` typeahead via SPARQL. |
| `legacy/public/scripts/directives/sparql-edit.js`          | The CodeMirror 5 wrapper. CodeMirror 6 has a completely different API — read the legacy to understand WHAT (read-only SPARQL display) not HOW. |
| `legacy/public/views/search.pug`                           | The `.fakeRect` result item + drag wiring (`ondragstart`, `dataTransfer`). |
| `legacy/public/views/describe.pug`                         | Categorized sections (image, text, datatype, objects, external), the per-property search input, the more/less toggles, the `+` button to capture results. |
| `legacy/public/views/edit.pug`                             | The tab structure (Variable | Constraint), the filter dropdown that uses `pGraph.filters` metadata, the partial-results list. |
| `legacy/public/views/sparql.pug`                           | The collapsible query header with colored chips. |
| `legacy/public/views/settings.pug`                         | Endpoint form + typeahead + buttons. |
| `legacy/public/views/help.pug`                             | FAQ + 4 example drag sources. |
| `legacy/public/views/log.pug`                              | Trivial — log list + download icon. |

## Output paths

```
app/src/app/tools/
├── search-panel/
│   ├── search-panel.component.ts
│   ├── search-panel.component.html
│   ├── search-panel.component.scss
│   ├── wikidata-search.service.ts          # wbsearchentities client (fetch, debounce)
│   └── *.spec.ts
├── describe-panel/
│   ├── describe-panel.component.ts
│   ├── describe-panel.component.html
│   ├── describe.service.ts                 # owns: load, categorize, cache (10 entries)
│   └── *.spec.ts
├── edit-panel/
│   ├── edit-panel.component.ts
│   ├── edit-panel.component.html
│   ├── edit-panel.component.scss
│   └── *.spec.ts
├── sparql-panel/
│   ├── sparql-panel.component.ts
│   ├── sparql-panel.component.html
│   ├── sparql-viewer/
│   │   ├── sparql-viewer.component.ts      # CodeMirror 6 wrapper
│   │   └── sparql-viewer.component.spec.ts
│   └── sparql-panel.component.spec.ts
├── settings-panel/
│   ├── settings-panel.component.ts
│   ├── settings-panel.component.html
│   └── *.spec.ts
├── help-panel/
│   ├── help-panel.component.ts
│   ├── help-panel.component.html
│   ├── help-panel.component.scss
│   └── faq.data.ts                          # FAQ entries as data
└── log-panel/
    ├── log-panel.component.ts
    └── log-panel.component.html
```

Also update:
- `app/src/app/shell/tools-panel/tools-panel.component.html` — switch on the active tool and render the real component.
- `app/src/app/tool/tool.service.ts` — subscribe to `GraphInteractionService.requestedTool`.
- `app/src/app/shell/search-panel/` — replace the Stage 0 placeholder with `SearchPanelComponent`.

## Dependencies to install

```
npm install @codemirror/state @codemirror/view @codemirror/language @codemirror/commands @codemirror/lang-sparql
# If @codemirror/lang-sparql is unavailable, use codemirror-lang-sparql or fall back to plain text mode.
```

No additional dependencies for search / describe / edit / sparql panels — they use `RequestService` + `QueryService` from Stage 1 and `PropertyGraphService` from Stage 2.

## Detailed design notes

### `ToolService` (upgrade from Stage 0)

```ts
@Injectable({ providedIn: 'root' })
export class ToolService {
  private readonly interaction = inject(GraphInteractionService);
  readonly active = signal<ToolName | 'none'>('none');

  constructor() {
    // When the canvas asks to open describe/edit, switch the active tool.
    effect(() => {
      const req = this.interaction.requestedTool();
      if (req) this.active.set(req.tool);
    });
  }

  toggle(name: ToolName): void {
    this.active.update(cur => cur === name ? 'none' : name);
  }
}
```

### `SearchPanelComponent`

- Owns the search input + results list.
- Uses `WikidataSearchService` which calls `wbsearchentities` via `fetch` with `AbortController`.
- Debounces 400ms (legacy semantic).
- On result list: each item is `draggable="true"`; on `dragstart`, write `uri = result.concepturi`, `prop = ''`. (See `parseDropPayload` in Stage 3.)
- Cache labels via `RequestService.setLabel(uri, label)` so the canvas/describe panel can show them immediately.

```ts
@Injectable({ providedIn: 'root' })
export class WikidataSearchService {
  async search(input: string, signal?: AbortSignal): Promise<WikidataSearchResult[]>;
}

export interface WikidataSearchResult { uri: string; label: string; description?: string; }
```

The endpoint URL is hard-coded to Wikidata (`https://www.wikidata.org/w/api.php`) just like legacy. If the user has switched `settings.endpoint.type` to a non-Wikidata source, the search should fall back to the SPARQL `querySearch` from Stage 1 (the legacy code has the SPARQL path commented out — wire it back as a fallback strategy).

### `DescribePanelComponent` + `DescribeService`

`DescribeService` owns the cache (max 10 entries) and the load logic:

```ts
@Injectable({ providedIn: 'root' })
export class DescribeService {
  readonly current = signal<DescribedResource | null>(null);
  describe(uri: string, source?: RDFResource): void;
  next(): void;     // navigates within source's results / URI list
  prev(): void;
}

export interface DescribedResource {
  uri: string;
  source: RDFResource | null;
  objects:  DescribeBucketItem[];
  datatype: DescribeBucketItem[];
  text:     DescribeBucketItem[];
  external: DescribeBucketItem[];
  image:    DescribeBucketItem[];
  results:  Record<string, unknown[]>;
}
```

Categorization heuristic — port verbatim from `legacy/public/scripts/controllers/describe.js` lines 50–88:
1. If URI is in `settings.describe.exclude` → skip.
2. Else if in `image` / `external` / `text` / `objects` / `datatype` lists → assign accordingly.
3. Else if `kind == 1` (ObjectProperty) → objects bucket.
4. Else if `kind == 2` (DatatypeProperty) → datatype bucket.
5. Else if `kind == 0` (unknown) → run `countValuesType` and bucket by majority.

Heuristic for URIs that contain `prop/direct` (Wikidata): rewrite to `entity` before calling `getProperties`. Keep this in the service (it's Wikidata-specific but pragmatic — DBpedia branch won't trip on it because the URIs don't contain `prop/direct`).

The view (`describe-panel.component.html`) renders the 5 buckets matching `legacy/public/views/describe.pug`:
- Images: first one inline (`<img>`).
- Text: more/less toggles per value.
- Datatype: 2-col responsive table with per-value more/less.
- Object: collapsible per-property block with a sub-filter input + draggable `.fakeRect` per value.
- External: list of `<a target="_blank">`.

Drag sources in the describe panel set `prop` (and `special = 'literal'` for the text/datatype/external "literal" tags). See `parseDropPayload` in Stage 3.

### `EditPanelComponent`

- Reads the currently selected resource from `PropertyGraphService.selected`.
- Tab UI: Variable | Constraint. Uses Angular signals + `@if` to switch.
- Variable tab:
  - Alias input (renders `?<alias>` in the canvas — bound to `Variable.setAlias`, returns `false` on collision so show an error state).
  - "Possible results" filter input with 400ms debounce → triggers `selected.runPreview({ limit: 10, varFilter, canceller: new AbortController() })`. Cancel any in-flight preview on each new keystroke.
  - Filter authoring: a `<select>` from `graph.filterCatalog`, dynamic inputs per filter type (the `data` field shape), "Add" button.
  - Filter list with delete buttons.
- Constraint tab:
  - "Add a new value" input (URL or text depending on `isLiteral`).
  - List of current URIs with describe-link + delete.
  - For properties: "Wildcard property" checkbox bound to `Property.star`.
  - When adding the first value, auto-flip to constraint (legacy behavior — see SPECS §13).

Don't carry the legacy `addSearchAsFilter` bug (`p.getLiteral.addFilter` missing parens) — either implement it correctly or omit it (it was unused in legacy).

### `SparqlPanelComponent`

- On `ngOnInit` and after every graph revision change, call `graph.getQueriesForGraph()` and render the resulting `Query[]`.
- Each query rendered with a collapsible header showing colored chips (one per `select[i]`) — use `Variable.toString()` for the label and `resource.getColor()` for the chip border.
- Body: `<sparql-viewer [content]="query.toSparql()">` — CodeMirror 6 read-only.
- Clicking a chip calls `graph.setSelected(resource)` — opens the edit tool via `requestedTool`.

### `SparqlViewerComponent`

```ts
@Component({
  selector: 'sparql-viewer',
  standalone: true,
  template: `<div #container class="cm-host"></div>`,
})
export class SparqlViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) content!: string;
  @ViewChild('container', { static: true }) host!: ElementRef<HTMLElement>;
  private view?: EditorView;

  ngAfterViewInit() {
    this.view = new EditorView({
      doc: this.content,
      extensions: [
        lineNumbers(),
        EditorView.editable.of(false),    // read-only for now
        sparql(),                          // language pack
      ],
      parent: this.host.nativeElement,
    });
  }
  ngOnChanges(c: SimpleChanges) {
    if (c['content'] && this.view) {
      this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: this.content } });
    }
  }
  ngOnDestroy() { this.view?.destroy(); }
}
```

### `SettingsPanelComponent`

- Form bound to a local copy of `SettingsService.appSettings` (so cancel is easy).
- Search-class typeahead: call `RequestService.execQuery(querySearch(input, { type: 'http://www.w3.org/2002/07/owl#Class', endpointType }))`. Debounce 300ms.
- Buttons: Default (`settings.reset()`), Cancel (re-copy from service), Save (write back via `settings.update(...)`).

**Re-expose this panel.** Add a button to `tools-panel` for `settings` (the legacy UI had this button commented out — uncomment in the new UI).

### `HelpPanelComponent`

- Static FAQ from `faq.data.ts` (port the legacy `help.pug` content).
- 4 draggable example launchers: `cats`, `w3c`, `mosquito`, `cancer`. On `dragstart`, set `special = 'example'`, `type = '<exampleType>'`.
- "Click here to run the interactive tutorial" links (stub — tutorial is implemented in Stage 5; clicking now does nothing but logs a TODO).
- "Click here to display the getting started" — Stage 5 will show the modal; for now, a placeholder.

### `LogPanelComponent`

- Reads `log.entries()` signal, lists `{date, info}` with the date formatted as `HH:MM:SS` (zero-padded — fix the legacy bug that didn't pad).
- Download button calls `log.download()`.

### DOM IDs (cross-cutting #4 — required for Stage 5's tutorial)

The legacy IntroJS tutorial anchors on these IDs. Preserve them in the new components or maintain a translation map for Stage 5 to update:

| Legacy ID | Component / location |
|-----------|-----------------------|
| `step1`              | The `<form>` element wrapping the search input |
| `search-container`   | `SearchPanelComponent` outer wrapper |
| `search-input`       | The search input element |
| `search-icon`        | The search FA icon |
| `search-results-panel` | The results list container |
| `result0`            | The first result's `.fakeRect` (use `id="result{{$index}}"`) |
| `vqb-main`           | The `<canvas-graph>` host element |
| `right-panel`        | The right tools panel container |
| `right-buttons`      | The tool toggle button bar |
| `propId0`            | The first object-property row in describe (use `id="propId{{$index}}"`) |
| `objptitle`          | The "Object properties" h5 heading in describe |
| `help-button`        | The help tool toggle button |
| `mid-help`           | The "Need help?" overlay when graph is empty |
| `top`                | Scroll anchor (legacy survey only — likely not needed here) |

**Recommended:** include these IDs in the new components. If you rename, list the renames in a comment in this stage doc so Stage 5 finds them.

## Step-by-step plan

1. Install CodeMirror 6 packages.
2. Upgrade `ToolService` to subscribe to `GraphInteractionService.requestedTool`.
3. Build the **search panel** (smallest dependency surface). Verify in browser: typing "einstein" returns Wikidata results; dragging one to the canvas (via Stage 3) creates a node.
4. Build the **describe panel** + `DescribeService`. Verify: clicking a constant node opens it with categorized properties.
5. Build the **sparql viewer** (CodeMirror 6 wrapper) + **sparql panel**. Verify: building a small graph produces a query rendered in CodeMirror.
6. Build the **edit panel**. Verify: clicking a variable node opens edit; renaming alias updates the canvas live; adding a filter modifies the SPARQL.
7. Build the **help panel** + 4 drag sources. Verify: dragging "cats" creates the canned example.
8. Build the **settings panel**. Verify: changing endpoint URL + saving persists across reload (`localStorage`).
9. Build the **log panel**. Verify: actions appear in the log; download produces a JSON file.
10. Update `tools-panel.component.html` to switch on `ToolService.active` and render the right component via `@switch` / `@if`.
11. End-to-end smoke test: complete the flow described in "## Goal" step by step.
12. `ng build` clean; `ng test` for any specs you added.

## What NOT to do

- Do **not** reintroduce the legacy reverse-injection pattern (`pGraph.describe = ...`). All cross-component communication goes through `PropertyGraphService` + `GraphInteractionService` + `ToolService` signals.
- Do **not** import any tool component into another tool component. Each tool is independent and watches services.
- Do **not** put canvas mutations in any tool panel — call `PropertyGraphService` methods.
- Do **not** store the "currently described/edited resource" inside the tool panels. The single source of truth is `PropertyGraphService.selected` (or for describe: `DescribeService.current`, which is derived from `selected` + user navigation).
- Do **not** use jQuery, `$timeout`, `$scope.$emit`, or any AngularJS-style event bus. They don't exist in Angular 17.
- Do **not** monkey-patch anything onto `String.prototype` even though the legacy describe/edit views call `.getLabel()` and `.describe()` on strings. Use the helpers from Stage 1.
- Do **not** ship the CodeMirror editable mode for the SPARQL viewer. It's read-only display, matching the legacy.
- Do **not** delete the legacy ID list above. If you rename any of them, document the rename so Stage 5's tutorial can adapt.

## Acceptance criteria

Verifiable in a running browser:

- [ ] Typing in the search box returns Wikidata results within ~1 second. The first result is draggable; dropping it on the canvas creates a node.
- [ ] Clicking a constant node (with a URI) opens the **describe** panel automatically. Properties are categorized into Image / Text / Datatype / Object / External buckets.
- [ ] Clicking a variable node opens the **edit** panel. Renaming the alias updates the canvas live. Adding a `lang` filter modifies the generated SPARQL.
- [ ] The **sparql** tool button shows one CodeMirror viewer per connected component of variables. Clicking a colored chip in a query header opens the edit panel for that resource.
- [ ] The **help** tool button shows FAQ + 4 draggable example launchers. Dragging "cats" creates the canned 2-node graph.
- [ ] The **settings** tool button shows the endpoint form. Saving changes persists across a page reload (localStorage).
- [ ] The **log** tool button shows recent log entries with zero-padded `HH:MM:SS` timestamps. Clicking download saves a JSON file.
- [ ] `grep -r "BehaviorSubject" app/src/app/tools/` returns empty.
- [ ] `grep -r "String.prototype" app/src/app/tools/` returns empty.
- [ ] `grep -r "reverse-injection" app/src/app/tools/` — informal check; no service in `app/src/app/tools/` is mutated by another service the way legacy did `pGraph.describe = describeObj`.
- [ ] `ng build` clean; no warnings about NgModule or legacy syntax.

---

## Hand-off prompt for the agent

```
=====================================================================
Project: RDFExplorer — migrating to Angular 17+ standalone + cytoscape.js.
We are at Stage 4 of 6. Stages 0–3 are done:
  - Angular 17 shell in app/
  - Core services under app/src/app/core/
  - Domain model + PropertyGraphService under app/src/app/graph/
  - Canvas working with cytoscape.js + GraphInteractionService signal bus
Legacy is read-only under legacy/.

Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-4-tools.md  ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md sections 3, 6, 9, 10, 11, 12, 13, 14, 15
     + cross-cutting concerns #2, #3, #4
  4. Every controller in /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/controllers/
  5. The matching views in /home/mmventurino/Documents/RDFExplorer/legacy/public/views/

Your goal is in stage-4-tools.md under "## Goal". You are building 7
panel components plus upgrading ToolService. The "## Detailed design
notes" describes each one. Follow the "## Step-by-step plan". The
"## Acceptance criteria" is what proves done.

This stage is the biggest UI delivery of the migration. Take it in the
order listed: search → describe → sparql viewer → edit → help → settings
→ log. Verify each in the browser before moving to the next.

Hard constraints (also in migration/README.md):
- legacy/ is READ-ONLY.
- Angular 17 standalone components + signals. New control flow (@if / @for / @switch).
- DO NOT reintroduce the legacy reverse-injection pattern. The canvas
  emits a signal (GraphInteractionService.requestedTool); ToolService
  watches it and switches the active tool. Tools then read
  PropertyGraphService.selected. NO component writes to another component's state.
- Tools never mutate the canvas directly — call PropertyGraphService methods.
- No String.prototype extensions. Use labelOf() / toCurie() from Stage 1.
- CodeMirror 6, not 5. Read-only for SPARQL display.
- Re-expose the settings and log buttons in the tool bar (legacy had them commented out).
- Preserve the DOM IDs listed in stage-4-tools.md "## DOM IDs" — Stage 5
  uses them for the tutorial. If you rename any, list the rename in a
  comment so Stage 5 can find them.

Specific bugs in legacy you must NOT propagate:
- describe.pug categorization that touches `prop/direct` URI rewriting:
  port the rewrite, but only as a Wikidata heuristic — do not apply
  to non-Wikidata endpoints.
- edit.js `addSearchAsFilter` calls `p.getLiteral.addFilter` (missing parens).
  That feature is unused — omit or implement correctly.
- log.pug `HH:MM:SS` doesn't zero-pad. Fix it.

Verification (mandatory — UI changes require browser confirmation):
- Run `cd app && ng serve`. Walk through every acceptance criterion.
- Run `cd app && ng test`. All specs pass.
- Run `cd app && ng build`. Clean.
- Run these greps and confirm empty:
  - `grep -r "BehaviorSubject" app/src/app/tools/`
  - `grep -r "String.prototype" app/src/app/tools/`
  - `grep -r "\\$timeout\\|\\$http\\|\\$scope" app/src/`

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface it.

Do not commit. When done, report:
  - Full file tree of app/src/app/tools/.
  - End-to-end flow you walked through and the result.
  - Each acceptance checkbox — confirmed with steps you took.
  - The grep checks.
  - Any DOM IDs you renamed (for Stage 5 to find).
=====================================================================
```
