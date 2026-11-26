import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GraduationSummary, HistoryEntry } from '../api/contracts'
import { graduationMemories, type GraduationMemory } from './graduation-memories'
import { CampusPhoto } from './ui'

interface Props {
  id: string; name: string; summary: GraduationSummary; history?: HistoryEntry[]; loading: boolean; children: ReactNode
}

export function GraduationReplay({ id, name, summary, history, loading, children }: Props) {
  const seenKey = 'daesogona.graduation-replay.' + id
  const [show, setShow] = useState(() => sessionStorage.getItem(seenKey) !== 'seen')
  const [scenes, setScenes] = useState<GraduationMemory[] | null>(null)
  const endingRegion = useRef<HTMLElement>(null)
  const returnFocus = useRef(false)
  useEffect(() => {
    if (!show || scenes) return
    const collect = () => setScenes(graduationMemories(summary, history ?? []))
    if (!loading || history) { collect(); return }
    const timeout = window.setTimeout(collect, 3000)
    return () => window.clearTimeout(timeout)
  }, [show, scenes, loading, history, summary])
  useEffect(() => {
    if (!show && returnFocus.current) {
      returnFocus.current = false
      endingRegion.current?.focus({ preventScroll: true })
      endingRegion.current?.scrollIntoView({ block: 'start' })
    }
  }, [show])
  function finish() {
    sessionStorage.setItem(seenKey, 'seen')
    returnFocus.current = true
    setShow(false)
  }
  if (show && (!scenes || scenes.length > 0)) return <MemoryScreen name={name} scenes={scenes} finish={finish} />
  return <section className="graduation-result" aria-label="졸업 엔딩" tabIndex={-1} ref={endingRegion}>
    {children}
    {(scenes?.length !== 0 || Boolean(history?.length)) && <button type="button" className="btn wide" onClick={() => {
      setScenes(null); setShow(true)
    }}>지난 선택 다시 보기</button>}
  </section>
}

function MemoryScreen({ name, scenes, finish }: { name: string; scenes: GraduationMemory[] | null; finish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [hidden, setHidden] = useState(document.hidden)
  const done = useRef(finish)
  useEffect(() => { done.current = finish }, [finish])
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => { node.close(); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (paused || hidden || !scenes?.length) return
    const timer = window.setTimeout(() => {
      if (index + 1 === scenes.length) done.current()
      else setIndex(index + 1)
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [index, scenes, paused, hidden])
  const scene = scenes?.[index]
  return <dialog className="memory-screen" ref={dialog} aria-labelledby="memory-title" onCancel={event => { event.preventDefault(); finish() }}>
    <div className="memory-heading"><h2 id="memory-title">{name}의 졸업 회상</h2><button type="button" className="btn" onClick={finish}>건너뛰기</button></div>
    <CampusPhoto className="memory-photo" />
    <div className="memory-caption" key={index} aria-live="polite" aria-atomic="true">
      {scene ? <><small>{scene.when}</small><h3>{scene.title}</h3><p>{scene.text}</p></> : <p>학교생활 기록을 펼치는 중…</p>}
    </div>
    {scenes && <><div className="memory-track" aria-hidden="true">{scenes.map((_, i) => <span key={i} className={i <= index ? 'lit' : ''} />)}</div>
      <div className="memory-controls"><small>{index + 1} / {scenes.length}</small>
        <button className="btn" type="button" onClick={() => setPaused(!paused)}>{paused ? '자동 재생' : '잠시 멈추기'}</button>
        <button className="btn primary" type="button" onClick={() => index + 1 === scenes.length ? finish() : setIndex(index + 1)}>{index + 1 === scenes.length ? '엔딩 보기' : '다음 장면'}</button>
      </div></>}
  </dialog>
}
