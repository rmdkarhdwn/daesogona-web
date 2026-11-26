import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GraduationSummary, HistoryEntry } from '../api/contracts'
import { graduationMemories, type GraduationMemory, type Finale, type Shot } from './graduation-memories'
import campus from '../assets/campus-photo.png'
import classroom from '../assets/ending/classroom.webp'
import workbench from '../assets/ending/workbench.webp'
import commute from '../assets/ending/commute.webp'
import notebook from '../assets/ending/notebook.webp'

const plates: Record<Shot, string> = { campus, classroom, workbench, commute, notebook }
const shotLength = 4400

interface Props {
  id: string; name: string; ending: Finale; summary: GraduationSummary; history?: HistoryEntry[]; loading: boolean; children: ReactNode
}

export function GraduationReplay({ id, name, ending, summary, history, loading, children }: Props) {
  const seenKey = 'daesogona.graduation-film.v1.' + id
  const [show, setShow] = useState(() => sessionStorage.getItem(seenKey) !== 'seen')
  const [scenes, setScenes] = useState<GraduationMemory[] | null>(null)
  const endingRegion = useRef<HTMLElement>(null)
  const returnFocus = useRef(false)
  useEffect(() => {
    if (!show || scenes) return
    const collect = () => setScenes(graduationMemories(summary, history ?? [], ending))
    if (!loading || history) { collect(); return }
    const timeout = window.setTimeout(collect, 3000)
    return () => window.clearTimeout(timeout)
  }, [show, scenes, loading, history, summary, ending])
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
  if (show) return <MemoryScreen name={name} scenes={scenes} finish={finish} />
  return <section className="graduation-result" aria-label="졸업 엔딩" tabIndex={-1} ref={endingRegion}>
    {children}
    <button type="button" className="btn wide" onClick={() => {
      setScenes(null); setShow(true)
    }}>졸업 컷신 다시 보기</button>
  </section>
}

function MemoryScreen({ name, scenes, finish }: { name: string; scenes: GraduationMemory[] | null; finish: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [hidden, setHidden] = useState(document.hidden)
  const clock = useRef({ index: -1, left: shotLength })
  const done = useRef(finish)
  useEffect(() => { done.current = finish }, [finish])
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    Object.values(plates).forEach(src => { const image = new Image(); image.src = src })
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => { node.close(); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (clock.current.index !== index) clock.current = { index, left: shotLength }
    if (paused || hidden || !scenes?.length) return
    const started = performance.now()
    const timer = window.setTimeout(() => {
      if (index + 1 === scenes.length) done.current()
      else setIndex(index + 1)
    }, clock.current.left)
    return () => {
      window.clearTimeout(timer)
      clock.current.left = Math.max(0, clock.current.left - (performance.now() - started))
    }
  }, [index, scenes, paused, hidden])
  const scene = scenes?.[index]
  const last = Boolean(scenes && index === scenes.length - 1)
  return <dialog className="memory-screen" ref={dialog} aria-labelledby="memory-title"
    data-paused={paused || hidden} onCancel={event => { event.preventDefault(); finish() }}>
    <div className="film-shell">
      <header className="memory-heading"><h2 id="memory-title">{name}의 졸업 회상</h2>
        <button type="button" className="film-button" onClick={finish}>건너뛰기</button></header>
      <div className="film-stage" key={index} data-reverse={index % 2 === 1} data-finale={last}>
        {scene && <img src={plates[scene.shot]} className="film-plate" alt="" />}
        <div className="memory-caption" aria-live="polite" aria-atomic="true">
          {scene ? <><small>{scene.when}</small><h3>{scene.title}</h3><p>{scene.text}</p></> : <p>학교생활 기록을 펼치는 중…</p>}
        </div>
      </div>
      <footer className="film-footer">
        {scenes && <><div className="memory-track" aria-hidden="true">{scenes.map((_, i) =>
          <span key={i} data-state={i < index ? 'past' : i === index ? 'now' : undefined}><i style={{ animationDuration: shotLength + 'ms' }} /></span>)}</div>
          <div className="memory-controls"><small>{index + 1} / {scenes.length}</small>
            <button className="film-button" type="button" onClick={() => setPaused(!paused)}>{paused ? '자동 재생' : '잠시 멈추기'}</button>
            <button className="film-button film-next" type="button" onClick={() => last ? finish() : setIndex(index + 1)}>{last ? '엔딩 보기' : '다음 장면'}</button>
          </div></>}
      </footer>
    </div>
  </dialog>
}
