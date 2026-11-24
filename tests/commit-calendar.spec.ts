import { expect, test } from '@playwright/test'
import { createGame } from '../demo/game'

test('학년 경계의 기록을 해당 턴에 표시하고 미래 턴은 잠근다', async ({ page }) => {
  const { view } = createGame({ name: '기록 확인', edition: 'MILD' }, true)
  Object.assign(view, { phase: 'Y2', year: 2, turn: 1, major: 'SW' })
  const entries = [
    { year: 0, turn: 1, title: '입학 전 기록' },
    { year: 1, turn: 24, title: '겨울방학 시작' },
    { year: 1, turn: 24, title: '프로젝트 회고' },
    { year: 2, turn: 1, title: '새 학기 시작' },
  ].map((entry, i) => ({ ...entry, id: String(i), dialogue: [], text: entry.title, status: 'READY', source: 'MOCK' }))
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/' + view.id) ? view : path.endsWith('/story') ? { entries }
      : path.endsWith('/progress') ? { projects: [], qualifications: [] } : []
    return route.fulfill({ json: { success: true, data } })
  })
  await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), view.id)
  await page.goto('/play/' + view.id)
  const calendar = page.getByRole('region', { name: '학교생활 커밋' })
  await expect(calendar.getByRole('button')).toHaveCount(72)
  await expect(calendar.locator('button[aria-current="step"]')).toHaveAccessibleName('2학년 1학기 · 1턴 · 기록 1건')
  await calendar.getByRole('button', { name: '1학년 2학기 · 24턴 · 기록 2건' }).click()
  await expect(calendar.getByRole('listitem')).toHaveText(['겨울방학 시작', '프로젝트 회고'])
  await calendar.getByRole('button', { name: '1학년 1학기 · 1턴 · 기록 0건' }).click()
  await expect(calendar.getByText('이 턴에 남긴 기록이 없습니다.')).toBeVisible()
  await expect(calendar.getByRole('button', { name: '2학년 1학기 · 2턴 · 진행 전' })).toBeDisabled()
})
