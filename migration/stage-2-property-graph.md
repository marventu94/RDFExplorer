# Stage 2 — Property graph domain model

## Goal

End state of this stage:
- A pure-TypeScript domain module under `app/src/app/graph/domain/` that ports the legacy `Node` / `Property` / `Literal` / `Variable` / `Filter` / `Edge` / `Query` classes. **No Angular imports anywhere in this module.**
- An Angular wrapper `PropertyGraphService` under `app/src/app/graph/property-graph.service.ts` that exposes the graph as signals (`nodes`, `edges`, `selected`) and provides public mutation methods (`addNode`, `addEdge`, `removeNode`, `setSelected`, `applyDrop`, `reset`, `getQueriesForGraph`, etc.).
- A drop handler that consumes a typed `DropPayload` (no DOM `DataTransfer` knowledge in the domain — the canvas component in Stage 3 parses the DataTransfer and calls the service with a typed payload).
- Endpoint-specific code (Wikidata `wikibase:directClaim`) extracted into a `WikidataAdapter` strategy.
- Comprehensive unit tests:
  - Golden-file tests for `Query.toSparql()` against the 4 canned examples (`cats`, `w3c`, `mosquito`, `cancer`). The expected output is captured from running the legacy code (you'll generate the golden files).
  - Filter serialization tests (every type: `text`, `lang`, `regex`, `leq`, `geq`, `isuri`, `isliteral`).
  - Variable alias collision tests (`setAlias` returns false on collision, no global state leaks across `PropertyGraphService` instances).
  - Graph mutation tests (`removeNode` cascades through edges + selected, `removeProperty` reindexes siblings).

After this stage, no UI consumes the domain model yet — the canvas (Stage 3) and tool panels (Stage 4) will. The model is feature-complete and tested in isolation.

## Prerequisites

- Stage 1 complete (this stage uses `SettingsService.labelUri`, `SettingsService.lang`, `RequestService.execQuery`, `LogService.add`, and the `Prefix` type).

## Spec sections covered

- [SPECS.md §7 — Property graph domain model](../SPECS.md#7-property-graph-domain-model-propertygraphservice) (the big one, 1038 lines in legacy)
- Cross-cutting concerns #2 (dataTransfer protocol), #3 (reverse injection), #7 (Wikidata-specific paths).

## Legacy files to consult (read-only)

| Path                                                       | What to focus on |
|------------------------------------------------------------|------------------|
| `legacy/public/scripts/services/property-graph.js`         | All 1038 lines. Pay particular attention to: `Filter.apply` (lines 56–87), `Variable.*` (89–166), `RDFResource.*` (168–298), `Node.*` (299–443), `Property.*` (445–552), `Literal.*` (554–602), `Edge` (604–616), `connect`/`onDrop`/`createExample` (618–788), `addNode`/`addEdge`/`getNodeByUri` (792–804), `Query.*` (807–1035). |
| `legacy/public/scripts/services/settings.js`               | `labelUri`, `lang`, and the `prefixes` list — needed by `Query.createTripleLabel` and prefix serialization. |
| `legacy/public/scripts/services/request.js`                | The `String.prototype.toPrefix` extension is called by `Query.get` — your TS port uses the Stage 1 `toCurie()` helper instead. |
| `legacy/public/scripts/services/logs.js`                   | Already migrated in Stage 1 as `LogService`. The domain model calls `log.add(msg)` at every mutation. |

**Heads up — known issues in the legacy code you must NOT propagate:**
- `EditCtrl.addSearchAsFilter` calls `p.getLiteral.addFilter` (missing parens) — would throw at runtime. Don't carry this bug into the port.
- `Variable.setOptions` is unused — port it anyway for completeness, but mark as `@deprecated` if you prefer.
- The `// FIXME: duplicate edges` comment in `addEdge` — the legacy code doesn't dedupe. Decide with the user whether to fix or preserve. Recommended: preserve current behavior, add a TODO with a link to a tracked issue.

## Output paths

```
app/src/app/graph/
├── domain/                                    # Pure TS, no Angular
│   ├── id-allocator.ts                        # ID generators (Node, Property, Literal, Variable counters)
│   ├── variable.ts                            # class Variable
│   ├── filter.ts                              # class Filter + FilterType union + per-type serialize()
│   ├── rdf-resource.ts                        # abstract base
│   ├── node.ts                                # class Node
│   ├── property.ts                            # class Property
│   ├── literal.ts                             # class Literal
│   ├── edge.ts                                # class Edge
│   ├── query.ts                               # class Query (toSparql, addLabel, retrieve, ...)
│   ├── graph.ts                               # PropertyGraph aggregate: state + mutations + drop handling
│   ├── drop-payload.ts                        # typed DropPayload union (DataTransfer-agnostic)
│   ├── endpoint/
│   │   ├── adapter.ts                         # interface DomainEndpointAdapter
│   │   ├── wikidata-adapter.ts                # uses wikibase:directClaim, loadPreview specifics
│   │   └── generic-adapter.ts                 # DBpedia-style (no directClaim)
│   ├── examples/
│   │   └── canned-examples.ts                 # cats, w3c, mosquito, cancer scenarios as typed builders
│   └── index.ts                               # barrel
├── property-graph.service.ts                  # Angular wrapper, signals
├── property-graph.service.spec.ts
└── domain/__tests__/
    ├── query.golden.spec.ts                   # vs. captured fixtures
    ├── filter.spec.ts
    ├── variable.spec.ts
    ├── graph-mutations.spec.ts
    └── fixtures/
        ├── cats.sparql
        ├── w3c.sparql
        ├── mosquito.sparql
        └── cancer.sparql
```

## Detailed design notes

### IDs and global state

The legacy module uses module-level counters (`lastNodeId`, `lastPropId`, `lastVarId`, `lastVarResId`, `lastVarPropId`, `usedAlias`, `uriToNode`). These persist as long as the page lives. In the port:
- Move them onto the `PropertyGraph` aggregate so each instance has its own counters and alias set. This makes tests and the `reset()` method clean.
- `IdAllocator` is an internal helper, one per `PropertyGraph` instance.

### `class Variable`

```ts
class Variable {
  constructor(private readonly graph: PropertyGraph, parent: RDFResource | null);
  readonly id: string;                    // 'var0' | 'prop0' | '0' depending on parent type
  alias: string;
  filters: Filter[];
  options: { show: boolean; count: boolean };
  results: SparqlBinding[];               // last-known results
  query?: string;                          // SPARQL string that produced `results` (used as cache key)
  setAlias(alias: string): boolean;       // dedup against graph.usedAliases — return false on collision
  toString(): string;                     // '?alias' or '?id'
  addFilter(type: FilterType, data: FilterData): Filter;
  removeFilter(filter: Filter): boolean;
  isBinded(): boolean;                    // legacy spelling. Optional alias `isBound`.
}
```

### `class Filter`

```ts
type FilterType = 'text' | 'lang' | 'regex' | 'leq' | 'geq' | 'isuri' | 'isliteral';
class Filter {
  constructor(public variable: Variable, public type: FilterType, public data: FilterData);
  serialize(adapter: DomainEndpointAdapter): string;  // returns the SPARQL fragment ending in '\n'
}
```

`serialize` per type:
- `lang`: `FILTER (lang(?v) = "<lang>")\n`
- `text`: `?v bif:contains "'<kw>'" .\n` (delegated to adapter — legacy is Virtuoso-only)
- `regex`: `FILTER regex(?v, "<re>", "i")\n`
- `leq`: `FILTER (?v < <n>)\n` (note legacy has missing space — keep it bug-compatible or fix; mark in code)
- `geq`: `FILTER (?v > <n>)\n`
- `isuri`: `FILTER isIRI(?v)\n`
- `isliteral`: `FILTER isLiteral(?v)\n`

### `class RDFResource` (abstract base)

Keep the legacy semantics:
- `isVar: boolean` toggles variable / constant
- `uris: string[]`, `cur: number` (index into uris; -1 if none)
- `variable: Variable`
- `addUri / removeUri / hasUris / getUri / nextUri / prevUri`
- `getRepr()`: display string considering `star`, multi-URI cycling
- `createQuery(opts?: { limit?, offset? }): Query | null`
- `hasResults() / getResult()`

**Remove** the reverse-injection pattern (`propertyGraph.describe(this)`, `propertyGraph.edit(this)`). In the new design, the canvas component handles click → emits an event → routes it to the right tool. Resources don't know about UI.

Specifically, drop these from the base class:
- `describe()`, `edit()`, `onClick()`, `onDblClick()` — these are UI concerns; they move to the canvas component / a `GraphInteractionService` in Stage 3.

### `class Node`, `class Property`, `class Literal`

Same fields as legacy. Notes:
- `Node.delete()`: cascade through edges where `edge.target === this`, then through edges sourced from this node's properties, then unregister URIs from `uriToNode`. The legacy code also deletes the source property if it has no other targets — preserve this.
- `Property.delete()`: re-index siblings. Preserve.
- Geometry methods (`getWidth/getHeight/getX/getY/getOffsetY/getColor/getPath`) — **port them but mark as `@deprecated`** with a comment that cytoscape (Stage 3) handles layout. They're retained for backward-compat in case any test uses them.
- `loadPreview` methods are Wikidata-specific. Move them onto `WikidataAdapter.loadNodePreview(node, query, cfg)` etc. The base class exposes `runPreview()` which delegates to whichever adapter is registered with `PropertyGraph`.

### `class Edge`

Trivial. `source: Property; target: Node;` plus `contains(resource): boolean`.

### `class Query`

The complex one. Translation notes:
- `update(seed: RDFResource)`: BFS over `graph.edges` to gather triples. Preserve dedup-by-identity.
- `toSparql(): string`: rebuild the legacy `Query.get()` output exactly. Includes:
  - `SELECT DISTINCT` with `select.filter(r => !r.hide).map(r => r.variable)`.
  - Each triple, with values literals rendered as `"..."`, IRIs rendered via `toCurie()` (else `<...>`), multi-URI properties rendered as `(a|b|c)*` (if `star`).
  - For each variable in each triple, append its filter serializations.
  - For triples where predicate AND object are both variables, append `FILTER isIRI(...)` or `FILTER isLiteral(...)` based on whether object is a Literal.
  - `OPTIONAL { ... }` blocks with same treatment.
  - `VALUES ?v { ... }` blocks for multi-URI constants.
  - `LIMIT` / `OFFSET` if set.
  - `PREFIX` header for every prefix actually used (collected during serialization).
- `createTripleLabel(resource)`, `addLabel`, `addOptLabel`, `addLabels`, `selectAll` — same semantics.
- `retrieve(opts: { canceller?: AbortSignal })`: calls `RequestService.execQuery`. On success, partitions results into per-variable result arrays (dedup by `value`). On no results, clears all variables' results.

**Rename `q` and `get`:** the legacy uses `this.q` to cache and `Query.get()` to serialize. Use `toSparql()` and an internal cache.

### `class PropertyGraph` (the aggregate)

```ts
class PropertyGraph {
  readonly nodes: Node[];
  readonly edges: Edge[];
  selected: RDFResource | null;
  // ID + alias state owned per-instance:
  readonly ids: IdAllocator;
  readonly usedAliases: Set<string>;
  readonly uriToNode: Map<string, Node>;
  // Filter catalog (legacy `filters` object — used for UI metadata in Stage 4):
  readonly filterCatalog: Record<FilterType, FilterMetadata>;
  // Color palette (also used by Stage 3):
  readonly colors: { rConst, rVar, pConst, pVar, pLit };
  // Adapter for endpoint-specific behavior:
  endpointAdapter: DomainEndpointAdapter;

  addNode(): Node;
  addEdge(source: Node | Property, target: Node): Edge | null;
  getNodeByUri(uri: string): Node | null;
  setSelected(r: RDFResource | null): void;
  applyDrop(payload: DropPayload, at: { x: number; y: number }): void;
  reset(): void;
  getQueriesForGraph(): { queries: Query[]; emptyVars: RDFResource[] };  // for SPARQL panel
}
```

### `DropPayload` — the typed contract

The legacy `onDrop` reads strings from `event.dataTransfer`. In the port, the canvas component parses DataTransfer into a typed union and passes it in:

```ts
export type DropPayload =
  | { kind: 'uri';      uri: string;                                       }
  | { kind: 'uri+prop'; uri: string; prop: string;                          }
  | { kind: 'prop';     prop: string;                                       }
  | { kind: 'literal';  prop: string;                                       }
  | { kind: 'search';   uri: string; alias: string;                         }
  | { kind: 'example';  exampleType: 'cats' | 'w3c' | 'mosquito' | 'cancer' };
```

`PropertyGraph.applyDrop(payload, at)` switches on `payload.kind` and applies the corresponding mutations. The canned examples live in `domain/examples/canned-examples.ts` as builders that take the graph + position.

### Angular wrapper: `PropertyGraphService`

```ts
@Injectable({ providedIn: 'root' })
export class PropertyGraphService {
  private readonly settings = inject(SettingsService);
  private readonly request  = inject(RequestService);
  private readonly log      = inject(LogService);

  private readonly graphRef = signal<PropertyGraph>(new PropertyGraph(/* deps */));
  readonly nodes    = computed(() => this.graphRef().nodes);
  readonly edges    = computed(() => this.graphRef().edges);
  readonly selected = computed(() => this.graphRef().selected);

  // Public API mirrors PropertyGraph but bumps the signal so the canvas re-renders.
  addNode(): Node;
  addEdge(s: Node | Property, t: Node): Edge | null;
  applyDrop(payload: DropPayload, at: { x: number; y: number }): void;
  setSelected(r: RDFResource | null): void;
  reset(): void;
  getQueriesForGraph(): { queries: Query[]; emptyVars: RDFResource[] };
}
```

**Important about signals + class instances:** the graph holds mutable arrays. To make the canvas reactive without deep diffing, the service should bump a `revision = signal(0)` after each mutation and the canvas should watch `revision` as the trigger. Document this pattern in the service's class comment.

## Step-by-step plan

1. Create `app/src/app/graph/domain/` skeleton with empty files.
2. Implement `id-allocator.ts` + tests.
3. Implement `variable.ts` + `filter.ts` + tests (alias collision, serialize per type).
4. Implement `rdf-resource.ts` + `node.ts` + `property.ts` + `literal.ts` + `edge.ts` + tests (graph mutations: add/remove/cascade/reindex).
5. Implement `endpoint/adapter.ts` interface + `wikidata-adapter.ts` + `generic-adapter.ts`. Tests for the SPARQL preview fragments each adapter emits.
6. Implement `query.ts` + golden-file tests (next step generates the fixtures).
7. **Generate golden SPARQL fixtures.** Run the legacy app, build each canned example (cats/w3c/mosquito/cancer), click the SPARQL tool, copy the generated query verbatim into `domain/__tests__/fixtures/<name>.sparql`. The new `query.ts` must produce string-equal output. If the user can't run the legacy site, capture from the live demo at https://rdfexplorer.org.
8. Implement `examples/canned-examples.ts` mirroring `createExample` in legacy (lines 715–788 of `property-graph.js`).
9. Implement `graph.ts` (`PropertyGraph` aggregate) including `applyDrop`.
10. Implement `property-graph.service.ts` (Angular wrapper) + its spec.
11. Run `ng test` — all green.
12. `ng build` — clean.

## What NOT to do

- Do **not** import Angular from any file under `domain/`. The wrapper service is the only Angular-aware file.
- Do **not** access `document` or `event.dataTransfer` from the domain. The canvas (Stage 3) parses DataTransfer; the domain receives a typed `DropPayload`.
- Do **not** keep the reverse-injection pattern (`propertyGraph.describe`, `.edit`, `.getQueries`). The canvas owns interaction routing in Stage 3.
- Do **not** preserve the `String.prototype` lookups in `Query.get` — use `toCurie()` from Stage 1.
- Do **not** lift the `wikibase:directClaim` hardcoded URI into the base classes. It belongs in `WikidataAdapter`.
- Do **not** delete or rename `var0`/`prop0`/`0` ID schemes — golden SPARQL fixtures will fail.
- Do **not** dedupe edges silently (legacy `// FIXME: duplicate edges`). Preserve current behavior + flag with TODO.
- Do **not** add NgRx or RxJS state. Signals + the revision-bump pattern.

## Acceptance criteria

- [ ] `app/src/app/graph/domain/**` has zero `from '@angular/...'` imports.
- [ ] `cd app && ng test` runs every spec in this stage. All green.
- [ ] Golden-file tests for the 4 canned examples exist and pass with string-equal comparisons against the legacy output.
- [ ] `PropertyGraphService.applyDrop` is the only public entry point for drag-drop logic — verified by grepping the canvas component (Stage 3) for direct calls to `addNode` from a DataTransfer handler. (Note: addNode is still exported for context menus + tests.)
- [ ] No file under `app/src/app/graph/` imports `String.prototype` extensions.
- [ ] All filter types from legacy (`text`, `lang`, `regex`, `leq`, `geq`, `isuri`, `isliteral`) are supported and tested.
- [ ] `PropertyGraphService` exposes signals (`nodes`, `edges`, `selected`) — verified by grep + by a test that asserts a signal-based subscription fires on mutation.

---

## Hand-off prompt for the agent

```
=====================================================================
Project: RDFExplorer — migrating to Angular 17+ standalone + cytoscape.js.
We are at Stage 2 of 6. Stages 0 (bootstrap) and 1 (core services) are
done — there is an Angular project in app/ with SettingsService,
RequestService, QueryService, LogService, and the label/clipboard utils
under app/src/app/core/.

Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-2-property-graph.md  ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md section 7 + cross-cutting #2, #3, #7
  4. /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/services/property-graph.js
     (entire file — this is the biggest port of the migration, 1038 lines)

Your goal is in stage-2-property-graph.md under "## Goal". The class
contracts are in "## Detailed design notes (do not deviate)". Follow the
"## Step-by-step plan". The "## Acceptance criteria" is what proves done.

This stage produces no UI change. You are porting the domain model and
its Angular wrapper. Stage 3 (canvas) consumes it.

Hard constraints (also listed in migration/README.md "Conventions"):
- legacy/ is READ-ONLY.
- TypeScript strict mode on.
- Angular code ONLY in property-graph.service.ts. Everything in
  app/src/app/graph/domain/ must be framework-free TypeScript.
- Signals + a revision-bump pattern for reactivity. No BehaviorSubject,
  no NgRx, no Subject for state.
- Remove the legacy reverse-injection pattern (propertyGraph.describe,
  propertyGraph.edit, propertyGraph.getQueries set by controllers).
  Interaction routing happens in Stage 3 — domain stays clean.
- No String.prototype lookups. Use toCurie() from app/src/app/core/label.util.ts.
- DataTransfer parsing happens in Stage 3, NOT here. The domain receives
  a typed DropPayload union (defined in domain/drop-payload.ts).
- Wikidata-specific behavior (wikibase:directClaim usage in loadPreview,
  the seed labels) goes behind a WikidataAdapter implementing
  DomainEndpointAdapter. A second GenericAdapter exists for DBpedia.

Golden-file tests are non-negotiable. The 4 canned examples (cats, w3c,
mosquito, cancer) must produce string-equal SPARQL to the legacy output.
To capture the fixtures:
  Option A: Run the legacy app locally (`cd legacy && node server.js` on
            port 8081, open localhost:8081), drag each example, click the
            SPARQL tool button, copy each query to
            domain/__tests__/fixtures/<name>.sparql.
  Option B: Visit https://rdfexplorer.org (the live demo).
  Option C: If neither is feasible, read property-graph.js carefully and
            hand-derive the expected output, then SHOW the derivation to
            the user for approval before declaring the goldens authoritative.

Bugs in legacy code you must NOT carry forward:
- EditCtrl.addSearchAsFilter calls p.getLiteral.addFilter (missing parens).
  That method is unused — port the equivalent correctly or omit.
- Variable.setOptions is unused but harmless — port it.
- The "// FIXME: duplicate edges" in addEdge: preserve current behavior
  (no dedup) and add a TODO comment.

Verification:
- Run `cd app && ng test`. All specs pass, including the 4 golden tests.
- Run `cd app && ng build`. Clean compile.
- Run `grep -r "@angular" app/src/app/graph/domain/`. Must return EMPTY.
- Run `grep -r "String.prototype" app/src/app/graph/`. Must return EMPTY.
- Run `grep -r "BehaviorSubject" app/src/app/graph/`. Must return EMPTY.

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface the contradiction to the user.

Do not commit. When done, report:
  - File tree under app/src/app/graph/.
  - Test results (count passing, golden tests listed by name).
  - The grep checks listed above.
  - Anything you flagged as a TODO or behavior you preserved despite
    being a legacy bug.
=====================================================================
```
