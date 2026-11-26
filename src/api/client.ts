import type { ApiProblem, CommandResult, Envelope } from './contracts'

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public status: number, public problem: ApiProblem) {
    super(problem.message)
    this.name = 'ApiError'
  }
}

export interface PendingCommand {
  key: string
  method: 'POST' | 'PUT'
  path: string
  body?: Record<string, unknown>
  expectedVersion?: number
  automaticProject?: boolean
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiBase + path, options)
  const payload = await response.json().catch(() => null) as Envelope<T> | null
  if (response.ok && payload?.success === true) return payload.data
  if (payload?.success === false && payload.error?.code) throw new ApiError(response.status, payload.error)
  throw new ApiError(response.ok ? 502 : response.status, {
    code: 'INVALID_RESPONSE',
    message: '서버 응답을 확인할 수 없습니다. 연결 상태를 확인해 주세요.',
  })
}

// Only transport failures are retried. A rejection by the game engine is final.
export function isTransientConnectionError(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
    || (error instanceof ApiError && [408, 502, 503, 504].includes(error.status))
}

export async function sendCommand(command: PendingCommand) {
  const headers = new Headers({ 'Idempotency-Key': command.key })
  if (command.body !== undefined) headers.set('Content-Type', 'application/json')
  if (command.expectedVersion !== undefined) headers.set('X-Expected-Version', String(command.expectedVersion))
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 45_000)
  try {
    return await request<CommandResult>(command.path, {
      method: command.method,
      headers,
      body: command.body === undefined ? undefined : JSON.stringify(command.body),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
}

// getRandomValues also works on local-network HTTP on a phone.
export function newCommandKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export function resultPlayer(result: CommandResult) {
  if ('change' in result) return result.change.player
  if ('player' in result) return result.player
  return result
}

export function resultReceipt(result: CommandResult) {
  if ('change' in result) return result.change
  return 'statDelta' in result ? result : null
}
