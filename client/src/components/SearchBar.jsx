import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Search, X, Command, CornerDownLeft, Loader2 } from 'lucide-react';

const FLAGS = {
  'India':'🇮🇳','United States':'🇺🇸','China':'🇨🇳','Japan':'🇯🇵',
  'South Korea':'🇰🇷','Germany':'🇩🇪','Taiwan':'🇹🇼','France':'🇫🇷',
  'United Kingdom':'🇬🇧','Switzerland':'🇨🇭','Singapore':'🇸🇬','Finland':'🇫🇮',
  'Sweden':'🇸🇪','Brazil':'🇧🇷','Australia':'🇦🇺','Norway':'🇳🇴',
  'Belgium':'🇧🇪','Luxembourg':'🇱🇺','Netherlands':'🇳🇱','Denmark':'🇩🇰',
  'Italy':'🇮🇹','Canada':'🇨🇦','Malaysia':'🇲🇾','Congo':'🇨🇩',
  'Peru':'🇵🇪','Ivory Coast':'🇨🇮','Saudi Arabia':'🇸🇦','Ireland':'🇮🇪',
};

export default function SearchBar({ onCompanySelect }) {
  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]             = useState(false);
  const [focused, setFocused]       = useState(false);
  const [active, setActive]         = useState(-1);
  const [loading, setLoading]       = useState(false);
  
  const inputRef    = useRef(null);
  const dropRef     = useRef(null);
  const debounceRef = useRef(null);

  const fetch = useCallback(async (q) => {
    if (!q) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/companies/search?q=${encodeURIComponent(q)}`);
      setSuggestions(data.companies || []);
      setOpen((data.companies || []).length > 0);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetch(query), 180);
    return () => clearTimeout(debounceRef.current);
  }, [query, fetch]);

  useEffect(() => {
    const h = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (c) => { 
    setQuery(c.name); 
    setOpen(false); 
    setActive(-1); 
    onCompanySelect(c); 
    inputRef.current?.blur();
  };
  
  const clear  = ()  => { 
    setQuery(''); 
    setSuggestions([]); 
    setOpen(false); 
    onCompanySelect(null); 
    inputRef.current?.focus(); 
  };

  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(p => Math.min(p+1, suggestions.length-1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(p => Math.max(p-1, 0)); }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(suggestions[active]); }
    if (e.key === 'Escape')    setOpen(false);
  };

  return (
    <div className="relative w-full z-50">
      <div className={`
        flex items-center gap-4 px-6 py-3.5 rounded-2xl border transition-all duration-300
        ${focused 
          ? 'bg-white border-blue-400 shadow-blue-glow scale-[1.01]' 
          : 'bg-white/80 backdrop-blur-md border-slate-200 shadow-sm hover:border-blue-200'}
      `}>
        
        {loading ? (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
        ) : (
          <Search className={`w-5 h-5 flex-shrink-0 transition-colors ${focused ? 'text-blue-500' : 'text-slate-400'}`} />
        )}

        <input 
          ref={inputRef}
          type="text" 
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); if (suggestions.length) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKey}
          placeholder="Analyze company logistics network…"
          className="flex-1 text-base text-slate-700 placeholder:text-slate-400 bg-transparent outline-none font-medium"
          autoComplete="off"
        />

        <div className="flex items-center gap-2">
          {query ? (
            <button 
              onClick={clear}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 transition-opacity">
              <Command size={14} className="text-slate-400" />
              <span className="text-xs font-black text-slate-400">K</span>
            </div>
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div ref={dropRef} className="absolute top-full left-0 right-0 z-[100]">
          <motion.div 
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mt-2 py-2 bg-white border border-slate-200 rounded-2xl shadow-elevated overflow-hidden shadow-premium"
          >
          <div className="px-3 pb-2 mb-1 border-b border-slate-50">
             <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Global Index Match</span>
          </div>
          {suggestions.map((c, i) => (
            <button 
              key={c.name} 
              onClick={() => select(c)} 
              onMouseEnter={() => setActive(i)}
              className={`w-full px-5 py-4 flex items-center justify-between transition-all
                ${i === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                  {FLAGS[c.country] || '🏢'}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className={`text-base tracking-tight font-bold truncate capitalize ${i === active ? 'text-blue-700' : 'text-slate-800'}`}>
                    {c.name}
                  </div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{c.country}</div>
                </div>
              </div>
              {i === active && (
                <motion.div 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-center gap-1 text-blue-500"
                >
                  <span className="text-xs font-black uppercase tracking-tighter mr-1">Select</span>
                  <CornerDownLeft size={14} strokeWidth={2.5} />
                </motion.div>
              )}
            </button>
          ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
