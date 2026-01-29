import React from 'react'

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/70 bg-slate-950 text-slate-400 text-sm px-6 py-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <div>© 2026 Aurix — Internal GPU Workload Performance Explorer</div>
        <div className="text-xs text-slate-500">Built for internal performance analysis and system reasoning</div>
      </div>
    </footer>
  )
}
