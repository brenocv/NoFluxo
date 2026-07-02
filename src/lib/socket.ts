'use client'

// Singleton socket.io client. Connects to the finance-sync mini-service on port 3003
// via the Caddy gateway (XTransformPort query param).
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (socket) return socket
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
