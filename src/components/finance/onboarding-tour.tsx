'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Wallet, LayoutGrid, GripVertical, Users, Sparkles,
  ArrowRight, ArrowLeft, TrendingUp, TrendingDown, PiggyBank,
  Palette, Bell, Download,
} from 'lucide-react'

interface Props {
  onComplete: () => void
}

interface Step {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
  bullets?: string[]
}

const steps: Step[] = [
  {
    icon: <Wallet className="h-9 w-9 text-white" />,
    iconBg: 'bg-gradient-brand',
    title: 'Bem-vindo(a) ao NoFluxo',
    description:
      'Seu controle financeiro em fluxo: despesas, rendimentos e reservas, tudo num só lugar — em Reais e em outras moedas ao mesmo tempo.',
  },
  {
    icon: (
      <div className="flex items-center gap-1">
        <TrendingUp className="h-6 w-6 text-white" />
        <TrendingDown className="h-6 w-6 text-white" />
      </div>
    ),
    iconBg: 'bg-gradient-brand',
    title: 'Resumo do mês',
    description:
      'No topo, veja seu saldo total do mês. Toque em "Entradas" ou "Saídas" para ir direto até aquele grupo na tela.',
    bullets: [
      'Saldo total (com ou sem valores a receber)',
      'Total de entradas e saídas do mês',
      'Reservas separadas guardadas no período',
    ],
  },
  {
    icon: <LayoutGrid className="h-9 w-9 text-white" />,
    iconBg: 'bg-emerald-600',
    title: 'Cards, grupos e itens',
    description:
      'Despesas, Rendimentos e Reservas são cards. Dentro de cada um, você cria subgrupos e itens — cada nível pode ter sua própria cor.',
    bullets: [
      'Toque no "+" para adicionar um item ou subgrupo',
      'Toque na cor para personalizar cada card',
      'A cor de fundo mostra a qual grupo cada item pertence',
    ],
  },
  {
    icon: <GripVertical className="h-9 w-9 text-white" />,
    iconBg: 'bg-amber-500',
    title: 'Arraste para organizar',
    description:
      'Segure a alcinha (⠿) ao lado de qualquer item ou subgrupo e arraste para cima ou para baixo para reordenar do jeito que preferir.',
  },
  {
    icon: <Users className="h-9 w-9 text-white" />,
    iconBg: 'bg-sky-600',
    title: 'Em tempo real, junto com quem você compartilha',
    description:
      'A caixinha de atividade mostra quem está online e o histórico de ações — assim dá pra usar desfazer/refazer com consciência de quem mudou o quê.',
  },
  {
    icon: <Sparkles className="h-9 w-9 text-white" />,
    iconBg: 'bg-violet-600',
    title: 'Mais recursos',
    description: 'No menu do topo você encontra tudo isso:',
    bullets: [
      'Backup e restauração dos seus dados',
      'Moedas personalizadas e cotações',
      'Notificações de vencimento',
      'Exportar para Excel',
    ],
  },
]

export function OnboardingTour({ onComplete }: Props) {
  const [i, setI] = useState(0)
  const step = steps[i]
  const isLast = i === steps.length - 1

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className={cn('h-20 w-20 rounded-3xl flex items-center justify-center mb-6 shadow-elevated', step.iconBg)}>
          {step.icon}
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2 text-balance">{step.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{step.description}</p>

        {step.bullets && (
          <ul className="mt-4 w-full space-y-2 text-left">
            {step.bullets.map((b, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground bg-muted/60 rounded-lg px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span className="text-pretty">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-8 mb-6">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                'h-1.5 rounded-full transition-all',
                idx === i ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
              )}
            />
          ))}
        </div>

        <div className="w-full flex items-center gap-2">
          {i > 0 && (
            <Button variant="outline" className="flex-shrink-0" onClick={() => setI(i - 1)} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {!isLast ? (
            <>
              <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={onComplete}>
                Pular
              </Button>
              <Button className="flex-[2]" onClick={() => setI(i + 1)}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={onComplete}>
              Começar a usar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
