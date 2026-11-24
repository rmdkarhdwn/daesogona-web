import { usePlayerData } from '../api/hooks'
import type { PlayerView } from '../api/contracts'
import type { RunPlayer } from './activities'
import { Loading, Problem } from './ui'

interface SchoolProject {
  code: string; title: string; status: string | null; workCount: number; workRequired: number
  inPortfolio: boolean; startable: boolean
}

export function JobPortfolio({ player, busy, run }: { player: PlayerView; busy: boolean; run: RunPlayer }) {
  const query = usePlayerData<SchoolProject[]>(player.id, '/projects')
  return <details className="story-card">
    <summary>지원용 포트폴리오 준비</summary>
    <p>프로젝트를 시작한 뒤 턴마다 한 번 작업할 수 있습니다. 완성한 작품을 등록하면 기업 서류 전형에 반영됩니다.</p>
    {query.error ? <Problem error={query.error} retry={() => { void query.refetch() }} /> : query.isPending ? <Loading /> :
      query.data.map(project => {
        const action = project.startable && !project.status ? 'start' : project.status === 'IN_PROGRESS' ? 'work' :
          project.status === 'COMPLETE' && !project.inPortfolio ? 'portfolio' : null
        return <div key={project.code} className="action-row">
          <div><strong>{project.title}</strong><small>{project.inPortfolio ? '등록 완료' : `작업 ${project.workCount}/${project.workRequired}회`}</small></div>
          {action && <button className="btn" disabled={busy || (action === 'work' && player.remainingAp < 1)}
            onClick={() => run('POST', `/projects/${project.code}/${action}`)}>{action === 'start' ? '시작' : action === 'work' ? '작업 · 1 AP' : '포트폴리오 등록'}</button>}
        </div>
      })}
  </details>
}
