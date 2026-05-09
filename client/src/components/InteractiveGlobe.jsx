import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Command, Loader2, ArrowRight,
  Globe2, Boxes, Waypoints, ShieldCheck,
  RotateCcw, Ruler, MapPin, Navigation
} from 'lucide-react';
import axios from 'axios';
import Globe from 'react-globe.gl';

/* ══════════════════════════════════════════════════════════
   FLAGS
   ══════════════════════════════════════════════════════════ */
const FLAGS = {
  'India':'🇮🇳','United States':'🇺🇸','China':'🇨🇳','Japan':'🇯🇵',
  'South Korea':'🇰🇷','Germany':'🇩🇪','Taiwan':'🇹🇼','France':'🇫🇷',
  'United Kingdom':'🇬🇧','Switzerland':'🇨🇭','Singapore':'🇸🇬','Finland':'🇫🇮',
  'Sweden':'🇸🇪','Brazil':'🇧🇷','Australia':'🇦🇺','Norway':'🇳🇴',
  'Belgium':'🇧🇪','Luxembourg':'🇱🇺','Netherlands':'🇳🇱','Denmark':'🇩🇰',
  'Italy':'🇮🇹','Canada':'🇨🇦','Malaysia':'🇲🇾','Congo':'🇨🇩',
  'Peru':'🇵🇪','Ivory Coast':'🇨🇮','Saudi Arabia':'🇸🇦','Ireland':'🇮🇪',
};

/* ══════════════════════════════════════════════════════════
   HAVERSINE FORMULA — Great‑circle distance (km)
   ══════════════════════════════════════════════════════════ */
