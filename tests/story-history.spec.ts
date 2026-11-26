import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'

test('이전 서버에서 다음 페이지의 서사까지 읽고 최근 로그와 커밋에 표시한다', async ({ page }) => {
  const { view } = createGame({ name: '이력 점검', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'Y1', year: 1, turn: 3 })
  const log = { year: 1, turn: 1, logId: 49, narrativeStatus: 'SAVED', narrative: '프로젝트 계획을 세웠다.' }
  const story = '시험 범위를 정리했다.'
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/story')) return route.fulfill({ status: 404, json: {} })
    const data = url.pathname.endsWith('/history') ? url.searchParams.get('afterId') === '0'
      ? { items: [{ ...log, logId: 20, kind: 'CAREER_PREFERENCE', subjectCode: 'WEB', narrativeStatus: null, narrative: null }, log], nextAfterId: 49 }
      : { items: [{ ...log, logId: 51, turn: 2, narrative: null, evidenceJson: JSON.stringify({ scene: story }) },
        { year: 1, turn: 3, logId: 52, kind: 'TURN', subjectCode: 'TURN_END', resultCode: 'TURN_ADVANCED' }], nextAfterId: null }
      : url.pathname.endsWith(view.id) ? view : url.pathname.endsWith('/progress') ? { projects: [], qualifications: [] } : []
    return route.fulfill({ json: { success: true, data } })
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  await expect(page.locator('#past-stories')).toContainText('희망 직무 선택 · 웹 개발자')
  await expect(page.locator('#past-stories')).toContainText('대소고 1학년 1학기 학교생활을 시작했다.')
  await expect(page.locator('#current-story summary').first()).toContainText('1학년 3턴 시작')
  await expect(page.locator('#current-story summary').last()).toContainText(story)
  await expect(page.locator('#current-story summary')).toHaveCount(2)
  await expect(page.locator('#commit-calendar .commit-readout')).toContainText('1학년 3턴 시작')
})

test('방학과 새 이벤트의 처리 코드를 결과 안내와 기록에 노출하지 않는다', async ({ page }) => {
  const { view } = createGame({ name: '방학 점검', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'SCHOOL', year: 1, turn: 12, school: { vacationPending: true, semesterFocus: 'PROGRAMMING' } })
  const subject = 'VACATION_Y1_SUMMER'
  const result = 'SEMESTER_ADVANCED'
  const text = '여름방학을 마치고 2학기가 시작됐습니다.'
  const logs = [{ logId: 1, year: 1, turn: 10, kind: 'EVENT', subjectCode: 'UNKNOWN_EVENT', choiceCode: 'NEW_OPTION',
    resultCode: 'NEW_RESULT', narrative: '선택 결과는 NEW_RESULT였다.', evidenceJson: JSON.stringify({ title: '동아리 모임', choiceLabel: '동아리 발표 준비' }) }]
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/choices')) {
      view.turn++
      view.school!.vacationPending = false
      logs.push({ logId: 2, year: 1, turn: 12, kind: 'EVENT_CHOICE', subjectCode: subject, choiceCode: 'REST', resultCode: result,
        narrative: `나는 휴식을 선택했고, 결과는 ${result}였다.`, evidenceJson: JSON.stringify({ scene: subject + ' · ' + result }) })
      return ok({ player: view, actionCode: subject, resultCode: result, statDelta: { S: -3 } })
    }
    if (path.endsWith('/events')) return ok(view.turn === 12 ? [{ code: subject, title: '여름방학', situation: '방학 계획을 정합니다.',
      required: true, choices: [{ code: 'REST', label: '방학 동안 쉬기', enabled: true, apCost: 0 }] }] : [])
    if (path.endsWith('/history')) return ok({ items: logs })
    if (path.endsWith('/progress')) return ok({ projects: [], qualifications: [], snapshots: [] })
    return ok(path.endsWith(view.id) ? view : [])
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  await page.getByRole('button', { name: '방학 동안 쉬기' }).click()
  await expect(page.locator('.receipt')).toContainText(text)
  await expect(page.locator('.receipt')).toContainText('스트레스 -3')
  await page.reload()
  await expect(page.locator('#current-story')).toContainText(text)
  await page.getByRole('button', { name: '전체 기록', exact: true }).click()
  const history = page.getByRole('dialog')
  await expect(history).toContainText(text)
  await expect(history).toContainText('동아리 발표 준비')
  await expect(page.locator('body')).not.toContainText(/VACATION_Y|SEMESTER_ADVANCED|UNKNOWN_EVENT|NEW_OPTION|NEW_RESULT/)
})
