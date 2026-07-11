// Custom Next.js server with integrated Socket.io for production (Railway).
// In development, `bun run dev` uses the standard Next.js dev server + the
// separate mini-services/finance-sync. In production (Railway), this file
// starts both Next.js and Socket.io on the same port.

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'

const PORT = Number(process.env.PORT) || 3000
const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'

const app = next({ dev, hostname, port: PORT })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  // Attach Socket.io to the same HTTP server
  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
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
  const COLORS = ['#16a34a', '#db2777', '#0891b2', '#d97706']
  let colorIdx = 0

  io.on('connection', (socket) => {
    console.log(`[sync] connected ${socket.id}`)

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

      socket.emit('presence:list', Array.from(presences.values()))
      socket.broadcast.emit('presence:joined', presence)
    })

    socket.on('change', (msg) => {
      const presence = socket.data.presence as Presence | undefined
      const envelope = {
        ...msg,
        by: presence ? { name: presence.name, color: presence.color } : null,
        at: Date.now(),
      }
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
    console.log(`> Ready on http://${hostname}:${PORT}`)
    console.log(`> Socket.io listening on path /api/socketio`)
  })
})
