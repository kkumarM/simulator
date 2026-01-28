import React from 'react'

type FieldProps = {
  label: string
  tooltip?: string
  suffix?: string
  error?: string
  children: React.ReactNode
}

export default function Field({ label, tooltip, suffix, error, children }: FieldProps) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="flex items-center gap-2 text-slate-300">
        <span>{label}</span>
        {tooltip && <span className="text-slate-500 text-xs" title={tooltip}>?</span>}
        {suffix && <span className="ml-auto text-slate-500 text-xs">{suffix}</span>}
      </div>
      {children}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </label>
  )
}