function haversineDistance(p1, p2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ══════════════════════════════════════════════════════════
   ANIMATED COUNTER
   ══════════════════════════════════════════════════════════ */
function AnimatedCounter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setCount(target); clearInterval(t); }
      else setCount(Math.floor(v));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return <span>{count.toLocaleString()}{suffix}</span>;
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function InteractiveGlobe({ onCompanySelect }) {
  /* ── Search state ── */
  const [query, setQuery]             = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [focused, setFocused]         = useState(false);
  const [active, setActive]           = useState(-1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [stats, setStats]             = useState(null);

  /* ── Globe interaction state ── */
  const [points, setPoints]     = useState([]);       // max 2
  const [distance, setDistance] = useState(null);

  const inputRef    = useRef(null);
  const dropRef     = useRef(null);
  const debounceRef = useRef(null);
  const globeRef    = useRef(null);

  /* ── Boot ── */
  useEffect(() => {
    axios.get('/api/graph/stats').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, []);

  /* ── Configure globe controls once mounted ── */
  useEffect(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.minDistance = 180;
    controls.maxDistance = 600;

    // Pause auto‑rotation while the user interacts
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    controls.addEventListener('end', () => {
      setTimeout(() => { controls.autoRotate = true; }, 3000);
    });
  }, []);

  /* ── Search helpers ── */
  const fetchResults = useCallback(async (q) => {
    if (!q || q.trim().length === 0) { setSuggestions([]); setOpen(false); return; }
    
    setSearchLoading(true);
    setOpen(true); // Open immediately to show "Searching..." or "No results"

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'https://flowscope-uaaf.onrender.com';

      const { data } = await axios.get(`${backendUrl}/api/companies/search?q=${encodeURIComponent(q)}`);
      setSuggestions(data.companies || []);
    } catch (err) {
      console.error('[Search] API Error:', err.message);
      setSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(query), 180);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetchResults]);

  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => { setQuery(c.name); setOpen(false); setActive(-1); onCompanySelect?.(c); inputRef.current?.blur(); };
  const clear  = ()  => { setQuery(''); setSuggestions([]); setOpen(false); inputRef.current?.focus(); };
  const onKey  = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(p => Math.min(p + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(p => Math.max(p - 1, 0)); }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(suggestions[active]); }
    if (e.key === 'Escape') setOpen(false);
  };

  /* ── Globe click — place points ── */
  const handleGlobeClick = useCallback(({ lat, lng }) => {
    if (points.length >= 2) return;
    const label = points.length === 0 ? 'A' : 'B';
    const newPoints = [...points, { lat, lng, label }];
    setPoints(newPoints);
    console.log(`Point ${label}:`, { lat: lat.toFixed(4), lng: lng.toFixed(4) });

    if (newPoints.length === 2) {
      const d = haversineDistance(newPoints[0], newPoints[1]);
      setDistance(d);
      // Pause rotation & focus mid‑point
      if (globeRef.current) {
        globeRef.current.controls().autoRotate = false;
        globeRef.current.pointOfView({
          lat: (newPoints[0].lat + newPoints[1].lat) / 2,
          lng: (newPoints[0].lng + newPoints[1].lng) / 2,
          altitude: 1.8
        }, 1200);
      }
    }
  }, [points]);

  const resetPoints = () => {
    setPoints([]);
    setDistance(null);
    if (globeRef.current) globeRef.current.controls().autoRotate = true;
  };

  /* ── Globe data ── */
  const userArcs = useMemo(() => {
    if (points.length !== 2) return [];
    return [{ startLat: points[0].lat, startLng: points[0].lng, endLat: points[1].lat, endLng: points[1].lng, color: ['#00fff2','#ffffff'], stroke: 1.2, dashLen: 0.6, dashGap: 0.15, animTime: 1500, alt: 0.45 }];
  }, [points]);

  // Decorative trade routes (always animating)
  const tradeRoutes = useMemo(() => [
    { startLat: 37.7, startLng: -122.4, endLat: 35.6, endLng: 139.7 },   // SF → Tokyo
    { startLat: 51.5, startLng: -0.1,   endLat: 22.3, endLng: 114.2 },   // London → HK
    { startLat: 1.3,  startLng: 103.8,  endLat: -33.8, endLng: 151.2 },  // Singapore → Sydney
    { startLat: 40.7, startLng: -74.0,  endLat: 48.8, endLng: 2.3 },     // NYC → Paris
    { startLat: 19.0, startLng: 72.8,   endLat: 25.2, endLng: 55.3 },    // Mumbai → Dubai
    { startLat: 35.6, startLng: 139.7,  endLat: 37.5, endLng: 127.0 },   // Tokyo → Seoul
    { startLat: 31.2, startLng: 121.5,  endLat: 1.3,  endLng: 103.8 },   // Shanghai → SG
    { startLat: 52.5, startLng: 13.4,   endLat: 39.9, endLng: 116.4 },   // Berlin → Beijing
    { startLat: -23.5, startLng: -46.6, endLat: 51.5, endLng: -0.1 },    // Sao Paulo → London
    { startLat: 25.2, startLng: 55.3,   endLat: 19.0, endLng: 72.8 },    // Dubai → Mumbai
    { startLat: 34.0, startLng: -118.2, endLat: 31.2, endLng: 121.5 },   // LA → Shanghai
    { startLat: 22.3, startLng: 114.2,  endLat: -33.8, endLng: 151.2 },  // HK → Sydney
  ].map(r => ({ ...r, color: ['rgba(0,255,242,0.3)','rgba(56,189,248,0.15)'], stroke: 0.3, dashLen: 0.3, dashGap: 0.4, animTime: 4000 + Math.random() * 3000, alt: 0.15 + Math.random() * 0.2 })), []);

  const allArcs = useMemo(() => [...tradeRoutes, ...userArcs], [tradeRoutes, userArcs]);

  // Trade hub cities (glow on globe)
  const tradeHubs = useMemo(() => [
    { lat: 37.7, lng: -122.4 }, { lat: 35.6, lng: 139.7 }, { lat: 51.5, lng: -0.1 },
    { lat: 22.3, lng: 114.2 }, { lat: 1.3, lng: 103.8 }, { lat: 40.7, lng: -74.0 },
    { lat: 19.0, lng: 72.8 }, { lat: 25.2, lng: 55.3 }, { lat: 31.2, lng: 121.5 },
    { lat: 48.8, lng: 2.3 }, { lat: -33.8, lng: 151.2 }, { lat: 52.5, lng: 13.4 },
    { lat: 39.9, lng: 116.4 }, { lat: 37.5, lng: 127.0 }, { lat: -23.5, lng: -46.6 },
    { lat: 34.0, lng: -118.2 }, { lat: 55.7, lng: 37.6 }, { lat: 13.7, lng: 100.5 },
  ], []);

  // Pulsing rings = trade hubs + user-placed points
  const allRings = useMemo(() => [
    ...tradeHubs.map(h => ({ lat: h.lat, lng: h.lng })),
    ...points.map(p => ({ lat: p.lat, lng: p.lng })),
  ], [tradeHubs, points]);

  /* ── Stat cards ── */
  const statCards = [
    { icon: <Boxes size={16} />,       label: 'Companies', value: stats?.totalCompanies || 210, suffix: '+' },
    { icon: <Waypoints size={16} />,   label: 'Trade Links', value: stats?.totalTradeLinks || 186,  suffix: '' },
    { icon: <Globe2 size={16} />,      label: 'Countries',   value: stats?.totalCountries || 28,     suffix: '' },
    { icon: <ShieldCheck size={16} />, label: 'Intelligence', value: stats?.totalEnriched || 0, suffix: ' pts' },
  ];

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div className="relative w-full h-full overflow-hidden select-none">

      {/* ── DEEP SPACE BACKGROUND ── */}
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, #0a1628 0%, #020617 50%, #000 100%)' }} />
      <div className="absolute inset-0 z-[1] opacity-50 pointer-events-none" style={{
        backgroundImage: `radial-gradient(1px 1px at 10% 20%,rgba(255,255,255,.4) 0%,transparent 100%),radial-gradient(1px 1px at 80% 10%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 30% 70%,rgba(255,255,255,.25) 0%,transparent 100%),radial-gradient(1px 1px at 60% 40%,rgba(255,255,255,.35) 0%,transparent 100%),radial-gradient(1px 1px at 90% 80%,rgba(255,255,255,.2) 0%,transparent 100%),radial-gradient(1px 1px at 15% 55%,rgba(255,255,255,.3) 0%,transparent 100%),radial-gradient(1px 1px at 50% 90%,rgba(255,255,255,.15) 0%,transparent 100%),radial-gradient(1px 1px at 70% 25%,rgba(255,255,255,.25) 0%,transparent 100%),radial-gradient(1px 1px at 5% 85%,rgba(255,255,255,.2) 0%,transparent 100%),radial-gradient(1px 1px at 40% 15%,rgba(255,255,255,.3) 0%,transparent 100%)`
      }} />
      <div className="absolute inset-0 z-[2] pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 48%,rgba(0,180,220,.08) 0%,transparent 45%),radial-gradient(circle at 50% 52%,rgba(0,255,242,.04) 0%,transparent 50%)' }} />

      {/* ═══ 3D GLOBE WITH ANIMATED TRADE ROUTES ═══ */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <Globe
          ref={globeRef}
          width={typeof window !== 'undefined' ? window.innerWidth * 0.75 : 900}
          height={typeof window !== 'undefined' ? window.innerHeight : 730}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#00d4ff"
          atmosphereAltitude={0.22}
          onGlobeClick={handleGlobeClick}

          /* Animated trade route arcs (always visible) */
          arcsData={allArcs}
          arcColor={d => d.color || ['#00fff2', '#38bdf8']}
          arcStroke={d => d.stroke || 0.4}
          arcDashLength={d => d.dashLen || 0.4}
          arcDashGap={d => d.dashGap || 0.2}
          arcDashAnimateTime={d => d.animTime || 3000}
          arcAltitudeAutoScale={d => d.alt || 0.3}

          /* Pulsing city markers */
          ringsData={allRings}
          ringLat={d => d.lat}
          ringLng={d => d.lng}
          ringColor={() => t => `rgba(0,255,242,${1 - t})`}
          ringMaxRadius={2.5}
          ringPropagationSpeed={1.5}
          ringRepeatPeriod={1200}

          /* Point labels */
          labelsData={points}
          labelLat={d => d.lat}
          labelLng={d => d.lng}
          labelText={d => d.label}
          labelSize={1.2}
          labelDotRadius={0.5}
          labelColor={() => '#00fff2'}
          labelResolution={3}
          labelAltitude={0.01}

          /* Glowing hex points on trade hubs */
          hexBinPointsData={tradeHubs}
          hexBinPointLat={d => d.lat}
          hexBinPointLng={d => d.lng}
          hexBinPointWeight={1}
          hexBinResolution={3}
          hexAltitude={0.01}
          hexTopColor={() => 'rgba(0,255,242,0.15)'}
          hexSideColor={() => 'rgba(0,255,242,0.05)'}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════
          UI OVERLAYS (z-30, on top of globe)
          ═══════════════════════════════════════════════════════ */}

      {/* ── TOP : Status pill ── */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="absolute top-6 right-8 z-30 flex items-center gap-3"
      >
        <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">Live Engine</span>
        </div>
      </motion.div>

      {/* ── TOP-LEFT : Brand ── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="absolute top-6 left-8 z-30"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00fff2] to-[#0ea5e9] flex items-center justify-center shadow-[0_0_25px_rgba(0,255,242,0.3)]">
            <Globe2 size={18} className="text-[#020617]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-tight leading-none">
              Flow<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00fff2] to-[#38bdf8]">Scope</span>
            </h1>
            <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em] mt-0.5">Supply Chain Intelligence</span>
          </div>
        </div>
      </motion.div>

      {/* ── CENTER-TOP : Search Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4"
      >
        <div className={`
          flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-500
          ${focused
            ? 'bg-[#0a0f1e]/80 border-[#00fff2]/30 shadow-[0_0_40px_rgba(0,255,242,0.08)]'
            : 'bg-[#0a0f1e]/50 backdrop-blur-2xl border-white/[0.06] hover:border-white/[0.12]'}
        `}>
          {searchLoading
            ? <Loader2 className="w-4 h-4 text-[#00fff2] animate-spin shrink-0" />
            : <Search className={`w-4 h-4 shrink-0 transition-colors ${focused ? 'text-[#00fff2]' : 'text-white/20'}`} />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { setFocused(true); if (suggestions.length) setOpen(true); }}
            onBlur={() => setFocused(false)}
            onKeyDown={onKey}
            placeholder="Search company in global trade network…"
            className="flex-1 text-sm text-white placeholder:text-white/15 bg-transparent outline-none font-medium"
            autoComplete="off"
          />
          {query ? (
            <button onClick={clear} className="p-1 rounded-lg text-white/15 hover:text-red-400 transition-all"><X size={16} /></button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] border border-white/[0.05]">
              <Command size={10} className="text-white/15" /><span className="text-[9px] font-bold text-white/15">K</span>
            </div>
          )}
        </div>

        {/* Dropdown */}
        <AnimatePresence>
          {open && focused && query.length > 0 && (
            <div ref={dropRef} className="absolute top-full left-0 right-0 z-[999] px-4">
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                className="mt-2 py-2 bg-[#0a0f1e]/95 backdrop-blur-3xl border border-[#00fff2]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
              >
                <div className="px-4 pb-2 mb-1 border-b border-white/[0.04] flex justify-between items-center">
                  <span className="text-[8px] font-black text-[#00fff2]/50 uppercase tracking-[0.2em]">Global Network Index</span>
                  {suggestions.length > 0 && <span className="text-[8px] font-bold text-white/20 uppercase">{suggestions.length} Results</span>}
                </div>

                {suggestions.length > 0 ? (
                  suggestions.map((c, i) => (
                    <button
                      key={`${c.name}-${i}`}
                      onClick={() => select(c)}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-all ${i === active ? 'bg-[#00fff2]/[0.08]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 border transition-colors ${i === active ? 'bg-[#00fff2]/20 border-[#00fff2]/40' : 'bg-white/[0.03] border-white/[0.05]'}`}>
                          {FLAGS[c.country] || '🏢'}
                        </div>
                        <div className="text-left overflow-hidden">
                          <div className={`text-sm font-bold truncate capitalize ${i === active ? 'text-[#00fff2]' : 'text-white/70'}`}>{c.name}</div>
                          <div className="text-[9px] text-white/20 font-bold uppercase tracking-wider">{c.country}</div>
                        </div>
                      </div>
                      {i === active && (
                        <motion.div initial={{ x: -6, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-1 text-[#00fff2]">
                          <span className="text-[9px] font-black uppercase">Trace</span>
                          <ArrowRight size={12} />
                        </motion.div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="text-white/20 text-xs font-medium italic">No companies found matching "{query}"</div>
                    <div className="text-[8px] text-white/10 uppercase font-bold tracking-widest mt-2">Try a known partner like "Reliance" or "Infosys"</div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── RIGHT PANEL : Distance Card (appears when points selected) ── */}
      <AnimatePresence>
        {points.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-24 right-8 z-30 w-64"
          >
            <div className="bg-[#0a0f1e]/70 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <div className="flex items-center gap-2 mb-5">
                <Navigation size={14} className="text-[#00fff2]" />
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Geodesic Engine</span>
              </div>

              <div className="space-y-4">
                {points.map((p) => (
                  <div key={p.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-[#00fff2]" />
                        <span className="text-[9px] font-black text-[#00fff2] uppercase tracking-widest">Point {p.label}</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00fff2] animate-pulse shadow-[0_0_6px_rgba(0,255,242,0.6)]" />
                    </div>
                    <div className="text-white/70 font-mono text-xs pl-5">
                      {p.lat.toFixed(4)}°, {p.lng.toFixed(4)}°
                    </div>
                  </div>
                ))}
              </div>

              {/* Distance result */}
              <AnimatePresence>
                {distance !== null && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 pt-5 border-t border-white/[0.06]">
                      <div className="flex items-center gap-2 text-white/25 mb-2">
                        <Ruler size={12} />
                        <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Haversine Distance</span>
                      </div>
                      <div className="text-3xl font-black text-white tabular-nums leading-none">
                        {Math.round(distance).toLocaleString()}
                        <span className="text-sm font-bold text-[#00fff2] ml-1.5">KM</span>
                      </div>
                      <div className="text-[9px] text-white/15 font-medium mt-1.5">
                        ≈ {(distance * 0.621371).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} miles
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Reset */}
              <button
                onClick={resetPoints}
                className="w-full mt-5 flex items-center justify-center gap-2 py-2.5 bg-white/[0.03] hover:bg-[#00fff2]/10 border border-white/[0.06] hover:border-[#00fff2]/30 rounded-xl text-white/40 hover:text-[#00fff2] transition-all text-[10px] font-black uppercase tracking-widest group"
              >
                <RotateCcw size={12} className="group-hover:-rotate-90 transition-transform duration-300" />
                Reset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM : Stats + Instruction ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-5 w-full max-w-2xl px-4">

        {/* Instruction pill */}
        {points.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-full"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#00fff2] animate-ping" />
            <span className="text-white/30 text-[10px] font-bold uppercase tracking-[0.15em]">
              Click globe to place {points.length === 0 ? 'Origin (A)' : 'Destination (B)'}
            </span>
          </motion.div>
        )}

        {/* Stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="grid grid-cols-4 gap-3 w-full"
        >
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
              className="group flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.04] hover:border-[#00fff2]/15 hover:bg-white/[0.05] transition-all duration-500 cursor-default"
            >
              <div className="text-white/15 group-hover:text-[#00fff2]/50 transition-colors">{card.icon}</div>
              <div className="text-xl font-black text-white tabular-nums leading-none">
                <AnimatedCounter target={card.value} suffix={card.suffix} />
              </div>
              <div className="text-[8px] font-bold text-white/15 uppercase tracking-[0.2em]">{card.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── TAGLINE ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3"
      >
        <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/[0.06]" />
        <span className="text-[8px] font-bold text-white/[0.08] uppercase tracking-[0.3em]">Trace the invisible</span>
        <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/[0.06]" />
      </motion.div>

      {/* ── Vignette ── */}
      <div className="absolute inset-0 pointer-events-none z-[5] shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
    </div>
  );
}
