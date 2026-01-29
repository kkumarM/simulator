import React, { useEffect, useState } from 'react'
import Badge from './ui/Badge'
import Button from './ui/Button'

export default function HeaderBar({ backendUrl, onOpenTimeline, hasRun, activeTab, setActiveTab }: { backendUrl: string; onOpenTimeline: () => void; hasRun: boolean; activeTab: string; setActiveTab: (t: string) => void }) {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking')

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const res = await fetch(`${backendUrl || ''}/v1/runs`, { method: 'OPTIONS' })
          .catch(() => fetch(`${backendUrl || ''}/v1/runs`, { method: 'GET' }))
        if (!cancelled) setStatus(res.ok ? 'up' : 'down')
      } catch {
        if (!cancelled) setStatus('down')
      }
    }
    ping()
    const id = setInterval(ping, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [backendUrl])

  const badge = status === 'up' ? <Badge tone="success">Connected</Badge> : status === 'down' ? <Badge tone="danger">Disconnected</Badge> : <Badge tone="neutral">Checking…</Badge>

  return (
    <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur px-4 lg:px-6 py-3 border-b border-slate-800/70">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AurixMark />
          <div className="leading-tight">
            <div className="text-xl font-semibold text-slate-100 tracking-wide" style={{ letterSpacing: '0.08em' }}>AURIX</div>
            <div className="text-xs text-slate-400">GPU Workload Performance Explorer</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <nav className="flex items-center gap-2 text-slate-300">
            <HeaderLink label="Docs" active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} />
            <HeaderLink label="Help" active={activeTab === 'help'} onClick={() => setActiveTab('help')} />
          </nav>
          <div className="h-5 w-px bg-slate-800" />
          <div title={backendUrl || 'Not set'}>{badge}</div>
          {hasRun && <Button variant="secondary" onClick={onOpenTimeline}>Open Timeline</Button>}
        </div>
      </div>
    </header>
  )
}

function AurixMark() {
  return (
    <svg width="42" height="42" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Aurix logo">
      <path d="M60 4 L8 116 H112 Z" fill="none" stroke="#34D399" strokeWidth="8" strokeLinejoin="round" />
      <path d="M25 82 H95" stroke="#34D399" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 66 H88" stroke="#34D399" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 50 H82" stroke="#34D399" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 34 H76" stroke="#34D399" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

function HeaderLink({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`px-2 py-1 text-sm font-medium transition ${active ? 'text-emerald-300 border-b border-emerald-400' : 'text-slate-300 hover:text-slate-100'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
