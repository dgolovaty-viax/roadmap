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

function TaskModal({ task, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(task)
  const [armed, setArmed] = useState(false)
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,30,30,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 10, width: '100%',
        maxWidth: 520, padding: '22px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
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

function Card({ task, onOpen, onDragStart }) {
  return (
    <div draggable onDragStart={e => onDragStart(e, task)} onClick={() => onOpen(task)}
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px',
        cursor: 'grab', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 15.5, fontWeight: 500, letterSpacing: '-0.2px', lineHeight: 1.3,
        color: task.status === 'done' ? C.grayLight : C.dark,
        textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</div>
      {task.desc && <p style={{ fontSize: 14, color: C.grayMid, marginTop: 6, lineHeight: 1.42 }}>{task.desc}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 999,
          background: task.owner && task.owner !== 'Unassigned' ? C.mintSoft : C.bgMed,
          color: task.owner && task.owner !== 'Unassigned' ? C.mintText : C.grayMid }}>
          {task.owner || 'Unassigned'}
        </span>
        {task.partner && <span style={{ fontFamily: MONO, fontSize: 11, color: C.grayLight }}>{task.partner}</span>}
      </div>
    </div>
  )
}

export default function PartnerPushPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [dragOver, setDragOver] = useState(null)

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

  const onDragStart = (e, task) => { e.dataTransfer.setData('text/plain', task.id); e.dataTransfer.effectAllowed = 'move' }
  const onDrop = (e, status) => {
    e.preventDefault(); setDragOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const task = tasks.find(t => t.id === id)
    if (!task || task.status === status) return
    const maxPos = Math.max(-1, ...byColumn[status].map(t => t.position ?? 0))
    upsert({ ...task, status, position: maxPos + 1 })
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
              Drag a card to move it; click it to edit.
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
                onDragOver={e => { e.preventDefault(); setDragOver(col.key) }}
                onDragLeave={() => setDragOver(d => d === col.key ? null : d)}
                onDrop={e => onDrop(e, col.key)}
                style={{ background: dragOver === col.key ? C.mintSoft : C.bgMed, borderRadius: 10, padding: 12,
                  minHeight: 240, transition: 'background 0.12s',
                  outline: dragOver === col.key ? `2px dashed ${C.mint}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px 12px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dark }}>
                    {col.label} <span style={{ color: C.grayLight }}>&middot; {counts[col.key]}</span>
                  </span>
                  <button onClick={() => addTask(col.key)} style={btn('transparent', C.grayMid, 'transparent')} aria-label={`Add to ${col.label}`}>+</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {byColumn[col.key].map(t => <Card key={t.id} task={t} onOpen={setEditing} onDragStart={onDragStart} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <TaskModal task={editing} onClose={() => setEditing(null)} onDelete={remove}
          onSave={(d) => { const { _new, ...clean } = d; if (clean.title.trim()) upsert(clean); setEditing(null) }} />
      )}
    </div>
  )
}
