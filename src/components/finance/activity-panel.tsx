'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ActivityEntry, PresenceUser } from '@/lib/finance'
import { Circle, Users } from 'lucide-react'

interface Props {
  activity: ActivityEntry[]
  presences: PresenceUser[]
  currentUser: string
}

export function ActivityPanel({ activity, presences, currentUser }: Props) {
  const others = presences.filter((p) => p.name !== currentUser)
  return (
    <Card className="p-3 space-y-3 shadow-sm">
      {/* Online users */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Online</span>
        </div>
        {presences.length === 0 && (
          <span className="text-xs text-muted-foreground italic">ninguém por enquanto</span>
        )}
        {presences.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted"
          >
            <Circle
              className="h-2 w-2 fill-emerald-500 text-emerald-500"
            />
            <span className="font-medium" style={{ color: p.color }}>
              {p.name}
            </span>
            {p.name === currentUser && (
              <span className="text-muted-foreground">(você)</span>
            )}
          </span>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Atividade recente
        </div>
        {activity.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhuma atividade ainda
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1 -mr-1">
            {activity.slice(0, 10).map((a) => (
              <li key={a.id} className="text-xs flex items-start gap-2">
                <span
                  className={cn(
                    'mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0',
                    a.action === 'create' && 'bg-emerald-500',
                    a.action === 'update' && 'bg-amber-500',
                    a.action === 'delete' && 'bg-rose-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">{a.user}</span>{' '}
                  <span className="text-foreground">{a.detail}</span>
                  <div className="text-[10px] text-muted-foreground">
                    {formatRelative(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
