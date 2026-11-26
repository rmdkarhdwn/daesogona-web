import type { EndingView, GraduationSummary, HistoryEntry } from '../api/contracts'
import { fieldLearningRoutes, isFieldLearningRoute } from './field-learning'
import { jobLabel, label, trackLabel } from './labels'

export type Shot = 'campus' | 'classroom' | 'workbench' | 'commute' | 'notebook'
export interface GraduationMemory { when: string; title: string; text: string; shot: Shot }
export type Finale = Pick<EndingView, 'title' | 'selectedPath' | 'acceptedCompany' | 'acceptedRole'>

const sequence = ['first', 'narsha1', 'narsha2', 'field', 'change', 'application', 'major', 'track', 'work', 'admission', 'focus']
const shots: Record<string, Shot> = {
  first: 'classroom', focus: 'classroom', major: 'classroom', track: 'workbench', change: 'notebook',
  narsha1: 'notebook', narsha2: 'workbench', work: 'workbench', application: 'notebook', field: 'commute',
}

export function graduationMemories(summary: GraduationSummary, history: HistoryEntry[], ending: Finale): GraduationMemory[] {
  const moments = new Map<string, GraduationMemory & { year: number; order: number }>()
  function add(key: string, year: number, order: number, when: string, title: string, text: string) {
    moments.set(key, { year, order, when, title, text, shot: shots[key] ?? 'campus' })
  }
  const projects = summary.narshaProjects ?? (summary.narsha ? [summary.narsha] : [])
  if (summary.initialCareerCode) add('first', 0, 0, '처음 품은 꿈', '희망 직무를 정한 날', jobLabel(summary.initialCareerCode))
  if (summary.major) add('major', 2, 0, '2학년', '학과를 결정했다', label(summary.major))
  if (summary.track) add('track', 3, 0, '3학년', '집중해서 배울 수업을 골랐다', trackLabel(summary.track))
  for (const project of projects) {
    const year = 'year' in project ? project.year : project.schoolYear
    const topic = 'topic' in project ? project.topic : project.topicLabel
    if (year && topic) add('narsha' + year, year, 1, year + '학년', '우리 팀이 정한 나르샤 주제', topic)
  }
  const route = summary.fieldLearningRoute ?? summary.fieldLearning?.route ?? summary.fieldTrips?.find(trip => trip.eventCode === 'J01')?.choiceCode
  if (isFieldLearningRoute(route)) add('field', 3, 1, '3학년', '학교 밖에서 배울 곳을 골랐다', fieldLearningRoutes[route].name)

  let pickedCareer = false
  for (const log of history) {
    const { subjectCode: code, choiceCode: choice, year, turn } = log
    const when = year > 0 ? year + '학년' + (turn > 0 ? ' · ' + turn + '턴' : '') : '입학 전'
    const record = (key: string, title: string, text: string) => add(key, year, turn, when, title, text)
    if (['CAREER_PICK', 'CAREER_CHANGE', 'CAREER_PREFERENCE'].includes(log.kind)) {
      const first = !pickedCareer && log.kind !== 'CAREER_CHANGE' && (!summary.initialCareerCode || summary.initialCareerCode === code)
      record(first ? 'first' : 'change', first ? '희망 직무를 정한 날' : '희망 직무를 다시 정했다', jobLabel(code))
      pickedCareer = true
    } else if (log.kind === 'YEAR_CHOICE' || code === 'Y201' || code === 'Y301') {
      const selected = log.kind === 'YEAR_CHOICE' ? code : choice
      if (selected && year === 2) record('major', '학과를 결정했다', label(selected))
      if (selected && year === 3) record('track', '집중해서 배울 수업을 골랐다', trackLabel(selected))
    } else if (code === 'AD00' && choice && ['GENERAL', 'MEISTER', 'LOCAL', 'SOCIAL'].includes(choice)) {
      record('admission', '지원서를 냈던 전형', label(choice))
    } else if (year === 1 && (code === 'FOCUS_Y1_S1' || code === 'TERM_FOCUS') && choice && !moments.has('focus')) {
      const focus = { PROGRAMMING: '프로그래밍', COMMUNICATION: '의사소통', ACADEMIC: '학업' }[choice] ?? label(choice)
      if (focus !== choice) record('focus', '첫 학기에 집중하기로 한 것', focus)
    } else if (code === 'J01' && isFieldLearningRoute(choice)) {
      record('field', '학교 밖에서 배울 곳을 골랐다', fieldLearningRoutes[choice].name)
    } else if (['NARSHA_START', 'NARSHA_RESUME', 'N104', 'N201'].includes(code)) {
      const key = 'narsha' + year
      const project = moments.get(key)
      if (project) record(key, project.title, project.text)
      else if (choice === 'SKIP') record(key, '나르샤 참여를 결정한 날', '이번 프로젝트에는 참여하지 않기로 했다.')
    } else if (log.kind === 'JOB_APPLY' || log.kind === 'APPLICATION') {
      record('application', '지원서를 냈다', label(code))
    } else if (log.kind === 'PORTFOLIO_REGISTER' || (log.kind === 'ACTION' && code === 'PORTFOLIO_ADD' && choice)) {
      const work = code === 'PORTFOLIO_ADD' ? choice! : code
      record('work', '포트폴리오에 남긴 작품', label(work))
    }
  }
  const company = ending.acceptedCompany ?? summary.acceptedCompany ?? summary.offer?.companyCode
  const role = ending.acceptedRole ?? summary.acceptedRole ?? summary.offer?.role
  const path = ending.selectedPath ?? summary.nextPath ?? summary.path
  const closing: GraduationMemory = {
    when: '졸업, 그 다음 날', title: ending.title,
    shot: company ? 'commute' : path === 'INDIE' || path === 'INDIE_DEV' ? 'workbench' : 'notebook',
    text: company ? [label(company) + '의 채용 제안 수락', role && jobLabel(role)].filter(Boolean).join(' · ')
      : path === 'UNEMPLOYED' || path === 'RETRY_JOB' ? '수첩을 펼쳤다. 이번에는 어디에 지원해 볼까.'
        : path ? label(path) : '학교생활의 마지막 장을 덮었다.',
  }
  const highlights = sequence.flatMap(key => {
    const item = moments.get(key)
    return item ? [item] : []
  }).slice(0, 6).sort((a, b) => a.year - b.year || a.order - b.order)

  return [{ when: '졸업식 아침', title: '운동장 너머로', text: '교문을 나서기 전, 처음 들어오던 날을 떠올렸다.', shot: 'campus' },
    ...highlights, closing]
}
