import type { FieldLearningRoute, HistoryEntry } from '../api/contracts.ts'
import { isFieldLearningRoute } from './field-learning.ts'
import type { ActivityScene } from './year-activities.ts'

export function selectedPlacement(history: HistoryEntry[]) {
  const selection = history.find(log => log.year === 3 && log.subjectCode === 'J01' && log.resultCode === 'SELECTED')
  return selection && isFieldLearningRoute(selection.choiceCode) ? { route: selection.choiceCode, logId: selection.logId } : undefined
}

const practicals: Record<string, [string, string, string]> = {
  WEB: ['예약 화면에 빈 결과가 뜬다', '예약 목록이 비어 있습니다. 실제로 예약이 없는 건지 아직 응답이 오지 않은 건지 사용자는 구분할 수 없습니다.', '로딩·빈 목록·오류를 구분해 구현하기'],
  FE: ['키보드로 신청서를 끝까지 채울 수 있을까', '신청 화면을 마우스 없이 써 보니 오류가 난 입력칸을 다시 찾기 어렵습니다.', '오류가 난 입력칸으로 초점을 돌려주기'],
  BE: ['마지막 한 자리에 예약 두 건', '실습용 서버에서 두 요청이 마지막 좌석을 동시에 예약했습니다. 둘 다 성공으로 응답했습니다.', '예약 한 건만 확정되도록 저장 과정 수정하기'],
  MOBILE: ['작성하던 신청서가 사라졌다', '휴대전화 화면을 돌렸다가 돌아오니 작성 중이던 신청 내용이 사라집니다.', '화면이 바뀌어도 초안이 남게 고치기'],
  AI: ['불량품 열 개 중 하나만 찾은 모델', '정확도는 높은데 실제 불량품을 대부분 놓칩니다. 어떤 실수를 더 줄일지 정해야 합니다.', '판정 기준을 바꾸며 놓친 불량품 수 비교하기'],
  GAME: ['낮은 프레임에서만 느려지는 캐릭터', '같은 키를 같은 시간 동안 눌렀는데 기기마다 캐릭터가 이동한 거리가 다릅니다.', '경과 시간으로 이동 거리를 계산해 보기'],
  NETWORK: ['실습실 끝자리에서 끊기는 통화', '두 자리에서 통화 품질을 재니 차이가 납니다. 수업에서 쓸 점검 순서를 정합니다.', '두 자리의 지연 시간과 손실률 비교하기'],
}
function practical(track?: string | null): ActivityScene {
  const [title, situation, task] = practicals[track ?? ''] ?? ['인수 전 마지막 동작 점검', '같은 기능이 두 환경에서 다르게 동작합니다. 담당자가 다시 확인할 수 있게 점검합니다.', '차이가 나는 조건을 재현하고 수정하기']
  return { title, situation, choices: { REVIEW_ASK: '어느 조건까지 동작해야 하는지 묻기', REVIEW_RETRY: task, REVIEW_NOTE: '다음 검토에 쓸 재현 절차 적기' } }
}

