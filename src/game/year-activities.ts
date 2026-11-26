interface ActivityScene {
  title: string
  situation: string
  choices: Record<string, string>
}

// The server still offers, validates and scores each underlying choice.
const secondYearScenes: Record<string, ActivityScene> = {
  DAILY_FEEDBACK: {
    title: '코드 리뷰에 남은 한 줄', situation: '선생님이 전공 과제의 저장 함수를 짚었습니다. “같은 요청이 두 번 들어오면 어떻게 될까?”',
    choices: { REVIEW_ASK: '어느 경우에 중복 저장되는지 질문하기', REVIEW_RETRY: '중복 요청을 처리하도록 함수 고치기', REVIEW_NOTE: '다음 리뷰에서 확인할 조건 적기' },
  },
  DAILY_AFTER_CLASS: {
    title: '시연 전날의 실습실', situation: '과제 시연은 내일입니다. 기본 기능은 돌아가지만 잘못 입력했을 때 안내가 없습니다.',
    choices: { AFTER_BREAK: '오늘은 마치고 기숙사에서 쉬기', AFTER_PRACTICE: '입력 오류 안내 한 가지 구현하기', AFTER_PLAN: '시연에 필요한 수정부터 순서 정하기' },
  },
  DAILY_NARSHA: {
    title: '나르샤 시연, 어디까지 보여줄까', situation: '팀 회의에서 시연을 처음부터 돌려 봤습니다. 중간에 끊기는 기능도 있고, 한 번 더 보여주고 싶은 기능도 있습니다.',
    choices: { NARSHA_PAIR: '팀원과 끊기는 구간을 나눠 고치기', NARSHA_SCOPE: '안정적으로 동작하는 기능으로 시연 구성하기', NARSHA_EXPAND: '추가 기능까지 연결해 시연해 보기' },
  },
  DAILY_EXAM: {
    title: '전공 시험과 과제 제출이 겹친 주', situation: '시험 범위를 펼쳐 놓으니 과제에서 자꾸 틀렸던 부분이 눈에 들어옵니다. 오늘 시간을 어디에 쓸까요?',
    choices: { EXAM_GROUP: '친구와 틀린 풀이를 바꿔 읽기', EXAM_CRAM: '남아서 실습 문제 한 세트 더 풀기', EXAM_SPLIT: '복습 범위를 이틀로 나누고 쉬기' },
  },
  DAILY_REFLECTION: {
    title: '이번 실습에서 추정이 빗나간 이유', situation: '금방 끝날 줄 알았던 수정에 오후를 다 썼습니다. 뉴로우-S 회고에 오늘의 실제 작업을 남깁니다.',
    choices: { REFLECT_NOTE: '예상보다 오래 걸린 원인 적기', REFLECT_TALK: '친구와 작업 시간 차이를 비교하기', REFLECT_REDUCE: '내일 끝낼 수정 한 가지로 계획 줄이기' },
  },
  DAILY_READING: {
    title: '책 속의 갈등을 설계 문제로 옮기기', situation: '독서 모임에서 같은 장면을 읽고도 누가 도움을 받아야 하는지 의견이 갈렸습니다.',
    choices: { READ_LISTEN: '친구가 고른 인물의 입장 듣기', READ_NOTE: '내가 만든 서비스의 사용자와 연결해 쓰기', READ_REST: '논쟁이 된 대목을 조용히 다시 읽기' },
  },
  DAILY_STUDENT_TALK: {
    title: '학생 발표 뒤에 남은 설계 질문', situation: '학생 발표자가 처음 만든 구조를 왜 바꿨는지 설명합니다. 내 전공 과제에서도 비슷한 문제가 있었습니다.',
    choices: { SENIOR_QUESTION: '구조를 바꿀 시점을 어떻게 알았는지 묻기', SENIOR_SPEECH: '내 과제의 설계 의도를 한 문장으로 말하기', SENIOR_NOTE: '다음 수정에 적용할 기준 적기' },
  },
  DAILY_SUPPORT_REQUEST: {
    title: '팀원 컴퓨터에서만 실행이 안 된다', situation: '같은 코드를 받았는데 실행 결과가 다릅니다. 도구를 새로 요청하기 전에 필요한 환경부터 살펴봅니다.',
    choices: { SUPPORT_PLAN: '필요한 도구와 버전을 목록으로 적기', SUPPORT_TEAM: '팀원과 설치 환경을 나란히 비교하기', SUPPORT_LIMIT: '지금 있는 도구로 최소 예제부터 실행하기' },
  },
  DAILY_NOBEL: {
    title: '책에서 만든 시제품 검증하기', situation: '소설 속 인물을 돕는 시제품이 나왔습니다. 실제로 그 인물이 처한 조건에서도 쓸 수 있을까요?',
    choices: { NOBEL_EMPATHY: '인물이 처한 환경을 사용 조건으로 정리하기', NOBEL_VERIFY: '조건을 바꿔 가며 시제품 직접 시험하기', NOBEL_STORY: '시제품을 쓴 뒤의 장면을 팀과 써 보기' },
  },
  DAILY_GLOBAL_PREP: {
    title: '온라인 인턴십을 앞둔 작업 기록', situation: '원격으로 만날 동료에게 내가 맡은 일을 설명한다고 생각하며 준비 자료를 펼칩니다.',
    choices: { GLOBAL_ENGLISH: '내 기여를 영어 세 문장으로 소개하기', GLOBAL_REMOTE: '원격 팀원이 이어받을 작업 기록 살펴보기', GLOBAL_BALANCE: '국내 실습과 해외 경험 중 필요한 준비 비교하기' },
  },
  DAILY_MARGIN: {
    title: '리뷰 노트를 다시 펼친 날', situation: '지난 리뷰에서 적어 둔 질문이 있습니다. 저장 함수를 따라가며 답을 확인합니다.',
    choices: { MARGIN_TRACE: '두 번째 요청에서 값이 바뀌는 지점 적기', MARGIN_ASK: '예상과 달랐던 조건문을 짚어 질문하기' },
  },
}

