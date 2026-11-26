import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ApiError, isTransientConnectionError, resultReceipt } from './api/client'
import {
  CAMPUS_FINISH_CHOICE, isSchool, playerPath, type YearChoice, type YearTransitionView, type ApplicationView, type CareerPreferenceView, type EndingView, type EventView,
  type MutationResult, type PlayerView, type HistoryEntry,
} from './api/contracts'
import { useCommands, usePlayerData, useStory } from './api/hooks'
import { useGameUi, useSavedGame } from './state'
import { onPlayer, Recruitment, useRecruitment, type RunPlayer } from './game/activities'
import { editionName, lockedEdition, type GameEdition } from './game/editions'
import { GraduationReplay } from './game/graduation-replay'
import { recruitmentCalendar } from './game/recruitment-calendar'
import { semesterTurns } from './game/schedule'
import { fieldLearningRoutes, isFieldLearningRoute } from './game/field-learning'
import { admissionComponents, admissionProtection, choiceDescription, jobLabel, label, trackLabel, stats } from './game/labels'
import { FieldLearningRecord, History, Notebook, qualificationName } from './game/records'
import { CurrentStory, StoryJournal } from './game/story'
import { CampusScene, DashboardLinks, SchoolRail, StudentRail } from './game/dashboard'
import { InterviewForm } from './game/interview'
import { isNarshaParticipation, NarshaParticipation } from './game/narsha-participation'
import { EventSource, NarshaRecord } from './game/school-life'
import { ChoiceCountdown, ChoiceTimerScope, randomChoice, TimedChoices, useChoiceTimer } from './game/choice-timer'
import { CampusPhoto, ChoiceForm, Dialog, Frame, Heading, Journey, Loading, PhotoScene, Problem, Receipt, StatList } from './game/ui'

type Run = (method: 'POST' | 'PUT', path: string, body?: Record<string, unknown>, version?: number) => void
const recentLogCount = 2
const autoTurnDelay = 3600
const nextDecisionDelay = 750
const isNarshaTopic = (code: string) => code === 'N104' || code === 'N201'

