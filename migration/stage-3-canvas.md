# Stage 3 — Visual canvas with cytoscape.js

## Goal

End state of this stage:
- A standalone `<canvas-graph>` component under `app/src/app/graph/canvas-graph/` that renders the property graph using **cytoscape.js**. The component subscribes to `PropertyGraphService` signals and reconciles its internal cytoscape collection on every change.
- All canvas interactions from the legacy app work:
  - Pan / zoom (built-in cytoscape).
  - Shift-click on empty canvas → new variable node at click coords.
  - Shift-drag from a node to another node → new edge (uses `cytoscape-edgehandles`).
  - Click node / property / literal → set `selected` via `PropertyGraphService.setSelected`.
  - Right-click → context menu (uses `cytoscape-context-menus`), with different items per resource type.
  - Delete / Backspace → remove selected node + cascade edges, or selected edge.
  - Drag drop from DOM-external sources (search results, describe panel, help examples) → the canvas parses `DataTransfer`, builds a typed `DropPayload`, and calls `PropertyGraphService.applyDrop(payload, at)`.
- Custom styling that matches the legacy color palette:
  - Resource (Node) constant: `#1f77b4` (blue)
  - Resource variable: `#2ca02c` (green)
  - Property constant: `#ff7f0e` (orange)
  - Property variable: `#d62728` (red)
  - Property literal: `#9467bd` (purple)
