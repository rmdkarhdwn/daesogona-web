import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'
import { schoolActivityEvents } from '../demo/school-life'
import { forSchoolYear } from '../src/game/year-activities'

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
