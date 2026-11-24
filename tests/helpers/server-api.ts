import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'

export async function api(request: APIRequestContext, path: string, method = 'GET', data?: object, version?: number) {
  const response = await request.fetch('/api/v1/players' + path, {
    method, data, headers: { 'Idempotency-Key': randomUUID(), ...(version == null ? {} : { 'X-Expected-Version': String(version) }) },
  })
  const result = await response.json()
  expect(result.success, method + ' ' + path + ' ' + JSON.stringify(result.error)).toBe(true)
  return result.data
}
