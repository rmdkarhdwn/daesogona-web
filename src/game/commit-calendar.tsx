import { useState } from 'react'
import type { PlayerView, StoryEntry } from '../api/contracts'
import { semesterTurns, yearTurns } from './schedule'
import { actionSummary } from './story'

export function CommitCalendar({ player, entries, loading, failed }: {
  player: PlayerView; entries: StoryEntry[]; loading: boolean; failed: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const current = player.year > 0 ? (player.year - 1) * yearTurns + player.turn : 0
  const records = new Map<number, StoryEntry[]>()
  for (const entry of entries) {
    if (entry.year < 1 || entry.year > 3 || entry.turn < 1 || entry.turn > yearTurns) continue
    const key = (entry.year - 1) * yearTurns + entry.turn
    const group = records.get(key) ?? []
    group.push(entry)
    records.set(key, group)
  }
  const selected = picked ?? current
  const selectedEntries = records.get(selected) ?? []
  return <section id="commit-calendar" className="story-card rail-card commit-calendar" aria-labelledby="commit-title">
    <header className="card-title"><h2 id="commit-title">학교생활 커밋</h2><small>한 칸 = 1턴</small></header>
    {[1, 2, 3].map(year => <div className="commit-year" key={year}>
      <span>{year}학년</span>
      <div className="commit-grid" role="group" aria-label={year + '학년 기록'}>
        {Array.from({ length: yearTurns }, (_, i) => {
          const turn = i + 1
          const key = (year - 1) * yearTurns + turn
          const count = records.get(key)?.length ?? 0
          const future = key > current && !count
          const caption = `${year}학년 ${turn <= semesterTurns ? 1 : 2}학기 · ${turn}턴 · ${future ? '진행 전' : '기록 ' + count + '건'}`
          return <button type="button" className="commit-cell" key={key} data-level={Math.min(count, 3)}
            title={caption} aria-label={caption} aria-current={key === current ? 'step' : undefined}
            aria-pressed={selected === key} disabled={future || (loading && !entries.length) || failed} onClick={() => setPicked(key)} />
        })}
      </div>
    </div>)}
    <div className="commit-legend"><span>기록 수</span>{['0', '1', '2', '3+'].map((count, i) =>
      <span key={count}><i className="commit-swatch" data-level={i} />{count}</span>)}</div>
    <div className="commit-readout" aria-live="polite">
      {failed ? <p>기록을 불러오지 못했습니다.</p> : loading && !entries.length ? <p>기록을 불러오는 중…</p> : selected > 0 ? <>
        <strong>{Math.floor((selected - 1) / yearTurns) + 1}학년 {(selected - 1) % yearTurns + 1}턴</strong>
        {selectedEntries.length ? <ul>{selectedEntries.map(entry => <li key={entry.id}>{actionSummary(entry)}</li>)}</ul>
          : <p>이 턴에 남긴 기록이 없습니다.</p>}
      </> : <p>입학 후 첫 턴부터 기록됩니다.</p>}
    </div>
    <a href="#current-story" className="map-return">최근 기록으로 돌아가기</a>
  </section>
}
