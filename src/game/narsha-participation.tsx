import { useState } from 'react'
import type { EventView, NarshaTopics } from '../api/contracts'
import { usePlayerData } from '../api/hooks'
import type { RunPlayer } from './activities'
import { TimedChoices } from './choice-timer'
import { ChoiceForm, Loading, Problem } from './ui'

export function isNarshaParticipation(code: string) {
  return code === 'NARSHA_START' || code === 'NARSHA_RESUME'
}

export function NarshaParticipation({ playerId, event, busy, run }: {
  playerId: string; event: EventView; busy: boolean; run: RunPlayer
}) {
  const [choosingTopic, setChoosingTopic] = useState(false)
  const [selected, setSelected] = useState('')
  const [text, setText] = useState('')
  const catalog = usePlayerData<NarshaTopics>(playerId, '/narsha', choosingTopic)
  const participate = event.code === 'NARSHA_START' ? 'JOIN' : 'RESUME'
  const path = `/events/${event.code}/choices`

  if (!choosingTopic) return <TimedChoices choices={event.choices} busy={busy} onChoose={code => {
    if (code === participate) setChoosingTopic(true)
    else run('POST', path, { choiceCode: code })
  }}>{choose => <div className="event-buttons">{event.choices.map(choice =>
    <div key={choice.code}>
      <button className={`btn wide${choice.code === participate ? ' primary' : ''}`} type="button"
        disabled={busy || !choice.enabled} onClick={() => choose(choice.code)}>{choice.label}</button>
      {choice.reason && <small className="lock-note">{choice.reason}</small>}
    </div>)}</div>}</TimedChoices>

  const rule = catalog.data?.customTopicRule
  const custom = selected === rule?.topicCode
  const topic = text.trim().replace(/\s+/gu, ' ')
  const length = Array.from(topic).length
  const valid = !custom || (!!rule && length >= rule.minLength && length <= rule.maxLength && !/[\p{Cc}\p{Cf}\p{Cn}]/u.test(topic))
  return <>
    <h3>나르샤 프로젝트 주제</h3>
    {catalog.isError ? <Problem error={catalog.error} retry={() => { void catalog.refetch() }} />
      : !catalog.data || !rule ? <Loading text="프로젝트 주제를 불러오는 중…" />
      : <ChoiceForm automatic busy={busy} submit="이 주제로 참가" canSubmit={valid}
          onSelectionChange={setSelected} options={[
            ...catalog.data.topics.map(item => ({ value: item.code, label: item.title, detail: item.summary })),
            { value: rule.topicCode, label: '기타 · 주제 직접 입력', autoPick: false },
          ]} onSubmit={topicCode => run('POST', path, { choiceCode: participate, narsha: topicCode === rule.topicCode
            ? { topicCode, customTopic: topic } : { topicCode } })}>
          {custom && <div className="custom-topic-field">
            <label htmlFor="narsha-topic">프로젝트 주제</label>
            <input id="narsha-topic" value={text} disabled={busy} onChange={e => setText(e.target.value)}
              aria-describedby="narsha-topic-length" />
            <small id="narsha-topic-length">{rule.minLength}~{rule.maxLength}자 · 현재 {length}자</small>
          </div>}
        </ChoiceForm>}
    <button type="button" className="btn" disabled={busy} onClick={() => {
      setChoosingTopic(false)
      setSelected('')
      setText('')
    }}>참가 선택으로 돌아가기</button>
  </>
}
