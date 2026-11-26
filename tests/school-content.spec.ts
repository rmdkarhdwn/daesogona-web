import { expect, test } from '@playwright/test'
import { createGame, events, execute } from '../demo/game'
import { appendDemoStory } from '../demo/story'
import { calendar } from '../demo/data'
import { eventRandom } from '../demo/random'
import { schoolLifeCatalog } from '../demo/school-life'
import type { StoryEntry } from '../src/api/contracts'

for (const width of [360, 1280]) {
  test(`${width}px에서 학교 근거 PDF와 회고 선택·기록을 확인한다`, async ({ page, request }) => {
    const game = createGame({ name: '학교생활 자료 검증' }, true)
    Object.assign(game.view, { phase: 'Y1', year: 1, turn: 4 })
    game.view.stats.S = 20
    game.view.semesterFocus = { code: 'FOCUS_BALANCE', label: '생활과 학업의 균형', semester: 1 }
    for (let seed = 1; seed < 100; seed++) {
      game.view.id = `00000000-0000-0000-0000-${seed.toString(16).padStart(12, '0')}`
      if (eventRandom(game.view.id, 'daily:1-4').nextInt(100) < 55) break
    }
    game.eventDraws = { 'daily:1-4': { eventCode: 'DAILY_REFLECTION', situation: '오늘의 회고',
      choiceCodes: ['REFLECT_REDUCE', 'REFLECT_NOTE', 'REFLECT_TALK'] } }
    const base = `/api/v1/players/${game.view.id}`
    const stories: StoryEntry[] = []
    await page.route('**/api/v1/**', async (route) => {
      const r = route.request()
      const path = new URL(r.url()).pathname
      const suffix = path.slice(base.length)
      let data: unknown
      if (r.method() === 'POST' && suffix.startsWith('/events/')) {
        expect(Number(r.headers()['x-expected-version'])).toBe(game.view.version)
        game.view.version++
        data = execute(game, suffix, r.postDataJSON())
        appendDemoStory(game, stories, suffix)
      } else if (path === base) data = game.view
      else if (suffix === '/events') data = events(game)
      else if (suffix === '/story') data = { entries: stories }
      else if (suffix === '/progress') data = { player: game.view, projects: [], qualifications: [], enrollments: [], snapshots: [], yearSummaries: [] }
      else if (suffix === '/applications') data = []
      else if (path === '/api/v1/catalog/calendar') data = calendar
      else if (path === '/api/v1/catalog/school-life') data = schoolLifeCatalog
      else data = []
      await route.fulfill({ json: { success: true, data, error: null } })
    })
    await page.setViewportSize({ width, height: 850 })
    await page.goto(`/play/${game.view.id}`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect.poll(() => stories.length, { timeout: 9000 }).toBe(1)
    await page.getByRole('button', { name: '일시 정지', exact: true }).click()
    const summary = page.locator('#current-story summary .recent-action')
    await expect(summary).not.toBeEmpty()
    const action = await summary.innerText()
    await page.reload()
    await expect(summary).toHaveText(action)
    await page.getByText('학교생활 근거 자료', { exact: false }).click()
    await expect(page.getByText(/자료별|홈페이지 탑재 자료는 미국 실리콘밸리/).first()).toBeVisible()
    const pdf = await request.get('/school-sources/admissions-2027.pdf')
    expect(pdf.ok()).toBeTruthy()
    expect(pdf.headers()['content-type']).toContain('application/pdf')
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: `/tmp/daesogo-school-2027/school-life-${width}.png`, fullPage: true })
  })
}

test('첫 학기 협업 선택이 친구와의 다음 실습으로 이어지고 혼자 쉰 회차에는 열리지 않는다', () => {
  for (const help of [true, false]) {
    const game = createGame({ name: '첫 실습', edition: 'MILD' }, true)
    Object.assign(game.view, { phase: 'Y1', year: 1, turn: 2,
      semesterFocus: { code: 'FOCUS_TEAM', label: '팀 프로젝트와 협업', semester: 1 } })
    game.view.stats.S = 20
    const first = events(game)[0]
    expect(first.code).toBe('DAILY_FRIEND')
    execute(game, '/events/DAILY_FRIEND/choices', { choiceCode: help ? 'FRIEND_HELP' : 'FRIEND_ALONE' })
    execute(game, '/turns/advance', {})
    const followUp = events(game).find(event => event.code === 'DAILY_TEST_CASE')
    if (help) {
      expect(followUp?.required).toBe(false)
      const path = '/events/DAILY_TEST_CASE/choices'
      execute(game, path, { choiceCode: 'TEST_TOGETHER' })
      const entries: StoryEntry[] = []
      appendDemoStory(game, entries, path)
      expect(entries[0].text).toContain('그 칸에 동그라미')
      expect(events(game)).not.toContainEqual(followUp)
    } else {
      expect(followUp).toBeUndefined()
    }
  }
})
