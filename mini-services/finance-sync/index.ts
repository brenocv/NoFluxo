// Real-time sync service for the family finance app.
// Listens on port 3003 (matches XTransformPort=3003 used by the client).
//
// Responsibilities:
//   1. Notify all clients when a transaction/category/config changes.
//   2. Track lightweight presence (who is online) so the UI can show
//      "Breno está online" / "Kiki está online".
//   3. Broadcast a small activity feed when a change comes in.

import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer((req, res) => {
  // tiny health-check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount }))
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

const io = new Server(httpServer, {
  // Path MUST be '/' so Caddy forwards to the right port.
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface Presence {
  id: string
  name: string
  color: string
  connectedAt: number
}

const presences = new Map<string, Presence>()

// Pre-defined user colors for the couple
const COLORS = ['#16a34a', '#db2777', '#0891b2', '#d97706']
let colorIdx = 0

io.on('connection', (socket) => {
  console.log(`[sync] connected ${socket.id}`)

  // Client identifies itself: { name: 'Breno' | 'Kiki' | ... }
  socket.on('identify', (data: { name: string }) => {
    const name = (data?.name || 'Anônimo').trim().slice(0, 30)
    const color = COLORS[colorIdx++ % COLORS.length]
    const presence: Presence = {
      id: socket.id,
      name,
      color,
      connectedAt: Date.now(),
    }
    presences.set(socket.id, presence)
    socket.data.presence = presence

    // Send current presence list to the new client
    socket.emit('presence:list', Array.from(presences.values()))
    // Notify everyone else
    socket.broadcast.emit('presence:joined', presence)
  })

  // A client changed something. Payload:
  //   { type: 'transaction' | 'category' | 'config' | 'category:reorder',
  //     action: 'create' | 'update' | 'delete',
  //     payload: any,
  //     detail: string }
  socket.on('change', (msg) => {
    const presence = socket.data.presence as Presence | undefined
    const envelope = {
      ...msg,
      by: presence ? { name: presence.name, color: presence.color } : null,
      at: Date.now(),
    }
    // Broadcast to all OTHER clients
    socket.broadcast.emit('change', envelope)
  })

  socket.on('disconnect', () => {
    const presence = socket.data.presence as Presence | undefined
    if (presence) {
      presences.delete(socket.id)
      socket.broadcast.emit('presence:left', presence)
    }
    console.log(`[sync] disconnected ${socket.id}`)
  })

  socket.on('error', (err) => {
    console.error(`[sync] socket error ${socket.id}:`, err)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[finance-sync] listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[finance-sync] SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[finance-sync] SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
