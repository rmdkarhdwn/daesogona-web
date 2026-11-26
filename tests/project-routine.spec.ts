import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'

test('작업 응답을 잃어도 턴을 더 넘기지 않고 같은 개인 프로젝트 작업만 확인한다', async ({ page }) => {
  const { view } = createGame({ name: '개인 프로젝트 점검', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'SCHOOL', year: 1, turn: 3, school: { semesterFocus: 'PROGRAMMING' } })
  const workKeys: string[] = []
  let projectReads = 0
  await page.route('**/api/v1/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/turns/advance')) {
      view.turn++
      view.version++
      return ok({ player: view, actionCode: 'TURN_END', resultCode: 'TURN_ADVANCED', statDelta: {} })
    }
    if (path.endsWith('/projects')) {
      projectReads++
      return ok([{ code: 'REST_API_SERVER', status: 'IN_PROGRESS' }])
    }
    if (path.endsWith('/REST_API_SERVER/work')) {
      workKeys.push(req.headers()['idempotency-key'])
      if (workKeys.length === 1) view.version++
      if (workKeys.length <= 2) return route.abort('failed')
      return ok({ player: view, actionCode: 'PROJECT_WORK', resultCode: 'COMPLETE', statDelta: {} })
    }
    if (path.endsWith(view.id)) return ok(view)
    if (path.endsWith('/progress')) return ok({ projects: [], qualifications: [] })
    if (path.endsWith('/history')) return ok({ items: workKeys.length ? [
      { logId: 10, year: 1, turn: 5, kind: 'PROJECT_WORK', subjectCode: 'REST_API_SERVER', resultCode: 'COMPLETE' },
    ] : [] })
    return ok([])
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  const end = page.getByRole('button', { name: '턴 종료', exact: true })
  await end.click()
  await expect(end).toBeEnabled()
  expect(view.turn).toBe(4)
  expect(projectReads).toBe(0)
  await end.click()
  const retry = page.getByRole('button', { name: '같은 요청 다시 보내기' })
  await expect(retry).toBeVisible()
  await page.reload()
  await retry.click()
  await expect(end).toBeEnabled()
  expect(view.turn).toBe(5)
  expect(projectReads).toBe(1)
  expect(workKeys).toHaveLength(3)
  expect(new Set(workKeys).size).toBe(1)
  await expect(page.locator('#current-story')).toContainText('REST API 서버 · 작품 완성')
  await expect(page.locator('#current-choices')).not.toContainText('지원용 포트폴리오 준비')
})
