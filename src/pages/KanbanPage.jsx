import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'

// ── Shared style constants (mirrors IdeasPage) ─────────────────────────

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

// Rank circle colours — top priority is teal, then blue, amber, grey…
const RANK_COLORS = ['#4FD0A5', '#93C5FD', '#FFD966', '#9F9FAA']

function rankColor(i) {
  return RANK_COLORS[i] || '#9F9FAA'
}

const JIRA_BROWSE_BASE = 'https://viax.atlassian.net/browse'

// Jira statusCategory key → pill colours
function statusStyle(cat) {
  if (cat === 'done')          return { bg: '#E8F9F3', color: '#1a7a5e', border: '#4FD0A5' }
  if (cat === 'indeterminate') return { bg: '#E8F0FE', color: '#1a56db', border: '#93C5FD' }
  return { bg: '#F0EFEC', color: '#666666', border: '#DDDDDD' } // "new" / To Do
}

function btn(bg, color, border) {
  return {
    background: bg, color, border: `1px solid ${border || bg}`,
    borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
  }
}

const lightField = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #DDDDDD', borderRadius: 6,
  padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none',
  background: '#FFFFFF', color: '#1E1E1E',
}

const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#888888', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 6,
}

// ── Data hook ──────────────────────────────────────────────────────────

function useBoard() {
  const [columns, setColumns] = useState([])
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    try {
      const { columns: cols, cards: crds } = await api.kanban.board()
      setColumns((cols || []).sort((a, b) => a.position - b.position))
      setCards((crds || []).sort((a, b) => a.position - b.position))
      setError(null)
    } catch (e) {
      console.error('Failed to load board', e)
      setError(e.message || 'Failed to load board')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { columns, setColumns, cards, setCards, loading, error, reload: load }
}

// ── Column header (editable title) ─────────────────────────────────────

function ColumnHeader({ column, count, onRename, onDelete, onAddCard }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(column.title)
  const [hovered, setHovered] = useState(false)

  const save = () => {
    const title = value.trim() || 'Untitled'
    setEditing(false)
    if (title !== column.title) onRename(column.id, title)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, minHeight: 30 }}
    >
      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') { setValue(column.title); setEditing(false) }
          }}
          style={{ ...lightField, padding: '5px 9px', fontSize: 14, fontWeight: 700 }}
        />
      ) : (
        <>
          <h3
            onClick={() => { setValue(column.title); setEditing(true) }}
            title="Click to rename"
            style={{
              fontSize: 14, fontWeight: 700, color: '#1E1E1E', margin: 0,
              cursor: 'text', letterSpacing: '0.02em', textTransform: 'uppercase',
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {column.title}
          </h3>
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#AAAAAA',
            background: '#F0EFEC', borderRadius: 20, padding: '1px 9px', flexShrink: 0,
          }}>
            {count}
          </span>
          {hovered && (
            <button
              onClick={() => onDelete(column.id)}
              title="Delete column"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#CC3333', fontSize: 15, lineHeight: 1, padding: 2, flexShrink: 0,
              }}
            >×</button>
          )}
        </>
      )}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────

