import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'

// ── Partner Push ───────────────────────────────────────────────────────
//
// A three-column board (To do · In progress · Done) for the Q4 partner push:
// the three asks of IM Digital and Aries, plus the next steps from the
// leadership sync of 5 Oct 2026.
//
// Storage: no new tables. The board rides on the Marketing Blitz key/value
// store — a `blitzes` row with slug `partner-push`, one `blitz_fields` row per
// task keyed `task:<id>`, the value being the task as JSON. One row per task
// means two people editing different cards never overwrite each other.
// Deleting a task writes an empty value, which the loader skips.
//
// Priority: card order within a column is the force-ranked priority (#1 at
// the top). Drag a card above or below another to re-rank; only cards whose
// position or column changed are saved.
//
// Comments: one field per comment, keyed `comment:<taskId>:<commentId>`, so
// progress notes never collide with card edits. Removing writes an empty value.

const SLUG = 'partner-push'
const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const C = {
  cream: '#F8F7F6', white: '#FEFEFE', dark: '#1E1E1E',
  border: '#E2E0DC', bgMed: '#E8E6E3',
  grayMid: '#525252', grayLight: '#8A8A8A',
  mint: '#5ED49A', mintText: '#177558', mintSoft: 'rgba(94,212,154,0.15)',
  red: '#8A1F1F', redSoft: '#FDECEC', redBorder: '#F5B5B5',
}

const COLUMNS = [
  { key: 'todo',     label: 'To do' },
  { key: 'progress', label: 'In progress' },
  { key: 'done',     label: 'Done' },
]

// Seeded once, on the first load of the board.
const SEED = [
  { title: 'Logo swap on partner websites', owner: 'Unassigned', partner: 'IM Digital + Aries', status: 'todo',
    desc: 'viax logo on the IM Digital and Aries sites; theirs on viax.io in return.' },
  { title: 'Joint marketing piece', owner: 'Unassigned', partner: 'IM Digital + Aries', status: 'todo',
    desc: 'One partnership announcement, short video or webinar with each partner. IM Digital before Customer Day.' },
  { title: 'Shared prospect intros', owner: 'Unassigned', partner: 'IM Digital + Aries', status: 'todo',
    desc: '1–2 intros per partner to existing customers or net-new targets. Ask IM Digital to bring them to Customer Day.' },
  { title: 'Send Dan Customer Day dates and agenda', owner: 'Brian', partner: 'IM Digital', status: 'todo',
    desc: 'Use the event to lock in the logo swap, announcement and prospect intros. Also chase the stalled Herber CTO intro.' },
  { title: 'Publish Customer Day landing page', owner: 'Larry', partner: 'IM Digital', status: 'todo',
    desc: 'Registration section moved higher; ready to go live. Share it with IM Digital.' },
  { title: 'Build Aries account deck', owner: 'Unassigned', partner: 'Aries', status: 'todo',
    desc: "Lion's and Rich's Foods, plus Manhattan customers who aren't happy. Lead with B2B back office and OMS; use the 2U refunds work as leverage." },
  { title: 'Follow-up call with ServiceNow GTM head', owner: 'Rick', partner: 'ServiceNow', status: 'todo',
    desc: 'Find one order-to-cash deal where Commerce Tools falls short and help win it.' },
  { title: 'Set up Infosys demo', owner: 'Rick', partner: 'Infosys', status: 'todo',
    desc: 'Mining vertical lead offered to open doors internally if viax helps displace Deloitte and Accenture.' },
  { title: 'Call with Netherlands SI', owner: 'Andrew', partner: 'Netherlands SI', status: 'todo',
    desc: 'Managing director and head of sales. Explore co-pursuit of Kramer and European B2B accounts.' },
  { title: 'Pitch MACH Alliance on a B2B working group', owner: 'Andrew', partner: 'MACH Alliance', status: 'todo',
    desc: 'Lead it for a year in exchange for a free partnership extension. Ask Jason for intros to Zimmer Biomet and Elsevier.' },
  { title: 'Build Q4 partner tracking board', owner: 'Dennis', partner: 'Internal', status: 'done',
    desc: 'This board.' },
]

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

const btn = (bg, fg, bd) => ({
  background: bg, color: fg, border: `1px solid ${bd || bg}`, borderRadius: 6,
  padding: '6px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 500, cursor: 'pointer',
})
const inputBase = {
  width: '100%', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px',
  fontFamily: FONT, fontSize: 15, color: C.dark, background: C.white, outline: 'none',
}
const label = { fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: C.grayLight, display: 'block', marginBottom: 5 }

