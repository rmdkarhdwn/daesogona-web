import { expect, test, type APIRequestContext } from '@playwright/test'
import type { EventView, PlayerView, YearTransitionView } from '../src/api/contracts'
import { api } from './helpers/server-api'

test.skip(!process.env.DAESOGO_E2E_BACKEND_URL, '실제 Spring 서버의 학년 전이를 검증합니다.')

async function finishYear(request: APIRequestContext, base: string, year: number) {
  let player: PlayerView = await api(request, base)
  for (let step = 0; step < 32 && player.year === year; step++) {
    let action = '/turns/advance'
    let body: { choiceCode: string } | undefined
    const events: EventView[] = await api(request, base + '/events')
    const event = events.find(item => item.required)
    if (event) {
      const choice = event.choices.find(item => item.enabled && ['REST', 'SKIP'].includes(item.code)) ?? event.choices.find(item => item.enabled)!
      action = '/events/' + event.code + '/choices'
      body = { choiceCode: choice.code }
    }
    player = (await api(request, base + action, 'POST', body, player.version)).player
  }
  expect(player.year).toBe(year + 1)
}

test('겨울방학 후 학과와 수업을 화면에서 확정하고 각 학년의 다음 턴을 진행한다', async ({ page, request }) => {
  test.setTimeout(180_000)
  const player: PlayerView = await api(request, '', 'POST', { name: '진급 검증', edition: 'MILD' })
  const base = '/' + player.id
  try {
    await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), player.id)
    await api(request, base + '/career-preference', 'PUT', { roleCode: 'WEB' }, player.version)
    for (const year of [2, 3]) {
      await finishYear(request, base, year - 1)
      const transition: YearTransitionView = await api(request, base + '/year-transition')
      const option = transition.options[1]
      await page.setViewportSize({ width: year === 2 ? 1280 : 390, height: 840 })
      await page.goto('/play/' + player.id)
      const endTurn = page.getByRole('button', { name: '턴 종료', exact: true, includeHidden: true })
      await expect(endTurn).toBeDisabled()
      await expect(page.getByRole('heading', { name: '이번 학기에 집중할 것' })).toHaveCount(0)
      await page.getByRole('radio', { name: option.title, exact: true }).check()
      await page.getByRole('button', { name: year === 2 ? '학과 확정' : '수업 확정' }).click()
      await expect(page.getByRole('dialog')).toBeHidden()
      await page.reload()
      await endTurn.click()
      const confirm = page.getByRole('button', { name: '다음 턴으로' })
      if (await confirm.isVisible()) await confirm.click()
      await expect.poll(() => api(request, base)).toMatchObject({
        year, turn: 2, [year === 2 ? 'major' : 'track']: option.code, school: { pendingChoice: null },
      })
      await page.goto('about:blank')
    }
  } finally {
    await page.close()
    const latest = await api(request, base)
    await api(request, base, 'DELETE', undefined, latest.version)
  }
})
