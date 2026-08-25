const { Server } = require('socket.io');
const logger = require('./utils/logger');
const { getAllowedOrigins } = require('./utils/origins');

// Real-time bridge for the owner console. The HTTP server is shared with
// Socket.IO so the REST API and push events run on the same port. Without an
// attached server (e.g. under test) every emit is a no-op and never throws.
class Realtime {
  constructor() {
    this.io = null;
  }

  attach(httpServer) {
    // CORS admits the env origins plus every live Dedicated Site hostname
    // (ADR-0029): owners' consoles connect from their own domains too.
    this.io = new Server(httpServer, {
      cors: {
        origin: async (origin, callback) => {
          if (!origin) return callback(null, true);
          const origins = await getAllowedOrigins(process.env);
          const host = origin.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
          const allowed = origins.some((o) => {
            const oHost = o.replace(/^https?:\/\//, '').toLowerCase();
            return host === oHost || host.endsWith(`.${oHost}`);
          });
          callback(null, allowed);
        },
        credentials: true
      }
    });

    this.io.use((socket, next) => {
      try {
        const auth = socket.handshake.auth?.token || '';
        const header = String(socket.handshake.headers?.authorization || '');
        const token = auth || header.replace(/^Bearer\s+/i, '');
        if (!token) {
          return next(new Error('unauthorized'));
        }
        const { verifyIdToken, upsertUser } = require('./middleware/authenticate');
        verifyIdToken(token)
          .then((decoded) =>
            // Rooms are keyed by the DB user id (what controllers publish with),
            // not the Firebase UID.
            upsertUser(decoded.uid, decoded.email, decoded.name)
          )
          .then((user) => {
            socket.userId = user.id;
            next();
          })
          .catch(() => next(new Error('unauthorized')));
      } catch (error) {
        next(new Error('unauthorized'));
      }
    });

    this.io.on('connection', (socket) => {
      socket.join(`owner:${socket.userId}`);
      logger.info(`Socket connected: ${socket.userId}`);
      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.userId}`);
      });
    });

    return this.io;
  }

  emitToOwner(ownerId, event, payload) {
    if (!this.io) {
      return false;
    }
    this.io.to(`owner:${ownerId}`).emit(event, payload);
    return true;
  }
}

const realtime = new Realtime();

module.exports = { Realtime, realtime };