const AUTHOR_KEY = 'partner-push-author'
const readAuthor = () => { try { return localStorage.getItem(AUTHOR_KEY) || '' } catch { return '' } }
const writeAuthor = (v) => { try { localStorage.setItem(AUTHOR_KEY, v) } catch { /* storage unavailable */ } }

function fmtWhen(iso) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function Comments({ comments, onAdd, onRemove }) {
  const [author, setAuthor] = useState(readAuthor)
  const [body, setBody] = useState('')
  const submit = () => {
    if (!body.trim()) return
    writeAuthor(author.trim())
    onAdd(author.trim() || 'Anonymous', body.trim())
    setBody('')
  }
  return (
    <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
      <label style={label}>Progress comments {comments.length ? `· ${comments.length}` : ''}</label>
      <div style={{ maxHeight: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comments.length === 0 && <p style={{ fontSize: 14, color: C.grayLight }}>No updates yet.</p>}
        {comments.map(c => (
          <div key={c.id} style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontFamily: MONO, fontSize: 11, color: C.grayLight }}>
              <span><b style={{ color: C.mintText, fontWeight: 500 }}>{c.author}</b> &middot; {fmtWhen(c.at)}</span>
              <button onClick={() => onRemove(c)} style={{ background: 'none', border: 0, color: C.grayLight, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}>Remove</button>
            </div>
            <p style={{ fontSize: 14.5, color: C.dark, marginTop: 4, lineHeight: 1.42, whiteSpace: 'pre-wrap' }}>{c.body}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, marginTop: 10 }}>
        <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name" style={{ ...inputBase, fontSize: 14 }} />
        <input value={body} onChange={e => setBody(e.target.value)} placeholder="Add a progress update…"
          onKeyDown={e => { if (e.key === 'Enter') submit() }} style={{ ...inputBase, fontSize: 14 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={submit} disabled={!body.trim()}
          style={{ ...btn(body.trim() ? C.mintSoft : 'transparent', body.trim() ? C.mintText : C.grayLight, body.trim() ? C.mint : C.border) }}>
          Add comment
        </button>
      </div>
    </div>
  )
}

function TaskModal({ task, comments, onAddComment, onRemoveComment, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(task)
  const [armed, setArmed] = useState(false)
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,30,30,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 10, width: '100%',
        maxWidth: 560, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: '22px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <label style={label}>Task</label>
        <input value={draft.title} onChange={set('title')} style={{ ...inputBase, fontSize: 17, fontWeight: 500 }} autoFocus />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div><label style={label}>Owner</label><input value={draft.owner} onChange={set('owner')} style={inputBase} /></div>
          <div><label style={label}>Partner</label><input value={draft.partner} onChange={set('partner')} style={inputBase} /></div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={label}>Description</label>
          <textarea value={draft.desc} onChange={set('desc')} rows={4} style={{ ...inputBase, resize: 'vertical', lineHeight: 1.45 }} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={label}>Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLUMNS.map(c => {
              const on = draft.status === c.key
              return (
                <button key={c.key} onClick={() => setDraft(d => ({ ...d, status: c.key }))}
                  style={btn(on ? C.mintSoft : 'transparent', on ? C.mintText : C.grayMid, on ? C.mint : C.border)}>
                  {c.label}
                </button>
              )
            })}
          </div>
        </div>
        {!task._new && (
          <Comments comments={comments} onAdd={(a, b) => onAddComment(task.id, a, b)} onRemove={onRemoveComment} />
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
          {task._new ? <span /> : (
            <button onClick={() => armed ? onDelete(task) : setArmed(true)}
              style={btn(armed ? C.redSoft : 'transparent', C.red, C.redBorder)}>
              {armed ? 'Click again to delete' : 'Delete'}
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btn('transparent', C.grayMid, C.border)}>Cancel</button>
            <button onClick={() => onSave(draft)} style={btn(C.dark, C.white)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({ task, rank, comments, dragging, onOpen, onDragStart, onDragEnd }) {
  const last = comments[comments.length - 1]
  return (
    <div data-card={task.id} draggable onDragStart={e => onDragStart(e, task)} onDragEnd={onDragEnd} onClick={() => onOpen(task)}
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px',
        cursor: 'grab', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', opacity: dragging ? 0.4 : 1 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      {rank && <span title="Priority" style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.mintText,
        background: C.mintSoft, borderRadius: 4, padding: '1px 6px', marginTop: 1, flexShrink: 0 }}>#{rank}</span>}
      <div style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.2px', lineHeight: 1.3,
        color: task.status === 'done' ? C.grayLight : C.dark,
        textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
      </div>
      {task.desc && <p style={{ fontSize: 14, color: C.grayMid, marginTop: 6, lineHeight: 1.42 }}>{task.desc}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 999,
          background: task.owner && task.owner !== 'Unassigned' ? C.mintSoft : C.bgMed,
          color: task.owner && task.owner !== 'Unassigned' ? C.mintText : C.grayMid }}>
          {task.owner || 'Unassigned'}
        </span>
        {task.partner && <span style={{ fontFamily: MONO, fontSize: 11, color: C.grayLight }}>{task.partner}</span>}
        {comments.length > 0 && <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: C.grayLight }}>
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>}
      </div>
      {last && (
        <p style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.border}`, fontSize: 13, color: C.grayMid, lineHeight: 1.38,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          <b style={{ fontWeight: 500, color: C.dark }}>{last.author}:</b> {last.body}
        </p>
      )}
    </div>
  )
}

function DropLine({ top }) {
  return <div style={{ position: top ? 'absolute' : 'static', top: -7, left: 0, right: 0, height: 3,
    background: C.mint, borderRadius: 2, zIndex: 3 }} />
}

export default function PartnerPushPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [comments, setComments] = useState({})        // taskId -> [comment]
  const [dragId, setDragId] = useState(null)
  const [dropAt, setDropAt] = useState(null)          // { status, index }

  const save = useCallback(async (task) => {
    await api.blitz.setField(SLUG, `task:${task.id}`, JSON.stringify(task))
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await api.blitz.init(SLUG, { name: 'Partner Push', feature: 'Q4 partner push', meetings: [] })
      const fields = data.fields || {}
      let list = Object.entries(fields)
        .filter(([k, v]) => k.startsWith('task:') && v)
        .map(([, v]) => { try { return JSON.parse(v) } catch { return null } })
        .filter(Boolean)
      const cmap = {}
      for (const [k, v] of Object.entries(fields)) {
        if (!k.startsWith('comment:') || !v) continue
        try { const c = JSON.parse(v); (cmap[c.taskId] ||= []).push(c) } catch { /* skip bad row */ }
      }
      for (const k in cmap) cmap[k].sort((a, b) => (a.at || '').localeCompare(b.at || ''))
      setComments(cmap)
      if (!fields.seeded) {
        list = SEED.map((t, i) => ({ ...t, id: newId(), position: i }))
        await Promise.all(list.map(t => api.blitz.setField(SLUG, `task:${t.id}`, JSON.stringify(t))))
        await api.blitz.setField(SLUG, 'seeded', '1')
      }
      setTasks(list)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const byColumn = useMemo(() => {
    const out = Object.fromEntries(COLUMNS.map(c => [c.key, []]))
    for (const t of tasks) (out[t.status] || out.todo).push(t)
    for (const k in out) out[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    return out
  }, [tasks])

  const upsert = async (task) => {
    setTasks(ts => ts.some(t => t.id === task.id) ? ts.map(t => t.id === task.id ? task : t) : [...ts, task])
    try { await save(task) } catch (e) { setError(e.message) }
  }

  const remove = async (task) => {
    setTasks(ts => ts.filter(t => t.id !== task.id))
    setEditing(null)
    try { await api.blitz.setField(SLUG, `task:${task.id}`, '') } catch (e) { setError(e.message) }
  }

  const addTask = (status = 'todo') => {
    const maxPos = Math.max(-1, ...tasks.map(t => t.position ?? 0))
    setEditing({ id: newId(), title: '', owner: 'Unassigned', partner: '', desc: '', status, position: maxPos + 1, _new: true })
  }

  const addComment = async (taskId, author, body) => {
    const c = { id: newId(), taskId, author, body, at: new Date().toISOString() }
    setComments(m => ({ ...m, [taskId]: [...(m[taskId] || []), c] }))
    try { await api.blitz.setField(SLUG, `comment:${taskId}:${c.id}`, JSON.stringify(c)) } catch (e) { setError(e.message) }
  }
  const removeComment = async (c) => {
    setComments(m => ({ ...m, [c.taskId]: (m[c.taskId] || []).filter(x => x.id !== c.id) }))
    try { await api.blitz.setField(SLUG, `comment:${c.taskId}:${c.id}`, '') } catch (e) { setError(e.message) }
  }

  const onDragStart = (e, task) => {
    e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move'
    setDragId(task.id)
  }
  const endDrag = () => { setDragId(null); setDropAt(null) }

  // Where in the column would the card land? First card whose middle is below the pointer.
  const onColumnDragOver = (e, status) => {
    e.preventDefault()
    const cards = [...e.currentTarget.querySelectorAll('[data-card]')]
    let index = cards.length
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { index = i; break }
    }
    setDropAt(d => (d && d.status === status && d.index === index) ? d : { status, index })
  }

  const onDrop = async (e, status) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    const target = dropAt && dropAt.status === status ? dropAt.index : byColumn[status].length
    endDrag()
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const list = byColumn[status].filter(t => t.id !== id)
    const from = byColumn[status].findIndex(t => t.id === id)
    const at = from !== -1 && from < target ? target - 1 : target
    list.splice(at, 0, { ...task, status })
    const changed = []
    const next = list.map((t, i) => {
      const orig = tasks.find(x => x.id === t.id)
      const nt = { ...t, position: i }
      if (!orig || orig.position !== i || orig.status !== nt.status) changed.push(nt)
      return nt
    })
    if (!changed.length) return
    setTasks(ts => ts.map(t => next.find(n => n.id === t.id) || t))
    try { await Promise.all(changed.map(save)) } catch (err) { setError(err.message) }
  }

  const counts = Object.fromEntries(COLUMNS.map(c => [c.key, byColumn[c.key].length]))

  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingTop: 56, fontFamily: FONT, color: C.dark, fontWeight: 300 }}>
      <div style={{ padding: '32px 32px 70px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }}>
              Q4 2026 &middot; Partner Push
            </p>
            <div style={{ width: 44, height: 4, background: C.mint, borderRadius: 2, margin: '12px 0 16px' }} />
            <h1 style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-1.1px', lineHeight: 1.05 }}>
              One deal with IM Digital. One with Aries.
            </h1>
            <p style={{ fontSize: 16.5, color: C.grayMid, marginTop: 10, maxWidth: 760 }}>
              The three Q4 asks of both partners, plus the next steps from the 5 Oct leadership sync.
              Drag cards to move them or force-rank priority (#1 is top). Click a card to edit it or add a progress comment.
            </p>
          </div>
          <button onClick={() => addTask('todo')} style={{ ...btn(C.dark, C.white), fontSize: 13, padding: '10px 18px' }}>
            + Add task
          </button>
        </div>

        {loading && <p style={{ marginTop: 34, fontFamily: MONO, fontSize: 13, color: C.grayLight }}>Loading the board…</p>}
        {error && (
          <div style={{ marginTop: 22, background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: '14px 18px', fontSize: 15, color: C.red }}>
            {error}
            <button onClick={load} style={{ ...btn('transparent', C.red, C.redBorder), marginLeft: 10 }}>Retry</button>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginTop: 28 }}>
            {COLUMNS.map(col => (
              <div key={col.key}
                onDragOver={e => onColumnDragOver(e, col.key)}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropAt(d => d && d.status === col.key ? null : d) }}
                onDrop={e => onDrop(e, col.key)}
                style={{ background: dropAt?.status === col.key ? C.mintSoft : C.bgMed, borderRadius: 10, padding: 12,
                  minHeight: 240, transition: 'background 0.12s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 12px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dark }}>
                    {col.label} <span style={{ color: C.grayLight }}>&middot; {counts[col.key]}</span>
                  </span>
                  <button onClick={() => addTask(col.key)} style={btn('transparent', C.grayMid, 'transparent')} aria-label={`Add to ${col.label}`}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {byColumn[col.key].map((t, i) => (
                    <div key={t.id} style={{ position: 'relative' }}>
                      {dropAt?.status === col.key && dropAt.index === i && <DropLine top />}
                      <Card task={t} rank={col.key === 'done' ? null : i + 1} comments={comments[t.id] || []}
                        dragging={dragId === t.id} onOpen={setEditing} onDragStart={onDragStart} onDragEnd={endDrag} />
                    </div>
                  ))}
                  {dropAt?.status === col.key && dropAt.index === byColumn[col.key].length && (
                    <div style={{ position: 'relative', height: 4 }}><DropLine /></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <TaskModal task={editing} comments={comments[editing.id] || []}
          onAddComment={addComment} onRemoveComment={removeComment} onClose={() => setEditing(null)} onDelete={remove}
          onSave={(d) => { const { _new, ...clean } = d; if (clean.title.trim()) upsert(clean); setEditing(null) }} />
      )}
    </div>
  )
}
