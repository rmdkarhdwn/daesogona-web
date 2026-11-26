import { playerPath, type PlayerView } from './contracts'
import { request } from './client'

interface SchoolProject {
  code: string
  role: string
  status: string | null
  inPortfolio: boolean
  startable: boolean
}

export async function nextProjectActivity(player: PlayerView) {
  const school = player.school
  if (!school || player.phase !== 'SCHOOL' || school.pendingChoice || school.vacationPending ||
      school.practiceRemaining || player.turn % 3 !== 2) return

  const base = playerPath(player.id) + '/projects'
  const projects = await request<SchoolProject[]>(base, { signal: AbortSignal.timeout(8000) })
  if (projects.filter(project => project.inPortfolio).length >= 3) return
  const completed = projects.find(project => project.status === 'COMPLETE' && !project.inPortfolio)
  if (completed) return base + '/' + encodeURIComponent(completed.code) + '/portfolio'

  const current = projects.find(project => project.status === 'IN_PROGRESS')
  if (current) {
    if (player.remainingAp > 1) return base + '/' + encodeURIComponent(current.code) + '/work'
    return
  }
  const available = projects.filter(project => project.startable && !project.status)
  const next = available.find(project => project.role === player.currentCareerCode) ?? available[0]
  if (next) return base + '/' + encodeURIComponent(next.code) + '/start'
}
