import { expect, test, type Page } from '@playwright/test'
import { createGame, events, execute } from '../demo/game'
import { calendar } from '../demo/data'

test.describe.configure({ mode: 'parallel' })
test.setTimeout(45000)

async function openAdmission(page: Page) {
  await page.goto('/')
  await page.getByLabel('이름', { exact: true }).fill('선택 대기 검증')
  await page.getByRole('radio', { name: '매운맛' }).check()
  await page.getByRole('button', { name: '지원 시작' }).click()
  await expect(page.getByRole('dialog')).toContainText('지원 전형 선택')
}

test('입학 모달을 닫으면 자동 선택을 멈추고 다시 열면 입력을 이어간다', async ({ page }) => {
  await openAdmission(page)
  await page.getByRole('radio', { name: '일반전형' }).check()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '전체 기록', exact: true }).click()
  await page.waitForTimeout(10500)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: /지원 전형 선택.*결정 열기/ }).click()
  await expect(page.getByRole('radio', { name: '일반전형' })).toBeChecked()
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/AD00/choices'))
  await page.getByRole('button', { name: '선택 확정' }).click()
  expect((await saved).ok()).toBe(true)
})

test('학교 탐색은 선택한 장소를 유지하고 부족한 개수만 채운다', async ({ page }) => {
  const game = createGame({ name: '학교 탐색 검증', edition: 'SPICY' }, true)
  Object.assign(game.view, { phase: 'BEFORE_SCHOOL', beforeSchoolDay: 1 })
  const base = `/api/v1/players/${game.view.id}`
  const commands: string[][] = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const suffix = url.pathname.slice(base.length)
    let data: unknown
    if (request.method() === 'POST') {
      const body = request.postDataJSON(); commands.push(body.choiceCodes)
      game.view.version++; data = execute(game, suffix, body)
    } else if (url.pathname === base) data = game.view
    else if (suffix === '/events') data = events(game)
    else if (suffix === '/story') data = { entries: [] }
    else if (suffix === '/progress') data = { player: game.view, projects: [], qualifications: [], enrollments: [], snapshots: [], yearSummaries: [] }
    else if (url.pathname === '/api/v1/catalog/calendar') data = calendar
    else data = []
    await route.fulfill({ json: { success: true, data, error: null } })
  })
  await page.goto(`/play/${game.view.id}`)
  const chosen = page.getByRole('checkbox', { name: '메이커실 둘러보기' })
  await chosen.check()
  await page.waitForTimeout(10000)
  await expect(page.getByRole('heading', { name: '전공 체험', exact: true })).toBeVisible()
  expect(commands).toHaveLength(1)
  expect(commands[0]).toHaveLength(2)
  expect(new Set(commands[0]).size).toBe(2)
  expect(commands[0]).toContain('MAKER_ROOM')
})

test('자동 선택의 저장이 실패하면 같은 선택을 반복 전송하지 않는다', async ({ page }) => {
  await openAdmission(page)
  let attempts = 0
  await page.route('**/AD00/choices', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts++
    await route.fulfill({ status: 400, json: { success: false, data: null,
      error: { code: 'VALIDATION_ERROR', message: '자동 선택 저장 실패 검증', details: {} } } })
  })
  await expect(page.getByRole('alert')).toContainText('자동 선택 저장 실패 검증', { timeout: 15000 })
  await page.waitForTimeout(11000)
  expect(attempts).toBe(1)
  await expect(page.getByText('자동 선택 대기', { exact: true })).toBeVisible()
})

test('입학 자동 선택을 끄면 기다리고 다시 켰을 때에만 한 번 제출한다', async ({ page }) => {
  await openAdmission(page)
  const submit = page.getByRole('button', { name: '선택 확정' })
  await page.getByRole('button', { name: '자동 선택 끄기' }).click()
  const posts: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/AD00/choices')) posts.push(request.url())
  })
  await page.waitForTimeout(10500)
  await expect(submit).toBeVisible()
  expect(posts).toHaveLength(0)
  await page.getByRole('button', { name: '자동 선택 켜기' }).click()
  await expect(page.getByRole('dialog')).toContainText('중학교 활동 기록', { timeout: 15000 })
  expect(posts).toHaveLength(1)
})
