const fs = require('fs');
const path = require('path');

const base = 'c:/Users/HP/Downloads/FlowScope';

// 1. Fix App.jsx backend URL
const appPath = path.join(base, 'client/src/App.jsx');
let app = fs.readFileSync(appPath, 'utf8');
app = app.replace('https://flowscope-uaaf.onrender.com', 'https://flow-scope.onrender.com');
fs.writeFileSync(appPath, app);

// 2. Fix RouteOptimization.jsx curved lines
const routePath = path.join(base, 'client/src/components/RouteOptimization.jsx');
let route = fs.readFileSync(routePath, 'utf8');

// Add haversine helper
const haversineCode = `
// ─── Haversine Formula (Client-side) ───
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}
`;

if (!route.includes('function haversine')) {
    route = route.replace("import { Route", haversineCode + "\nimport { Route");
}

// Add getCurvedPath
const curvedPathCode = `
  // ─── Helper: Create Curved Path (Great Circle Visual) ───
  const getCurvedPath = (from, to, segments = 40) => {
    const [lat1, lon1] = from;
    const [lat2, lon2] = to;
    const path = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let lat = lat1 + (lat2 - lat1) * t;
      let lon = lon1 + (lon2 - lon1) * t;
      const offset = Math.sin(t * Math.PI) * (haversine(lat1, lon1, lat2, lon2) / 3000) * 8;
      lat += offset;
      path.push([lat, lon]);
    }
    return path;
  };
`;

if (!route.includes('const getCurvedPath')) {
    route = route.replace('return (', curvedPathCode + '\n  return (');
}

// Replace Polyline positions
route = route.replace('positions={[edge.from, edge.to]}', 'positions={getCurvedPath(edge.from, edge.to)}');

fs.writeFileSync(routePath, route);

console.log('Re-applied production fixes');