const aiReview: ActivityScene = {
  title: '분류 모델이 낯선 사진에서만 틀린다',
  situation: '수업에서 만든 모델은 연습 사진을 잘 맞혔습니다. 그런데 친구가 찍은 사진은 전혀 다른 물건으로 분류합니다.',
  choices: {
    REVIEW_ASK: '학습 사진과 평가 사진을 어떻게 나눴는지 질문하기',
    REVIEW_RETRY: '사진을 다시 나누고 분류 결과 비교하기',
    REVIEW_NOTE: '다음 리뷰에 가져갈 오답 사례 정리하기',
  },
}

const aiFollowUp: ActivityScene = {
  title: '오답 사진 두 장을 펼쳐 놓고',
  situation: '지난 리뷰에서 적어 둔 사진 두 장입니다. 물건은 같은데 한 장에서만 분류 결과가 달라졌습니다.',
  choices: { MARGIN_TRACE: '두 사진의 입력값을 나란히 적어 보기', MARGIN_ASK: '결과가 달라진 전처리 단계를 짚어 질문하기' },
}

export function yearActivityScene(year: number, code: string, major?: string | null) {
  if (year !== 2) return
  if (major === 'AI' && code === 'DAILY_FEEDBACK') return aiReview
  if (major === 'AI' && code === 'DAILY_MARGIN') return aiFollowUp
  return secondYearScenes[code]
}

export function availableInYear(year: number, code: string) {
  if (code === 'DAILY_ART_SPORTS') return year === 1
  // In year two, leave room for the major, mentoring and project events.
  return year !== 2 || !['DAILY_ROOMMATE', 'DAILY_FRIEND', 'DAILY_SECOND_LAP', 'DAILY_TEST_CASE'].includes(code)
}

export function forSchoolYear<T extends { code: string; title: string; situation: string; choices: { code: string; label: string }[] }>(year: number, event: T, major?: string | null): T {
  const scene = yearActivityScene(year, event.code, major)
  if (!scene) return event
  return { ...event, title: scene.title, situation: scene.situation,
    choices: event.choices.map(choice => ({ ...choice, label: scene.choices[choice.code] ?? choice.label })) }
}
