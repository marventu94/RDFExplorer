# Stage 1 — Core services (settings, request, query, log)

## Goal

End state of this stage:
- Four Angular 17 services exist in `app/src/app/core/`, each fully typed, signal-based where state is involved, with unit tests:
  1. `SettingsService` — endpoint config, prefixes, language, search class, describe categorization. Persists to `localStorage`. (Replaces `legacy/public/scripts/services/settings.js`.)
  2. `LogService` — append-only signal-backed log, JSON download helper. (Replaces `legacy/public/scripts/services/logs.js`.)
  3. `RequestService` — `fetch`-based SPARQL POST with `AbortController` cancellation, in-memory URI→label cache (signal). **No `String.prototype` extensions.** (Replaces `legacy/public/scripts/services/request.js`.)
  4. `QueryService` — pure functions returning SPARQL query strings. (Replaces `legacy/public/scripts/services/query.js`.)
- Three helper modules (no Angular dependency):
  - `app/src/app/core/label.util.ts` — `labelOf(uri, prefixes, cache)`, `toCurie(uri, prefixes)`.
  - `app/src/app/core/clipboard.util.ts` — `copyToClipboard(text)` via `navigator.clipboard`.
  - `app/src/app/core/endpoint-adapter.ts` — strategy interface keyed off `EndpointType` for SPARQL templating differences (`virtuoso` / `fuseki` / `other`).
- Unit tests in `*.spec.ts` (Jest or Karma — whatever Angular CLI scaffolded) covering:
  - Each `QueryService` function with at least one input → expected SPARQL string (snapshot or string equality).
  - `RequestService.execQuery` aborts when its `AbortController` is cancelled.
  - `RequestService` correctly correlates `?var` / `?varLabel` columns and seeds the label cache (preserve the legacy `onSuccess` behavior).
  - `SettingsService` round-trips through `localStorage`.

After this stage there is **no UI change** — services are wired but unused. Stages 2–4 consume them.

## Prerequisites

- Stage 0 complete.

## Spec sections covered

