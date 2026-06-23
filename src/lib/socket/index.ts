import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '~/lib/auth/jwt';
import { registerHandlers } from './handlers';

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'tauri://localhost',
  'https://tauri.localhost',
];

let io: Server | null = null;

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (process.env.NODE_ENV === "development" && origin?.startsWith("http://localhost:")) {
          callback(null, true);
          return;
        }
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) return next(new Error('Unauthorized'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    registerHandlers(socket);
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
