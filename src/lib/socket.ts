'use client'

// Singleton socket.io client.
// In development: connects to the separate mini-service on port 3003 via Caddy gateway.
// In production: Socket.io is disabled (app works with page refresh for sync).
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket

  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // Production: return a dummy socket that does nothing
    // (real-time sync is handled by page refresh)
    const dummy = {
      connected: false,
      emit: () => {},
      on: () => {},
      off: () => {},
      disconnect: () => {},
    } as unknown as Socket
    socket = dummy
    return dummy
  }

  // Development: connect to the separate mini-service via Caddy gateway
  socket = io('/?XTransformPort=3003', {
    transports: ['websocket', 'polling'],
    forceNew: true,
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
