import { ApiError, request } from './client'
import { playerPath, type HistoryEntry, type StoryEntry, type StoryView, type StressLoad } from './contracts'

interface NarrativeLog extends HistoryEntry {
  narrativeStatus?: 'SAVED' | 'PENDING' | 'FAILED' | null
  narrative?: string | null
  narrativeSource?: 'LLM' | 'TEMPLATE' | 'FALLBACK' | null
  evidenceJson?: string | null
}

function readEvidence(raw?: string | null): { title?: string; scene?: string; stressLoad?: StressLoad } {
  if (!raw) return {}
  try { return JSON.parse(raw) ?? {} } catch { return {} }
}

function toStoryEntry(log: NarrativeLog): StoryEntry {
  const evidence = readEvidence(log.evidenceJson)
  return {
    id: String(log.logId), year: log.year, turn: log.turn, beforeSchoolDay: log.beforeSchoolDay,
    title: evidence.title || '학교생활 기록', text: log.narrative || evidence.scene || '',
    status: log.narrativeStatus === 'PENDING' ? 'PENDING' : 'READY',
    source: log.narrativeSource === 'LLM' ? 'AI' : log.narrativeSource === 'TEMPLATE' ? 'MOCK' : 'FALLBACK',
    stressLoad: Array.isArray(evidence.stressLoad?.sources) ? evidence.stressLoad : null,
    dialogue: [],
  }
}

// Older Spring deployments expose the same saved narratives through paginated history.
let useHistory = false
export async function loadStory(id: string, signal: AbortSignal): Promise<StoryView> {
  const base = playerPath(id)
  if (!useHistory) {
    try { return await request<StoryView>(base + '/story', { signal }) } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
  }
  const entries: StoryEntry[] = []
  let afterId = 0
  for (;;) {
    const page = await request<{ items: NarrativeLog[]; nextAfterId?: number | null }>(
      base + '/history?limit=50&afterId=' + afterId, { signal })
    for (const log of page.items) {
      if (log.narrativeStatus || log.narrative) entries.push(toStoryEntry(log))
    }
    if (page.nextAfterId == null) break
    if (page.nextAfterId <= afterId) throw new Error('기록의 다음 페이지를 확인할 수 없습니다.')
    afterId = page.nextAfterId
  }
  useHistory = true
  return { entries }
}
