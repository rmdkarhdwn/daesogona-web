import type { StoryEntry } from '../api/contracts'
import { AssessmentResults, StatSetbacks, StressPressure } from './assessments'


function period(entry: StoryEntry) {
  if (entry.year) return `${entry.year}학년 ${entry.turn <= 12 ? 1 : 2}학기 · ${entry.turn}턴`
  if (entry.beforeSchoolDay) return `비포스쿨 ${entry.beforeSchoolDay}일 차`
  return '입학 전형'
}

function StoryText({ entry }: { entry: StoryEntry }) {
  return (
    <div className="story-text">
      <p>{entry.text}</p>
      <AssessmentResults results={entry.assessments} />
      <StatSetbacks results={entry.setbacks} />
      <StressPressure load={entry.stressLoad} />
      {entry.dialogue.length > 0 && <dl className="story-dialogue">
        {entry.dialogue.map((line, index) => <div key={index}><dt>{line.speaker}</dt><dd>{line.text}</dd></div>)}
      </dl>}
    </div>
  )
}

export function actionSummary(entry: StoryEntry) {
  if (entry.actionSummary) return entry.actionSummary
  const sources = entry.stressLoad?.sources ?? []
  if (sources.length === 1 && sources[0].reason.endsWith('기')) return sources[0].reason
  const exam = entry.assessments?.[0]?.title ?? sources
    .map(source => ({ MIDTERM: '중간고사', FINAL: '기말고사', ASSESSMENT: '수행평가' })[source.code])
    .find(Boolean)
  if (exam) return exam.includes('수행평가') ? '수행평가 제출' : `${exam} 응시`

  const text = entry.text.trim()
  const body = text.startsWith(entry.title + '.') ? text.slice(entry.title.length + 1).trim() : text
  const selected = body.match(/^수첩에 적었다\.\s*“(.+?)\.?”/u)
  if (selected) return selected[1]
  return body.split(/(?<=[.!?])\s|\n/u, 1)[0] || entry.title
}

export function CurrentStory({ entries, loading, failed, retry }: {
  entries: StoryEntry[]; loading: boolean; failed: boolean; retry: () => void
}) {
  return (
    <section className="current-story" id="current-story" aria-labelledby="current-story-title">
      <h2 className="section-label" id="current-story-title">최근 로그</h2>
      {entries.map(entry => (
        <details className="recent-entry" key={entry.id}>
          <summary>
            <span className="journal-period">{period(entry)}</span>
            <span className="recent-action">{actionSummary(entry)}</span>
          </summary>
          <div className="recent-detail">
            <h3>{entry.title}</h3>
            <StoryText entry={entry} />
            {entry.status === 'PENDING' && !failed && <p role="status">기록 작성 중</p>}
          </div>
        </details>
      ))}
      {failed && <div className="story-note story-retry"><p>이야기를 불러오지 못했습니다.</p><button className="btn" type="button" onClick={retry}>이야기 다시 불러오기</button></div>}
      {!entries.length && !failed && <p className="story-note">{loading ? '기록을 불러오는 중…' : '아직 기록이 없습니다.'}</p>}
    </section>
  )
}

export function StoryJournal({ entries }: { entries: StoryEntry[] }) {
  return (
    <section className="past-stories" id="past-stories" aria-labelledby="past-stories-title">
      <div className="journal-heading"><h2 id="past-stories-title">여태껏 했던 로그</h2><span>{entries.length}건</span></div>
      {entries.length ?
    <ol className="story-card journal-entries" aria-label="이전 장면">
      {entries.slice().reverse().map((entry) => <li key={entry.id}>
        <span className="journal-period">{period(entry)}</span>
        <div>
          <h3>{entry.title}</h3>
          <StoryText entry={entry} />
        </div>
      </li>)}
    </ol>
      : <p className="story-note">아직 이전 로그가 없습니다. 이야기가 진행되면 여기에 쌓입니다.</p>}
    </section>
  )
}
