import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import type { EventView, NarshaTopics, PlayerView, SchoolNarshaProject } from '../src/api/contracts'

test.skip(!process.env.DAESOGO_E2E_BACKEND_URL, '실제 Spring 서버로 참가와 저장을 검증합니다.')

async function api(request: APIRequestContext, path: string, method = 'GET', data?: object, version?: number) {
  const response = await request.fetch('/api/v1/players' + path, {
    method, data, headers: { 'Idempotency-Key': randomUUID(), ...(version == null ? {} : { 'X-Expected-Version': String(version) }) },
  })
  const result = await response.json()
  expect(result.success, method + ' ' + path + ' ' + JSON.stringify(result.error)).toBe(true)
  return result.data
}

async function reachEvent(request: APIRequestContext, id: string, eventCode: string) {
  for (let step = 0; step < 55; step++) {
    const player: PlayerView = await api(request, '/' + id)
    const command = (path: string, body?: object) => api(request, '/' + id + path, 'POST', body, player.version)
    if (player.year === 2 && !player.major) {
      const transition = await api(request, '/' + id + '/year-transition')
      await command('/year-transition', { choiceCode: transition.options[0].code })
      continue
    }
    const events: EventView[] = await api(request, '/' + id + '/events')
    if (events.some(event => event.code === eventCode)) return
    const required = events.find(event => event.required)
    if (required) {
      const choice = required.choices.find(option => option.code === 'REST') ?? required.choices.find(option => option.enabled)!
      await command('/events/' + required.code + '/choices', { choiceCode: choice.code })
    } else await command('/turns/advance')
  }
  throw new Error('이벤트에 도달하지 못했습니다. ' + eventCode)
}

async function openEvent(page: Page, id: string, code: string, button: string) {
  await page.goto('/play/' + id)
  const selector = page.getByRole('combobox', { name: '현재 이벤트' })
  await page.getByRole('region', { name: '지금 열린 선택' }).getByRole('button').first().waitFor()
  if (await selector.count()) await selector.selectOption(code)
  await page.getByRole('button', { name: button, exact: true }).click()
}

for (const skipFirst of [false, true]) {
  test(skipFirst ? '1학년 참가 취소 후 미참가' : '1학년 후보와 2학년 직접 입력 주제를 각각 저장한다', async ({ page, request }) => {
    const player: PlayerView = await api(request, '', 'POST', { name: '나르샤 검증', edition: 'MILD' })
    const base = '/' + player.id
    const projects = async (): Promise<SchoolNarshaProject[]> => (await api(request, base + '/narsha')).projects
    try {
      await page.addInitScript(id => sessionStorage.setItem('daesogo.playback.' + id, 'paused'), player.id)
      await api(request, base + '/career-preference', 'PUT', { roleCode: 'WEB' }, player.version)
      await reachEvent(request, player.id, 'NARSHA_START')
      await page.setViewportSize({ width: skipFirst ? 1280 : 360, height: 840 })
      await openEvent(page, player.id, 'NARSHA_START', '팀 프로젝트 참가')
      const catalog: NarshaTopics = await api(request, base + '/narsha')
      const first = catalog.topics[0]
      await expect(page.getByRole('radio', { name: first.title, exact: true })).toBeVisible()
      expect(await projects()).toHaveLength(0)
      if (skipFirst) {
        await page.getByRole('button', { name: '참가 선택으로 돌아가기' }).click()
        const result = page.waitForResponse(r => r.url().endsWith('/NARSHA_START/choices') && r.request().method() === 'POST')
        await page.getByRole('button', { name: '이번 프로젝트 미참가' }).click()
        expect((await result).ok()).toBe(true)
        expect(await projects()).toHaveLength(0)
        return
      }
      await page.getByRole('radio', { name: first.title, exact: true }).check()
      await page.getByRole('button', { name: '이 주제로 참가' }).click()
      await expect.poll(projects).toMatchObject([{ year: 1, topic: first.title, status: 'IN_PROGRESS' }])
      await page.reload()
      await page.getByRole('button', { name: '학생 수첩' }).click()
      await expect(page.getByRole('dialog').getByText(first.title, { exact: true })).toBeVisible()
      await page.goto('about:blank')
      await reachEvent(request, player.id, 'NARSHA_RESUME')
      await openEvent(page, player.id, 'NARSHA_RESUME', '새 프로젝트 시작')
      await page.getByRole('radio', { name: '기타 · 주제 직접 입력' }).check()
      const confirm = page.getByRole('button', { name: '이 주제로 참가' })
      await page.getByLabel('프로젝트 주제', { exact: true }).fill('가')
      await expect(confirm).toBeDisabled()
      await page.getByLabel('프로젝트 주제', { exact: true }).fill('  실시간   교내 접근성 지도  ')
      await confirm.click()
      await expect.poll(projects).toMatchObject([{ year: 1, topic: first.title }, { year: 2, topic: '실시간 교내 접근성 지도' }])
    } finally {
      await page.close()
      const latest = await api(request, base)
      await api(request, base, 'DELETE', undefined, latest.version)
    }
  })
}
