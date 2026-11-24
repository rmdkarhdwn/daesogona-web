import type { PlayerView } from '../api/contracts'
import { applicationTurn, codingTurn, interviewTurn, resultTurn } from './schedule'

export function recruitmentCalendar(player: PlayerView) {
  if (player.school) {
    return {
      canApply: player.turn <= 4, coding: player.turn === 4, interview: player.turn === 5,
      result: player.turn >= 6, starts: 1, applicationPeriod: '1~4턴',
    }
  }
  return {
    canApply: player.turn === applicationTurn, coding: player.turn === codingTurn,
    interview: player.turn === interviewTurn, result: player.turn === resultTurn,
    starts: applicationTurn, applicationPeriod: `${applicationTurn}턴`,
  }
}
