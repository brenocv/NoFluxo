'use client'

// Singleton socket.io client. The custom server (server.ts) mounts Socket.IO on
// the same HTTP server/port as Next.js, at path /api/socketio, in both dev and
// production — so we always connect same-origin, no special-casing needed.
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket

  socket = io({
    path: '/api/socketio',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 10000,
  })
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
