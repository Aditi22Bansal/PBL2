require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const chatRoutes = require('./routes/chat');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow frontend access
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

connectDB();

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
server.listen(PORT, () => {
    console.log(`Server & Socket.IO running on port ${PORT}`);

    // Keep-alive: ping both services every 14 min to prevent Render free-tier cold starts.
    // Render spins down after 15 min of inactivity — this keeps them warm.
    const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14 minutes
    const axios = require('axios');

    setInterval(async () => {
        const nodeUrl = process.env.SELF_URL || `http://localhost:${PORT}`;
        const pythonUrl = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

        try {
            await axios.get(`${nodeUrl}/api/health`, { timeout: 10000 });
            console.log('[Keep-Alive] Node backend pinged ✓');
        } catch (e) {
            console.warn('[Keep-Alive] Node ping failed:', e.message);
        }

        try {
            await axios.get(`${pythonUrl}/health`, { timeout: 10000 });
            console.log('[Keep-Alive] Python backend pinged ✓');
        } catch (e) {
            console.warn('[Keep-Alive] Python ping failed (may be waking up):', e.message);
        }
    }, KEEP_ALIVE_INTERVAL);
});