- [SPECS.md §3 — Settings service](../SPECS.md#3-settings-service--settings-panel) (data only; UI panel is stage 4)
- [SPECS.md §4 — SPARQL query templates](../SPECS.md#4-sparql-query-templates-queryservice)
- [SPECS.md §5 — Request layer](../SPECS.md#5-httpsparql-request-layer-requestservice)
- [SPECS.md §6 — Logging service](../SPECS.md#6-logging-service-logservice) (data only; log view is stage 4)
- Cross-cutting concerns #1 (String.prototype), #6 (endpoint adapter), #7 (Wikidata seed labels).

## Legacy files to consult (read-only)

| Path                                                       | Why |
|------------------------------------------------------------|-----|
| `legacy/public/scripts/services/settings.js`               | The complete object shape — copy `lang`, `labelUri`, `endpoint`, `searchClass`, `resultLimit`, `prefixes` (31 entries), `describe.{exclude,objects,datatype,text,image,external}`. |
| `legacy/public/scripts/services/request.js`                | `execQuery` semantics (POST to `endpoint.url?origin=*` with `format=json` + `query` params), the 100ms `running` throttle, the `?var`/`?varLabel` auto-correlation in `onSuccess`, the seed `label` dictionary (P31, Q146, etc.), and the three `String.prototype` extensions you must **replace, not port**. |
| `legacy/public/scripts/services/query.js`                  | All template strings: `search`, `getClasses`, `getProperties`, `countValuesType`, `getPropUri`, `getPropObject`, `getPropDatatype`. Note the `settings.endpoint.type` switching inside `search`. |
| `legacy/public/scripts/services/logs.js`                   | Trivial — 2 functions and an array. Match exactly. |

## Output paths

```
app/src/app/core/
├── settings.service.ts
├── settings.types.ts                 # interfaces: EndpointConfig, EndpointType, Prefix, DescribeConfig, etc.
├── settings.service.spec.ts
├── log.service.ts
├── log.service.spec.ts
├── request.service.ts
├── request.service.spec.ts
├── query.service.ts                  # Pure functions, no Angular state
├── query.service.spec.ts
├── label.util.ts                     # Replaces String.prototype.getLabel + toPrefix
├── clipboard.util.ts                 # Replaces String.prototype.copyToClipboard
├── endpoint-adapter.ts               # Strategy interface + 'virtuoso' | 'fuseki' | 'other' impls
└── wikidata-seed.ts                  # The hardcoded label seed (P31, Q146, ...) extracted out
```

## Detailed contracts (do not deviate)

### `settings.types.ts`

```ts
export type EndpointType = 'virtuoso' | 'fuseki' | 'other';

export interface EndpointConfig {
  url: string;            // SPARQL endpoint URL
  type: EndpointType;
  label: string;          // human-readable name
}

export interface Prefix {
  prefix: string;         // e.g. 'wd'
  uri: string;            // full URI
}

export interface SearchClass {
  uri:   { type: 'uri';     value: string };
  label: { type: 'literal'; value: string; 'xml:lang'?: string };
}

export interface DescribeConfig {
  exclude:  string[];     // URI denylist
  objects:  string[];     // forced object-property bucket
  datatype: string[];     // forced datatype-property bucket
  text:     string[];     // long-text bucket
  image:    string[];     // image bucket
  external: string[];     // external link bucket
}

export interface AppSettings {
  lang: string;                       // 'en'
  labelUri: string;                   // rdfs:label URI
  endpoint: EndpointConfig;
  searchClass: SearchClass;
  resultLimit: number;
}
```

### `settings.service.ts`

- Holds `AppSettings` as a `signal<AppSettings>()`.
- Holds `prefixes` as `signal<readonly Prefix[]>()` initialized from the 31 legacy entries.
- Holds `describe` as `signal<DescribeConfig>()` initialized from `legacy/public/scripts/services/settings.js` lines 59–85.
- Exposes `reset()` that restores defaults.
- Exposes `update<K extends keyof AppSettings>(key, value)` that also persists to `localStorage` under key `rdfexplorer.settings.v1`. Versioned key so future schema changes don't blow up.
- On construction, hydrates from `localStorage` if present.
- Defaults: same as legacy (Wikidata endpoint, `en`, limit 20, `rdfs:label`, search class = `dbo:Person`).

### `query.service.ts`

Pure functions. The `EndpointAdapter` is passed as a function arg, **not** injected, so this stays testable:

```ts
export const querySearch =
  (keyword: string, opts: { type?: string; limit?: number; offset?: number;
                            endpointType: EndpointType }) => string;

export const queryGetClasses    = (uri: string, opts?: { limit?: number; offset?: number }) => string;
export const queryGetProperties = (uri: string) => string;     // Wikidata-flavored (uses wikibase:directClaim)
export const queryCountValuesType = (uri: string, prop: string) => string;
export const queryGetPropUri     = (uri: string, prop: string) => string;
export const queryGetPropObject  = (uri: string, prop: string) => string;
export const queryGetPropDatatype = (uri: string, prop: string) => string;
```

**Mandatory:** escape `keyword` before string interpolation — at minimum reject `"` and `\` or escape with backslash. The legacy code does no escaping; this is a SPARQL injection issue you must fix while migrating. Add a unit test for the escaping.

### `endpoint-adapter.ts`

```ts
export interface EndpointAdapter {
  textSearchTriple(label: string, keyword: string, limit: number): string;
}
// Three impls: VirtuosoAdapter (bif:contains), FusekiAdapter (text:query), GenericAdapter (FILTER regex).
// Selection by EndpointType.
```

`querySearch` uses the adapter rather than an inline switch.

### `request.service.ts`

```ts
@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly settings = inject(SettingsService);
  readonly labelCache = signal<ReadonlyMap<string, string>>(new Map(WIKIDATA_SEED));

  // Executes a SPARQL query. Returns a Promise so callers can await + AbortController.
  async execQuery<T = SparqlJsonResult>(
    query: string,
    opts?: { signal?: AbortSignal }
  ): Promise<T>;

  getLabel(uri: string): string | undefined;     // direct cache hit only
  setLabel(uri: string, label: string): void;
}
```

`execQuery` must:
- POST to `endpoint.url + '?origin=*'` with body `format=json&query=<encoded>` (or as URL-encoded form — match what legacy does: query goes as URL params on the POST URL, body is empty). Replicate exact wire shape.
- Parse JSON SPARQL response (typed: `{ head: { vars: string[] }, results: { bindings: Array<Record<string, {type, value, 'xml:lang'?, datatype?}>> } }`).
- After success, **auto-correlate** `?var` / `?varLabel` columns (legacy lines 39–64 of `request.js`): for every variable whose `<var>Label` companion exists and is a literal, write `bindings[i][var].value → bindings[i][varLabel].value` into the label cache. Preserve this.
- Throw on abort. Caller is responsible for soft-failing.
- **Do not** re-implement the 100ms `$timeout` throttle. It was a workaround for `$http`'s lack of cancellation, which we no longer need. Document the removal in a code comment.

### `label.util.ts`

```ts
export function toCurie(uri: string, prefixes: readonly Prefix[]): [string, Prefix | null];
export function labelOf(
  uri: string,
  prefixes: readonly Prefix[],
  cache: ReadonlyMap<string, string>
): string;
```

`labelOf` returns the cached label OR the curie OR the original URI (legacy semantics). Note the legacy comment `//FIXME result cant have '/'` — surface this to the user; the existing behavior just returns the URI as-is when no prefix matches, which is acceptable.

### `clipboard.util.ts`

```ts
export async function copyToClipboard(text: string): Promise<void>;
// Uses navigator.clipboard.writeText. Falls back to nothing (no execCommand) — modern browsers only.
```

### `log.service.ts`

```ts
@Injectable({ providedIn: 'root' })
export class LogService {
  readonly entries = signal<readonly LogEntry[]>([]);
  add(info: string): void;          // appends { date: new Date(), info }
  download(): void;                 // triggers JSON download via Blob URL — no execCommand
  clear(): void;                    // not in legacy, but worth having
}
export interface LogEntry { readonly date: Date; readonly info: string; }
```

### `wikidata-seed.ts`

Export the 18 hardcoded URI→label pairs from `legacy/public/scripts/services/request.js` lines 5–24 as a `readonly Map`. No logic.

## Step-by-step plan

1. Create the directory `app/src/app/core/` and the files listed above (empty stubs first).
2. Implement `settings.types.ts` (types only — no logic).
3. Implement `wikidata-seed.ts` (copy the dictionary).
4. Implement `label.util.ts` and `clipboard.util.ts` with unit tests. **Tests must not import Angular.**
5. Implement `endpoint-adapter.ts` with three classes + a factory. Unit test the SPARQL fragment shape for each.
6. Implement `query.service.ts` as exported pure functions. Unit test each function against fixed inputs → expected strings. Include a SPARQL injection test (input `'"; DROP'` must be escaped/rejected).
7. Implement `log.service.ts` + tests (signal mutations, download produces a Blob).
8. Implement `settings.service.ts` + tests (hydrate, persist, reset).
9. Implement `request.service.ts` + tests (use `fetch` mock; verify abort, verify label correlation in `onSuccess`).
10. Run `ng test` (or `npm test` in `app/`). All green.
11. Verify no service is referenced from a component yet — they are wired in via `@Injectable({ providedIn: 'root' })` and exist for future stages.
12. Run `ng build` — clean.

## What NOT to do

- Do **not** monkey-patch `String.prototype`. The legacy `getLabel/toPrefix/copyToClipboard` extensions exist on every string at runtime — replace with the helper functions above. (Cross-cutting concern #1.)
- Do **not** import these services from any component yet. Wiring happens in stage 4.
- Do **not** add HTTP interceptors, retry logic, or progress bars. The legacy throttle was a workaround for a different limitation.
- Do **not** introduce `HttpClient` for the SPARQL call. Use `fetch` directly — the legacy `$http` config is non-standard (POST with params in URL, empty body) and `fetch` is the cleanest way to replicate it.
- Do **not** use `BehaviorSubject` for `labelCache` or settings. Signals only.
- Do **not** copy the `bif:contains` text-search code into `query.service.ts` inline. It goes through the endpoint adapter so DBpedia / Fuseki / Virtuoso variants are switchable.
- Do **not** drop the Wikidata seed labels — they're used during stage 4 to display common URIs before any query has loaded them.

## Acceptance criteria

- [ ] `cd app && ng test` runs and all tests pass. Tests exist for all four services + both util modules + the endpoint adapter.
- [ ] `cd app && ng build` exits clean with no errors or warnings.
- [ ] `app/src/app/core/` matches the file list above.
- [ ] None of the new code uses `String.prototype.*` extensions or `document.execCommand`.
- [ ] None of the new code uses `BehaviorSubject` for app state. Run `grep -r "BehaviorSubject" app/src/` and confirm empty (other than RxJS imports the framework already has).
- [ ] `RequestService.execQuery` calls `fetch` with `AbortSignal` support — verified by a test that aborts mid-flight.
- [ ] `QueryService.querySearch` escapes (or rejects) double-quotes / backslashes in the keyword input — verified by a test with input `'evil"; DROP'`.
- [ ] `SettingsService` round-trips through `localStorage`: set a value, instantiate a new service in a test, the value is restored.
- [ ] `WIKIDATA_SEED` map has 18 entries matching the legacy dictionary.

---

## Hand-off prompt for the agent

```
=====================================================================
Project: RDFExplorer — migrating to Angular 17+ standalone + cytoscape.js.
We are at Stage 1 of 6. Stage 0 is already done — there is an Angular 17
project in app/ with a layout shell, and the original code is read-only
in legacy/.

Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-1-services.md  ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md sections 3, 4, 5, 6
     + cross-cutting concerns #1, #6, #7

Your goal is in stage-1-services.md under "## Goal". Follow the
"## Step-by-step plan" in order. The "## Acceptance criteria" is what
proves you're done — verify every checkbox.

This stage produces no UI change. You are writing 4 services + 2 util
modules + 1 endpoint adapter + 1 seed file + tests. Stages 2–4 consume them.

Hard constraints (also listed in migration/README.md "Conventions"):
- legacy/ is READ-ONLY. Do not modify any file in legacy/.
- TypeScript strict mode on. Do not loosen it.
- Signals for state (settings, label cache, log entries). No BehaviorSubject.
- inject() over constructor DI is preferred.
- DO NOT add String.prototype extensions. The legacy code monkey-patches
  String.prototype.getLabel / toPrefix / copyToClipboard. Replace with
  exported helper functions (see "## Detailed contracts" in the stage doc).
- DO NOT import these services from any component in this stage. They
  exist root-provided for future stages to consume.
- Use native fetch + AbortController. Not HttpClient.
- Endpoint-type-specific SPARQL (virtuoso bif:contains vs fuseki text:query
  vs generic FILTER regex) goes through the EndpointAdapter strategy —
  do not put inline switches in QueryService.

Detailed type contracts are in the stage doc under "## Detailed contracts
(do not deviate)". Match those signatures exactly so stages 2–4 can build
on them without surprise.

Verification:
- Run `cd app && ng test` and confirm all new specs pass.
- Run `cd app && ng build` and confirm clean compile.
- Run `grep -r "String.prototype" app/src/` — must return empty.
- Run `grep -r "BehaviorSubject" app/src/` — must return empty.

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface the contradiction to the user — do not silently
pick one. Specific known issues already flagged in SPECS:
- SPARQL injection in querySearch (legacy doesn't escape) — fix it.
- request.js label correlation logic must be preserved verbatim.
- The 100ms request throttle must NOT be reimplemented (legacy hack for
  $http; fetch+AbortController doesn't need it).

Do not commit. When done, report:
  - Files created (output of `ls app/src/app/core/`).
  - Test results (number passing, none failing).
  - The grep checks confirming no String.prototype / BehaviorSubject leakage.
  - Any contradictions you hit and how you resolved them.
=====================================================================
```
