import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Plus, Minus, Maximize, ArrowUpRight, Activity, MousePointerClick } from 'lucide-react';

const TIER_COLORS = {
  0: '#2563EB', // Blue 600
  1: '#8B5CF6', // Violet 500
  2: '#10B981', // Emerald 500
  3: '#F59E0B', // Amber 500
  4: '#EC4899', // Pink 500
};

const DEFAULT_COLOR = '#94A3B8'; // Slate 400

// ─── Tier-based node sizing ───
const TIER_SIZE = { 0: 64, 1: 48, 2: 38, 3: 30, 4: 24 };
const TIER_FONT = { 0: '14px', 1: '11px', 2: '10px', 3: '9px', 4: '8px' };

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}

export default function GraphView({ graphData, onNodeClick, onExpandNode, expandingNode, selectedNode, highlightCompany, showControls = true }) {
  const containerRef = useRef(null);
  const cyRef        = useRef(null);
  const [tooltip,    setTooltip] = useState(null);
  const [expandHint, setExpandHint] = useState(null); // show "double-click to expand" hint
  const lastTapRef = useRef({ id: null, at: 0 });
  const lastExpandRef = useRef({ id: null, at: 0 });

  // Keep callback refs up to date
  const onExpandRef = useRef(onExpandNode);
  useEffect(() => { onExpandRef.current = onExpandNode; }, [onExpandNode]);

  const getActiveCy = useCallback(() => {
    const cy = cyRef.current;
    return cy && !cy.destroyed() ? cy : null;
  }, []);

  const build = useCallback(() => {
    if (!containerRef.current || !graphData?.nodes?.length) return;
    const existing = cyRef.current;
    if (existing && !existing.destroyed()) {
      existing.stop();
      existing.removeAllListeners();
      cyRef.current = null;
      existing.destroy();
    }

    const qs   = (graphData.edges || []).map(e => e.quantity || e.tradeValue || 1);
    const minQ = qs.length > 0 ? Math.min(...qs) : 1;
    const maxQ = qs.length > 0 ? Math.max(...qs) : 1;
    const wt   = q => (maxQ === minQ || isNaN(maxQ)) ? 2.5 : 2 + ((q - minQ) / (maxQ - minQ)) * 6;

    const elements = [
      ...graphData.nodes.map(n => ({
        data: {
          id:          n.id,
          label:       n.label,
          country:     n.country,
          tier:        n.tier || 0,
          tradeVolume: n.tradeVolume,
          color:       TIER_COLORS[n.tier] || DEFAULT_COLOR,
          isRoot:      n.id === highlightCompany,
          nodeSize:    TIER_SIZE[n.tier] || 28,
          fontSize:    TIER_FONT[n.tier] || '8px',
        },
      })),
      ...graphData.edges.map((e, i) => ({
        data: {
          id:      `e${i}`,
          source:  e.source,
          target:  e.target,
          hsn:     e.hsn,
          quantity:e.quantity || e.tradeValue,
          product: e.product,
          w:       wt(e.quantity || e.tradeValue || 1),
          ec:      TIER_COLORS[graphData.nodes.find(node => node.id === e.source)?.tier] || DEFAULT_COLOR,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      autoungrabify: false,
      autolock: false,
      panningEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      boxSelectionEnabled: false,
      pixelRatio: 'auto', // Force retina-ready canvas
      wheelSensitivity: 0.2, // Smooth zooming
      style: [
        {
          selector: 'node',
          style: {
            'background-color':   '#ffffff',
            'background-opacity': 1,
            label:                'data(label)',
            color:                '#1E293B',
            'font-size':          'data(fontSize)',
            'font-family':        'Inter, sans-serif',
            'font-weight':        800,
            'text-halign':        'center',
            'text-valign':        'bottom',
            'text-margin-y':      8,
            'text-outline-color': '#ffffff',
            'text-outline-width': 4,
            width:                'data(nodeSize)',
            height:               'data(nodeSize)',
            'border-width':       4,
            'border-color':       'data(color)',
            'border-opacity':     1,
            'transition-property':'background-color, width, height, border-width, border-color',
            'transition-duration':'250ms',
            'overlay-opacity':    0,
          },
        },
        {
          selector: 'node[?isRoot]',
          style: {
            width:  64, height: 64,
            'font-size': '14px',
            'font-weight': 900,
            'background-color': 'data(color)',
            'border-color': '#ffffff',
            'border-width': 5,
            color: '#0F172A',
          },
        },
        { selector: 'node.hover',
          style: { 'background-color': 'data(color)', 'border-color': '#ffffff', width: 56, height: 56 } },
        { selector: 'node.selected-node',
          style: { 'background-color': 'data(color)', 'border-color': '#1E293B', 'border-width': 5, width: 60, height: 60 } },
        { selector: 'node.expanding',
          style: { 'border-style': 'dashed', 'border-color': '#F59E0B', width: 60, height: 60 } },
        { selector: 'node.dimmed',
          style: { 'background-opacity': 0.2, 'text-opacity': 0.2, 'border-opacity': 0.2, 'shadow-opacity': 0 } },
        {
          selector: 'edge',
          style: {
            width:               'data(w)',
            'line-color':        'data(ec)',
            'line-opacity':      .12,
            'target-arrow-color':'data(ec)',
            'target-arrow-shape':'triangle',
            'arrow-scale':       .7,
            'curve-style':       'bezier',
            'overlay-opacity':   0,
            'transition-property':'line-opacity, width',
            'transition-duration':'250ms',
          },
        },
        { selector: 'edge.hover',
          style: {
            'line-opacity': .8,
            width: 5,
            label: 'data(product)',
            color: '#1E293B',
            'font-size': '9px',
            'font-weight': 800,
            'font-family': 'Inter, sans-serif',
            'text-outline-color': '#fff', 'text-outline-width': 3,
            'text-rotation': 'autorotate',
          },
        },
        { selector: 'edge.connected', style: { 'line-opacity': .5, width: 4 } },
        { selector: 'edge.dimmed',    style: { 'line-opacity': .02 } },
      ],
      layout: {
        name: 'cose', animate: false,
        nodeRepulsion: () => 12000, idealEdgeLength: () => 150,
        edgeElasticity: () => 100, gravity: 0.15, numIter: 1000, padding: 60,
        nodeDimensionsIncludeLabels: true,
      },
      minZoom: .15, maxZoom: 4,
    });

    // Ensure nodes can be moved by drag in both max and mini graph views.
    cy.nodes().grabify();
    cy.nodes().forEach((n) => n.grabbable(true));
    cy.elements().unlock();
    cy.autolock(false);

    // ─── Single click: select node AND expand (recursive trace) ───
    cy.on('tap', 'node', evt => {
      const n = evt.target;
      const nodeId = n.data('id');
      const now = Date.now();
      const nodeData = { id: nodeId, name: nodeId, country: n.data('country'), tier: n.data('tier'), tradeVolume: n.data('tradeVolume') };

      onNodeClick?.(nodeData);

      const expandCooldown = lastExpandRef.current.id === nodeId && (now - lastExpandRef.current.at) < 500;
      if (!expandCooldown && onExpandRef.current) {
        onExpandRef.current(nodeData);
        lastExpandRef.current = { id: nodeId, at: now };
      }

      lastTapRef.current = { id: nodeId, at: now };
    });

    cy.on('mouseover', 'node', evt => {
      if (cy.destroyed()) return;
      evt.target.addClass('hover');
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
      const hood = evt.target.closedNeighborhood();
      cy.elements().not(hood).addClass('dimmed');
      evt.target.connectedEdges().addClass('connected');
      // Tooltip is now handled separately by the DetailsPanel in App.jsx
      // No need for a "double click" hint anymore since single tap expands.
    });
    cy.on('mouseout', 'node', evt => {
      if (cy.destroyed()) return;
      evt.target.removeClass('hover');
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      cy.elements().removeClass('connected dimmed');
      setExpandHint(null);
    });
    cy.on('mouseover', 'edge', evt => {
      if (cy.destroyed()) return;
      const e = evt.target; e.addClass('hover');
      if (containerRef.current) containerRef.current.style.cursor = 'pointer';
      const p = evt.renderedPosition;
      setTooltip({ x: p.x, y: p.y, hsn: e.data('hsn'), quantity: e.data('quantity'), product: e.data('product'), source: e.data('source'), target: e.data('target') });
    });
    cy.on('mouseout', 'edge', evt => {
      if (cy.destroyed()) return;
      evt.target.removeClass('hover');
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      setTooltip(null);
    });
    cy.on('tap', evt => {
      if (evt.target === cy) { onNodeClick?.(null); cy.elements().removeClass('selected-node'); }
    });

    cyRef.current = cy;
  }, [graphData, onNodeClick, highlightCompany]);

  useEffect(() => {
    build();
    return () => {
      const cy = cyRef.current;
      if (cy && !cy.destroyed()) {
        cy.stop();
        cy.removeAllListeners();
        cy.destroy();
      }
      cyRef.current = null;
    };
  }, [build]);

  // Handle selected node highlight
  useEffect(() => {
    const cy = getActiveCy();
    if (!cy) return;
    cy.elements().removeClass('selected-node');
    if (selectedNode) {
      const el = cy.getElementById(selectedNode);
      if (el.length) el.addClass('selected-node');
    }
  }, [selectedNode, getActiveCy]);

  // Handle expanding node visual indicator
  useEffect(() => {
    const cy = getActiveCy();
    if (!cy) return;
    cy.elements().removeClass('expanding');
    if (expandingNode) {
      const el = cy.getElementById(expandingNode);
      if (el.length) el.addClass('expanding');
    }
  }, [expandingNode, getActiveCy]);

  const fit     = () => getActiveCy()?.animate({ fit: { padding: 50 }, duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  const zoomIn  = () => { const cy = getActiveCy(); if (cy) cy.animate({ zoom: { level: cy.zoom()*1.4, renderedPosition:{x:cy.width()/2,y:cy.height()/2} }, duration:250 }); };
  const zoomOut = () => { const cy = getActiveCy(); if (cy) cy.animate({ zoom: { level: cy.zoom()/1.4, renderedPosition:{x:cy.width()/2,y:cy.height()/2} }, duration:250 }); };

  return (
    <div className="relative h-full overflow-hidden" id="graph-view">
      <div ref={containerRef} className="w-full h-full bg-[#F8FAFC] cursor-grab active:cursor-grabbing touch-none" />



      {/* Enhanced Tooltip */}
      {tooltip && (
        <div className="cy-tooltip min-w-[200px]" style={{ left: tooltip.x + 20, top: tooltip.y - 10 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
               <div className="p-1 rounded bg-blue-50 text-blue-600">
                  <Activity size={10} strokeWidth={3} />
               </div>
               <span className="font-black text-blue-600 text-xs tabular-nums">{tooltip.hsn}</span>
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
               {fmt(tooltip.quantity)} units
            </span>
          </div>
          <div className="text-[11px] font-bold text-slate-700 leading-snug mb-2">{tooltip.product}</div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
             <span className="text-slate-600">{tooltip.source.split(' ')[0]}</span>
             <ArrowUpRight size={10} className="text-blue-400" />
             <span className="text-slate-600">{tooltip.target.split(' ')[0]}</span>
          </div>
        </div>
      )}

      {/* Control Surface — bottom right */}
      {showControls && (
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        {[
          { icon: <Plus size={16} strokeWidth={2.5} />,    fn: zoomIn,  title: 'Zoom in'   },
          { icon: <Minus size={16} strokeWidth={2.5} />,   fn: zoomOut, title: 'Zoom out'  },
          { icon: <Maximize size={16} strokeWidth={2.5} />, fn: fit,     title: 'Fit to screen' },
        ].map((b, i) => (
          <button key={i} onClick={b.fn} title={b.title}
            className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200
                       rounded-2xl shadow-premium text-slate-400
                       hover:text-blue-600 hover:border-blue-400 hover:shadow-blue-glow transition-all duration-300">
            {b.icon}
          </button>
        ))}
      </div>
      )}
      
      {/* Network Origin Tag */}
      {highlightCompany && (
        <div className="absolute top-6 right-6 px-4 py-2 glass-panel rounded-2xl flex items-center gap-2.5 z-10 border-blue-200">
           <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-blue-glow" />
           <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Network Origin: {highlightCompany}</span>
        </div>
      )}
    </div>
  );
}
