import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'

// ── Marketing Calendar ─────────────────────────────────────────────────
//
// A month calendar of marketing events that zooms into a week. Each event has
// a date, owner, topic, an optional campaign tag, and its content — a URL
// where the campaign content lives, an uploaded file, or both.
//
// View and anchor date live in the URL (?view=week&d=2026-10-14) so a link
// opens on the same week. Click a day number to zoom into its week, click an
// empty part of a day to add an event there, drag an event to reschedule it.
//
// Events are also writable through the MCP server (backend/mcp_server.py:
// list_marketing_events, upsert_marketing_event, list_marketing_campaigns).

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const C = {
  cream: '#F8F7F6', white: '#FEFEFE', dark: '#1E1E1E', darkAlt: '#2A2A2A',
  border: '#E2E0DC', bgMed: '#E8E6E3',
  grayMid: '#525252', grayLight: '#8A8A8A',
  mint: '#5ED49A', mintText: '#177558', mintSoft: 'rgba(94,212,154,0.15)',
  red: '#8A1F1F', redSoft: '#FDECEC', redBorder: '#F5B5B5',
}
const NO_CAMPAIGN = '#8A8A8A'
const FILE_LIMIT = 3 * 1024 * 1024
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']   // weeks start Monday
const MAX_CHIPS = 3                                                 // per day in month view

// ── Dates (all local, keyed as YYYY-MM-DD — never via toISOString) ─────

const pad = n => String(n).padStart(2, '0')
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromKey = k => {
  const [y, m, d] = String(k || '').slice(0, 10).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return isNaN(dt) ? new Date() : dt
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = d => addDays(d, -((d.getDay() + 6) % 7))
const todayKey = () => toKey(new Date())

function monthDays(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const start = startOfWeek(first)
  const end = addDays(startOfWeek(last), 6)
  const days = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

function fmtRange(view, anchor) {
  if (view === 'month') return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const s = startOfWeek(anchor), e = addDays(s, 6)
  const sameMonth = s.getMonth() === e.getMonth()
  const left = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const right = e.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${left} – ${right}, ${e.getFullYear()}`
}

function bytes(n) {
  if (!n) return ''
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`
}

function readBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] || '')
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── Shared styles ──────────────────────────────────────────────────────

const btn = (bg, color, border) => ({
  fontFamily: MONO, fontSize: 12, fontWeight: 500, background: bg, color,
  border: `1px solid ${border || bg}`, borderRadius: 6, padding: '7px 13px',
  cursor: 'pointer', whiteSpace: 'nowrap',
})
const inputBase = {
  width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 14.5, fontWeight: 300,
  color: C.dark, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 7,
  padding: '9px 12px', outline: 'none',
}
const fieldLabel = {
  display: 'block', fontFamily: MONO, fontSize: 11, fontWeight: 500,
  letterSpacing: '0.09em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 6,
}

