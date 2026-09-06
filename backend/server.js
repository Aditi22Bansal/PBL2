require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const promClient = require('prom-client');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const chatRoutes = require('./routes/chat');

const http = require('http');
const { Server } = require('socket.io');

// Real browser-facing frontend origin(s), comma-separated - no browser should ever
// need to reach this backend from anywhere else. Empty by default (no origins
// allowed) rather than defaulting to a guess, so a misconfigured deployment fails
// closed instead of silently staying wide open.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '50mb' }));

// Prometheus metrics: default Node/process metrics plus real per-request
// duration/count, labeled by the matched route PATTERN (e.g. "/api/admin/profile/:id"),
// not the raw URL - so labels stay bounded regardless of how many distinct emails/ids
// actually get requested. Unmatched (404) requests are labeled "unmatched" for the
// same reason, rather than the raw attempted path.
promClient.collectDefaultMetrics();

const httpRequestDurationSeconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

app.use((req, res, next) => {
  const endTimer = httpRequestDurationSeconds.startTimer();
  res.on('finish', () => {
    const routePath = req.route && req.route.path;
    const route = routePath ? `${req.baseUrl}${routePath}` : (req.baseUrl || 'unmatched');
    const labels = { method: req.method, route, status_code: res.statusCode };
    endTimer(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Database connection
const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hostel_allocator';
        await mongoose.connect(uri);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

// Make io accessible to routes if needed
app.set('socketio', io);

// Socket.IO logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Join a specific room based on allocation ID
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Join a per-student channel keyed by email, so the server can push an
    // event at one specific student rather than broadcasting to a room. The
    // chat's join_room can't serve this: it's keyed on an allocation id, which
    // by definition doesn't exist yet for the student we most need to reach -
    // the one who is about to BE allocated. Same trust level as join_room
    // (client-asserted, unauthenticated); it only ever receives pushes, and
    // nothing sensitive is emitted over it.
    socket.on('join_user', (email) => {
        if (!email) return;
        socket.join(`user:${email}`);
        console.log(`User ${socket.id} joined personal channel for ${email}`);
    });

    // Handle incoming chat messages
    socket.on('send_message', (data) => {
        // Broadcast to everyone in the room including sender (or use socket.to().emit)
        io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hostel Allocator API is running' });
});

const PORT = process.env.PORT || 5000;

// Only auto-connect/listen when this file is run directly (`node server.js`, exactly
// what the Dockerfile/dev scripts do) - not when required as a module. Lets tests
// `require('../server')` to get `app` for supertest and control their own Mongo
// connection (e.g. an in-memory instance) without also binding a real port or
// racing a real MongoDB connection attempt. Zero behavior change for production.
if (require.main === module) {
    connectDB();
    server.listen(PORT, () => {
        console.log(`Server & Socket.IO running on port ${PORT}`);
    });
}

module.exports = { app, server, connectDB };
