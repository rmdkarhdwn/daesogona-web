import { expect, test } from '@playwright/test'
import { createGame, events } from '../demo/game'
import { routineChoice } from '../src/game/student-routine'

test('방학 캠프는 건강할 때 자동 참가하고 피곤하거나 3학년이면 쉰다', () => {
  const game = createGame({ name: '방학' }, true)
  Object.assign(game.view, { phase: 'Y1', year: 1, turn: 12, vacation: { season: 'SUMMER', campTurn: 0 } })
  const vacation = events(game)[0]
  expect(routineChoice(game.view, vacation)?.code).toBe('MAJOR_CAMP')
  game.view.stats.H = 30
  expect(routineChoice(game.view, vacation)?.code).toBe('VACATION_REST')
  Object.assign(game.view, { year: 3 })
  game.view.stats.H = 90
  expect(routineChoice(game.view, vacation)?.code).toBe('VACATION_REST')
  expect(routineChoice(game.view, { ...vacation, code: 'NARSHA_START' })).toBeUndefined()
  expect(routineChoice(game.view, { ...vacation, choices: vacation.choices.map(c => ({ ...c, enabled: false })) })).toBeUndefined()
})

for (const width of [360, 1280]) {
  test(width + 'px 일상은 기록으로 지나가고 나르샤 주제는 직접 확정할 때까지 기다린다', async ({ page }) => {
    test.setTimeout(45_000)
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.getByLabel('이름', { exact: true }).fill('나르샤 주제 검증')
    await page.getByRole('button', { name: '학교생활 시작' }).click()
    const modal = page.getByRole('dialog', { name: '중요한 결정' })
    await modal.getByRole('radio').last().check()
    await modal.getByRole('button', { name: '이 직무로 시작' }).click()
    if (width === 360) await page.getByLabel('진행 속도').selectOption('16')
    else await page.getByRole('button', { name: '16×' }).click()
    await expect(modal.getByRole('heading', { name: '1학년 나르샤 · 주제 선택' })).toBeVisible({ timeout: 18_000 })
    await expect(page.locator('#current-story .recent-entry')).toHaveCount(2)
    const custom = modal.getByRole('radio', { name: '기타 · 직접 주제 입력' })
    await custom.check()
    const topic = '교내 기자재 예약과 수리 이력 관리'
    await modal.getByLabel('프로젝트 주제', { exact: true }).fill(topic)
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    await page.waitForTimeout(10_200)
    await expect(page.locator('.phase')).toContainText('1학년 · 8턴')
    await page.getByRole('button', { name: /나르샤.*결정 열기/ }).click()
    await expect(modal.getByLabel('프로젝트 주제', { exact: true })).toHaveValue(topic)
    const sent = page.waitForResponse(r => r.url().endsWith('/N104/choices') && r.request().method() === 'POST')
    await modal.getByRole('button', { name: '이 주제로 시작' }).click()
    expect((await sent).ok()).toBe(true)
    await expect(modal).toBeHidden()
    await expect(page.locator('#current-story')).toContainText(topic)
  })
}
