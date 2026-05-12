import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon paths in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const TIER_COLORS = {
  0: '#4DA3FF', // Blue for Tier 0
  1: '#A78BFA', // Purple for Tier 1
  2: '#7CFC8A', // Green for Tier 2
  3: '#F59E0B',
  4: '#EC4899',
};
const DEFAULT_COLOR = '#E6EDF3';

const createMarkerIcon = (color, isActive) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background: ${color}; width: ${isActive ? '20px' : '14px'}; height: ${isActive ? '20px' : '14px'}; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 ${isActive ? '20px' : '10px'} ${color}; transition: all 0.3s ease;"></div>`,
  iconSize: isActive ? [20, 20] : [14, 14],
  iconAnchor: isActive ? [10, 10] : [7, 7],
});

export default function MapView({ tradeRoutes = [], nodes = [] }) {
  const [selectedTier1Id, setSelectedTier1Id] = useState(null);

  // Identify Tier 0 company
  const tier0Node = useMemo(() => nodes.find(n => n.tier === 0), [nodes]);
  
  // Find all Tier 1 suppliers connected to Tier 0
  const tier1Suppliers = useMemo(() => {
    if (!tier0Node) return [];
    return nodes.filter(n => n.tier === 1 && n.type === 'Company');
  }, [nodes, tier0Node]);

  // Determine active nodes and routes based on selection
  const { filteredNodes, filteredRoutes, activeNodeIds } = useMemo(() => {
    if (!selectedTier1Id) {
      return { 
        filteredNodes: nodes.filter(n => n.coords), 
        filteredRoutes: tradeRoutes.filter(r => r.from && r.to),
        activeNodeIds: new Set()
      };
    }

    const activeIds = new Set();
    activeIds.add(tier0Node?.id);
    activeIds.add(selectedTier1Id);

    // Find Tier 2s that supply this Tier 1
    const t2Edges = tradeRoutes.filter(r => r.toName === selectedTier1Id || r.toName === selectedTier1Id.replace('c_', ''));
    t2Edges.forEach(e => {
        const sourceId = nodes.find(n => n.label === e.fromName || `c_${n.label}` === e.fromName || n.id === e.fromName)?.id;
        if (sourceId) activeIds.add(sourceId);
    });

    const fRoutes = tradeRoutes.filter(r => {
        const fromNode = nodes.find(n => n.label === r.fromName || `c_${n.label}` === r.fromName || n.id === r.fromName);
        const toNode = nodes.find(n => n.label === r.toName || `c_${n.label}` === r.toName || n.id === r.toName);
        
        const fromId = fromNode?.id;
        const toId = toNode?.id;

        const isT1toT0 = (toId === tier0Node?.id && (selectedTier1Id ? fromId === selectedTier1Id : fromNode?.tier === 1));
        const isT2toT1 = ((selectedTier1Id ? toId === selectedTier1Id : toNode?.tier === 1) && fromNode?.tier === 2);
        
        if (isT1toT0) r.segmentType = 'T1toT0';
        else if (isT2toT1) r.segmentType = 'T2toT1';

        if (selectedTier1Id) return isT1toT0 || isT2toT1;
        return fromNode && toNode;
    });

    return {
      filteredNodes: nodes.filter(n => (selectedTier1Id ? (activeIds.has(n.id) || n.tier === 0) : true) && n.coords),
      filteredRoutes: fRoutes,
      activeNodeIds: activeIds
    };
  }, [nodes, tradeRoutes, selectedTier1Id, tier0Node]);

  return (
    <div className="h-full w-full relative bg-[#0a0a0a] z-0">
      <MapContainer 
        center={[20.5937, 78.9629]} 
        zoom={3} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri'
        />
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri'
        />

        {/* Trade Routes */}
        {filteredRoutes.map((route, i) => {
          const isSelected = selectedTier1Id !== null;
          
          // Improved Tier Detection for Coloring
          const toNode = nodes.find(n => n.label === route.toName || `c_${n.label}` === route.toName || n.id === route.toName);
          const fromNode = nodes.find(n => n.label === route.fromName || `c_${n.label}` === route.fromName || n.id === route.fromName);
          
          let color = '#A78BFA'; // Default Purple
          if (toNode?.tier === 0) {
            color = '#A78BFA'; // Tier 1 -> Tier 0: Purple
          } else if (toNode?.tier === 1) {
            color = '#7CFC8A'; // Tier 2 -> Tier 1: Green
          }
          
          const angle = Math.atan2(route.to[0] - route.from[0], route.to[1] - route.from[1]) * (180 / Math.PI);
          
          return (
            <React.Fragment key={`route-fragment-${i}`}>
              <Polyline 
                positions={[route.from, route.to]}
                pathOptions={{
                  color: color,
                  weight: isSelected ? 4 : 2.5,
                  opacity: 0.8,
                  dashArray: '10, 10',
                  lineJoin: 'round',
                  className: isSelected ? 'animate-flow-fast' : 'animate-flow'
                }}
              />
              <Marker 
                position={[(route.from[0] + route.to[0])/2, (route.from[1] + route.to[1])/2]} 
                icon={L.divIcon({
                  className: 'hsn-label-on-path',
                  html: `<div style="background: rgba(0,0,0,0.85); color: ${color}; font-size: 9px; font-family: Inter, sans-serif; font-weight: 900; padding: 3px 8px; border: 1px solid ${color}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); white-space: nowrap; letter-spacing: 0.3px; display: flex; align-items: center; gap: 4px;">
                    <span style="opacity: 0.7; font-size: 8px;">HS</span>
                    <span>${route.hsn}</span>
                    ${route.component ? `<span style="color: rgba(255,255,255,0.5); margin: 0 2px;">·</span><span style="color: rgba(255,255,255,0.85); text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px;">${route.component}</span>` : ''}
                  </div>`,
                  iconSize: [80, 20],
                  iconAnchor: [40, 10]
                })}
                interactive={false}
              />
            </React.Fragment>
          );
        })}

        {/* Nodes / Markers */}
        {filteredNodes.map((n, i) => {
           const color = TIER_COLORS[n.tier] || DEFAULT_COLOR;
           const isActive = selectedTier1Id !== null;
           
           return (
            <Marker 
              key={`node-marker-${i}`}
              position={n.coords}
              icon={createMarkerIcon(color, isActive)}
            >
              {isActive && (
                <Tooltip permanent direction="top" offset={[0, -10]} className="custom-path-tooltip">
                  <div className="bg-black/90 text-white px-2 py-1 rounded text-[10px] font-black border border-white/20 whitespace-nowrap uppercase tracking-tighter">
                    {n.label}
                  </div>
                </Tooltip>
              )}
              <Popup>
                <div className="p-3 min-w-[200px] bg-slate-900 text-white rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800 text-[9px] font-black uppercase">Tier {n.tier}</div>
                     <div className="text-[12px] font-black text-white truncate">{n.label}</div>
                  </div>
                  
                  {n.tier === 0 && tier1Suppliers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Select Trade Route</div>
                      <div className="space-y-1.5">
                        {tier1Suppliers.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedTier1Id(selectedTier1Id === s.id ? null : s.id)}
                            className={`w-full text-left p-2 rounded border transition-all text-[10px] font-bold flex items-center justify-between ${
                                selectedTier1Id === s.id 
                                ? 'bg-blue-600 border-blue-400 text-white' 
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <span>{s.label}</span>
                            {selectedTier1Id === s.id ? <span className="text-[8px]">ACTIVE</span> : <span className="opacity-50">TRACE</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-[10px] text-slate-300 italic">
                    {n.description || 'No description available'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>

      {/* Global Selection Status */}
      {selectedTier1Id && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in zoom-in duration-300">
          <button 
            onClick={() => setSelectedTier1Id(null)}
            className="bg-blue-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-blue-400 shadow-2xl flex items-center gap-3 group"
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"/>
            <span className="text-[10px] uppercase font-black text-white tracking-widest">
              Viewing Full Trade Chain: {nodes.find(n => n.id === selectedTier1Id)?.label}
            </span>
            <div className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded text-white group-hover:bg-white/40 transition-colors">ESC</div>
          </button>
        </div>
      )}

      {(!tradeRoutes || tradeRoutes.length === 0) && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#4DA3FF] rounded-full animate-pulse"/>
            <span className="text-[10px] uppercase font-bold text-[#E6EDF3] tracking-widest">
              Ready for Network Data
            </span>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-path-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .custom-path-tooltip::before {
          display: none !important;
        }
        @keyframes flow-fast {
          to { stroke-dashoffset: -20; }
        }
        .animate-flow-fast {
          animation: flow-fast 0.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
