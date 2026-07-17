// Custom Next.js server with integrated Socket.io for production (Railway).
// This file is pre-compiled during the build step (to server.js) so it runs instantly.

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
    accountName: string
  }

  const presences = new Map<string, Presence>()
  const COLORS = ['#16a34a', '#db2777', '#0891b2', '#d97706']
  let colorIdx = 0

  const room = (accountName: string) => `account:${accountName}`

  io.on('connection', (socket) => {
    console.log(`[sync] connected ${socket.id}`)

    socket.on('identify', (data: { name: string; accountName?: string }) => {
      const name = (data?.name || 'Anônimo').trim().slice(0, 30)
      const accountName = (data?.accountName || 'default').trim()

      // If this socket was already identified for a different account
      // (e.g. the user switched accounts without reconnecting), leave the
      // old room and let that room know we left.
      const existing = socket.data.presence as Presence | undefined
      if (existing && existing.accountName !== accountName) {
        socket.leave(room(existing.accountName))
        presences.delete(socket.id)
        socket.to(room(existing.accountName)).emit('presence:left', existing)
      }

      const color = COLORS[colorIdx++ % COLORS.length]
      const presence: Presence = {
        id: socket.id,
        name,
        color,
        connectedAt: Date.now(),
        accountName,
      }
      presences.set(socket.id, presence)
      socket.data.presence = presence
      socket.join(room(accountName))

      // Only reveal presence within the SAME account — other accounts on
      // this deployment must never see each other's users or activity,
      // even though they may have multiple workbooks each.
      const roomPresences = Array.from(presences.values()).filter(
        (p) => p.accountName === accountName
      )
      socket.emit('presence:list', roomPresences)
      socket.to(room(accountName)).emit('presence:joined', presence)
    })

    socket.on('change', (msg) => {
      const presence = socket.data.presence as Presence | undefined
      if (!presence) return
      const envelope = {
        ...msg,
        by: { name: presence.name, color: presence.color },
        at: Date.now(),
      }
      // Only broadcast to other clients logged into the SAME account.
      socket.to(room(presence.accountName)).emit('change', envelope)
    })

    socket.on('disconnect', () => {
      const presence = socket.data.presence as Presence | undefined
      if (presence) {
        presences.delete(socket.id)
        socket.to(room(presence.accountName)).emit('presence:left', presence)
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