const placements: Record<FieldLearningRoute, ActivityScene> = {
  DOMESTIC: { title: '기업 멘토에게 건넬 작업 일지', situation: '국내 현장실습 기록에 “오류 수정”이라고만 적었습니다. 다음 담당자가 이어서 확인하려면 무엇이 더 필요할까요?',
    choices: { REFLECT_NOTE: '오류를 재현한 순서와 수정 결과 적기', REFLECT_TALK: '동료에게 일지를 읽어 보고 빠진 단계 묻기', REFLECT_REDUCE: '다음 점검 범위를 기능 하나로 좁히기' } },
  SILICON_VALLEY: { title: '시차가 있는 팀에 남길 인계 메모', situation: '실리콘밸리 현장학습의 협업 연습입니다. 내가 자리를 비운 뒤에도 동료가 작업을 이어갈 수 있도록 영어 메모를 남깁니다.',
    choices: { REFLECT_NOTE: '시도한 방법과 남은 질문을 영어로 적기', REFLECT_TALK: '동료에게 메모만 보고 작업 순서를 설명해 달라고 하기', REFLECT_REDUCE: '다음 작업자가 확인할 항목 하나만 남기기' } },
}
export const seniorFocus: Record<string, string> = {
  PROGRAMMING: '실무 과제 구현과 검증', COMMUNICATION: '인수인계와 면접 답변', ACADEMIC: '직무 기초와 실기 대비',
  FOCUS_BALANCE: '지원 일정과 컨디션 관리', FOCUS_GRADES: '졸업 전 전공 실기 대비', FOCUS_CODE: '납품할 기능 구현과 검증',
  FOCUS_CAREER: '지원 직무 과제 연습', FOCUS_TEAM: '팀 인수인계와 업무 설명', FOCUS_ENGLISH: '영어 기술 문서와 업무 메일',
}
const scenes: Record<string, ActivityScene> = {
  S03: { title: '지원서에 쓴 작품을 면접에서 설명한다면', situation: '작품 소개만 보면 어느 부분을 내가 만들었는지 알기 어렵습니다. 서류와 면접 중 어디부터 다듬을까요?',
    choices: { PORTFOLIO: '직접 해결한 문제와 결과를 지원서에 담기', PRESENT: '동료 앞에서 내 역할을 설명하고 질문받기' } },
  DAILY_REFLECTION: { title: '공고의 한 줄과 내 경험 연결하기', situation: '관심 직무의 공고에서 “팀과 문제를 해결한 경험”을 골랐습니다. 어떤 작업이 그 근거가 될까요?',
    choices: { REFLECT_NOTE: '내가 해결한 문제와 결과 적기', REFLECT_TALK: '팀원에게 기억나는 내 기여 묻기', REFLECT_REDUCE: '가장 잘 설명할 수 있는 사례 하나 남기기' } },
  DAILY_AFTER_CLASS: { title: '면접관이 직접 열어 볼 작품', situation: '친구에게 작품 링크만 보내 보니 첫 화면에서 사용법을 묻습니다. 오늘 마칠 일을 고릅니다.',
    choices: { AFTER_BREAK: '오늘 작업을 끝내고 쉬기', AFTER_PRACTICE: '첫 실행에 쓸 예시 데이터 넣기', AFTER_PLAN: '시연에 꼭 필요한 수정 순서 정하기' } },
  DAILY_EXAM: { title: '전공 실기, 설명까지 해 보기', situation: '실기 연습에서 정답은 냈는데 왜 그 방법을 골랐는지 설명하다 막혔습니다.',
    choices: { EXAM_GROUP: '친구와 서로 다른 풀이의 비용 비교하기', EXAM_CRAM: '다른 풀이를 직접 구현해 시간 재기', EXAM_SPLIT: '구현과 설명 연습을 다른 날로 나누기' } },
  DAILY_STUDENT_TALK: { title: '모의 기술면접의 꼬리 질문', situation: '연습 면접에서 친구가 물었습니다. “팀이 만든 것 중 직접 결정한 부분은 어디예요?”',
    choices: { SENIOR_QUESTION: '설계와 구현 중 어느 쪽을 더 듣고 싶은지 묻기', SENIOR_SPEECH: '내 결정과 그 결과를 30초 안에 답하기', SENIOR_NOTE: '답을 뒷받침할 작업 기록 표시하기' } },
  DAILY_SUPPORT_REQUEST: { title: '새 팀원이 실행할 수 있는 납품본', situation: '전공 수업에서 다른 팀과 결과물을 교환합니다. 내 컴퓨터 없이도 실행할 수 있어야 합니다.',
    choices: { SUPPORT_PLAN: '실행에 필요한 버전과 설정 정리하기', SUPPORT_TEAM: '팀원의 새 환경에서 설치 순서 확인하기', SUPPORT_LIMIT: '기본 환경에서 핵심 기능만 검증하기' } },
  DAILY_ALUMNI: { title: '채용 공고 너머의 첫 업무', situation: '졸업생에게 신입 개발자의 첫 일주일을 물을 기회입니다. 공고만 보고는 알기 어려웠던 것을 고릅니다.',
    choices: { ALUMNI_WORK: '처음 맡았던 업무와 완료 기준 묻기', ALUMNI_STUDY: '입사 뒤 부족한 기술을 익힌 방법 묻기', ALUMNI_PATH: '지원 전에 직무가 맞는지 확인한 방법 묻기' } },
}

export function seniorScene(code: string, track?: string | null, placement?: FieldLearningRoute) {
  if (code === 'DAILY_FEEDBACK') return practical(track)
  if (code === 'DAILY_REFLECTION' && placement) return placements[placement]
  return scenes[code]
}
