import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Layers, Hash, ChevronRight } from 'lucide-react';

function fmt(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}

export default function HSNSelector({ companyName, onHSNSelect, selectedHSN }) {
  const [codes, setCodes]   = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyName) { setCodes([]); return; }
    setLoading(true);
    axios.get(`/api/companies/${encodeURIComponent(companyName)}/hsn`)
      .then(({ data }) => setCodes(data.hsnCodes || []))
      .catch(() => setCodes([]))
      .finally(() => setLoading(false));
  }, [companyName]);

  if (loading) return (
    <div className="flex flex-col gap-2.5">
      {[1,2,3,4].map(i => <div key={i} className="h-10 shimmer border border-slate-50" />)}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5" id="hsn-selector">
      {/* All codes button */}
      <motion.button
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onHSNSelect('all', 'Global Aggregate')}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider
          border transition-all duration-200 group
          ${selectedHSN === 'all'
            ? 'bg-blue-600 text-white border-blue-600 shadow-blue-glow'
            : 'bg-white text-slate-500 border-slate-100 hover:border-blue-400 hover:text-blue-600 shadow-sm'
          }`}
      >
        <div className="flex items-center gap-2.5">
          <Layers size={14} className={selectedHSN === 'all' ? 'text-white' : 'text-blue-500'} />
          <span>Global Aggregate</span>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-black ${selectedHSN === 'all' ? 'bg-blue-500/30' : 'bg-slate-100'}`}>
          {codes.length}
        </div>
      </motion.button>

      {/* Individual codes */}
      <div className="space-y-2 mt-2">
        {codes.map((h, i) => (
          <motion.button
            key={h.code}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onHSNSelect(h.code, h.description)}
            className={`w-full flex flex-col p-3.5 rounded-xl border transition-all duration-200 group relative overflow-hidden
              ${selectedHSN === h.code
                ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-violet-500 shadow-premium'
                : 'bg-white text-slate-600 border-slate-100 hover:border-violet-300 shadow-sm'
              }`}
          >
            {/* Product name — primary label, clearly visible */}
            <div className={`text-[13px] font-black text-left leading-snug uppercase tracking-tight mb-2 ${selectedHSN === h.code ? 'text-white' : 'text-slate-700'}`}>
              {h.description}
            </div>

            {/* HS code badge + quantity — secondary info row */}
            <div className="flex items-center justify-between w-full">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wide ${selectedHSN === h.code ? 'bg-white/15 text-violet-200' : 'bg-violet-50 text-violet-600'}`}>
                <Hash size={11} className="opacity-70" />
                <span>HS {h.code}</span>
              </div>
              {h.totalQuantity > 0 && (
                <span className={`text-[11px] font-black tabular-nums px-2 py-0.5 rounded-md ${selectedHSN === h.code ? 'bg-white/20 text-violet-100' : 'bg-slate-100 text-slate-500'}`}>
                  {fmt(h.totalQuantity)} units
                </span>
              )}
            </div>
            
            {selectedHSN === h.code && (
              <motion.div 
                layoutId="hsn-glow"
                className="absolute right-[-20%] top-[-20%] w-24 h-24 bg-white/10 blur-2xl rounded-full"
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
