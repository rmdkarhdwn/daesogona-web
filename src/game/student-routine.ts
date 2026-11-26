import { isSchool, type ChoiceView, type EventView, type PlayerView } from '../api/contracts'

// New event types stay interactive until their command and consequences are known.
const routineCodes = new Set([
  'E11', 'S01', 'S02', 'S03', 'S101', 'S103', 'TERM_FOCUS', 'VACATION', 'STRESS_SUPPORT',
  'S202', 'N204', 'NARSHA_WRAP', 'NARSHA_RANK', 'N205', 'SOFTWAREWAVE',
])

const careerWords: Record<string, RegExp> = {
  WEB: /웹|화면|브라우저/, BACKEND: /서버|API|데이터베이스/, CROSS_PLATFORM: /모바일|앱|플랫폼/,
  ANDROID: /모바일|앱|안드로이드/, IOS: /모바일|앱|iOS/, GAME: /게임|조작|프레임/,
  NETWORK: /네트워크|연결|통신/, SECURITY: /보안|권한|접근/, UI_UX: /사용성|사용자|디자인/,
  AI_DEVELOPER: /모델|학습 데이터|분류/, AI_NATIVE: /모델|자동화|프롬프트/,
}

export function isStudentRoutine(player: PlayerView, event: EventView) {
  return isSchool(player) && !event.selectionCount &&
    (routineCodes.has(event.code) || /^(DAILY_|VACATION_Y|FOCUS_Y)/.test(event.code))
}

export function routineChoice(player: PlayerView, event: EventView): ChoiceView | undefined {
  if (!isStudentRoutine(player, event)) return
  const tired = player.stats.S >= 55 || player.stats.H <= 40
  const focus = player.school?.semesterFocus ?? player.semesterFocus?.code
  const vacation = event.code.startsWith('VACATION')
  const semester = event.code === 'TERM_FOCUS' || event.code.startsWith('FOCUS_Y')
  const options = event.choices.filter(choice => choice.enabled && !(vacation && player.year >= 3 && choice.code.includes('CAMP')))
  function score(choice: ChoiceView) {
    const words = choice.code + ' ' + choice.label
    if (vacation) return Number(choice.code.includes('CAMP') === !tired) * 10
    if (semester) {
      if (tired && choice.code === 'FOCUS_BALANCE') return 10
      if (player.stats.G < 55 && /ACADEMIC|GRADES/.test(choice.code)) return 9
      if (player.stats.C < 28 && /COMMUNICATION|TEAM/.test(choice.code)) return 8
      return /CAREER|PROGRAMMING/.test(choice.code) ? 6 : 0
    }
    if (tired && /REST|SLEEP|BREAK|WALK|SCOPE|쉬기|휴식|상담|범위.*줄/.test(words)) return 9
    if (careerWords[player.currentCareerCode ?? '']?.test(words)) return 7
    if (focus === 'C' || focus === 'FOCUS_TEAM') return /PAIR|TEAM|DISCUSS|협업|팀원|친구|함께/.test(words) ? 5 : 0
    if (focus === 'A' || focus === 'FOCUS_GRADES') return /PLAN|NOTE|ASK|정리|질문|복습/.test(words) ? 5 : 0
    return /PRACTICE|RETRY|VERIFY|PAIR|COOPERATE|ATTEND|구현|검증|실습|시연/.test(words) ? 5 : 0
  }
  // Stable ties for refresh and retry, varied by student, event and turn.
  const seed = [player.id, player.year, player.turn, event.code].join('/')
  const hash = (code: string) => Array.from(seed + code).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
  return options.sort((a, b) => score(b) - score(a) || hash(a.code) - hash(b.code))[0]
}
