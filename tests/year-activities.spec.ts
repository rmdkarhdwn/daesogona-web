import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'
import { schoolActivityEvents } from '../demo/school-life'
import { dailySchoolEvents, dailyExamEvent, dailyNarshaEvent } from '../demo/data'
import { availableInYear, forSchoolYear } from '../src/game/year-activities'

test('악기·스포츠는 1학년 활동이고 전공 리뷰는 학년과 학과에 따라 달라진다', () => {
  for (const year of [1, 2, 3]) {
    const draws = Array.from({ length: 24 }, (_, turn) => schoolActivityEvents(year, turn + 1)).flat()
    expect(draws.some(event => event.code === 'DAILY_ART_SPORTS')).toBe(year === 1)
  }
  const review = { code: 'DAILY_FEEDBACK', title: '코드 리뷰', situation: '질문', choices: [
    { code: 'REVIEW_RETRY', label: '다시 구현하기', enabled: false },
  ] }
  expect(forSchoolYear(1, review)).toBe(review)
  const software = forSchoolYear(2, review, 'SOFTWARE')
  const ai = forSchoolYear(2, review, 'AI')
  expect([review, software, ai].map(event => event.choices[0].label)).toEqual([
    '다시 구현하기', '중복 요청을 처리하도록 함수 고치기', '사진을 다시 나누고 분류 결과 비교하기',
  ])
  expect(ai.choices[0]).toMatchObject({ code: 'REVIEW_RETRY', enabled: false })
})

test('기존 서버가 2학년에 악기 활동을 보내도 선택 대기 없이 다음 턴과 전공 선택 기록까지 진행한다', async ({ page }) => {
  const { view } = createGame({ name: '학년별 활동 점검', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'SCHOOL', year: 2, turn: 6, major: 'AI', school: { semesterFocus: 'P' } })
  let saved = false
  const choice = { code: 'REVIEW_RETRY', label: '혼자 다시 구현해 보기', enabled: true, apCost: 0 }
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/turns/advance')) {
      view.turn++
      return ok({ player: view, resultCode: 'TURN_ADVANCED', actionCode: 'TURN_END', statDelta: {} })
    }
    if (path.endsWith('/DAILY_FEEDBACK/choices')) {
      expect(route.request().postDataJSON()).toEqual({ choiceCode: 'REVIEW_RETRY' })
      saved = true
      return ok({ player: view, actionCode: 'DAILY_FEEDBACK', resultCode: 'COMPLETED', statDelta: {} })
    }
    if (path.endsWith('/events')) return ok(saved ? [] : [view.turn === 6 ?
      { code: 'DAILY_ART_SPORTS', title: '1인 1악기·1스포츠', choices: [choice], required: false } :
      { code: 'DAILY_FEEDBACK', title: '예상하지 못한 코드 리뷰', choices: [choice], required: false }])
    if (path.endsWith('/history')) return ok({ items: saved ? [{ logId: 20, year: 2, turn: 7, subjectCode: 'DAILY_FEEDBACK',
      choiceCode: 'REVIEW_RETRY', kind: 'EVENT', resultCode: 'COMPLETED', evidenceJson: JSON.stringify({ scene: choice.label }) }] : [] })
    if (path.endsWith('/progress')) return ok({ projects: [], qualifications: [], snapshots: [] })
    return ok(path.endsWith(view.id) ? view : [])
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  const advance = page.getByRole('button', { name: '다음 결정까지' })
  await expect(advance).toBeEnabled()
  await expect(page.locator('#current-choices')).not.toContainText('1인 1악기')
  await page.getByRole('button', { name: '턴 종료' }).click()
  const activity = page.getByRole('button', { name: '사진을 다시 나누고 분류 결과 비교하기' })
  await activity.click()
  await page.reload()
  await expect(page.locator('#current-story')).toContainText('사진을 다시 나누고 분류 결과 비교하기')
})

test('3학년 공통 활동은 전공·취업 장면으로 바뀌거나 추첨에서 빠진다', () => {
  const shared = [...dailySchoolEvents, dailyExamEvent, dailyNarshaEvent, ...schoolActivityEvents(1, 8), ...schoolActivityEvents(2, 18)]
  for (const event of shared.filter(event => availableInYear(3, event.code))) {
    const senior = forSchoolYear(3, event, 'AI', 'WEB')
    expect(senior.title, event.code).not.toBe(event.title)
    expect(senior.choices.map(choice => choice.code)).toEqual(event.choices.map(choice => choice.code))
    expect(senior.choices.every((choice, i) => choice.label !== event.choices[i].label)).toBe(true)
  }
  const review = dailySchoolEvents.find(event => event.code === 'DAILY_FEEDBACK')!
  const tracks = ['FE', 'BE', 'WEB', 'MOBILE', 'AI', 'GAME', 'NETWORK']
  expect(new Set(tracks.map(track => forSchoolYear(3, review, 'AI', track).title)).size).toBe(tracks.length)
})

test('현장실습 회고는 선발 기록 이후에만 국내·해외 경로로 나뉜다', async ({ page }) => {
  const { view } = createGame({ name: '현장실습 회고', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'SCHOOL', year: 3, turn: 8, track: 'WEB', school: { semesterFocus: 'P' } })
  const journal = { kind: 'EVENT', subjectCode: 'DAILY_REFLECTION', choiceCode: 'REFLECT_NOTE', resultCode: 'COMPLETED',
    evidenceJson: JSON.stringify({ scene: '작업 기록을 정리했습니다.' }), year: 3 }
  let route = 'SILICON_VALLEY'
  let result = 'NOT_SELECTED'
  await page.route('**/api/v1/**', req => {
    const path = new URL(req.request().url()).pathname
    const ok = (data: unknown) => req.fulfill({ json: { success: true, data } })
    if (path.endsWith('/history')) return ok({ items: [
      { ...journal, logId: 11, turn: 1 }, { logId: 12, turn: 3, year: 3, subjectCode: 'J01', choiceCode: route, resultCode: result },
      { ...journal, logId: 13, turn: 5 },
    ] })
    if (path.endsWith('/events')) return ok([{ code: journal.subjectCode, title: '오늘의 회고', situation: '', required: false,
      choices: [{ code: 'REFLECT_NOTE', label: '기록', enabled: true, apCost: 0 }] }])
    if (path.endsWith('/progress')) return ok({ projects: [], qualifications: [], snapshots: [] })
    return ok(path.endsWith(view.id) ? view : [])
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  for (const [choice, status, title] of [
    ['SILICON_VALLEY', 'NOT_SELECTED', '공고의 한 줄과 내 경험 연결하기'],
    ['SILICON_VALLEY', 'SELECTED', '시차가 있는 팀에 남길 인계 메모'],
    ['DOMESTIC', 'SELECTED', '기업 멘토에게 건넬 작업 일지'],
  ]) {
    route = choice
    result = status
    await page.goto('/play/' + view.id)
    await expect(page.locator('#current-selection h2')).toHaveText(title)
    await expect(page.locator('#current-story')).toContainText(title)
    await expect(page.locator('#current-story .recent-entry').last()).toContainText('공고의 한 줄과 내 경험 연결하기')
  }
})
