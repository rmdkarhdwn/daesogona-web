import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useGameUi, useSavedGame } from '../state'
import { ApiError, isTransientConnectionError, newCommandKey, request, resultReceipt, resultPlayer, sendCommand, type PendingCommand } from './client'
import { playerPath, type PlayerView } from './contracts'

import { nextProjectActivity } from './project-routine'
import { loadStory } from './story'

const queryKey = (id: string, suffix: string) => ['player', id, suffix] as const

export function usePlayerData<T>(id: string, suffix: string, enabled = true, path = playerPath(id) + suffix) {
  return useQuery({
    queryKey: queryKey(id, suffix),
    queryFn: ({ signal }) => request<T>(path, { signal }),
    enabled: Boolean(id) && enabled,
    retry: false,
  })
}

export function useStory(player: PlayerView) {
  return useQuery({
    queryKey: [...queryKey(player.id, '/story'), player.phase === 'ENDED' ? 'final' : 'playing'],
    queryFn: ({ signal }) => loadStory(player, signal),
    retry: false,
    refetchInterval: (query) => query.state.data?.entries.some((entry) => entry.status === 'PENDING') ? 1500 : false,
  })
}

export function useCommands() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const mutation = useMutation({
    mutationFn: sendCommand,
    networkMode: 'always',
    retry: (failures, error) => failures === 0 && navigator.onLine && isTransientConnectionError(error),
    retryDelay: 1500,
  })

  function refreshPlayerData(id: string) {
    // Story generation and reads have their own lifecycle.
    void queryClient.invalidateQueries({ queryKey: queryKey(id, '/story') })
    return queryClient.invalidateQueries({
      queryKey: ['player', id],
      predicate: (query) => query.queryKey[2] !== '/story',
    })
  }

  function isFinalRejection(error: unknown) {
    return error instanceof ApiError && error.status >= 400 && error.status < 500 &&
      error.status !== 408 && error.status !== 429 && error.problem.code !== 'INVALID_RESPONSE'
  }

  async function execute(command: PendingCommand) {
    const ui = useGameUi.getState()
    if (ui.active || (ui.pending && ui.pending.key !== command.key)) return null
    ui.setActive(true)
    const targetId = command.path.match(/^\/players\/([^/]+)/)?.[1]
    try {
      ui.journal(command)
      const result = await mutation.mutateAsync(command)
      let player = resultPlayer(result)
      if (command.path.endsWith('/turns/advance') && resultReceipt(result)?.resultCode === 'TURN_ADVANCED') {
        // The turn is already saved. A failed catalog read can wait until another turn.
        const path = await nextProjectActivity(player).catch(() => undefined)
        if (path) {
          const activity: PendingCommand = { method: 'POST', path, key: newCommandKey(),
            expectedVersion: player.version, automaticProject: true }
          ui.journal(activity)
          try {
            player = resultPlayer(await mutation.mutateAsync(activity))
          } catch (error) {
            // Keep an uncertain activity in the journal so retry never advances another turn.
            if (!isFinalRejection(error)) {
              await refreshPlayerData(player.id)
              throw error
            }
          }
        }
      }
      ui.journal(null)
      if (player.demoScenario !== 'COUNSELING') useSavedGame.getState().save(player.id, player.edition ?? 'SPICY')
      await queryClient.cancelQueries({ queryKey: ['player', player.id] })
      queryClient.setQueryData<PlayerView>(queryKey(player.id, ''), (current) =>
        current && current.version > player.version ? current : player,
      )
      await refreshPlayerData(player.id)
      if (command.path === '/players') navigate(`/play/${player.id}`)
      return command.automaticProject ? null : result
    } catch (error) {
      if (isFinalRejection(error)) {
        ui.journal(null)
        if (targetId) await refreshPlayerData(decodeURIComponent(targetId))
        if (command.automaticProject) return null
      }
      throw error
    } finally {
      ui.setActive(false)
    }
  }

  return {
    run: (method: PendingCommand['method'], path: string, body?: PendingCommand['body'], version?: number) =>
      execute({ key: newCommandKey(), method, path, body, expectedVersion: version }),
    retry: () => {
      const command = useGameUi.getState().pending
      return command ? execute(command) : Promise.resolve(null)
    },
  }
}
