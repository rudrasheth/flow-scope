import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
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
        flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-300
        ${focused 
          ? 'bg-white border-blue-400 shadow-blue-glow scale-[1.01]' 
          : 'bg-white/80 backdrop-blur-md border-slate-200 shadow-sm hover:border-blue-200'}
      `}>
        
        {loading ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
        ) : (
          <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${focused ? 'text-blue-500' : 'text-slate-400'}`} />
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
          className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none font-medium"
          autoComplete="off"
        />

        <div className="flex items-center gap-2">
          {query ? (
            <button 
              onClick={clear}
              className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 transition-opacity">
              <Command size={10} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400">K</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div 
            ref={dropRef} 
            key="search-suggestions-container" 
            className="absolute top-full left-0 right-0 z-[100]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            <div className="mt-2 py-2 bg-white border border-slate-200 rounded-2xl shadow-elevated overflow-hidden shadow-premium">
              <div className="px-3 pb-2 mb-1 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Index Match</span>
              </div>
              {suggestions.map((c, i) => (
                <button 
                  key={c.name} 
                  onClick={() => select(c)} 
                  onMouseEnter={() => setActive(i)}
                  className={`w-full px-4 py-3 flex items-center justify-between transition-all
                    ${i === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-base shadow-sm group">
                      {FLAGS[c.country] || '🏢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold truncate ${i === active ? 'text-blue-700' : 'text-slate-700'}`}>
                        {c.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{c.country}</div>
                    </div>
                  </div>
                  {i === active && (
                    <motion.div 
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center gap-1 text-blue-500"
                    >
                      <span className="text-[10px] font-black uppercase tracking-tighter mr-1">Select</span>
                      <CornerDownLeft size={12} strokeWidth={2.5} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
