import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Light Professional Tiles
const TILE_LAYER = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const TIER_COLORS = {
  0: '#2563EB',
  1: '#8B5CF6',
  2: '#10B981',
  3: '#F59E0B',
  4: '#EC4899',
};
const DEFAULT_COLOR = '#94A3B8';

const createMarkerIcon = (color) => L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background: ${color}; width: 12px; height: 12px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 8px ${color}80;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Disaster Icon for GDACS
const createDisasterIcon = (color) => L.divIcon({
  className: 'disaster-marker',
  html: `<div style="background: ${color}; width: 14px; height: 14px; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px ${color}; animation: pulse-shadow 2s infinite;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Component to handle map centering and animation
function MapController({ tradeRoutes }) {
  const map = useMap();
  useEffect(() => {
    if (tradeRoutes && tradeRoutes.length > 0) {
      const coords = tradeRoutes
        .flatMap(r => [r.from, r.to])
        .filter(c => Array.isArray(c) && c.length === 2 && !isNaN(c[0]) && !isNaN(c[1]));

      if (coords.length > 0) {
        try {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6, animate: true, duration: 1.5 });
        } catch (e) {
          console.error("Map bounds error:", e);
        }
      }
    }
  }, [tradeRoutes, map]);
  return null;
}

export default function MapView({ tradeRoutes = [], nodes = [] }) {
  const [disasters, setDisasters] = useState([]);
  const [newsRiskScores, setNewsRiskScores] = useState({});

  // Haversine distance formula
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    // Fetch real-time disasters from GDACS
    fetch("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?format=json")
      .then(res => res.json())
      .then(data => {
        if (data.features) {
          const events = data.features.map(f => {
            const severity = f.properties.alertlevel;
            let color = "#22c55e"; // Green
            if (severity === "Orange") color = "#f97316"; 
            if (severity === "Red") color = "#ef4444"; 
            
            return {
              id: f.properties.eventid,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              title: f.properties.name,
              type: f.properties.eventtype,
              severity: severity,
              color: color,
              description: f.properties.description
            };
          }).filter(e => e.severity !== 'Green');
          setDisasters(events);
        }
      })
      .catch(err => console.error("GDACS fetch error:", err));
  }, []);

  // News-based Risk Scoring
  useEffect(() => {
    const calculateRiskFromNews = async () => {
      const keywords = ['strike', 'shortage', 'protest', 'delay', 'disruption', 'blocked', 'sanction', 'war', 'crisis', 'outage', 'bankruptcy', 'bottleneck'];
      const scores = {};

      for (const node of nodes) {
        try {
          const response = await fetch(`http://localhost:3001/api/news?q=${encodeURIComponent(node.label)}`);
          const data = await response.json();
          
          let score = 0;
          if (data.results && Array.isArray(data.results)) {
            data.results.forEach(article => {
              const text = (article.title + ' ' + (article.description || '')).toLowerCase();
              keywords.forEach(word => {
                if (text.includes(word)) score += 10;
              });
              if (text.includes('urgent') || text.includes('breaking') || text.includes('critical')) score += 5;
            });
          }
          scores[node.id] = Math.min(score, 100); // Cap at 100
        } catch (err) {
          console.warn(`Failed to fetch news risk for ${node.label}`);
        }
      }
      setNewsRiskScores(scores);
    };

    if (nodes.length > 0) {
      calculateRiskFromNews();
    }
  }, [nodes]);

  const validRoutes = (tradeRoutes || []).filter(r => 
    r && Array.isArray(r.from) && r.from.length === 2 && 
    Array.isArray(r.to) && r.to.length === 2
  );

  const relevantNodes = (nodes || []).filter(n => 
    n.coords && Array.isArray(n.coords) && n.coords.length === 2 &&
    !isNaN(n.coords[0]) && !isNaN(n.coords[1])
  );

  // Analyze each node's risk based on disasters and news
  const nodesWithRisk = relevantNodes.map(node => {
    const nearbyDisasters = disasters.filter(d => getDistance(d.lat, d.lng, node.coords[0], node.coords[1]) < 700);
    const hasHighDisaster = nearbyDisasters.some(d => d.severity === 'Red');
    const hasMedDisaster = nearbyDisasters.some(d => d.severity === 'Orange');
    const newsScore = newsRiskScores[node.id] || 0;

    let riskLevel = 'LOW';
    let riskColor = '#475569'; // Default Slate

    if (hasHighDisaster || newsScore > 60) {
      riskLevel = 'CRITICAL';
      riskColor = '#ef4444'; // Red
    } else if (hasMedDisaster || newsScore > 30) {
      riskLevel = 'ELEVATED';
      riskColor = '#f97316'; // Orange
    }

    return { ...node, riskLevel, riskColor, newsScore, nearbyDisasters };
  });

  return (
    <div className="h-full w-full bg-[#E9EEF6] relative overflow-hidden" id="map-view-container">
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer url={TILE_LAYER} />
        
        <MapController tradeRoutes={validRoutes} />

        {/* Disaster Impact Radii (Only for disasters near nodes) */}
        {disasters.map((d, i) => {
          const isRelevant = nodesWithRisk.some(n => getDistance(d.lat, d.lng, n.coords[0], n.coords[1]) < 1000);
          if (!isRelevant) return null;

          return (
            <Circle 
              key={`radius-${d.id}-${i}`}
              center={[d.lat, d.lng]}
              radius={200000}
              pathOptions={{
                color: d.color,
                fillColor: d.color,
                fillOpacity: 0.1,
                weight: 1,
                dashArray: '5, 10'
              }}
            />
          );
        })}

        {/* Trade Route Arcs */}
        {validRoutes.map((route, i) => {
          const color = route.type === 'IMPORT' ? '#2563EB' : '#9333EA';
          return (
            <div key={`group-${i}`}>
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
              <Marker 
                position={[(route.from[0] + route.to[0])/2, (route.from[1] + route.to[1])/2]} 
                icon={L.divIcon({
                  className: 'hsn-label-on-path',
                  html: `<div style="background: rgba(255,255,255,0.95); color: ${color}; font-size: 8px; font-family: Inter, sans-serif; font-weight: 900; padding: 2px 6px; border: 1.5px solid ${color}; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); white-space: nowrap; backdrop-filter: blur(4px); letter-spacing: -0.2px;">HS ${route.hsn}</div>`,
                  iconSize: [36, 16],
                  iconAnchor: [18, 8]
                })}
                interactive={false}
              />
              {/* Directional Arrow at Destination */}
              <Marker 
                position={route.to}
                icon={L.divIcon({
                  className: 'flow-arrow',
                  html: `<div style="color: ${color}; transform: rotate(${Math.atan2(route.to[0]-route.from[0], route.to[1]-route.from[1])}rad); font-size: 14px; font-weight: 900; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); text-shadow: 0 0 2px #fff;">▶</div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8]
                })}
                interactive={false}
              />
            </div>
          );
        })}

        {/* Disaster Markers (Faded if not near any suppliers) */}
        {disasters.map((d, i) => {
          const isNearSupplier = nodesWithRisk.some(n => getDistance(d.lat, d.lng, n.coords[0], n.coords[1]) < 1500);
          
          return (
            <Marker 
              key={`disaster-${d.id}-${i}`}
              position={[d.lat, d.lng]}
              icon={createDisasterIcon(d.color)}
              opacity={isNearSupplier ? 1 : 0.2}
            >
              <Popup>
                <div className="p-3 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                     <div className="px-2 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-wider" style={{ background: d.color }}>
                        {d.severity} ALERT
                     </div>
                     <div className="text-[12px] font-black text-slate-800">{d.title}</div>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-tight">TYPE: {d.type}</div>
                  <div className="text-[11px] bg-red-50 p-3 rounded-xl border border-red-100 text-red-900 leading-snug font-medium">
                    {d.description || 'Active natural disaster detected in this region.'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Supplier/Company Markers with Dynamic Risk Colors */}
        {nodesWithRisk.map((n, i) => (
          <Marker 
            key={`marker-${i}`}
            position={n.coords}
            icon={createMarkerIcon(n.riskLevel === 'LOW' ? (TIER_COLORS[n.tier] || DEFAULT_COLOR) : n.riskColor)}
          >
            <Popup>
              <div className="p-3 min-w-[240px]">
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      <div className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-black uppercase">Tier {n.tier}</div>
                      <div className="text-[12px] font-black text-slate-800">{n.label}</div>
                   </div>
                   <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                     n.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-700' : 
                     n.riskLevel === 'ELEVATED' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                   }`}>
                      {n.riskLevel}
                   </div>
                </div>

                {/* News Sentiment Score */}
                <div className="mb-3 bg-slate-50 border border-slate-100 rounded-xl p-2">
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">News Conflict Score</span>
                      <span className="text-[9px] font-black text-slate-600 uppercase">{n.newsScore}%</span>
                   </div>
                   <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${n.newsScore}%` }} />
                   </div>
                </div>
                
                <div className="text-[10px] bg-white p-3 rounded-xl border border-slate-100 text-slate-600 leading-relaxed italic shadow-sm">
                  "{n.description}"
                </div>
                
                {n.nearbyDisasters.length > 0 && (
                  <div className="mt-3 p-2 bg-red-50 rounded-lg border border-red-100">
                    <div className="text-[9px] font-black text-red-600 uppercase mb-1">Impact Warning</div>
                    <div className="text-[10px] text-red-800">Near active {n.nearbyDisasters[0].type} ({n.nearbyDisasters[0].severity}).</div>
                  </div>
                )}

                <div className="text-[9px] text-slate-400 mt-3 uppercase font-bold tracking-widest text-right">{n.country}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Empty State Overlay */}
      {(!tradeRoutes || tradeRoutes.length === 0) && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/20 backdrop-blur-[1px] pointer-events-none">
          <div className="bg-white/90 px-5 py-2.5 rounded-full border border-slate-200 shadow-xl flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"/>
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
              Ready for Network Data
            </span>
          </div>
        </div>
      )}

      {/* Smart Risk Legend */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200 shadow-premium min-w-[180px]">
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 border-b border-slate-100 pb-2">Contextual Risk</div>
        <div className="flex flex-col gap-3">
           <div className="flex items-center gap-3">
             <div className="w-3 h-3 rounded-full bg-[#ef4444] shadow-[0_0_10px_#ef4444]" />
             <div>
                <div className="text-[10px] font-black text-slate-800 uppercase leading-none">Critical</div>
                <div className="text-[8px] font-bold text-slate-400 leading-tight">Disaster Near Node / News Alarm</div>
             </div>
           </div>
           <div className="flex items-center gap-3">
             <div className="w-3 h-3 rounded-full bg-[#f97316] shadow-[0_0_8px_#f97316]" />
             <div>
                <div className="text-[10px] font-black text-slate-800 uppercase leading-none">Elevated</div>
                <div className="text-[8px] font-bold text-slate-400 leading-tight">Nearby Alerts / Sentiment Shift</div>
             </div>
           </div>
           <div className="flex items-center gap-3 opacity-50">
             <div className="w-2 h-2 rounded-full border-2 border-slate-300" />
             <div>
                <div className="text-[10px] font-black text-slate-600 uppercase leading-none">Faded</div>
                <div className="text-[8px] font-bold text-slate-400 leading-tight">Global Events (No Local Impact)</div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