function Card({ card, rank, dragging, jira, onClick, onDragStart, onDragEnd, onDragOver }) {
  const [hovered, setHovered] = useState(false)
  const preview = (card.description || '').trim().slice(0, 120)
  const jiraKey = card.jira_issue_key

  return (
    <div
      draggable
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      style={{
        position: 'relative',
        background: '#FFFFFF',
        border: '1px solid #E2E0DC',
        borderRadius: 8,
        padding: '14px 16px 14px 14px',
        cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: hovered && !dragging ? '0 2px 14px rgba(0,0,0,0.08)' : 'none',
        opacity: dragging ? 0.35 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s',
        userSelect: 'none',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      {/* Rank circle */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: rankColor(rank), marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: '#1E1E1E',
      }}>
        {rank + 1}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h4 style={{
          fontSize: 14, fontWeight: 600, color: '#1E1E1E', margin: 0, lineHeight: 1.4,
          wordBreak: 'break-word',
        }}>
          {card.title || <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>Untitled</span>}
        </h4>
        {preview && (
          <p style={{ fontSize: 12.5, color: '#888888', margin: '6px 0 0 0', lineHeight: 1.55 }}>
            {preview}{(card.description || '').length > 120 ? '…' : ''}
          </p>
        )}

        {jiraKey && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <a
              href={jira?.url || `${JIRA_BROWSE_BASE}/${jiraKey}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              title={jira?.summary ? `${jiraKey} — ${jira.summary}` : `Open ${jiraKey} in Jira`}
              style={{
                background: '#E8F0FE', border: '1px solid #0052CC', borderRadius: 5,
                padding: '2px 7px', fontSize: 11, fontWeight: 700, color: '#0052CC',
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
              }}
            >
              {jiraKey} ↗
            </a>
            {jira?.status && (() => {
              const s = statusStyle(jira.statusCat)
              return (
                <span style={{
                  background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                  borderRadius: 5, padding: '2px 8px', fontSize: 10.5, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{jira.status}</span>
              )
            })()}
            {jira?.assignee && (
              <span style={{ fontSize: 11, color: '#888888', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', background: '#DDD7CE', color: '#555',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                }}>{(jira.assignee[0] || '?').toUpperCase()}</span>
                {jira.assignee}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Jira panel (inside the card modal) ─────────────────────────────────

function jiraSearchJql(raw) {
  const q = (raw || '').replace(/["\\]/g, '').trim()
  const key = q.toUpperCase()
  return `(project = VX AND summary ~ "${q}*") OR key = "${key}" ORDER BY updated DESC`
}

function JiraPanel({ card, jira, jiraConfigured, defaultTitle, defaultDescription, onLink, onUnlink, onCreate }) {
  const linked = !!card.jira_issue_key
  const [mode, setMode]   = useState('view')  // view | search | create
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState(null)

  // search state
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  // create state
  const [cTitle, setCTitle] = useState(defaultTitle || '')
  const [cDesc, setCDesc]   = useState(defaultDescription || '')
  const [components, setComponents] = useState([])
  const [selectedComps, setSelectedComps] = useState(new Set())
  const [showComps, setShowComps] = useState(false)
  const [compsLoaded, setCompsLoaded] = useState(false)

  // Debounced Jira search
  useEffect(() => {
    if (mode !== 'search') return
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    let alive = true
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.jira.search({
          jql: jiraSearchJql(q),
          fields: ['summary', 'status', 'assignee'],
          maxResults: 15,
        })
        if (alive) setResults(res?.issues || [])
      } catch (e) {
        if (alive) { setError(e.message || String(e)); setResults([]) }
      } finally {
        if (alive) setSearching(false)
      }
    }, 350)
    return () => { alive = false; clearTimeout(t) }
  }, [query, mode])

  const loadComponents = async () => {
    if (compsLoaded) { setShowComps(s => !s); return }
    setShowComps(true)
    try {
      const r = await api.jira.components()
      setComponents(r?.components || [])
    } catch { /* non-fatal */ } finally { setCompsLoaded(true) }
  }

  const doLink = async (key) => {
    setBusy(true); setError(null)
    try { await onLink(key); setMode('view') }
    catch (e) { setError(e.message || String(e)) }
    finally { setBusy(false) }
  }

  const doUnlink = async () => {
    setBusy(true); setError(null)
    try { await onUnlink() }
    catch (e) { setError(e.message || String(e)) }
    finally { setBusy(false) }
  }

  const doCreate = async () => {
    if (!cTitle.trim() || busy) return
    setBusy(true); setError(null)
    try {
      await onCreate({ title: cTitle.trim(), description: cDesc, componentIds: [...selectedComps] })
      setMode('view')
    } catch (e) { setError(e.message || String(e)) }
    finally { setBusy(false) }
  }

  const toggleComp = (id) => setSelectedComps(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const sectionLabel = { ...fieldLabel, marginBottom: 8 }
  const box = { border: '1px solid #E2E0DC', borderRadius: 8, padding: 14, background: '#FAFAF8' }

  return (
    <div style={{ marginBottom: 24 }}>
      <label style={sectionLabel}>Jira</label>

      {/* LINKED — show details */}
      {linked ? (
        <div style={{ ...box, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={jira?.url || `${JIRA_BROWSE_BASE}/${card.jira_issue_key}`}
            target="_blank" rel="noreferrer"
            style={{ background: '#E8F0FE', border: '1px solid #0052CC', borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 700, color: '#0052CC', textDecoration: 'none' }}
          >
            {card.jira_issue_key} ↗
          </a>
          {jira?.status && (() => { const s = statusStyle(jira.statusCat); return (
            <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{jira.status}</span>
          )})()}
          {jira?.assignee
            ? <span style={{ fontSize: 12.5, color: '#555' }}>{jira.assignee}</span>
            : <span style={{ fontSize: 12.5, color: '#AAA', fontStyle: 'italic' }}>Unassigned</span>}
          {jira?.summary && <span style={{ fontSize: 12.5, color: '#888', flexBasis: '100%' }}>{jira.summary}</span>}
          <button onClick={doUnlink} disabled={busy} style={{ ...btn('#FFF0F0', '#CC3333', '#FFCCCC'), marginLeft: 'auto', padding: '5px 12px' }}>
            {busy ? '…' : 'Unlink'}
          </button>
        </div>
      ) : !jiraConfigured ? (
        <div style={{ ...box, fontSize: 12.5, color: '#888' }}>
          Jira isn't configured on the server (set JIRA_EMAIL and JIRA_API_TOKEN).
        </div>
      ) : mode === 'view' ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setMode('search'); setError(null) }} style={btn('#FFFFFF', '#0052CC', '#0052CC')}>🔗 Link existing issue</button>
          <button onClick={() => { setMode('create'); setError(null); setCTitle(defaultTitle || ''); setCDesc(defaultDescription || '') }} style={btn('#FFFFFF', '#0052CC', '#0052CC')}>＋ Create &amp; link new</button>
        </div>
      ) : mode === 'search' ? (
        <div style={box}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search VX issues by summary, or type a key (VX-123)…"
            style={{ ...lightField, marginBottom: 8 }}
          />
          <div style={{ maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {searching && <div style={{ fontSize: 12.5, color: '#888', padding: 6 }}>Searching…</div>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div style={{ fontSize: 12.5, color: '#888', padding: 6 }}>No matching issues.</div>
            )}
            {results.map(it => {
              const f = it.fields || {}
              const s = statusStyle(f.status?.statusCategory?.key)
              return (
                <button
                  key={it.key}
                  onClick={() => doLink(it.key)}
                  disabled={busy}
                  style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 6, padding: '9px 12px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0052CC', flexShrink: 0 }}>{it.key}</span>
                  <span style={{ fontSize: 12.5, color: '#1E1E1E', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.summary}</span>
                  {f.status?.name && <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{f.status.name}</span>}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => { setMode('view'); setQuery(''); setResults([]) }} style={btn('#F3F3F3', '#555', '#DDD')}>Cancel</button>
          </div>
        </div>
      ) : (
        /* create mode */
        <div style={box}>
          <label style={{ ...fieldLabel, marginBottom: 4 }}>Summary</label>
          <input value={cTitle} onChange={e => setCTitle(e.target.value)} style={{ ...lightField, marginBottom: 10, fontWeight: 600 }} />
          <label style={{ ...fieldLabel, marginBottom: 4 }}>Description</label>
          <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} rows={3} style={{ ...lightField, resize: 'vertical', marginBottom: 10, lineHeight: 1.5 }} />

          <button onClick={loadComponents} style={{ background: 'none', border: 'none', color: '#0052CC', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, fontFamily: FONT }}>
            {showComps ? '▾' : '▸'} Components {selectedComps.size > 0 ? `(${selectedComps.size})` : '(optional)'}
          </button>
          {showComps && (
            <div style={{ marginTop: 8, maxHeight: 140, overflow: 'auto', border: '1px solid #E2E0DC', borderRadius: 6, padding: 6, background: '#FFFFFF' }}>
              {components.length === 0
                ? <div style={{ fontSize: 12, color: '#999', padding: 6 }}>No components cached.</div>
                : components.map(c => (
                    <label key={c.jira_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer', fontSize: 12.5 }}>
                      <input type="checkbox" checked={selectedComps.has(c.jira_id)} onChange={() => toggleComp(c.jira_id)} />
                      {c.name}
                    </label>
                  ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={doCreate} disabled={busy || !cTitle.trim()} style={{ ...btn('#0052CC', '#FFFFFF'), opacity: (busy || !cTitle.trim()) ? 0.5 : 1 }}>
              {busy ? 'Creating…' : 'Create Story & link'}
            </button>
            <button onClick={() => setMode('view')} disabled={busy} style={btn('#F3F3F3', '#555', '#DDD')}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 8, fontSize: 12, color: '#C92A2A' }}>⚠ {error}</div>}
    </div>
  )
}

// ── Card edit / create modal ───────────────────────────────────────────

function CardModal({ initial, jira, jiraConfigured, onSave, onDelete, onClose, onLinkJira, onUnlinkJira, onCreateJira }) {
  const isNew = !initial.id
  const [title, setTitle]             = useState(initial.title || '')
  const [description, setDescription] = useState(initial.description || '')
  const [saving, setSaving]           = useState(false)

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '32px 36px', width: '100%', maxWidth: 520, fontFamily: FONT, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1E1E1E', margin: '0 0 20px 0' }}>
          {isNew ? 'New Card' : 'Edit Card'}
        </h2>

        <div style={{ marginBottom: 18 }}>
          <label style={fieldLabel}>Title *</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="What's the task?"
            style={lightField}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={fieldLabel}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional detail…"
            rows={4}
            style={{ ...lightField, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {!isNew && (
          <JiraPanel
            card={initial}
            jira={jira}
            jiraConfigured={jiraConfigured}
            defaultTitle={title}
            defaultDescription={description}
            onLink={key => onLinkJira(initial, key)}
            onUnlink={() => onUnlinkJira(initial)}
            onCreate={payload => onCreateJira(initial, payload)}
          />
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {!isNew && (
              <button
                onClick={() => { if (window.confirm('Delete this card?')) { onDelete(); onClose() } }}
                style={btn('#FFF0F0', '#CC3333', '#FFCCCC')}
              >Delete</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={btn('#F3F3F3', '#555555', '#DDDDDD')}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              style={{ ...btn('#4FD0A5', '#1E1E1E'), opacity: (!title.trim() || saving) ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : isNew ? 'Add Card' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quick add-card input (inline at bottom of column) ──────────────────

function QuickAdd({ onAdd }) {
  const [open, setOpen]   = useState(false)
  const [value, setValue] = useState('')

  const submit = () => {
    const title = value.trim()
    if (title) onAdd(title)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: '1px dashed #D5D3CE',
          borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#999999',
          cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#4FD0A5'; e.currentTarget.style.color = '#1a7a5e' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D5D3CE'; e.currentTarget.style.color = '#999999' }}
      >
        + Add a card
      </button>
    )
  }

  return (
    <div>
      <textarea
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
          if (e.key === 'Escape') { setValue(''); setOpen(false) }
        }}
        placeholder="Card title…"
        rows={2}
        style={{ ...lightField, resize: 'none', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={submit} style={btn('#4FD0A5', '#1E1E1E')}>Add</button>
        <button onClick={() => { setValue(''); setOpen(false) }} style={btn('#F3F3F3', '#555555', '#DDDDDD')}>Cancel</button>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function KanbanPage() {
  const { columns, setColumns, cards, setCards, loading, error, reload } = useBoard()
  const [dragId, setDragId]       = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { columnId, index }
  const [editCard, setEditCard]   = useState(null)   // card object being edited

  // Group cards by column, sorted by position
  const cardsByColumn = useMemo(() => {
    const map = {}
    columns.forEach(c => { map[c.id] = [] })
    ;[...cards].sort((a, b) => a.position - b.position).forEach(c => {
      if (map[c.column_id]) map[c.column_id].push(c)
    })
    return map
  }, [columns, cards])

  // ── Jira info (live status/assignee for linked cards) ───────────────

  const [jiraInfo, setJiraInfo]             = useState({})
  const [jiraConfigured, setJiraConfigured] = useState(true)

  const linkedKeys    = useMemo(
    () => [...new Set(cards.map(c => c.jira_issue_key).filter(Boolean))],
    [cards]
  )
  const linkedKeysStr = linkedKeys.join(',')

  useEffect(() => {
    const keys = linkedKeysStr ? linkedKeysStr.split(',') : []
    if (!keys.length) { setJiraInfo({}); return }
    let alive = true
    ;(async () => {
      try {
        const res = await api.jira.search({
          jql: `key in (${keys.join(',')})`,
          fields: ['summary', 'status', 'assignee'],
          maxResults: 100,
        })
        if (!alive) return
        const map = {}
        ;(res?.issues || []).forEach(it => {
          const f = it.fields || {}
          map[it.key] = {
            summary:   f.summary,
            status:    f.status?.name,
            statusCat: f.status?.statusCategory?.key,
            assignee:  f.assignee?.displayName || null,
            url:       `${JIRA_BROWSE_BASE}/${it.key}`,
          }
        })
        setJiraInfo(map)
      } catch (e) {
        if (alive) { console.error('jira info', e); if (/503/.test(String(e))) setJiraConfigured(false) }
      }
    })()
    return () => { alive = false }
  }, [linkedKeysStr])

  // Keep the open modal's card object in sync after a mutation
  const patchCard = (saved) => {
    setCards(prev => prev.map(c => c.id === saved.id ? saved : c))
    setEditCard(prev => (prev && prev.id === saved.id ? saved : prev))
  }

  const linkJira = async (card, issueKey) => {
    const saved = await api.kanban.linkJira(card.id, issueKey)
    patchCard(saved)
    return saved
  }

  const unlinkJira = async (card) => {
    const saved = await api.kanban.unlinkJira(card.id)
    patchCard(saved)
    return saved
  }

  const createJira = async (card, payload) => {
    const res = await api.kanban.createJira(card.id, payload)
    if (res?.card) patchCard(res.card)
    return res
  }

  // ── Column ops ──────────────────────────────────────────────────────

  const addColumn = async () => {
    const optimistic = {
      id: crypto.randomUUID(), title: 'New Column', position: columns.length,
    }
    setColumns(prev => [...prev, optimistic])
    try {
      const saved = await api.kanban.upsertColumn(optimistic)
      setColumns(prev => prev.map(c => c.id === optimistic.id ? saved : c))
    } catch (e) { console.error(e); reload() }
  }

  const renameColumn = async (id, title) => {
    const col = columns.find(c => c.id === id)
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c))
    try {
      await api.kanban.upsertColumn({ ...col, title })
    } catch (e) { console.error(e); reload() }
  }

  const deleteColumn = async (id) => {
    const col = columns.find(c => c.id === id)
    const n = (cardsByColumn[id] || []).length
    if (!window.confirm(`Delete "${col?.title}"${n ? ` and its ${n} card${n !== 1 ? 's' : ''}` : ''}?`)) return
    setColumns(prev => prev.filter(c => c.id !== id))
    setCards(prev => prev.filter(c => c.column_id !== id))
    try {
      await api.kanban.deleteColumn(id)
    } catch (e) { console.error(e); reload() }
  }

  // ── Card ops ──────────────────────────────────────────────────────────

  const addCard = async (columnId, title) => {
    const position = (cardsByColumn[columnId] || []).length
    const optimistic = { id: crypto.randomUUID(), column_id: columnId, title, description: '', position }
    setCards(prev => [...prev, optimistic])
    try {
      const saved = await api.kanban.upsertCard({ ...optimistic, columnId })
      setCards(prev => prev.map(c => c.id === optimistic.id ? saved : c))
    } catch (e) { console.error(e); reload() }
  }

  const saveCard = async (card, { title, description }) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, title, description } : c))
    try {
      await api.kanban.upsertCard({ ...card, columnId: card.column_id, title, description })
    } catch (e) { console.error(e); reload() }
  }

  const deleteCard = async (card) => {
    setCards(prev => prev.filter(c => c.id !== card.id))
    try {
      await api.kanban.deleteCard(card.id)
    } catch (e) { console.error(e); reload() }
  }

  const clearBoard = async () => {
    if (!cards.length) return
    if (!window.confirm(`Clear all ${cards.length} card${cards.length !== 1 ? 's' : ''}? Your columns stay in place.`)) return
    setCards([])
    try {
      await api.kanban.clear()
    } catch (e) { console.error(e); reload() }
  }

  // ── Drag & drop ─────────────────────────────────────────────────────

  const applyDrop = async () => {
    if (!dragId || !dropTarget) { setDragId(null); setDropTarget(null); return }
    const { columnId, index } = dropTarget

    // Rebuild ordering
    const byCol = {}
    columns.forEach(c => { byCol[c.id] = (cardsByColumn[c.id] || []).filter(x => x.id !== dragId) })
    const drag = cards.find(c => c.id === dragId)
    if (!drag) { setDragId(null); setDropTarget(null); return }
    const arr = byCol[columnId] || (byCol[columnId] = [])
    const idx = Math.max(0, Math.min(index, arr.length))
    arr.splice(idx, 0, { ...drag, column_id: columnId })

    // Flatten + reassign positions, diff against current
    const next = []
    const changed = []
    Object.entries(byCol).forEach(([colId, list]) => {
      list.forEach((c, i) => {
        const updated = { ...c, column_id: colId, position: i }
        next.push(updated)
        const orig = cards.find(o => o.id === c.id)
        if (!orig || orig.column_id !== colId || orig.position !== i) {
          changed.push({ id: c.id, columnId: colId, position: i })
        }
      })
    })

    setCards(next)
    setDragId(null)
    setDropTarget(null)
    if (changed.length) {
      try { await api.kanban.reorder(changed) }
      catch (e) { console.error(e); reload() }
    }
  }

  // Compute drop index within a column based on hovered card + pointer position
  const onCardDragOver = (e, card, indexInCol) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > rect.top + rect.height / 2
    setDropTarget({ columnId: card.column_id, index: indexInCol + (after ? 1 : 0) })
  }

  const onColumnDragOver = (e, columnId) => {
    e.preventDefault()
    if (!dragId) return
    // Only set to end if not already targeting a card in this column
    setDropTarget(prev =>
      prev && prev.columnId === columnId ? prev : { columnId, index: (cardsByColumn[columnId] || []).length }
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  const totalCards = cards.length

  return (
    <div style={{ fontFamily: FONT, background: '#F8F7F6', minHeight: '100vh', paddingTop: 56 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1E1E1E', margin: 0 }}>Priority Board</h1>
            <p style={{ fontSize: 13, color: '#888888', margin: '6px 0 0 0' }}>
              Drag cards to force-rank a round. Card order within a column is the priority. Clear the cards to start the next round.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={addColumn} style={btn('#1E1E1E', '#FFFFFF')}>+ Add column</button>
            <button
              onClick={clearBoard}
              disabled={!totalCards}
              style={{ ...btn('#FFFFFF', '#CC3333', '#FFCCCC'), opacity: totalCards ? 1 : 0.5 }}
            >
              Clear board
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FFF0F0', border: '1px solid #FFCCCC', borderRadius: 8, padding: '12px 18px', margin: '18px 0', color: '#CC3333', fontSize: 13 }}>
            Couldn't load the board: {error}. If this is the first time, make sure the <code>004_kanban.sql</code> migration has been run in Supabase.
          </div>
        )}

        {/* Board */}
        {loading ? (
          <p style={{ fontSize: 14, color: '#AAAAAA', marginTop: 40 }}>Loading…</p>
        ) : columns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗂</div>
            <p style={{ fontSize: 15, color: '#AAAAAA', marginBottom: 18 }}>No columns yet.</p>
            <button onClick={addColumn} style={btn('#4FD0A5', '#1E1E1E')}>+ Add your first column</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto', paddingTop: 22, paddingBottom: 8 }}>
            {columns.map(col => {
              const colCards = cardsByColumn[col.id] || []
              const isDropCol = dropTarget && dropTarget.columnId === col.id
              return (
                <div
                  key={col.id}
                  onDragOver={e => onColumnDragOver(e, col.id)}
                  onDrop={applyDrop}
                  style={{
                    width: 300, flexShrink: 0,
                    background: isDropCol && dragId ? '#F0FBF6' : '#F0EFEC',
                    border: `1px solid ${isDropCol && dragId ? '#4FD0A5' : '#E2E0DC'}`,
                    borderRadius: 12, padding: 14,
                    transition: 'background 0.15s, border 0.15s',
                  }}
                >
                  <ColumnHeader
                    column={col}
                    count={colCards.length}
                    onRename={renameColumn}
                    onDelete={deleteColumn}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10, minHeight: 8 }}>
                    {colCards.map((card, i) => (
                      <div key={card.id}>
                        {/* Insertion indicator before this card */}
                        {isDropCol && dropTarget.index === i && dragId && dragId !== card.id && (
                          <div style={{ height: 3, background: '#4FD0A5', borderRadius: 2, marginBottom: 8 }} />
                        )}
                        <Card
                          card={card}
                          rank={i}
                          dragging={dragId === card.id}
                          jira={card.jira_issue_key ? jiraInfo[card.jira_issue_key] : null}
                          onClick={() => setEditCard(card)}
                          onDragStart={() => setDragId(card.id)}
                          onDragEnd={() => { setDragId(null); setDropTarget(null) }}
                          onDragOver={e => onCardDragOver(e, card, i)}
                        />
                      </div>
                    ))}
                    {/* Insertion indicator at end of column */}
                    {isDropCol && dropTarget.index >= colCards.length && dragId && (
                      <div style={{ height: 3, background: '#4FD0A5', borderRadius: 2 }} />
                    )}
                  </div>

                  <QuickAdd onAdd={title => addCard(col.id, title)} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editCard && (
        <CardModal
          initial={editCard}
          jira={editCard.jira_issue_key ? jiraInfo[editCard.jira_issue_key] : null}
          jiraConfigured={jiraConfigured}
          onSave={patch => saveCard(editCard, patch)}
          onDelete={() => deleteCard(editCard)}
          onClose={() => setEditCard(null)}
          onLinkJira={linkJira}
          onUnlinkJira={unlinkJira}
          onCreateJira={createJira}
        />
      )}
    </div>
  )
}
