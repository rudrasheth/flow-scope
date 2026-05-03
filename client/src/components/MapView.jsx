import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
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

const createMarkerIcon = (color) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background: ${color}; width: 14px; height: 14px; border: 2px solid #000; border-radius: 50%; box-shadow: 0 0 10px ${color};"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function MapView({ tradeRoutes = [], nodes = [] }) {
  // Validate routes
  const validRoutes = (tradeRoutes || []).filter(r => 
    r && Array.isArray(r.from) && r.from.length === 2 && !isNaN(r.from[0]) && !isNaN(r.from[1]) &&
    Array.isArray(r.to) && r.to.length === 2 && !isNaN(r.to[0]) && !isNaN(r.to[1])
  );

  // Validate nodes
  const relevantNodes = (nodes || []).filter(n => 
    n.coords && Array.isArray(n.coords) && n.coords.length === 2 &&
    !isNaN(n.coords[0]) && !isNaN(n.coords[1])
  );

  return (
    <div className="h-full w-full relative bg-[#0a0a0a] z-0">
      <MapContainer 
        center={[20.5937, 78.9629]} 
        zoom={3} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        {/* Base Satellite Imagery Layer */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
        />
        
        {/* Reference Labels Layer */}
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri'
        />

        {/* Trade Routes */}
        {validRoutes.map((route, i) => {
          const color = route.type === 'IMPORT' ? '#4DA3FF' : '#A78BFA';
          return (
            <div key={`route-group-${i}`}>
              <Polyline 
                positions={[route.from, route.to]}
                pathOptions={{
                  color: color,
                  weight: 2.5,
                  opacity: 0.8,
                  dashArray: '10, 10',
                  lineJoin: 'round',
                  className: 'animate-flow'
                }}
              />
              {/* Midpoint Label */}
              <Marker 
                position={[(route.from[0] + route.to[0])/2, (route.from[1] + route.to[1])/2]} 
                icon={L.divIcon({
                  className: 'hsn-label-on-path',
                  html: `<div style="background: rgba(0,0,0,0.8); color: ${color}; font-size: 8px; font-family: Inter, sans-serif; font-weight: 900; padding: 2px 6px; border: 1px solid ${color}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); white-space: nowrap; letter-spacing: 0.5px;">HS ${route.hsn}</div>`,
                  iconSize: [36, 16],
                  iconAnchor: [18, 8]
                })}
                interactive={false}
              />
              {/* Direction Arrow */}
              <Marker 
                position={route.to}
                icon={L.divIcon({
                  className: 'flow-arrow',
                  html: `<div style="color: ${color}; transform: rotate(${Math.atan2(route.to[0]-route.from[0], route.to[1]-route.from[1])}rad); font-size: 14px; font-weight: 900; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">▶</div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
                interactive={false}
              />
            </div>
          );
        })}

        {/* Nodes / Markers */}
        {relevantNodes.map((n, i) => {
           const color = TIER_COLORS[n.tier] || DEFAULT_COLOR;
           return (
            <Marker 
              key={`node-marker-${i}`}
              position={n.coords}
              icon={createMarkerIcon(color)}
            >
              <Popup>
                <div className="p-3 min-w-[200px] bg-slate-900 text-white rounded-lg border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800 text-[9px] font-black uppercase">Tier {n.tier}</div>
                     <div className="text-[12px] font-black text-white truncate">{n.label}</div>
                  </div>
                  <div className="text-[10px] text-slate-300 italic mb-2">
                    {n.description || 'No description available'}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest text-right">
                    {n.city ? `${n.city}, ` : ''}{n.country}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

      </MapContainer>

      {/* Empty State Overlay */}
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
    </div>
  );
}
