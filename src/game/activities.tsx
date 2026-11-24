import { useState } from 'react'
import { recruitmentCalendar } from './recruitment-calendar'
import { companiesV12 } from './company-catalog'
import {
  playerPath, type ApplicationView, type CatalogEntry, type JobStep,
  type PlayerView,
} from '../api/contracts'
import { usePlayerData } from '../api/hooks'
import { jobLabel, label } from './labels'
import { InterviewForm } from './interview'
import { Loading, Problem } from './ui'

export type RunPlayer = (method: 'POST' | 'PUT', suffix: string, body?: Record<string, unknown>) => void

export function useRecruitment(player: PlayerView, enabled: boolean) {
  const id = player.id
  const calendar = recruitmentCalendar(player)
  const atApplicationTurn = enabled && calendar.canApply
  const bundled = Boolean(player.school) && player.rulesVersion === 'v1.2'
  const fetchCompanies = atApplicationTurn && !bundled
  const query = usePlayerData<ApplicationView[]>(id, '/applications', enabled)
  const companies = usePlayerData<CatalogEntry[]>(id, 'catalog/companies', fetchCompanies,
    `/catalog/companies?playerId=${encodeURIComponent(id)}`)
  const applications = query.data ?? []
  const listedCompanies = atApplicationTurn ? (bundled ? companiesV12 : companies.data ?? []) : []
  const step: { step: JobStep; status: string; title: string } | undefined =
    calendar.coding ? { step: 'CODING', status: 'DOC_PASSED', title: '코딩 테스트' } :
    calendar.interview ? { step: 'INTERVIEW', status: 'CODE_PASSED', title: '면접' } :
    calendar.result ? { step: 'RESULT', status: 'INTERVIEW_PASSED', title: '결과 확인' } : undefined
  const canApply = (code: string) => player.remainingAp > 0 && applications.length < 2 && !applications.some((item) => item.companyCode === code)
  const stepCost = player.school && step?.step === 'RESULT' ? 0 : 1
  const canTakeStep = (item: ApplicationView) => player.remainingAp >= stepCost && item.status === step?.status
  return {
    applications, listedCompanies, calendar, step, stepCost, canApply, canTakeStep,
    hasAction: enabled && (listedCompanies.some((item) => canApply(item.code)) || applications.some(canTakeStep)),
    pending: enabled && (query.isPending || (fetchCompanies && companies.isPending)),
    fetching: enabled && (query.isFetching || (fetchCompanies && companies.isFetching)),
    error: enabled ? query.error ?? (fetchCompanies ? companies.error : null) : null,
    retry: () => { void query.refetch(); if (fetchCompanies) void companies.refetch() },
  }
}

export function Recruitment({ player, busy, run, data }: { player: PlayerView; busy: boolean; run: RunPlayer; data: ReturnType<typeof useRecruitment> }) {
  const [interviewId, setInterviewId] = useState<string>()
  const { applications, listedCompanies, calendar, step, stepCost, canApply, canTakeStep, pending, error, retry } = data
  if (error) return <Problem error={error} retry={retry} />
  if (pending) return <Loading text="채용 일정을 확인하는 중…" />
  return (
    <section className="recruitment story-card" aria-labelledby="recruitment-title">
      <p className="eyebrow">채용 일정</p>
      <h2 id="recruitment-title">{step?.title ?? (calendar.canApply ? '기업 지원' : '지원 현황')}</h2>
      {player.school && player.turn <= 5 && <p className="muted">기업 지원 1~4턴 · 코딩 테스트 4턴 · 면접 5턴 · 결과 확인 6턴부터</p>}
      {calendar.canApply && (
        <>
          <p className="muted">최대 두 곳에 한 번씩 지원할 수 있습니다. 지원마다 1 AP가 필요합니다.</p>
          {listedCompanies.map((company) => {
            const applied = applications.some((application) => application.companyCode === company.code)
            const details = company.details && typeof company.details === 'object' ? company.details as Record<string, unknown> : undefined
            const requirements = company.requirements && typeof company.requirements === 'object' ? company.requirements as Record<string, unknown> : undefined
            return <div className="action-row" key={company.code}>
              <div><strong>{company.title}</strong>
                {typeof details?.role === 'string' && <small>{jobLabel(details.role)}{typeof requirements?.skill === 'number' && typeof requirements.portfolio === 'number' ? ` · 기술 ${requirements.skill} / 포트폴리오 ${requirements.portfolio}` : ''}</small>}
              </div>
              <button className="btn" type="button" disabled={busy || !canApply(company.code)}
                onClick={() => run('POST', '/applications', { companyCode: company.code })}>{applied ? '지원 완료' : '지원 · 1 AP'}</button>
            </div>
          })}
        </>
      )}
      {!calendar.canApply && !applications.length && <p className="muted">3학년 {calendar.applicationPeriod}에 지원한 기업이 없습니다.</p>}
      {applications.map((application) => {
        const document = application.D ?? application.d
        const coding = application.K ?? application.k
        const interview = application.J ?? application.j
        return (
        <div className="action-row" key={application.id}>
          <div><strong>{label(application.companyCode)} · {label(application.status)}</strong>
            {application.failureCode && <small>{label(application.failureCode)}</small>}
            <small>{document == null ? '' : `서류 ${document.toFixed(1)}`}{coding == null ? '' : ` · 코딩 ${coding.toFixed(1)}`}{interview == null ? '' : ` · 면접 ${interview.toFixed(1)}`}</small>
            {application.interviewEvaluation && <small>답변 평가 {application.interviewEvaluation.score}점 · {application.interviewEvaluation.criteria
              .map((item) => `${item.label} ${item.score}`).join(' · ')}</small>}
          </div>
          {step && application.status === step.status && <button className="btn primary" type="button" disabled={busy || !canTakeStep(application)}
            onClick={() => {
              if (step.step === 'INTERVIEW') setInterviewId(interviewId === application.id ? undefined : application.id)
              else run('POST', `/applications/${encodeURIComponent(application.id)}/steps`, { step: step.step })
            }}>{step.title} · {stepCost} AP</button>}
          {step?.step === 'INTERVIEW' && canTakeStep(application) && interviewId === application.id &&
            <InterviewForm playerId={player.id} path={`/applications/${encodeURIComponent(application.id)}/interview`} busy={busy}
              submit={(questionId, answer) => run('POST', `/applications/${encodeURIComponent(application.id)}/steps`,
                { step: 'INTERVIEW', questionId, answer })} />}
        </div>
        )
      })}
    </section>
  )
}

export function careerCatalogPath(id: string) {
  return `/catalog/career-roles?playerId=${encodeURIComponent(id)}`
}

export function onPlayer(player: PlayerView, run: (method: 'POST' | 'PUT', path: string, body?: Record<string, unknown>, version?: number) => void): RunPlayer {
  return (method, suffix, body) => run(method, playerPath(player.id) + suffix, body, player.version)
}
