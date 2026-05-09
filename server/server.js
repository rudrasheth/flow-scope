require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { initDriver } = require('./config/neo4j');
const csvService = require('./services/csvService');
const companiesRouter = require('./routes/companies');
const graphRouter = require('./routes/graph');
const traceRouter = require('./routes/trace');
const dashboardRouter = require('./routes/dashboard');
const routeOptimizerRouter = require('./routes/routeOptimizer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust this in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// ─── Prevent server crash on unhandled errors ───
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Promise Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err.message);
});

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// Attach io to request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ─── API Routes ───
app.use('/api/companies', companiesRouter);
app.use('/api/graph', graphRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/trace', traceRouter);
app.use('/api/route', routeOptimizerRouter);

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: err.message,
    path: req.path
  });
});

app.get('/api/news', async (req, res) => {
  try {
    const userQuery = req.query.q || 'supply chain';
    // Ensure "trade" is part of the query to only show trade news
    const finalQuery = userQuery.toLowerCase().includes('trade') ? userQuery : `${userQuery} AND trade`;
    
    // Using fetch API
    const response = await fetch(`https://newsdata.io/api/1/news?apikey=${process.env.NEWS_API_KEY}&q=${encodeURIComponent(finalQuery)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('News fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: require('./config/neo4j').getIsConnected() ? 'neo4j' : 'csv-fallback',
  });
});

// ─── Socket.io Connection ───
io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

// Export the app for Vercel
module.exports = app;

// ─── Start Server (Only when running locally) ───
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  async function start() {
    console.log('\n  ╔═══════════════════════════════════════╗');
    console.log('  ║         F L O W S C O P E             ║');
    console.log('  ║    Supply Chain Intelligence API       ║');
    console.log('  ╚═══════════════════════════════════════╝\n');

    // Load CSV data (always — used as fallback and for stats)
    try {
      await csvService.loadData();
    } catch (err) {
      console.error('  ✗ Failed to load CSV data:', err.message);
      process.exit(1);
    }

    // Try Neo4j connection (optional)
    await initDriver();

    server.listen(PORT, () => {
      console.log(`\n  ✓ Server running on http://localhost:${PORT}`);
      console.log(`  ✓ WebSocket enabled and ready`);
      console.log(`  ✓ API available at http://localhost:${PORT}/api\n`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`\n  ✗ Port ${PORT} is already in use. Another FlowScope server is running.`);
        console.error(`  ✓ Reuse the existing server at http://localhost:${PORT} or stop the old process and restart.\n`);
        process.exit(0);
      }

      console.error('[Server] Listen error:', err.message || err);
      process.exit(1);
    });
  }

  start();
} else {
  // In Vercel, we need to ensure data is loaded before processing requests
  // Since we can't easily do top-level await in a way that works everywhere,
  // we can use a middleware to ensure it's loaded.
  app.use(async (req, res, next) => {
    if (!csvService.loaded) {
      await csvService.loadData();
    }
    next();
  });
}
