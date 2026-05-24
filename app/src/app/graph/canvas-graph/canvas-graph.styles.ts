import cytoscape from 'cytoscape';

export const CHILD_HEIGHT = 20;
export const CHILD_PADDING = 10;
export const NODE_BASE_HEIGHT = 30;
export const NODE_WIDTH = 220;
export const PROP_WIDTH = 200;

export const CYTOSCAPE_STYLES: cytoscape.StylesheetCSS[] = [
  {
    selector: 'node[kind = "node"]',
    css: {
      'shape': 'round-rectangle',
      'background-color': '#f8f8f8',
      'background-opacity': 1,
      'border-width': 2,
      'border-color': 'data(color)',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '14px',
      'font-weight': 'bold',
      'color': '#333',
      'width': NODE_WIDTH,
      'height': 'data(compoundHeight)',
      'padding': '5px',
      'text-wrap': 'ellipsis',
      'text-max-width': `${NODE_WIDTH - 20}px`,
      'compound-sizing-wrt-labels': 'exclude',
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "node"]:selected',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.3,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "node"]:active',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.2,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "property"]',
    css: {
      'shape': 'round-rectangle',
      'background-color': '#f3f3f3',
      'background-opacity': 1,
      'border-width': 1,
      'border-color': 'data(color)',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'color': '#333',
      'width': PROP_WIDTH,
      'height': CHILD_HEIGHT,
      'text-wrap': 'ellipsis',
      'text-max-width': `${PROP_WIDTH - 10}px`,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "property"]:selected',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.3,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "property"]:active',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.2,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "literal"]',
    css: {
      'shape': 'round-rectangle',
      'background-color': '#f0f0f0',
      'background-opacity': 1,
      'border-width': 1,
      'border-color': '#9467bd',
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'color': '#333',
      'width': PROP_WIDTH,
      'height': CHILD_HEIGHT,
      'text-wrap': 'ellipsis',
      'text-max-width': `${PROP_WIDTH - 10}px`,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "literal"]:selected',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.3,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[kind = "literal"]:active',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.2,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'edge',
    css: {
      'width': 3,
      'line-color': '#333',
      'target-arrow-color': '#333',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
    } as cytoscape.Css.Edge,
  },
  {
    selector: 'edge:selected',
    css: {
      'overlay-color': '#51cbee',
      'overlay-opacity': 0.3,
      'width': 4,
    } as cytoscape.Css.Edge,
  },
  {
    selector: ':parent',
    css: {
      'border-opacity': 1,
    } as cytoscape.Css.Node,
  },
];
