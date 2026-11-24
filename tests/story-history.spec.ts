import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'

test('이전 서버에서 다음 페이지의 서사까지 읽고 최근 로그와 커밋에 표시한다', async ({ page }) => {
  const { view } = createGame({ name: '이력 점검', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'Y1', year: 1, turn: 2 })
  const log = { year: 1, turn: 1, logId: 49, narrativeStatus: 'SAVED', narrative: '프로젝트 계획을 세웠다.' }
  const story = '시험 범위를 정리했다.'
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/story')) return route.fulfill({ status: 404, json: {} })
    const data = url.pathname.endsWith('/history') ? url.searchParams.get('afterId') === '0'
      ? { items: [{ ...log, logId: 20, narrativeStatus: null, narrative: null }, log], nextAfterId: 49 }
      : { items: [{ ...log, logId: 51, turn: 2, narrative: null, evidenceJson: JSON.stringify({ scene: story }) }], nextAfterId: null }
      : url.pathname.endsWith(view.id) ? view : url.pathname.endsWith('/progress') ? { projects: [], qualifications: [] } : []
    return route.fulfill({ json: { success: true, data } })
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  await expect(page.locator('#current-story summary').first()).toContainText(story)
  await expect(page.locator('#current-story summary')).toHaveCount(2)
  await expect(page.locator('#commit-calendar .commit-readout')).toContainText(story)
})
