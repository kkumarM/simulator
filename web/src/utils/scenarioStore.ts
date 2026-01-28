import { defaultScenario } from '../components/ScenarioPanel'

const INDEX_KEY = 'gpu-sim:scenarios:index'

export function saveScenarioEntry(scenario: any) {
  const id = Date.now().toString()
  const entry = { id, name: scenario.name || `scenario-${id}`, updated: new Date().toISOString() }
  const index = loadIndex().filter((i) => i.id !== id)
  index.push(entry)
  localStorage.setItem(`gpu-sim:scenario:${id}`, JSON.stringify(scenario))
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  return { id, index }
}

export function loadScenario(id: string) {
  const raw = localStorage.getItem(`gpu-sim:scenario:${id}`)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function deleteScenario(id: string) {
  localStorage.removeItem(`gpu-sim:scenario:${id}`)
  const next = loadIndex().filter((i) => i.id !== id)
  localStorage.setItem(INDEX_KEY, JSON.stringify(next))
  return next
}

export function loadIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function loadLastScenario() {
  const idx = loadIndex()
  if (!idx.length) return defaultScenario
  const latest = idx[idx.length - 1]
  return loadScenario(latest.id) || defaultScenario
}
