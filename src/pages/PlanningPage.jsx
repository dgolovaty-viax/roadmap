import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VotingTab from '@/components/voting/VotingTab'
import { api } from '@/lib/api'

// ── Data model ─────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'why',           label: "Why We're Building This", subtitle: 'Problem, persona, and business case — in one place.' },
  { key: 'customerValue', label: 'Customer Value',          subtitle: 'What the customer gets and how their world changes.' },
  { key: 'scope',         label: 'Scope',                   subtitle: "What's in, what's out, and what ships first." },
  { key: 'risks',         label: 'Risks & Open Questions',  subtitle: 'What could block us or needs a decision before work starts.' },
  { key: 'tech',          label: 'Tech Approach',           subtitle: 'Enough context for engineering to size and plan.' },
]

const STATUS_OPTIONS = ['Draft', 'In Review', 'Approved', 'In Progress', 'Done']

const STATUS_STYLE = {
  'Draft':       { background: '#F3F3F3', color: '#666666', border: '1px solid #DDDDDD' },
  'In Review':   { background: '#FFF8E6', color: '#996600', border: '1px solid #FFD966' },
  'Approved':    { background: '#E8F0FE', color: '#1a56db', border: '1px solid #93C5FD' },
  'In Progress': { background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5' },
  'Done':        { background: '#F0F0F0', color: '#555555', border: '1px solid #AAAAAA' },
}

// Map API response (snake_case) → app object (camelCase)
function rowToEpic(row) {
  return {
    id:            row.id,
    title:         row.title,
    owner:         row.owner,
    status:        row.status,
    targetQuarter: row.target_quarter ?? row.targetQuarter ?? '',
    sections:      row.sections || { why: '', customerValue: '', scope: '', risks: '', tech: '' },
    createdAt:     row.created_at ?? row.createdAt,
    updatedAt:     row.updated_at ?? row.updatedAt,
  }
}

function newEpic() {
  return {
    id: crypto.randomUUID(),
    title: '',
    owner: '',
    status: 'Draft',
    targetQuarter: '',
    sections: { why: '', customerValue: '', scope: '', risks: '', tech: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ── Persistence (via Flask API) ────────────────────────────────────────

function useEpics() {
  const [epics,   setEpics]   = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.epics.list()
      setEpics((data || []).map(rowToEpic))
    } catch (e) {
      console.error('Failed to load epics', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = async (epic) => {
    try {
      const saved = await api.epics.upsert(epic)
      const mapped = rowToEpic(saved)
      setEpics(prev => {
        const idx = prev.findIndex(e => e.id === mapped.id)
        return idx >= 0 ? prev.map(e => e.id === mapped.id ? mapped : e) : [mapped, ...prev]
      })
      return mapped
    } catch (e) {
      console.error('Failed to save epic', e)
      return epic
    }
  }

  const remove = async (id) => {
    await api.epics.delete(id)
    setEpics(prev => prev.filter(e => e.id !== id))
  }

  return { epics, loading, upsert, remove }
}

// ── Shared styles ──────────────────────────────────────────────────────

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

function btn(bg, color, border) {
  return {
    background: bg, color, border: `1px solid ${border || bg}`,
    borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT, transition: 'opacity 0.15s',
  }
}

const fieldBase = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #DDDDDD', borderRadius: 6,
  padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none',
  background: '#FFFFFF', color: '#1E1E1E',
}

const darkField = {
  ...fieldBase,
  background: 'transparent', color: '#FFFFFF',
  border: '1px solid #383838',
}

const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#888888', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 6,
}

// ── StatusBadge ────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['Draft']
  return (
    <span style={{ ...s, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

// ── EpicCard (list row) ────────────────────────────────────────────────

function EpicCard({ epic, onClick }) {
  const [hovered, setHovered] = useState(false)
  const preview = epic.sections.why?.trim().slice(0, 150) || ''

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8,
        padding: '20px 24px', cursor: 'pointer',
        boxShadow: hovered ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: preview ? 8 : 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E1E1E', margin: 0, lineHeight: 1.4 }}>
          {epic.title || <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>Untitled Epic</span>}
        </h3>
        <StatusBadge status={epic.status} />
      </div>

      {preview && (
        <p style={{ fontSize: 13, color: '#888888', margin: '0 0 14px 0', lineHeight: 1.65 }}>
          {preview}{epic.sections.why.length > 150 ? '…' : ''}
        </p>
      )}

      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#AAAAAA', alignItems: 'center' }}>
        {epic.owner && <span>{epic.owner}</span>}
        {epic.targetQuarter && <span>{epic.targetQuarter}</span>}
        <span style={{ marginLeft: 'auto' }}>
          Updated {new Date(epic.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

// ── EpicDetail (view + edit) ───────────────────────────────────────────

function EpicDetail({ initial, isNew, saving, onSave, onDelete, onBack }) {
  const [epic,        setEpic]        = useState(initial)
  const [editing,     setEditing]     = useState(isNew)
  const [generating,  setGenerating]  = useState(false)
  const [genError,    setGenError]    = useState(null)
  const [copied,      setCopied]      = useState(false)

  const handleCopyLink = () => {
    const url = `${window.location.origin}/planning/epics/${epic.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const set = (field, val) => setEpic(p => ({ ...p, [field]: val }))
  const setSection = (key, val) => setEpic(p => ({ ...p, sections: { ...p.sections, [key]: val } }))

  const handleSave = () => {
    onSave(epic)
    setEditing(false)
  }

  const handleCancel = () => {
    if (isNew) { onBack(); return }
    setEpic(initial)
    setEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('Delete this epic? This cannot be undone.')) onDelete(epic.id)
  }

  const handleGenerate = async () => {
    if (!epic.title.trim()) { setGenError('Add a title first so AI has context.'); return }
    setGenerating(true); setGenError(null)
    try {
      const { sections } = await api.ai.generateEpic(epic.title, '')
      setEpic(p => ({ ...p, sections: { ...p.sections, ...sections } }))
    } catch (e) {
      setGenError('AI generation failed. Check that the backend is running.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT }}>
          ← All epics
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {editing ? (
            <>
              <button onClick={handleGenerate} disabled={generating || saving} style={btn('#F0F8FF', '#1a56db', '#93C5FD')}>
                {generating ? '✦ Generating…' : '✦ Generate with AI'}
              </button>
              <button onClick={handleCancel} disabled={saving} style={btn('#F0F0F0', '#555555', '#DDDDDD')}>Cancel</button>
              <button onClick={handleSave}   disabled={saving || generating} style={btn('#4FD0A5', '#1E1E1E')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button onClick={handleCopyLink} style={btn(copied ? '#E8F9F3' : '#F3F3F3', copied ? '#1a7a5e' : '#555555', copied ? '#4FD0A5' : '#DDDDDD')}>
                {copied ? '✓ Link copied' : '🔗 Copy link'}
              </button>
              <button onClick={handleDelete} style={btn('#FFF0F0', '#CC3333', '#FFCCCC')}>Delete</button>
              <button onClick={() => setEditing(true)} style={btn('#1E1E1E', '#FFFFFF')}>Edit</button>
            </>
          )}
        </div>
      </div>

      {/* Metadata block */}
      <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '24px 28px', marginBottom: 20 }}>
        {editing ? (
          <>
            <input
              value={epic.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Epic Title"
              style={{ ...darkField, fontSize: 20, fontWeight: 600, marginBottom: 18 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ ...fieldLabel, color: '#777777' }}>Owner</label>
                <input value={epic.owner} onChange={e => set('owner', e.target.value)} placeholder="e.g. Jane Smith" style={darkField} />
              </div>
              <div>
                <label style={{ ...fieldLabel, color: '#777777' }}>Status</label>
                <select value={epic.status} onChange={e => set('status', e.target.value)} style={{ ...darkField, background: '#2A2A2A' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...fieldLabel, color: '#777777' }}>Target Quarter</label>
                <input value={epic.targetQuarter} onChange={e => set('targetQuarter', e.target.value)} placeholder="e.g. Q2 2026" style={darkField} />
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 600, margin: '0 0 14px 0', lineHeight: 1.3 }}>
              {epic.title || <span style={{ color: '#555555', fontStyle: 'italic' }}>Untitled Epic</span>}
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={epic.status} />
              {epic.owner        && <span style={{ fontSize: 13, color: '#AAAAAA' }}>{epic.owner}</span>}
              {epic.targetQuarter && <span style={{ fontSize: 13, color: '#AAAAAA' }}>{epic.targetQuarter}</span>}
            </div>
          </>
        )}
      </div>

      {/* AI error */}
      {genError && (
        <div style={{ background: '#FFF0F0', border: '1px solid #FFCCCC', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#CC3333' }}>
          {genError}
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map((sec, i) => (
        <div key={sec.key} style={{ marginBottom: 14 }}>
          <div style={{ background: '#1E1E1E', borderRadius: '6px 6px 0 0', padding: '10px 18px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: '#4FD0A5', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>0{i + 1}</span>
            <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{sec.label}</span>
            <span style={{ color: '#555555', fontSize: 12, fontStyle: 'italic', marginLeft: 6 }}>{sec.subtitle}</span>
          </div>
          {editing ? (
            <textarea
              value={epic.sections[sec.key]}
              onChange={e => setSection(sec.key, e.target.value)}
              rows={4}
              placeholder="..."
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 18px', fontSize: 14, lineHeight: 1.7, color: '#1E1E1E', resize: 'vertical', fontFamily: FONT, outline: 'none', background: '#FFFFFF' }}
            />
          ) : (
            <div style={{ border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 18px', minHeight: 72, fontSize: 14, lineHeight: 1.75, color: epic.sections[sec.key] ? '#1E1E1E' : '#CCCCCC', fontStyle: epic.sections[sec.key] ? 'normal' : 'italic', whiteSpace: 'pre-wrap', background: '#FFFFFF' }}>
              {epic.sections[sec.key] || 'Not filled in yet.'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Planning Page ──────────────────────────────────────────────────────

const TABS = ['Epics', 'Voting Sessions']

export default function PlanningPage() {
  const { epicId }                  = useParams()
  const navigate                    = useNavigate()
  const { epics, loading, upsert, remove } = useEpics()
  const [tab, setTab]             = useState('Epics')
  const [selectedId, setSelectedId] = useState(epicId || null)
  const [isNew, setIsNew] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  // When epics load and there's a URL epicId, select it
  useEffect(() => {
    if (epicId && epics.length > 0) {
      setSelectedId(epicId)
      setTab('Epics')
    }
  }, [epicId, epics.length])

  const selected = draft || epics.find(e => e.id === selectedId) || null

  const handleNew = () => {
    const e = newEpic()
    setDraft(e)
    setSelectedId(e.id)
    setIsNew(true)
  }

  const handleSelect = (epic) => {
    setDraft(null)
    setSelectedId(epic.id)
    setIsNew(false)
    navigate(`/planning/epics/${epic.id}`)
  }

  const handleSave = async (epic) => {
    setSaving(true)
    const saved = await upsert(epic)
    setSaving(false)
    setDraft(null)
    setSelectedId(saved.id)
    setIsNew(false)
    navigate(`/planning/epics/${saved.id}`)
  }

  const handleDelete = async (id) => {
    await remove(id)
    setSelectedId(null)
    setDraft(null)
    setIsNew(false)
    navigate('/planning')
  }

  const handleBack = () => {
    setSelectedId(null)
    setDraft(null)
    setIsNew(false)
    navigate('/planning')
  }

  // Tab bar (hidden when viewing an epic detail)
  const TabBar = () => (
    <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E2E0DC', marginBottom: 36 }}>
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => { setTab(t); handleBack() }}
          style={{
            background: 'none', border: 'none', padding: '10px 22px',
            fontSize: 14, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#1E1E1E' : '#AAAAAA',
            cursor: 'pointer', fontFamily: FONT,
            borderBottom: tab === t ? '2px solid #4FD0A5' : '2px solid transparent',
            marginBottom: -2,
          }}
        >{t}</button>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, fontFamily: FONT }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 32px' }}>

        {/* Page title */}
        <h1 style={{ fontSize: 30, fontWeight: 400, color: '#1E1E1E', margin: '0 0 28px 0', letterSpacing: '-0.5px' }}>Planning</h1>

        {/* Tab bar — hide when in epic detail */}
        {!selected && <TabBar />}

        {/* ── Epics tab ── */}
        {tab === 'Epics' && (
          selected ? (
            <EpicDetail
              key={selected.id}
              initial={selected}
              isNew={isNew}
              saving={saving}
              onSave={handleSave}
              onDelete={handleDelete}
              onBack={handleBack}
            />
          ) : loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0', color: '#AAAAAA', fontSize: 14 }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
                <p style={{ fontSize: 13, color: '#AAAAAA', margin: 0 }}>
                  {epics.length === 0 ? 'No epics yet' : `${epics.length} epic${epics.length !== 1 ? 's' : ''}`}
                </p>
                <button onClick={handleNew} style={btn('#4FD0A5', '#1E1E1E')}>+ New Epic</button>
              </div>

              {epics.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 14, color: '#DDDDDD' }}>◎</div>
                  <p style={{ fontSize: 15, color: '#AAAAAA', margin: '0 0 24px 0' }}>No epics yet. Create one to get started.</p>
                  <button onClick={handleNew} style={{ ...btn('#1E1E1E', '#FFFFFF'), padding: '10px 24px', fontSize: 14 }}>
                    Create your first epic
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {epics.map(epic => (
                    <EpicCard key={epic.id} epic={epic} onClick={() => handleSelect(epic)} />
                  ))}
                </div>
              )}
            </>
          )
        )}

        {/* ── Voting Sessions tab ── */}
        {tab === 'Voting Sessions' && <VotingTab epics={epics} />}

      </div>
    </div>
  )
}
