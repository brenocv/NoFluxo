'use client'

// Singleton socket.io client.
// In development: connects to the separate mini-service on port 3003 via Caddy gateway.
// In production (Railway): connects to the integrated Socket.io server on /api/socketio.
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket

  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Production: connect to the integrated Socket.io on the same origin
    socket = io({
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  } else {
    // Development: connect to the separate mini-service via Caddy gateway
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
