import { ApiError, request } from './client'
import { playerPath, type HistoryEntry, type PlayerView, type StoryEntry, type StoryView, type StressLoad } from './contracts'

import { yearActivityScene } from '../game/year-activities'
import { calendarResult, displayLabel, jobLabel, label } from '../game/labels'

interface NarrativeLog extends HistoryEntry {
  narrativeStatus?: 'SAVED' | 'PENDING' | 'FAILED' | null
  narrative?: string | null
  narrativeSource?: 'LLM' | 'TEMPLATE' | 'FALLBACK' | null
}

export function readEvidence(raw?: string | null): { title?: string; scene?: string; choiceLabel?: string; focusStat?: string; stressLoad?: StressLoad } {
  if (!raw) return {}
  try { return JSON.parse(raw) ?? {} } catch { return {} }
}

function savedAction(log: NarrativeLog) {
  const transition = calendarResult(log.resultCode)
  if (transition) return transition
  switch (log.kind) {
    case 'CAREER_PREFERENCE': return `희망 직무 선택 · ${jobLabel(log.subjectCode)}`
    case 'TURN': return log.resultCode === 'TURN_ADVANCED' ? `${log.year}학년 ${log.turn}턴 시작` : '이번 턴 일정 마무리'
    case 'YEAR_CHOICE': return `${label(log.subjectCode)} 선택`
    case 'PROJECT_START': return `개인 프로젝트 시작 · ${label(log.subjectCode)}`
    case 'PROJECT_WORK': {
      const step = log.resultCode === 'COMPLETE' ? '작품 완성' : log.resultCode === 'FAILED' ? '미완성으로 마무리' : '작업 진행'
      return `${label(log.subjectCode)} · ${step}`
    }
    case 'PORTFOLIO_REGISTER': return `${label(log.subjectCode)} 포트폴리오 등록`
    case 'COURSE_ENROLL': return `${label(log.subjectCode)} 수강 신청`
    case 'COURSE_ATTEND': return `${label(log.subjectCode)} 수업 출석`
    case 'COURSE_EXAM': return `${label(log.subjectCode)} 시험 응시`
    case 'JOB_APPLY': return `${label(log.subjectCode)} 지원`
    case 'JOB_STEP': return '채용 전형 진행'
    case 'GRADUATE': return '졸업 후 진로 확정'
    case 'NARSHA_ACTION': return log.subjectCode === 'MENTORING' ? '나르샤 멘토링 참여' : '나르샤 프로젝트 작업'
    default: return ''
  }
}

// Older server templates embed command identifiers in otherwise Korean sentences.
function readableScene(text: string | null | undefined, log: NarrativeLog) {
  if (!text) return
  const tokens = text.match(/\b[A-Z][A-Z0-9_]*\b/g) ?? []
  if (tokens.some(token => token === log.resultCode ||
      (token.includes('_') && (token === log.subjectCode || token === log.choiceCode)))) return
  return displayLabel(text)
}

function toStoryEntry(log: NarrativeLog, major?: string | null): StoryEntry | undefined {
  const evidence = readEvidence(log.evidenceJson)
  const variant = yearActivityScene(log.year, log.subjectCode, major)
  const choice = variant?.choices[log.choiceCode ?? '']
  const action = savedAction(log)
  if (!log.narrativeStatus && !log.narrative && !evidence.scene && !action) return
  const focus = { PROGRAMMING: '프로그래밍', ACADEMIC: '학업', COMMUNICATION: '의사소통' }[log.choiceCode ?? '']
  const summary = log.subjectCode?.startsWith('FOCUS_') && focus ? `학기 목표 선택 · ${focus}` :
    choice || displayLabel(evidence.choiceLabel) || action || undefined
  return {
    actionSummary: summary,
    id: String(log.logId), year: log.year, turn: log.turn, beforeSchoolDay: log.beforeSchoolDay,
    title: variant?.title || displayLabel(evidence.title) || action || '학교생활 기록',
    text: (log.narrativeSource === 'LLM' && readableScene(log.narrative, log)) ||
      (variant && choice && `${variant.situation} · ${choice}`) ||
      readableScene(log.narrative, log) || readableScene(evidence.scene, log) || action ||
      displayLabel(evidence.choiceLabel) || displayLabel(log.choiceCode) || '학교생활 기록',
    status: log.narrativeStatus === 'PENDING' ? 'PENDING' : 'READY',
    source: log.narrativeSource === 'LLM' ? 'AI' : log.narrativeSource === 'TEMPLATE' ? 'MOCK' : 'FALLBACK',
    stressLoad: Array.isArray(evidence.stressLoad?.sources) ? evidence.stressLoad : null,
    dialogue: [],
  }
}

export async function loadStory(player: PlayerView, signal: AbortSignal): Promise<StoryView> {
  const base = playerPath(player.id)
  // Spring history includes both narrative scenes and commands such as career picks and turns.
  // The demo stores authored scenes separately.
  if (!player.school) {
    try {
      const story = await request<StoryView>(base + '/story', { signal })
      if (player.phase === 'ENDED') return { ...story, history: await readHistory(base, signal) }
      return story
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error
    }
  }
  const entries: StoryEntry[] = []
  if (player.edition === 'MILD') {
    entries.push({ id: 'school-start', year: 1, turn: 1, title: '학교생활 시작',
      text: '대소고 1학년 1학기 학교생활을 시작했다.', dialogue: [], source: 'FALLBACK', status: 'READY' })
  }
  const history = await readHistory(base, signal)
  for (const log of history) {
    const entry = toStoryEntry(log, player.major)
    if (entry) entries.push(entry)
  }
  return { entries, history: player.phase === 'ENDED' ? history : undefined }
}

async function readHistory(base: string, signal: AbortSignal) {
  const history: NarrativeLog[] = []
  let afterId = 0
  for (;;) {
    const page = await request<{ items: NarrativeLog[]; nextAfterId?: number | null }>(
      base + '/history?limit=50&afterId=' + afterId, { signal })
    history.push(...page.items)
    if (page.nextAfterId == null) break
    if (page.nextAfterId <= afterId) throw new Error('기록의 다음 페이지를 확인할 수 없습니다.')
    afterId = page.nextAfterId
  }
  return history
}