- Visual structure: each `Node` is a cytoscape compound node containing one child node per `Property`. Each `Property` that has a `Literal` carries a second child for the literal (or renders the literal inline — your call; document it in the component's class comment). Edges in cytoscape go from a Property (source) to another Node (target), mirroring the legacy `Edge { source: Property, target: Node }`.
- The canvas component does **not** know about tool panels. It emits an event (or sets a signal in a dedicated `GraphInteractionService`) when a resource is clicked; Stage 4 wires that to the right tool.

After this stage, the user can drag, drop, edit-by-context-menu, and reposition the graph visually. **Tool panels still don't work** — clicking a node won't open describe or edit; those come in Stage 4.

## Prerequisites

- Stage 0 (Angular shell + canvas-panel placeholder exists).
- Stage 1 (services available).
- Stage 2 (`PropertyGraphService`, `DropPayload`, the domain model are in place).

## Spec sections covered

- [SPECS.md §8 — Visual query builder directive](../SPECS.md#8-visual-query-builder-directive-d3-svg-canvas)
- [SPECS.md §17 — Styles](../SPECS.md#17-styles) (graph-specific portion)
- Cross-cutting #2 (dataTransfer protocol) — the canvas is the one place where DataTransfer is parsed.

## Legacy files to consult (read-only)

| Path                                                       | What to focus on |
|------------------------------------------------------------|------------------|
| `legacy/public/scripts/directives/visual-query-builder.js` | Entire file. Lines 36–156 (init + state), 184–402 (interaction handlers), 404–620 (`updateGraph` — D3 enter/update/exit; replaced by cytoscape's automatic reconciliation), 622–802 (custom context menus — replaced by `cytoscape-context-menus`). |
| `legacy/public/scripts/services/property-graph.js`         | Lines 619–712 (`onDrop`, `onDragOver`) — the DataTransfer parsing logic. **Reimplement this in the canvas component**, calling `applyDrop` on the service. |
| `legacy/public/styles/graph.css`                           | Colors, hover states, selected highlight (the `#highlight` SVG filter). Cytoscape uses its own style system — translate to cytoscape selectors. |
| `legacy/public/views/index.pug`                            | The `<visual-query-builder>` host element + adjacent shift-hint footer. |

## Output paths

```
app/src/app/graph/
├── canvas-graph/
│   ├── canvas-graph.component.ts
│   ├── canvas-graph.component.html      # mostly just <div #cy></div>
│   ├── canvas-graph.component.scss
│   ├── canvas-graph.styles.ts           # cytoscape style array (typed)
│   ├── canvas-graph.context-menus.ts    # node/property/literal/canvas menu definitions
│   ├── canvas-graph.drop.ts             # DataTransfer → DropPayload parser
│   ├── canvas-graph.component.spec.ts
│   └── interaction.service.ts           # signal-based bus: clickedResource$, requestedTool$
└── ... (existing files from stages 1+2)
```

## Dependencies to install

In `app/`:

```
npm install cytoscape cytoscape-edgehandles cytoscape-context-menus
npm install --save-dev @types/cytoscape
```

If types for the two plugins are missing, declare them in `app/src/types/cytoscape-plugins.d.ts` with `declare module ... { const x: cytoscape.Ext; export default x; }`.

## Detailed design notes

### Component structure

```ts
@Component({
  selector: 'canvas-graph',
  standalone: true,
  imports: [],
  templateUrl: './canvas-graph.component.html',
  styleUrls: ['./canvas-graph.component.scss'],
})
export class CanvasGraphComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly graph = inject(PropertyGraphService);
  private readonly interaction = inject(GraphInteractionService);

  private cy!: cytoscape.Core;

  ngOnInit(): void {
    this.cy = cytoscape({
      container: this.host.nativeElement.querySelector('#cy'),
      elements: this.computeElements(),
      style: CYTOSCAPE_STYLES,
      layout: { name: 'preset' },     // resources carry x/y from the domain
      wheelSensitivity: 0.2,
    });
    this.installPlugins();
    this.installInteractions();
    this.subscribeToGraphChanges();
  }
  // ...
}
```

### Element conversion (domain → cytoscape)

Translate the domain `PropertyGraph` into a cytoscape elements array on each revision change. Resource → cytoscape node, Property → child node (parent points to the owning Node), Literal → child node of the Property, Edge → cytoscape edge from Property to target Node.

Use stable IDs:
- Node: `n${node.id}`
- Property: `p${property.id}` (parent: `n${property.parentNode.id}`)
- Literal: `l${literal.parent.id}` (parent: `p${property.id}`)
- Edge: `e${source.id}-${target.id}`

Data fields each carries: `kind: 'node' | 'property' | 'literal' | 'edge'`, `color`, `label` (= `resource.getRepr()` or fallback "No values set!"), and optionally `domain` ref for click handlers.

**Reactivity:** in `ngOnInit`, set up an `effect()` that watches `graph.nodes()`, `graph.edges()`, and a `revision()` signal you may add in Stage 2. On change, diff the current cytoscape collection against the recomputed `elements` array using `cy.batch(() => { ... add/remove/update ... })`. **Don't `cy.elements().remove()` + re-add everything** — that loses pan/zoom state and animation.

### Drop handler (cross-cutting concern #2)

The legacy `dataTransfer` keys are: `uri`, `prop`, `special`, `alias`, `type`. Parse them in `canvas-graph.drop.ts`:

```ts
export function parseDropPayload(dt: DataTransfer): DropPayload | null {
  const uri     = dt.getData('uri');
  const prop    = dt.getData('prop');
  const special = dt.getData('special');
  const alias   = dt.getData('alias');
  const type    = dt.getData('type');

  if (special === 'example' && type) return { kind: 'example', exampleType: type as any };
  if (special === 'search'  && uri)  return { kind: 'search', uri, alias };
  if (special === 'literal' && prop) return { kind: 'literal', prop };
  if (uri && prop)                   return { kind: 'uri+prop', uri, prop };
  if (prop)                          return { kind: 'prop', prop };
  if (uri)                           return { kind: 'uri', uri };
  return null;
}
```

Wire `dragover` (preventDefault) and `drop` on the cytoscape container. Map screen coords → graph coords via `cy.pan()` and `cy.zoom()`:

```ts
const pan = cy.pan(), zoom = cy.zoom();
const at = { x: (ev.offsetX - pan.x) / zoom, y: (ev.offsetY - pan.y) / zoom };
this.graph.applyDrop(payload, at);
```

### Context menus

Use `cytoscape-context-menus`. Four scopes:

- **Empty canvas** (`selector: 'core'`): "New variable", "New property".
- **Node** (`selector: 'node[kind = "node"]'`): "Describe", "Edit", "New property", "New literal", "Copy URI", "Remove".
- **Property** (`selector: 'node[kind = "property"]'`): "Describe", "Edit", "Copy URI", "Remove".
- **Literal** (`selector: 'node[kind = "literal"]'`): "Edit", "Remove".

For "Describe" / "Edit", route through the `GraphInteractionService` signal so Stage 4's tool panels can react. Don't call any controller method directly — that's the legacy reverse-injection pattern.

```ts
@Injectable({ providedIn: 'root' })
export class GraphInteractionService {
  readonly requestedTool = signal<{ tool: 'describe' | 'edit'; target: RDFResource } | null>(null);
}
```

Stage 4's `ToolService` watches `requestedTool` and opens the matching panel.

### Keyboard shortcuts

- `Delete` / `Backspace` on canvas focus: if a node is selected, `graph.removeNode(node)`; if an edge, `graph.removeEdge(edge)`.
- Implement via `@HostListener('document:keydown', ['$event'])` gated on canvas focus state (avoid hijacking edit inputs in tool panels). Mirror the legacy `state.lastKeyDown` debounce — don't fire on key repeat.

### Shift-click + shift-drag

`cytoscape-edgehandles` provides the shift-drag-to-edge behavior. Configure it to:
- Activate on shift+drag from a node.
- On complete: call `graph.addEdge(sourceNode, targetNode)`.

Shift-click on empty canvas:
```ts
cy.on('tap', (evt) => {
  if (evt.target === cy && evt.originalEvent.shiftKey) {
    const node = this.graph.addNode();
    node.setPosition(evt.position.x, evt.position.y);
    // ...
  }
});
```

### Styles

Translate `legacy/public/styles/graph.css` into a cytoscape style array. Key selectors:

```ts
export const CYTOSCAPE_STYLES: cytoscape.Stylesheet[] = [
  {
    selector: 'node[kind = "node"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#fff',
      'border-width': 2,
      'border-color': 'data(color)',
      'label': 'data(label)',
      'width': 220, 'height': 30,
      // ...
    }
  },
  { selector: 'node[kind = "property"]', style: { /* ... */ } },
  { selector: 'node[kind = "literal"]',  style: { /* ... */ } },
  { selector: 'edge', style: { /* arrows */ } },
  { selector: ':selected', style: { 'overlay-color': '#51cbee', 'overlay-opacity': 0.3 } },
];
```

Match the legacy stroke colors and the `#51cbee` highlight from the SVG filter (now an overlay).

## Step-by-step plan

1. Install dependencies (`cytoscape`, `cytoscape-edgehandles`, `cytoscape-context-menus`, `@types/cytoscape`). Add plugin type shims if needed.
2. Create `canvas-graph/` skeleton + `canvas-graph.component.ts` with cytoscape initialized in `ngOnInit`.
3. Replace the Stage 0 canvas placeholder in `MainComponent` with `<canvas-graph></canvas-graph>`.
4. Implement element conversion (domain → cytoscape) as a pure function in `canvas-graph.styles.ts` or a sibling file. Test it with a small unit test.
5. Wire reactivity: an `effect()` reads `graph.nodes() / edges() / revision()` and diffs into cytoscape via `cy.batch(...)`.
6. Implement styles (`CYTOSCAPE_STYLES`) matching legacy colors.
7. Implement `parseDropPayload` (`canvas-graph.drop.ts`) + unit test it against the 6 payload shapes.
8. Wire `dragover` and `drop` listeners on the cytoscape container, calling `graph.applyDrop(payload, at)`.
9. Wire `cytoscape-edgehandles` for shift-drag → `graph.addEdge`.
10. Wire shift-click on empty canvas → `graph.addNode`.
11. Wire single click on a node/property/literal → `graph.setSelected(domainRef)` + `interaction.requestedTool` if a context menu was used.
12. Wire keyboard delete via `@HostListener`.
13. Wire `cytoscape-context-menus` for the 4 scopes with their items + handlers.
14. Implement `GraphInteractionService` with the `requestedTool` signal.
15. Smoke test in the browser:
    - Open the help panel (placeholder from Stage 0; or temporarily add a fixed `<button>` that calls `graph.applyDrop({ kind: 'example', exampleType: 'cats' }, { x: 200, y: 200 })`).
    - Drag a canned example onto the canvas → 2 nodes + 1 edge appear, styled.
    - Shift-click → new node appears.
    - Shift-drag between two nodes → new edge.
    - Right-click → menu shows; "Remove" deletes.
    - Delete key on selected node → removes it.
16. `ng build` — clean.

## What NOT to do

- Do **not** add tool-panel logic. Clicking a node should at most set selection + push a `requestedTool` signal. Stage 4 owns the panels.
- Do **not** access `propertyGraphService` internals (the `PropertyGraph` instance) directly — go through the service's public methods.
- Do **not** mutate the domain from the canvas without going through `PropertyGraphService` (so the revision signal bumps and other consumers re-render).
- Do **not** reimplement the SVG `#highlight` filter — use cytoscape `:selected` style with an overlay color.
- Do **not** install d3. The legacy directive's D3 v3 code is being replaced wholesale.
- Do **not** delete `legacy/public/scripts/directives/visual-query-builder.js` — it's the reference. Read it.
- Do **not** rebuild the cytoscape graph from scratch on every signal change. Use `cy.batch` + add/remove/update for performance.
- Do **not** suppress the browser context menu on the entire document — only on the cytoscape container, exactly like the legacy did inside the SVG.

## Acceptance criteria

Each item must be verifiable in a running browser:

- [ ] `canvas-graph` renders in the center of the main view.
- [ ] Drag-dropping a temporary "cats" example button onto the canvas creates 2 nodes (`?cat` variable + `house cat` constant) connected by a `P31` property — visible and styled per palette.
- [ ] Shift-click on empty canvas creates a new variable node at click coords.
- [ ] Shift-drag from one node to another creates an edge (via a new property on the source).
- [ ] Right-click on a node shows: Describe, Edit, New property, New literal, Copy URI, Remove. Right-click on a property shows: Describe, Edit, Copy URI, Remove. Right-click on a literal shows: Edit, Remove. Right-click on empty canvas shows: New variable, New property.
- [ ] Delete key on a selected node removes it and cascades edges; on a selected edge removes just the edge.
- [ ] Wheel pans/zooms; shift+wheel does not (or whichever convention you settle on — document it).
- [ ] The canvas does NOT crash if `PropertyGraphService.reset()` is called.
- [ ] Clicking "Describe" or "Edit" from a context menu pushes to `GraphInteractionService.requestedTool`; verified by a unit test on the service.
- [ ] `ng build` clean; `ng serve` no console errors.
- [ ] `grep -r "d3" app/src/` returns empty (D3 is not used).

---

## Hand-off prompt for the agent

```
=====================================================================
Project: RDFExplorer — migrating to Angular 17+ standalone + cytoscape.js.
We are at Stage 3 of 6. Stages 0, 1, 2 are done:
  - Angular 17 shell in app/
  - Core services under app/src/app/core/
  - Domain model + PropertyGraphService under app/src/app/graph/
The legacy code is read-only under legacy/.

Read these files end-to-end before writing code:
  1. /home/mmventurino/Documents/RDFExplorer/migration/README.md
  2. /home/mmventurino/Documents/RDFExplorer/migration/stage-3-canvas.md ← your stage
  3. /home/mmventurino/Documents/RDFExplorer/SPECS.md section 8 + cross-cutting #2
  4. /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/directives/visual-query-builder.js
  5. /home/mmventurino/Documents/RDFExplorer/legacy/public/scripts/services/property-graph.js
     (lines 619–712 specifically — the onDrop logic you are porting into the canvas)
  6. /home/mmventurino/Documents/RDFExplorer/legacy/public/styles/graph.css

Your goal is in stage-3-canvas.md under "## Goal". The component shape
is described in "## Detailed design notes". Follow the "## Step-by-step
plan". The "## Acceptance criteria" is what proves done.

You are replacing the D3 v3 SVG canvas with cytoscape.js. This is a
total rewrite of the visual layer — NOT a port. Reuse legacy CODE only
for the DataTransfer parsing pattern (cross-cutting #2). Reuse legacy
COLORS and INTERACTION CONVENTIONS (shift-click, shift-drag, right-click
context menus, delete key).

Hard constraints (also in migration/README.md):
- legacy/ is READ-ONLY.
- No D3. Run `grep -r "d3" app/src/` after the stage — must be empty.
- Angular 17 standalone components + signals.
- Cytoscape reactivity goes through cy.batch() + diff, NOT full reload
  on every signal change. Preserve pan/zoom state.
- The canvas is the ONLY place that touches DataTransfer. Parse into
  the typed DropPayload defined in Stage 2 (app/src/app/graph/domain/drop-payload.ts).
- Tool routing is via GraphInteractionService (a signal). The canvas
  does not import any tool component. Stage 4 wires the tools.
- Context menus use cytoscape-context-menus (NOT a custom SVG menu).
- All canvas mutations go through PropertyGraphService — don't mutate
  the domain directly from the component.

Dependencies to install (from app/):
  npm install cytoscape cytoscape-edgehandles cytoscape-context-menus
  npm install --save-dev @types/cytoscape

Add type shims for the two plugins in app/src/types/ if needed.

Verification (mandatory — UI changes require a browser check):
- Run `cd app && ng serve`. Open http://localhost:4200.
- Add a temporary button (you can delete it after) somewhere visible that
  calls graph.applyDrop({ kind: 'example', exampleType: 'cats' }, { x: 200, y: 200 }).
- Walk through every acceptance criterion checkbox in the browser.
- If you cannot launch a browser, say so explicitly and ask the user to verify.

If you hit a contradiction between SPECS.md and the legacy code, the
legacy code wins. Surface the contradiction.

Do not commit. When done, report:
  - The file tree under app/src/app/graph/canvas-graph/.
  - Each acceptance checkbox — confirmed or blocked, with how you verified.
  - The deps you installed (output of `npm list cytoscape cytoscape-edgehandles cytoscape-context-menus`).
  - Any visual differences from the legacy app that the user should know about
    (cytoscape's default node shapes/styles can diverge from the SVG version).
=====================================================================
```