export default function App() {
  const commands = useCommands()
  const { pending, active, setDialog } = useGameUi()
  const [error, setError] = useState<unknown>()
  const [receipt, setReceipt] = useState<MutationResult | null>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    setDialog(null)
  }, [pathname, setDialog])

  const run: Run = (method, path, body, version) => {
    setError(undefined)
    void commands.run(method, path, body, version).then((result) => { if (result) setReceipt(resultReceipt(result)) }, setError)
  }
  const retry = () => {
    setError(undefined)
    void commands.retry().then((result) => { if (result) setReceipt(resultReceipt(result)) }, setError)
  }
  const busy = Boolean(pending || active)
  const commandFailed = error != null || Boolean(pending && !active)
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    if (!active || !pending) { setWaiting(false); return }
    const timer = window.setTimeout(() => setWaiting(true), 4000)
    return () => window.clearTimeout(timer)
  }, [active, pending])
  const feedback = (
    <>
      {active && pending && waiting && <p className="notice" role="status">서버 응답을 기다리고 있습니다. 연결이 잠시 끊기면 같은 요청으로 한 번 더 확인합니다.</p>}
      {pending && !active && <div className="problem" role="alert">
        <p>{error instanceof ApiError && !isTransientConnectionError(error) ? error.message :
          navigator.onLine ? '요청이 저장됐는지 아직 확인할 수 없습니다.' : '인터넷 연결이 끊겼습니다.'}</p>
        <p>요청을 이 탭에 보관했습니다. 연결이 돌아오면 아래 버튼으로 이어가세요.</p>
        <button type="button" className="btn" onClick={retry}>같은 요청 다시 보내기</button>
      </div>}
      {error != null && !pending && <Problem error={error} />}
    </>
  )

  return (
    <Routes>
      <Route path="/" element={<Home run={run} busy={busy} feedback={feedback} />} />
      <Route path="/play/:id" element={<GameRoute run={run} busy={busy} receipt={receipt} feedback={feedback} commandFailed={commandFailed} />} />
      <Route path="/ending/:id" element={<GameRoute ending run={run} busy={busy} receipt={receipt} feedback={feedback} commandFailed={commandFailed} />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

function Home({ run, busy, feedback }: { run: Run; busy: boolean; feedback: ReactNode }) {
  const [name, setName] = useState('')
  const [edition, setEdition] = useState<GameEdition>(lockedEdition ?? 'MILD')
  const savedId = useSavedGame((state) => state.playerIds?.[edition] ?? (edition === 'SPICY' && !Object.keys(state.playerIds ?? {}).length ? state.playerId : null))
  const saved = usePlayerData<PlayerView>(savedId ?? '', '')
  const savedMissing = saved.error instanceof ApiError && saved.error.status === 404
  return (
    <Frame>
      {feedback}
      <PhotoScene cover>
        <Heading eyebrow="대소고 학교생활 시뮬레이션" title="대소고나">{edition === 'MILD' ? '1학년 1학기부터 시작하는 학교생활과 취업 준비.' : '입학 지원서를 내는 날부터 졸업하는 날까지.'}</Heading>
        {!lockedEdition && <fieldset className="edition-picker"><legend>플레이 버전</legend>
          {(['MILD', 'SPICY'] as const).map((value) => <label key={value}>
            <input type="radio" name="edition" aria-label={editionName(value)} checked={edition === value} onChange={() => setEdition(value)} />
            <strong>{editionName(value)}</strong><small>{value === 'MILD' ? '1학년부터 · 휴식과 상담 · 취업 준비 지원' : '입학부터 · 기존 스트레스와 진로 선택'}</small>
          </label>)}
        </fieldset>}
        <form className="create-form" onSubmit={(event) => { event.preventDefault(); if (name.trim() && !busy) run('POST', '/players', { name: name.trim(), edition }) }}>
          <label htmlFor="name">이름</label>
          <input id="name" maxLength={24} required value={name} placeholder="이름을 입력하세요" onChange={(event) => setName(event.target.value)} />
          <button className="btn primary wide" type="submit" disabled={busy || !name.trim()}>{edition === 'MILD' ? '학교생활 시작' : '지원 시작'}</button>
        </form>
        {savedId && !savedMissing && <Link className="btn wide continue" to={`/play/${savedId}`}>이어서 하기</Link>}
        {savedMissing && <small className="muted">저장된 회차를 찾지 못했습니다. 새 회차를 시작할 수 있습니다.</small>}
      </PhotoScene>
      <div className="home-foot"><span>대소고 학교생활을 바탕으로 만든 비공식 게임</span>
        {import.meta.env.MODE === 'demo' && <span>로컬 데모</span>}</div>
    </Frame>
  )
}

function GameRoute({ run, busy, receipt, feedback, commandFailed, ending = false }: {
  run: Run; busy: boolean; receipt: MutationResult | null; feedback: ReactNode; commandFailed: boolean; ending?: boolean
}) {
  const id = useParams().id ?? ''
  const player = usePlayerData<PlayerView>(id, '')
  if (player.isPending || player.error) return (
    <Frame>{feedback}<PhotoScene>
      {player.error ? <><Heading eyebrow="학교생활" title="회차를 열 수 없습니다" />
        <Problem error={player.error} retry={() => { void player.refetch() }} /><Link className="btn wide continue" to="/">시작 화면</Link></> : <Loading />}
    </PhotoScene></Frame>
  )
  if (lockedEdition && (player.data.edition ?? 'SPICY') !== lockedEdition) return <Frame><PhotoScene>
    <Heading title="다른 버전의 회차입니다">이 버전에서 새 학교생활을 시작하거나 저장된 회차를 이어 주세요.</Heading><Link className="btn" to="/">시작 화면</Link>
  </PhotoScene></Frame>
  if (ending !== (player.data.phase === 'ENDED')) return <Navigate replace to={`/${player.data.phase === 'ENDED' ? 'ending' : 'play'}/${id}`} />
  return <Game key={id} player={player.data} busy={busy} receipt={receipt?.player.id === id ? receipt : null}
    feedback={feedback} commandFailed={commandFailed} run={onPlayer(player.data, run)} />
}

function Game({ player, busy, receipt, feedback, commandFailed, run }: {
  player: PlayerView; busy: boolean; receipt: MutationResult | null; feedback: ReactNode; commandFailed: boolean; run: RunPlayer
}) {
  const school = isSchool(player)
  const ordinary = !['CAREER_PICK', 'GRAD_READY', 'ENDED'].includes(player.phase)
  const hiring = school && !player.vacation && player.year === 3 && player.turn >= recruitmentCalendar(player).starts
  const { dialog, setDialog } = useGameUi()
  const yearChoice = school && player.school ? player.school.pendingChoice : null
  const events = usePlayerData<EventView[]>(player.id, '/events', ordinary && !yearChoice)
  const story = useStory(player)
  const recruitment = useRecruitment(player, hiring)
  const [selectedEvent, setSelectedEvent] = useState<string>()
  const playbackKey = `daesogo.playback.${player.id}`
  const [playback, setPlayback] = useState<'auto' | 'next' | null>(
    () => sessionStorage.getItem(playbackKey) === 'paused' ? null : 'auto',
  )
  const [speed, setSpeed] = useState(1)
  const entries = story.data?.entries ?? []
  const visible = ordinary && !yearChoice ? events.data ?? [] : []
  const requiredEvents = visible.filter((event) => event.required)
  const eventOptions = requiredEvents.length ? requiredEvents : visible
  const current = eventOptions.find((event) => event.code === selectedEvent) ?? eventOptions[0]
  const focusEvent = current?.code === 'TERM_FOCUS' || current?.code.startsWith('FOCUS_Y') ? current : undefined
  const decision = school && current?.required && !focusEvent ? current : undefined
  const hasRequired = Boolean(yearChoice) || requiredEvents.length > 0 || (school && ((player.year === 2 && !player.major) || (player.year === 3 && !player.track)))
  const canAct = school && Boolean(events.data) && !events.error && !hasRequired
  const choiceOpen = visible.some((event) => event.choices.some((choice) => choice.enabled)) || recruitment.hasAction
  const importantChoice = visible.some((event) => (event.blocksAuto ?? (event.required || event.code === 'J01'))
    && event.choices.some((choice) => choice.enabled)) || recruitment.hasAction
  const blocksAuto = importantChoice || (playback !== 'next' && visible.some((event) => event.choices.some((choice) => choice.enabled)))
  const checking = events.isFetching || recruitment.pending || recruitment.fetching
  const canAuto = canAct && !blocksAuto && !recruitment.error && !checking
  const awaitingChoice = hasRequired || blocksAuto
  const running = Boolean(playback && !awaitingChoice && !dialog && !commandFailed)

  useEffect(() => {
    if (!playback || !school) return
    if (commandFailed || events.error || recruitment.error || (playback === 'next' && awaitingChoice)) {
      setPlayback(null)
      return
    }
    if (busy || dialog || !canAuto) return
    const delay = playback === 'next' ? nextDecisionDelay : autoTurnDelay / speed
    const timer = window.setTimeout(() => run('POST', '/turns/advance', { mode: 'AUTO' }), delay)
    return () => window.clearTimeout(timer)
  }, [playback, speed, school, commandFailed, events.error, recruitment.error, busy, checking, awaitingChoice, dialog, canAuto, run])

  useEffect(() => {
    if (school) sessionStorage.setItem(playbackKey, playback === 'auto' ? 'auto' : 'paused')
  }, [playbackKey, playback, school])

  const showStory = () => document.getElementById('current-story')?.scrollIntoView({ block: 'start' })
  const nextTurn = () => {
    setDialog(null)
    showStory()
    run('POST', '/turns/advance')
  }
  const advance = () => {
    setPlayback(null)
    if (choiceOpen) setDialog('turn')
    else nextTurn()
  }

  let panel: ReactNode
  if (player.phase === 'CAREER_PICK') panel = <CareerPicker player={player} busy={busy} run={run} />
  else if (player.phase === 'GRAD_READY') panel = <GraduationPicker player={player} busy={busy} run={run} />
  else if (player.phase === 'ENDED') panel = <Ending player={player} history={story.data?.history} loadingHistory={story.isPending} />
  else if (yearChoice) panel = <YearTransitionPicker key={yearChoice} player={player} kind={yearChoice} busy={busy} run={run} />
  else if (events.isPending) panel = <Loading />
  else if (events.error) panel = <Problem error={events.error} retry={() => { void events.refetch() }} />
  else if (current && !focusEvent) panel = (
    <>
      {eventOptions.length > 1 && <select className="event-selector" aria-label="현재 이벤트" value={current.code} disabled={busy}
        onChange={(event) => setSelectedEvent(event.target.value)}>
        {eventOptions.map((event) => <option key={event.code} value={event.code}>{event.title}</option>)}
      </select>}
      {decision ? (
        <section aria-label="중대 결정">
          <Heading eyebrow="중대 결정" title={decision.title} level={2}>{decision.situation}</Heading>
          <EventSource source={decision.source} />
          {isNarshaParticipation(decision.code) ? <NarshaParticipation key={decision.code} playerId={player.id} event={decision} busy={busy} run={run} /> :
            isNarshaTopic(decision.code) ? <NarshaTopicPicker key={decision.code} event={decision} busy={busy} run={run} /> :
            <TimedChoices choices={decision.choices} busy={busy} onChoose={(choiceCode) => run('POST', `/events/${decision.code}/choices`, { choiceCode })}>{choose =>
            <ol className="decision-options" data-event-code={decision.code}>{decision.choices.map((choice, index) => <li key={choice.code}>
              <button className="btn wide decision-option" type="button" disabled={busy || !choice.enabled}
                aria-label={choice.label} aria-describedby={choice.description ? `decision-${choice.code}` : undefined}
                onClick={() => choose(choice.code)}>
                <span aria-hidden="true">{index + 1}</span><span className="decision-copy"><strong>{choice.label}</strong>
                {choice.description && <small id={`decision-${choice.code}`}>{choiceDescription(choice.description)}</small>}</span>
              </button>
            </li>)}</ol>}</TimedChoices>}
        </section>
      ) : <EventPanel key={current.code} event={current} player={player} busy={busy} run={run} />}
    </>
  )

  const timeControls = school && (
    <div className="time-controls" role="group" aria-label="시간 진행">
      <span className={`clock-label${running ? ' running' : ''}`} aria-live="polite">
        {running ? '시간이 흐르는 중' : '일시 정지 상태'}
        {awaitingChoice && <small> · 선택 대기</small>}
      </span>
      <button className="btn primary" type="button" disabled={!playback && ((!canAuto && !awaitingChoice) || busy || commandFailed)}
        onClick={() => { if (!playback) showStory(); setPlayback(playback ? null : 'auto') }}>{playback ? '일시 정지' : '자동 진행'}</button>
      <div className="speed-strip" role="group" aria-label="재생 속도">{[1, 2, 4, 8, 16].map(rate =>
        <button className="btn" type="button" key={rate} aria-pressed={speed === rate} onClick={() => setSpeed(rate)}>{rate}×</button>)}</div>
      <select className="clock-speed" aria-label="진행 속도" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
        {[1, 2, 4, 8, 16].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
      </select>
      <button className="btn" type="button" disabled={playback === 'next' || !canAct || importantChoice || checking || busy || commandFailed || Boolean(recruitment.error)}
        onClick={() => { showStory(); setPlayback('next') }}>다음 결정까지</button>
      <button className="btn end-turn" type="button" disabled={!canAct || busy} onClick={advance}>턴 종료</button>
    </div>
  )

  return (
    <ChoiceTimerScope paused={busy || commandFailed || Boolean(dialog)} resetKey={`${player.id}:${player.version}:${player.phase}`}>
    <Frame player={player} timeControls={timeControls} footer={<Journey player={player} />}
      saveStatus={busy ? '저장 중' : commandFailed ? '저장 상태 확인' : '저장됨'}>
      <div className="story-layout">
        <section className="story-main" aria-labelledby="journal-title">
          <DashboardLinks />
          <CampusScene />
          <div className="journal-heading"><h1 id="journal-title">인생 기록</h1><span>{entries.length}건</span></div>
          <CurrentStory entries={entries.slice(-recentLogCount).reverse()} loading={story.isPending} failed={story.isError} retry={() => { void story.refetch() }} />
          <section className="current-choices" id="current-choices" aria-labelledby="choices-title">
            <h2 className="section-label" id="choices-title">선택지</h2>
            {!dialog && feedback}
            {panel && <section className="story-card choice-card" id="current-selection" aria-label="지금 열린 선택">{panel}</section>}
            {hiring && canAct && <Recruitment player={player} busy={busy} run={run} data={recruitment} />}
            {school && !player.vacation && !player.school?.vacationPending && !player.school?.practiceRemaining && (!hasRequired || focusEvent) &&
              <SemesterFocus key={`${player.year}-${player.turn <= semesterTurns ? 1 : 2}`}
                player={player} busy={busy} run={run} event={focusEvent} />}
            {Boolean(player.vacation?.campTurn) && <section className="story-card choice-card">
              <Heading title={`전공강화캠프 · ${player.vacation?.campTurn}/2턴`} level={2}>
                시간을 진행하면 이번 실습을 마칩니다.
              </Heading>
            </section>}

            {!panel && !hiring && !school && <p className="story-note">현재 열린 선택지가 없습니다.</p>}
          </section>
          {receipt && !['TURN_ADVANCE', 'TURN_END'].includes(receipt.actionCode) && <Receipt receipt={receipt} />}
          <StoryJournal entries={entries.slice(0, -recentLogCount)} />
        </section>
        <StudentRail player={player} />
        <SchoolRail player={player} entries={entries} loading={story.isPending} failed={story.isError} />
      </div>
      {dialog === 'notebook' && <Dialog title="학생 수첩" close={() => setDialog(null)}>{feedback}<Notebook player={player} busy={busy} run={run} /></Dialog>}
      {dialog === 'history' && <Dialog title="전체 기록" close={() => setDialog(null)}>{feedback}<History player={player} /></Dialog>}
      {dialog === 'photo' && <Dialog title="대소고 캠퍼스 사진" close={() => setDialog(null)}><CampusPhoto className="campus-photo" /></Dialog>}
      {dialog === 'turn' && <Dialog title="턴을 끝낼까요?" close={() => setDialog(null)}>
        {feedback}
        {choiceOpen && <p>현재 열린 선택이나 채용 일정은 이번 턴과 함께 지나갑니다.</p>}
        <button type="button" className="btn primary wide" disabled={busy || !canAct} onClick={nextTurn}>다음 턴으로</button>
      </Dialog>}
    </Frame></ChoiceTimerScope>
  )
}

function YearTransitionPicker({ player, kind, busy, run }: {
  player: PlayerView; kind: YearChoice; busy: boolean; run: RunPlayer
}) {
  const path = '/year-transition'
  const query = usePlayerData<YearTransitionView>(player.id, path + '/' + kind, true, playerPath(player.id) + path)
  if (query.isPending) return <Loading />
  if (query.error) return <Problem error={query.error} retry={() => { void query.refetch() }} />
  const { year, pendingChoice, options, notice } = query.data
  const major = kind === 'MAJOR'
  if (year !== player.year || pendingChoice !== kind || !options.length) return <p role="status">
    학년 선택 정보를 다시 확인해 주세요. <button className="btn" onClick={() => window.location.reload()}>다시 불러오기</button>
  </p>
  return <section aria-label="중대 결정">
    <Heading eyebrow="중대 결정" title={major ? '2학년 학과 선택' : '3학년 수업 선택'} level={2}>{notice}</Heading>
    <ChoiceForm automatic busy={busy} submit={major ? '학과 확정' : '수업 확정'}
      options={options.map(option => ({ value: option.code, label: option.title, detail: option.focus.map(stat => stats[stat]).join(' · ') }))}
      onSubmit={choiceCode => run('POST', path, { choiceCode })} />
  </section>
}

function SemesterFocus({ player, busy, run, event }: {
  player: PlayerView; busy: boolean; run: RunPlayer; event?: EventView
}) {
  const query = usePlayerData<EventView>(player.id, '/events/TERM_FOCUS', !event && !player.semesterFocus && !player.school)
  const stored = player.school?.semesterFocus
  const focus = player.semesterFocus?.label ?? (stored ? stats[stored as keyof typeof stats] : undefined)
  const semester = player.turn <= semesterTurns ? 1 : 2
  const turnInSemester = (player.turn - 1) % semesterTurns + 1
  const choices = (event ?? query.data)?.choices ?? []
  return (
    <section className="story-card choice-card" aria-label="이번 학기에 집중할 것">
      <Heading eyebrow={`${semester}학기 · ${turnInSemester}/${semesterTurns}턴`} title="이번 학기에 집중할 것" level={2} />
      {focus ? <p><strong>{focus}</strong><br /><small>이 학기가 끝날 때까지 매 턴 적용됩니다.</small></p> :
        choices.length ? <ChoiceForm automatic busy={busy} submit="이번 학기 집중 정하기"
          options={choices.map((choice) => ({ value: choice.code, label: choice.label, detail: choiceDescription(choice.description), disabled: !choice.enabled }))}
          onSubmit={(choiceCode) => run('POST', `/events/${event?.code ?? 'TERM_FOCUS'}/choices`, { choiceCode })} /> :
          query.isError ? <Problem error={query.error} retry={() => { void query.refetch() }} /> : <Loading />}
    </section>
  )
}

function NarshaTopicPicker({ event, busy, run }: { event: EventView; busy: boolean; run: RunPlayer }) {
  const [choiceCode, setChoiceCode] = useState('')
  const [topic, setTopic] = useState('')
  const custom = choiceCode === 'NARSHA_CUSTOM'
  const valid = !custom || (topic.trim().length >= 2 && topic.trim().length <= 80 && !/[\x00-\x1f\x7f]/.test(topic.trim()))
  return <ChoiceForm automatic busy={busy} submit="이 주제로 시작" canSubmit={valid} onSelectionChange={setChoiceCode}
    options={event.choices.map((choice) => ({
      value: choice.code, label: choice.label, detail: choiceDescription(choice.description), disabled: !choice.enabled, autoPick: choice.code !== 'NARSHA_CUSTOM',
    }))} onSubmit={(code) => run('POST', `/events/${event.code}/choices`, {
      choiceCode: code, ...(code === 'NARSHA_CUSTOM' ? { customTopic: topic.trim() } : {}),
    })}>
    {custom && <div className="custom-topic-field">
      <label htmlFor={`custom-topic-${event.code}`}>프로젝트 주제</label>
      <input id={`custom-topic-${event.code}`} value={topic} maxLength={80} disabled={busy}
        placeholder="팀이 만들 프로젝트 주제를 입력해 주세요" onChange={(e) => setTopic(e.target.value)}
        aria-describedby={`custom-topic-hint-${event.code}`} />
      <small id={`custom-topic-hint-${event.code}`}>2~80자 · {topic.trim().length}/80</small>
    </div>}
  </ChoiceForm>
}

function BeforeSchoolPicker({ event, busy, onSubmit }: {
  event: EventView
  busy: boolean
  onSubmit: (choiceCodes: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>([])
  const choices = event.choices.filter((choice) => choice.code !== CAMPUS_FINISH_CHOICE)
  const limit = event.selectionCount ?? 2
  const visited = choices.filter((choice) => choice.visited).length
  const remaining = Math.max(0, limit - visited)
  const submitLabel = event.code === 'BS01' ? '탐색 마치기' : '체험 마치기'
  const available = choices.filter(choice => choice.enabled && !choice.visited).map(choice => choice.code)
  const timer = useChoiceTimer({ enabled: remaining > 0 && available.length >= remaining, busy, choiceKey: event.code,
    onExpire: () => {
      const picked = selected.filter(code => available.includes(code)).slice(0, remaining)
      const pool = available.filter(code => !picked.includes(code))
      while (picked.length < remaining) { const code = randomChoice(pool)!; picked.push(code); pool.splice(pool.indexOf(code), 1) }
      onSubmit(picked)
    } })

  return <>
    <ChoiceCountdown timer={timer} description="고른 장소·체험은 유지하고, 남은 개수만 자동으로 채워 확정합니다." />
    <p className="field-note" role="status">선택 {Math.min(visited + selected.length, limit)} / {limit}</p>
    <fieldset className="options before-school-options" aria-label={event.title}>
      {choices.map((choice) => {
        const checked = Boolean(choice.visited) || selected.includes(choice.code)
        const disabled = busy || !choice.enabled || (!checked && selected.length >= remaining)
        return <label key={choice.code} className={`option${checked ? ' selected' : ''}${disabled ? ' locked' : ''}`}>
          <input type="checkbox" aria-label={choice.label} checked={checked} disabled={disabled}
            onChange={(e) => {
              const check = e.target.checked
              setSelected((current) => check
                ? [...current, choice.code]
                : current.filter((code) => code !== choice.code))
            }} />
          <span className="option-copy"><strong>{choice.label}</strong><small>{choiceDescription(choice.description)}</small></span>
          {choice.visited && <span className="option-tag">방문 완료</span>}
        </label>
      })}
    </fieldset>
    <button className="btn primary wide" type="button" disabled={busy || selected.length !== remaining}
      onClick={() => timer.confirm(() => onSubmit(selected))}>{submitLabel}</button>
  </>
}

function EventPanel({ event, player, busy, run }: { event: EventView; player: PlayerView; busy: boolean; run: RunPlayer }) {
  const path = `/events/${encodeURIComponent(event.code)}/choices`
  const commit = (choiceCode: string) => run('POST', path, { choiceCode })
  const fieldLearning = event.code === 'J01' && event.choices.some((choice) => isFieldLearningRoute(choice.code))
  const caption = fieldLearning ? '게임 속 진로 체험 · 선택 이벤트' : event.code === 'J01' ? '진로 상담 · 선택 이벤트' :
    player.phase === 'BEFORE_SCHOOL' ? `게임 속 비포스쿨 · ${player.beforeSchoolDay}일 차` :
      event.required ? undefined : '선택 이벤트'
  return (
    <>
      <Heading eyebrow={caption} title={event.title} level={2}>{event.situation}</Heading>
      {event.code === 'AD00' && event.choices.length > 1 && <p className="field-note">표시된 확률은 이 회차의 지원 자격 추첨에 적용됩니다. 특별전형 탈락 시 보호막이 발동해 이미 제출한 결과로 일반전형 판정을 한 번 받습니다.</p>}
      <EventSource source={event.source} />
      {fieldLearning && <p className="field-note">가상 운영 규칙입니다. 한 회차에서 한 프로그램에 신청할 수 있으며, 참가 여부와 관계없이 기업 지원도 가능합니다.</p>}
      {event.code === 'AD05' ? (
        <InterviewForm playerId={player.id} path="/events/AD05/interview" busy={busy}
          submit={(questionId, answer) => run('POST', '/events/AD05/choices', { choiceCode: 'ANSWER', questionId, answer })} />
      ) : isNarshaParticipation(event.code) ? (
        <NarshaParticipation key={event.code} playerId={player.id} event={event} busy={busy} run={run} />
      ) : isNarshaTopic(event.code) ? (
        <NarshaTopicPicker key={event.code} event={event} busy={busy} run={run} />
      ) : event.selectionCount ? (
        <BeforeSchoolPicker key={event.code} event={event} busy={busy}
          onSubmit={(choiceCodes) => run('POST', path, { choiceCodes })} />
      ) : event.required ? (
        <ChoiceForm automatic busy={busy} onSubmit={commit} options={event.choices.map((choice) => ({
          value: choice.code, label: choice.label, detail: choiceDescription(choice.description), disabled: !choice.enabled,
          hint: choice.visited ? undefined : choice.reason, tag: choice.visited ? '방문 완료' : choice.apCost > 0 ? `${choice.apCost} AP` : undefined,
        }))} />
      ) : (
        <>
          <TimedChoices choices={event.choices} busy={busy} onChoose={commit}>{choose => <div className="event-buttons">
            {event.choices.map((choice, index) => <div key={choice.code}>
              <button type="button" className={`btn wide${index === 0 ? ' primary' : ''}`} disabled={busy || !choice.enabled}
                onClick={() => choose(choice.code)}>{choice.label}{choice.apCost > 0 ? ` · ${choice.apCost} AP` : ''}</button>
              {fieldLearning && isFieldLearningRoute(choice.code) && <small className="field-option">{fieldLearningRoutes[choice.code].preview}</small>}
              {choice.description && !fieldLearning && <small className="field-option">{choiceDescription(choice.description)}</small>}
              {choice.reason && <small className="lock-note">{choice.reason}</small>}
            </div>)}
          </div>}</TimedChoices>
        </>
      )}
    </>
  )
}

function CareerPicker({ player, busy, run }: { player: PlayerView; busy: boolean; run: RunPlayer }) {
  const career = usePlayerData<CareerPreferenceView>(player.id, '/career-preference')
  if (career.isPending) return <Loading />
  if (career.error) return <Problem error={career.error} retry={() => { void career.refetch() }} />
  return (
    <>
      <Heading eyebrow="나의 진로" title="희망 직무 선택" level={2}>{player.edition === 'MILD' ? '현재 기초 역량을 바탕으로 11개 직무를 적합도순으로 정리했습니다.' : '비포스쿨 경험과 능력치를 바탕으로 11개 직무를 적합도순으로 정리했습니다.'} 순위는 참고하고, 하고 싶은 직무를 자유롭게 골라 주세요.</Heading>
      <ChoiceForm automatic busy={busy} submit="이 직무로 시작" onSubmit={(roleCode) => run('PUT', '/career-preference', { roleCode })}
        options={[...career.data.recommendations].sort((a, b) => a.rank - b.rank).map((entry) => ({
          value: entry.roleCode, label: entry.label, tag: `적합도 ${entry.rank}위 · ${entry.score.toFixed(2)}점`,
          detail: [...entry.activityReasons.map((item) => item.eventCode === 'BS01' && item.choiceCode === 'STUDIO'
            ? label('STUDIO') : item.activityLabel), ...entry.statReasons.map((item) => `${stats[item.statCode]} +${item.contribution}`)].join(' · '),
        }))} />
    </>
  )
}

function GraduationPicker({ player, busy, run }: { player: PlayerView; busy: boolean; run: RunPlayer }) {
  const applications = usePlayerData<ApplicationView[]>(player.id, '/applications')
  if (applications.isPending) return <Loading />
  if (applications.error) return <Problem error={applications.error} retry={() => { void applications.refetch() }} />
  const offers = applications.data.filter((item) => item.status === 'OFFERED')
  return (
    <>
      <Heading eyebrow="학교생활의 마지막 선택" title="졸업 후 진로" level={2}>학교에서 쌓은 경험을 바탕으로 다음 걸음을 정합니다.</Heading>
      <ChoiceForm busy={busy} submit="졸업 확정" onSubmit={(value) => {
        if (value.startsWith('offer:')) run('POST', '/graduation', { path: player.school ? 'EMPLOYMENT' : 'ACCEPT_OFFER', applicationId: value.slice(6) })
        else run('POST', '/graduation', { path: value })
      }} options={[
        ...offers.map((item) => ({ value: `offer:${item.id}`, label: `${label(item.companyCode)} 제안 수락`, detail: jobLabel(item.role) })),
        { value: player.school ? 'UNEMPLOYED' : 'RETRY_JOB', label: '다시 취업 준비' },
        { value: player.school ? 'UNIVERSITY' : 'STUDY_NEXT', label: '진학 준비', detail: player.school ? undefined : '진학 준비 2회와 학업 35점' },
        { value: player.school ? 'INDIE_DEV' : 'INDIE', label: '개인 개발 준비', detail: player.school ? '포트폴리오 등록 작품 1개 이상' : '개인 개발 준비 1회와 완성 프로젝트' },
      ]} />
    </>
  )
}

function Ending({ player, history, loadingHistory }: { player: PlayerView; history?: HistoryEntry[]; loadingHistory: boolean }) {
  const result = usePlayerData<EndingView>(player.id, '/ending')
  if (result.isPending) return <Loading />
  if (result.error) return <Problem error={result.error} retry={() => { void result.refetch() }} />
  const { title, body, summary, selectedPath, acceptedCompany, acceptedRole } = result.data
  const ending = (
    <>
      <Heading eyebrow={player.endReason === 'WITHDRAWAL' ? '학교생활 기록' : player.year ? '졸업 기록' : '입학 전형 결과'} title={title} level={2}>{body}</Heading>
      {'stage' in summary ? <div className="record-line"><p>{summary.stage}차 · {summary.score}점 · {summary.rank}위</p>
        {summary.protection && <p>{admissionProtection(summary.protection, summary.passed === true)}</p>}
        {summary.components && <p className="muted">{admissionComponents(summary.stage, summary.components)}</p>}</div> :
        <div className="ending-summary">
          {summary.schoolStatus === 'WITHDRAWN' && <p>{summary.withdrawalYear}학년 {summary.withdrawalTurn}턴에 자퇴를 선택했습니다.</p>}
          <p>최초 희망 · {jobLabel(summary.initialCareerCode)}<br />현재 희망 · {jobLabel(summary.currentCareerCode)}</p>
          <p>{label(summary.major)} · {trackLabel(summary.track)}</p>
          {(acceptedRole || (summary.employed && summary.acceptedRole)) ? <p>취업 · {label(acceptedCompany ?? summary.acceptedCompany)} · {jobLabel(acceptedRole ?? summary.acceptedRole)}</p> :
            <p>{summary.schoolStatus === 'WITHDRAWN' ? '다음 계획' : '졸업 후'} · {label(summary.nextPath ?? selectedPath)}</p>}
          <FieldLearningRecord route={summary.fieldLearningRoute} experience={summary.fieldLearning} />
          {summary.narshaProjects?.length ? summary.narshaProjects.map((record, i) =>
            <NarshaRecord key={'year' in record ? record.year : record.schoolYear ?? i} record={record} />) : <NarshaRecord record={summary.narsha} />}
          {summary.certificates?.length ? <p>자격증 · {summary.certificates.map(item => item.certificate).join(', ')}</p> : null}
          {summary.qualifications?.length ? <p>자격증 · {summary.qualifications.map(qualificationName).join(', ')}</p> : null}
          {summary.projects?.length ? <p>프로젝트 · {summary.projects.map((item) => label(item.projectCode)).join(', ')}</p> : null}
          {summary.applicationResults?.map((item) => <p key={item.id}>{label(item.companyCode)} · {label(item.status)}{item.failureCode ? ` · ${label(item.failureCode)}` : ''}</p>)}
          {(summary.finalStats ?? summary.stats) && <details><summary>졸업 능력치</summary><StatList values={(summary.finalStats ?? summary.stats)!} /></details>}
        </div>}
      <Link className="btn primary wide continue" to="/">새 회차 시작</Link>
    </>
  )
  if ('stage' in summary || !player.year || summary.schoolStatus === 'WITHDRAWN' || player.endReason === 'WITHDRAWAL') return ending
  return <GraduationReplay id={player.id} name={player.name} summary={summary} history={history} loading={loadingHistory}>{ending}</GraduationReplay>
}