function Overlay({ onClose, width = 640, children }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,30,30,0.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 16px 20px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.white, borderRadius: 12, width, maxWidth: '100%',
        fontFamily: FONT, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

// ── Event chip / card ──────────────────────────────────────────────────

function EventChip({ event, campaign, compact, onOpen, onDragStart, onDragEnd }) {
  const color = campaign?.color || NO_CAMPAIGN
  const hasContent = event.content_url || event.file_name
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', event.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(event.id) }}
      onDragEnd={onDragEnd}
      onClick={e => { e.stopPropagation(); onOpen(event.id) }}
      title={[event.title, event.owner && `Owner: ${event.owner}`, campaign && `Campaign: ${campaign.name}`].filter(Boolean).join('\n')}
      style={{
        background: `${color}1F`, borderLeft: `3px solid ${color}`, borderRadius: 5,
        padding: compact ? '3px 7px' : '8px 10px', cursor: 'pointer', minWidth: 0,
      }}
    >
      <div style={{
        fontSize: compact ? 12.5 : 14, fontWeight: 500, color: C.dark, lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'nowrap' : 'normal',
      }}>
        {event.title || 'Untitled'}
      </div>
      {!compact && (
        <>
          {event.topic && (
            <div style={{ fontSize: 13, color: C.grayMid, marginTop: 4, lineHeight: 1.4,
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {event.topic}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 7, fontFamily: MONO, fontSize: 11, color: C.grayLight }}>
            {event.owner && <span>{event.owner}</span>}
            {campaign && <span style={{ color }}>{campaign.name}</span>}
            {hasContent && <span>{event.file_name ? 'file' : 'link'}{event.file_name && event.content_url ? ' + link' : ''}</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ── Event modal ────────────────────────────────────────────────────────

function EventModal({ event, defaultDate, campaigns, onClose, onSaved, onDeleted }) {
  const isNew = !event
  const [form, setForm] = useState(() => ({
    title: event?.title || '',
    date: event?.event_date || defaultDate || todayKey(),
    owner: event?.owner || '',
    topic: event?.topic || '',
    campaignId: event?.campaign_id || '',
    contentUrl: event?.content_url || '',
  }))
  const [file, setFile] = useState(null)          // newly picked, not yet uploaded
  const [current, setCurrent] = useState(event)   // reflects file removal etc.
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const pick = e => {
    const f = e.target.files && e.target.files[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!f) return
    if (f.size > FILE_LIMIT) { setErr(`${f.name} is ${bytes(f.size)} — the limit is 3MB. Add a content URL instead.`); return }
    setErr(null); setFile(f)
  }

  const save = async () => {
    if (!form.title.trim()) { setErr('Give the event a title.'); return }
    if (!form.date) { setErr('Pick a date.'); return }
    setBusy(true); setErr(null)
    try {
      let saved = await api.marketing.upsertEvent({
        ...(current ? { id: current.id } : {}),
        title: form.title, date: form.date, owner: form.owner, topic: form.topic,
        campaignId: form.campaignId, contentUrl: form.contentUrl,
      })
      if (file) {
        saved = await api.marketing.putFile(saved.id, {
          fileName: file.name, mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size, data: await readBase64(file),
        })
      }
      onSaved(saved)
      onClose()
    } catch (e) {
      console.error(e); setErr(e.message || 'Save failed')
    } finally { setBusy(false) }
  }

  const download = async () => {
    try {
      const f = await api.marketing.getFile(current.id)
      const bin = atob(f.file_data || '')
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([buf], { type: f.mime_type || 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url; a.download = f.file_name || 'content'; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (e) { console.error(e); setErr('Could not download the file.') }
  }

  const removeFile = async () => {
    setBusy(true)
    try {
      const saved = await api.marketing.deleteFile(current.id)
      setCurrent(saved); onSaved(saved)
    } catch (e) { console.error(e); setErr('Could not remove the file.') }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setBusy(true)
    try { await api.marketing.deleteEvent(current.id); onDeleted(current.id); onClose() }
    catch (e) { console.error(e); setErr('Could not delete the event.'); setBusy(false) }
  }

  const url = form.contentUrl.trim()
  const safeHref = /^https?:\/\//i.test(url) ? url : url ? `https://${url}` : ''

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <p style={{ flex: 1, fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }}>
          {isNew ? 'New marketing event' : 'Marketing event'}
        </p>
        <button onClick={onClose} style={btn('transparent', C.grayLight, C.border)}>Close</button>
      </div>

      <div style={{ padding: '20px 26px 8px', display: 'grid', gap: 16 }}>
        <div>
          <label style={fieldLabel}>Title</label>
          <input autoFocus={isNew} value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. RMB launch webinar" style={{ ...inputBase, fontSize: 17, fontWeight: 400 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputBase} />
          </div>
          <div>
            <label style={fieldLabel}>Owner</label>
            <input value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="Who owns it" style={inputBase} />
          </div>
          <div>
            <label style={fieldLabel}>Campaign</label>
            <select value={form.campaignId} onChange={e => set('campaignId', e.target.value)} style={inputBase}>
              <option value="">No campaign</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Topic</label>
          <textarea value={form.topic} onChange={e => set('topic', e.target.value)} rows={3}
            placeholder="What the event is about" style={{ ...inputBase, resize: 'vertical', lineHeight: 1.45 }} />
        </div>

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, padding: 16, background: C.cream }}>
          <label style={{ ...fieldLabel, color: C.mintText, marginBottom: 4 }}>Content</label>
          <p style={{ fontSize: 13, color: C.grayMid, marginBottom: 12 }}>
            Point to where the campaign content lives, upload the file itself (up to 3MB), or both.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={form.contentUrl} onChange={e => set('contentUrl', e.target.value)}
              placeholder="https://…" style={{ ...inputBase, background: C.white }} />
            {safeHref && (
              <a href={safeHref} target="_blank" rel="noreferrer" style={{ ...btn(C.white, C.dark, C.border), textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                Open
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {file ? (
              <>
                <span style={{ fontSize: 13.5 }}>{file.name} <span style={{ color: C.grayLight }}>· {bytes(file.size)} · uploads on save</span></span>
                <button onClick={() => setFile(null)} style={btn('transparent', C.grayMid, C.border)}>Cancel</button>
              </>
            ) : current?.file_name ? (
              <>
                <span style={{ fontSize: 13.5 }}>{current.file_name} <span style={{ color: C.grayLight }}>· {bytes(current.size_bytes)}</span></span>
                <button onClick={download} style={btn(C.white, C.dark, C.border)}>Download</button>
                <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn(C.white, C.dark, C.border)}>Replace</button>
                <button onClick={removeFile} disabled={busy} style={btn('transparent', C.red, C.redBorder)}>Remove</button>
              </>
            ) : (
              <button onClick={() => fileRef.current?.click()} style={btn(C.white, C.dark, C.border)}>Upload a file</button>
            )}
            <input ref={fileRef} type="file" onChange={pick} style={{ display: 'none' }} />
          </div>
        </div>

        {err && (
          <p style={{ fontSize: 13.5, color: C.red, background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 7, padding: '8px 12px' }}>
            {err}
          </p>
        )}
      </div>

      <div style={{ padding: '14px 26px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isNew && (
          <button onClick={remove} disabled={busy} style={btn(confirmDelete ? C.red : 'transparent', confirmDelete ? C.white : C.red, confirmDelete ? C.red : C.redBorder)}>
            {confirmDelete ? 'Click again to delete' : 'Delete event'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={btn('transparent', C.grayMid, C.border)}>Cancel</button>
        <button onClick={save} disabled={busy} style={{ ...btn(C.dark, C.white), opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : isNew ? 'Add event' : 'Save'}
        </button>
      </div>
    </Overlay>
  )
}

// ── Campaign manager ───────────────────────────────────────────────────

function CampaignRow({ campaign, count, onSave, onDelete }) {
  const [name, setName] = useState(campaign.name)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { setName(campaign.name) }, [campaign.name])

  const commitName = () => {
    const n = name.trim()
    if (!n) { setName(campaign.name); return }
    if (n !== campaign.name) onSave({ id: campaign.id, name: n })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
      <input type="color" value={campaign.color || NO_CAMPAIGN} title="Campaign colour"
        onChange={e => onSave({ id: campaign.id, name: campaign.name, color: e.target.value })}
        style={{ width: 30, height: 30, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
      <input value={name} onChange={e => setName(e.target.value)} onBlur={commitName}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        style={{ ...inputBase, flex: 1, background: 'transparent' }} />
      <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.grayLight, width: 72, textAlign: 'right' }}>
        {count} event{count === 1 ? '' : 's'}
      </span>
      <button
        onClick={() => { if (confirm) onDelete(campaign.id); else setConfirm(true) }}
        onBlur={() => setConfirm(false)}
        title={count ? 'Its events stay on the calendar, untagged' : undefined}
        style={btn(confirm ? C.red : 'transparent', confirm ? C.white : C.red, confirm ? C.red : C.redBorder)}
      >
        {confirm ? 'Confirm' : 'Remove'}
      </button>
    </div>
  )
}

function CampaignsModal({ campaigns, counts, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)

  const run = async (fn) => {
    setErr(null)
    try { await fn() } catch (e) {
      const m = String(e.message || '')
      const json = m.slice(m.indexOf('{'))
      try { setErr(JSON.parse(json).error) } catch { setErr(m || 'Something went wrong') }
    }
  }

  const add = () => {
    const n = name.trim()
    if (!n) return
    run(async () => { await onSave({ name: n }); setName('') })
  }

  return (
    <Overlay onClose={onClose} width={560}>
      <div style={{ padding: '22px 26px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }}>
            Campaigns
          </p>
          <p style={{ fontSize: 13.5, color: C.grayMid, marginTop: 6 }}>
            Rename inline, click the swatch to recolour. Removing a campaign keeps its events on the calendar, untagged.
          </p>
        </div>
        <button onClick={onClose} style={btn('transparent', C.grayLight, C.border)}>Done</button>
      </div>
      <div style={{ padding: '6px 26px 22px' }}>
        {campaigns.length === 0 && (
          <p style={{ fontSize: 14, color: C.grayLight, padding: '14px 0' }}>No campaigns yet.</p>
        )}
        {campaigns.map(c => (
          <CampaignRow key={c.id} campaign={c} count={counts[c.id] || 0}
            onSave={patch => run(() => onSave(patch))}
            onDelete={id => run(() => onDelete(id))} />
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New campaign name"
            onKeyDown={e => { if (e.key === 'Enter') add() }} style={inputBase} />
          <button onClick={add} style={btn(C.dark, C.white)}>Add campaign</button>
        </div>
        {err && <p style={{ fontSize: 13.5, color: C.red, marginTop: 10 }}>{err}</p>}
      </div>
    </Overlay>
  )
}

// ── Calendar views ─────────────────────────────────────────────────────

function useDropTarget(dateKey, onDrop) {
  const [over, setOver] = useState(false)
  return {
    over,
    handlers: {
      onDragOver: e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true) },
      onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) },
      onDrop: e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id, dateKey) },
    },
  }
}

function MonthCell({ day, inMonth, events, campaignById, onAdd, onOpen, onZoom, onMove, drag }) {
  const key = toKey(day)
  const isToday = key === todayKey()
  const { over, handlers } = useDropTarget(key, onMove)
  const shown = events.slice(0, MAX_CHIPS)
  const extra = events.length - shown.length

  return (
    <div {...handlers} onClick={() => onAdd(key)} style={{
      minHeight: 124, padding: '6px 6px 8px', borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
      background: over ? C.mintSoft : inMonth ? C.white : C.cream, cursor: 'pointer', minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={e => { e.stopPropagation(); onZoom(key) }}
          title="Open this week"
          style={{
            fontFamily: MONO, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'zoom-in',
            width: 26, height: 26, borderRadius: 13,
            background: isToday ? C.mint : 'transparent',
            color: isToday ? C.dark : inMonth ? C.grayMid : '#B8B6B2',
          }}
        >
          {day.getDate()}
        </button>
      </div>
      {shown.map(ev => (
        <EventChip key={ev.id} event={ev} campaign={campaignById[ev.campaign_id]} compact
          onOpen={onOpen} onDragStart={drag.start} onDragEnd={drag.end} />
      ))}
      {extra > 0 && (
        <button onClick={e => { e.stopPropagation(); onZoom(key) }}
          style={{ fontFamily: MONO, fontSize: 11, color: C.grayMid, background: 'none', border: 'none', textAlign: 'left', padding: '2px 4px', cursor: 'zoom-in' }}>
          +{extra} more
        </button>
      )}
    </div>
  )
}

function MonthView({ anchor, eventsByDay, ...rest }) {
  const days = monthDays(anchor)
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.white }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', background: C.cream, borderBottom: `1px solid ${C.border}` }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ padding: '9px 10px', fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.grayLight }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginRight: -1, marginBottom: -1 }}>
        {days.map(d => (
          <MonthCell key={toKey(d)} day={d} inMonth={d.getMonth() === anchor.getMonth()}
            events={eventsByDay[toKey(d)] || []} {...rest} />
        ))}
      </div>
    </div>
  )
}

function WeekColumn({ day, events, campaignById, onAdd, onOpen, onMove, drag }) {
  const key = toKey(day)
  const isToday = key === todayKey()
  const { over, handlers } = useDropTarget(key, onMove)
  return (
    <div {...handlers} style={{
      borderRight: `1px solid ${C.border}`, minWidth: 0, display: 'flex', flexDirection: 'column',
      background: over ? C.mintSoft : C.white,
    }}>
      <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${C.border}`, background: isToday ? C.mintSoft : C.cream }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: isToday ? C.mintText : C.grayLight }}>
          {WEEKDAYS[(day.getDay() + 6) % 7]}
        </div>
        <div style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.6px', marginTop: 2 }}>{day.getDate()}</div>
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 420 }}>
        {events.map(ev => (
          <EventChip key={ev.id} event={ev} campaign={campaignById[ev.campaign_id]}
            onOpen={onOpen} onDragStart={drag.start} onDragEnd={drag.end} />
        ))}
        <button onClick={() => onAdd(key)} style={{
          marginTop: 'auto', fontFamily: MONO, fontSize: 11.5, color: C.grayLight, background: 'transparent',
          border: `1px dashed ${C.border}`, borderRadius: 6, padding: '7px 0', cursor: 'pointer',
        }}>
          + Add
        </button>
      </div>
    </div>
  )
}

function WeekView({ anchor, eventsByDay, ...rest }) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.white, overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', marginRight: -1 }}>
        {days.map(d => <WeekColumn key={toKey(d)} day={d} events={eventsByDay[toKey(d)] || []} {...rest} />)}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function MarketingCalendarPage() {
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'week' ? 'week' : 'month'
  const anchorKey = params.get('d') || todayKey()
  const anchor = useMemo(() => fromKey(anchorKey), [anchorKey])

  const [events, setEvents] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [filter, setFilter] = useState(null)          // campaign id, 'none', or null for all
  const [modal, setModal] = useState(null)            // { eventId } | { newDate } | 'campaigns'

  const go = useCallback((nextView, nextKey) => {
    const p = new URLSearchParams(params)
    p.set('view', nextView); p.set('d', nextKey)
    setParams(p, { replace: false })
  }, [params, setParams])

  const load = useCallback(async () => {
    try {
      const [ev, cs] = await Promise.all([api.marketing.events(), api.marketing.campaigns()])
      setEvents(ev || []); setCampaigns(cs || []); setError(null)
    } catch (e) {
      console.error('Failed to load marketing calendar', e)
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const campaignById = useMemo(() => Object.fromEntries(campaigns.map(c => [c.id, c])), [campaigns])

  const counts = useMemo(() => {
    const m = {}
    events.forEach(e => { if (e.campaign_id) m[e.campaign_id] = (m[e.campaign_id] || 0) + 1 })
    return m
  }, [events])

  const eventsByDay = useMemo(() => {
    const m = {}
    events
      .filter(e => !filter || (filter === 'none' ? !e.campaign_id : e.campaign_id === filter))
      .forEach(e => { const k = String(e.event_date).slice(0, 10); (m[k] = m[k] || []).push(e) })
    Object.values(m).forEach(list => list.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))))
    return m
  }, [events, filter])

  const step = dir => {
    const next = view === 'month'
      ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
      : addDays(anchor, 7 * dir)
    go(view, toKey(next))
  }

  const upsertLocal = saved => setEvents(prev => [...prev.filter(e => e.id !== saved.id), saved])

  const moveEvent = useCallback(async (id, dateKey) => {
    const ev = events.find(e => e.id === id)
    if (!ev || String(ev.event_date).slice(0, 10) === dateKey) return
    setEvents(prev => prev.map(e => e.id === id ? { ...e, event_date: dateKey } : e))
    setStatus('saving')
    try { upsertLocal(await api.marketing.upsertEvent({ id, date: dateKey })); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [events, load])

  const saveCampaign = async patch => {
    const saved = await api.marketing.upsertCampaign(patch)
    setCampaigns(prev => prev.some(c => c.id === saved.id) ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved])
  }
  const deleteCampaign = async id => {
    await api.marketing.deleteCampaign(id)
    setCampaigns(prev => prev.filter(c => c.id !== id))
    setEvents(prev => prev.map(e => e.campaign_id === id ? { ...e, campaign_id: null } : e))
    if (filter === id) setFilter(null)
  }

  const viewProps = {
    anchor, eventsByDay, campaignById,
    onAdd: key => setModal({ newDate: key }),
    onOpen: id => setModal({ eventId: id }),
    onZoom: key => go('week', key),
    onMove: moveEvent,
    drag: { start: () => {}, end: () => {} },
  }

  const openEvent = modal?.eventId ? events.find(e => e.id === modal.eventId) : null
  const segBtn = active => ({
    ...btn(active ? C.dark : 'transparent', active ? C.white : C.grayMid, active ? C.dark : 'transparent'),
    borderRadius: 5, padding: '6px 14px',
  })
  const pill = (active, color) => ({
    fontFamily: MONO, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', borderRadius: 999, padding: '5px 11px',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    border: `1px solid ${active ? C.dark : C.border}`, background: active ? C.dark : C.white, color: active ? C.white : C.grayMid,
  })

  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingTop: 56, fontFamily: FONT, color: C.dark, fontWeight: 300 }}>
      <div style={{ padding: '32px 32px 70px' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }}>
              Marketing Calendar
            </p>
            <div style={{ width: 44, height: 4, background: C.mint, borderRadius: 2, margin: '12px 0 16px' }} />
            <h1 style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-1.1px', lineHeight: 1.05 }}>
              What goes out, when, and who owns it.
            </h1>
            <p style={{ fontSize: 16.5, color: C.grayMid, marginTop: 10, maxWidth: 760 }}>
              Click a day to add an event, click a date number to zoom into its week, drag an event to move it.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModal('campaigns')} style={{ ...btn(C.white, C.dark, C.border), fontSize: 13, padding: '10px 16px' }}>
              Campaigns
            </button>
            <button onClick={() => setModal({ newDate: view === 'week' ? toKey(startOfWeek(anchor)) : todayKey() })}
              style={{ ...btn(C.dark, C.white), fontSize: 13, padding: '10px 18px' }}>
              Add event
            </button>
          </div>
        </div>

        {/* toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 30, marginBottom: 14 }}>
          <button onClick={() => go(view, todayKey())} style={btn(C.white, C.dark, C.border)}>Today</button>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => step(-1)} aria-label="Previous" style={btn(C.white, C.dark, C.border)}>‹</button>
            <button onClick={() => step(1)} aria-label="Next" style={btn(C.white, C.dark, C.border)}>›</button>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 400, letterSpacing: '-0.4px', minWidth: 220 }}>{fmtRange(view, anchor)}</h2>
          <div style={{ display: 'flex', gap: 2, padding: 3, background: C.bgMed, borderRadius: 7, marginLeft: 'auto' }}>
            <button onClick={() => go('month', anchorKey)} style={segBtn(view === 'month')}>Month</button>
            <button onClick={() => go('week', anchorKey)} style={segBtn(view === 'week')}>Week</button>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: status === 'error' ? C.red : C.grayLight, minWidth: 60 }}>
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Save failed' : ''}
          </span>
        </div>

        {/* campaign filter */}
        {campaigns.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setFilter(null)} style={pill(!filter)}>All</button>
            {campaigns.map(c => (
              <button key={c.id} onClick={() => setFilter(filter === c.id ? null : c.id)} style={pill(filter === c.id)}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: c.color || NO_CAMPAIGN }} />
                {c.name}
              </button>
            ))}
            <button onClick={() => setFilter(filter === 'none' ? null : 'none')} style={pill(filter === 'none')}>No campaign</button>
          </div>
        )}

        {loading && <p style={{ marginTop: 20, fontFamily: MONO, fontSize: 13, color: C.grayLight }}>Loading the calendar…</p>}
        {error && (
          <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 9, background: C.redSoft, border: `1px solid ${C.redBorder}`, color: C.red, fontSize: 14 }}>
            Could not load the calendar: {error}
            <div style={{ fontSize: 13, marginTop: 6, color: C.grayMid }}>
              If this mentions a missing relation, apply backend/migrations/008_marketing_calendar.sql in the Supabase SQL editor.
            </div>
          </div>
        )}

        {!loading && !error && (view === 'month' ? <MonthView {...viewProps} /> : <WeekView {...viewProps} />)}
      </div>

      {modal === 'campaigns' && (
        <CampaignsModal campaigns={campaigns} counts={counts} onClose={() => setModal(null)}
          onSave={saveCampaign} onDelete={deleteCampaign} />
      )}
      {modal && modal !== 'campaigns' && (modal.newDate || openEvent) && (
        <EventModal
          key={modal.eventId || modal.newDate}
          event={openEvent}
          defaultDate={modal.newDate}
          campaigns={campaigns}
          onClose={() => setModal(null)}
          onSaved={upsertLocal}
          onDeleted={id => setEvents(prev => prev.filter(e => e.id !== id))}
        />
      )}
    </div>
  )
}
