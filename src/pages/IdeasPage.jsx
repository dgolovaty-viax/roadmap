import { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react'
import { api } from '@/lib/api'

// ── Shared constants ───────────────────────────────────────────────────

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

const TAG_PALETTE = [
  { bg: '#E8F9F3', color: '#1a7a5e', border: '#4FD0A5' },  // teal
  { bg: '#E8F0FE', color: '#1a56db', border: '#93C5FD' },  // blue
  { bg: '#FFF8E6', color: '#996600', border: '#FFD966' },  // amber
  { bg: '#F3F0FF', color: '#5B21B6', border: '#C4B5FD' },  // purple
  { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },  // emerald
  { bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC' },  // sky blue
  { bg: '#FEF9C3', color: '#854D0E', border: '#FDE047' },  // yellow
  { bg: '#F0FDF4', color: '#166534', border: '#86EFAC' },  // light green
  { bg: '#F5F3FF', color: '#4C1D95', border: '#A78BFA' },  // deep purple
  { bg: '#ECFEFF', color: '#164E63', border: '#67E8F9' },  // cyan
  { bg: '#FFF7ED', color: '#9A3412', border: '#FDBA74' },  // orange
  { bg: '#F0F9FF', color: '#1e3a5f', border: '#BAE6FD' },  // navy
]

// Context that maps tag id → palette entry (set by IdeasPage, consumed by TagBadge)
const TagColorContext = createContext({})

function tagPalette(name) {
  let hash = 0
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length]
}

function btn(bg, color, border) {
  return {
    background: bg, color, border: `1px solid ${border || bg}`,
    borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
  }
}

const lightField = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #DDDDDD', borderRadius: 6,
  padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none',
  background: '#FFFFFF', color: '#1E1E1E',
}

const darkField = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #383838', borderRadius: 6,
  padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none',
  background: 'transparent', color: '#FFFFFF',
}

const fieldLabel = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#888888', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 6,
}

const darkFieldLabel = { ...fieldLabel, color: '#777777' }

// ── helpers ────────────────────────────────────────────────────────────

function normalizeTags(idea) {
  const assignments = idea.idea_tag_assignments || []
  return assignments.map(a => a.idea_tags).filter(Boolean)
}

// ── Duplicate detection ────────────────────────────────────────────────

const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','have','has','had','do','does','did',
  'will','would','could','should','may','might','must','can','it','its','this','that',
  'we','our','you','your','they','their','i','my','how','what','when','where','why','which'])

function keyWords(text) {
  return new Set(
    (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
  )
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 0
  const inter = [...a].filter(x => b.has(x)).length
  return inter / (a.size + b.size - inter)
}

// Returns Map<ideaId, Array<{id, title}>> of which ideas each idea is similar to
function buildDuplicateMap(ideas) {
  const map = new Map()
  for (let i = 0; i < ideas.length; i++) {
    for (let j = i + 1; j < ideas.length; j++) {
      const a = ideas[i], b = ideas[j]
      const tA = (a.title || '').toLowerCase().trim()
      const tB = (b.title || '').toLowerCase().trim()
      const isMatch = (tA && tA === tB) || jaccard(
        keyWords((a.title || '') + ' ' + (a.description || '')),
        keyWords((b.title || '') + ' ' + (b.description || ''))
      ) >= 0.4
      if (isMatch) {
        if (!map.has(a.id)) map.set(a.id, [])
        if (!map.has(b.id)) map.set(b.id, [])
        map.get(a.id).push({ id: b.id, title: b.title })
        map.get(b.id).push({ id: a.id, title: a.title })
      }
    }
  }
  return map
}

// ── TagBadge ───────────────────────────────────────────────────────────

function TagBadge({ id, name, onRemove }) {
  const colorMap = useContext(TagColorContext)
  if (!name) return null
  const { bg, color, border } = (id && colorMap[id]) ? colorMap[id] : tagPalette(name)
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
      padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase',
      whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {name}
      {onRemove && (
        <span
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ cursor: 'pointer', fontWeight: 900, fontSize: 13, lineHeight: 1, opacity: 0.7 }}
        >×</span>
      )}
    </span>
  )
}

// ── MultiTagSelector ───────────────────────────────────────────────────

function MultiTagSelector({ selectedTags, allTags, onAdd, onRemove, onCreateAndAdd, dark }) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const field = dark ? darkField : lightField
  const selectedIds = new Set(selectedTags.map(t => t.id))
  const available = allTags.filter(t => !selectedIds.has(t.id))

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await onCreateAndAdd(name)
    setNewName('')
    setShowNew(false)
  }

  return (
    <div>
      {/* Selected tags as removable badges */}
      {selectedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selectedTags.map(tag => (
            <TagBadge key={tag.id} id={tag.id} name={tag.name} onRemove={() => onRemove(tag)} />
          ))}
        </div>
      )}

      {/* Add more tags */}
      {showNew ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setShowNew(false); setNewName('') }
            }}
            placeholder="New tag name"
            style={{ ...field, flex: 1 }}
          />
          <button onClick={handleCreate} style={btn('#4FD0A5', '#1E1E1E')}>Add</button>
          <button
            onClick={() => { setShowNew(false); setNewName('') }}
            style={btn(dark ? '#2A2A2A' : '#F3F3F3', dark ? '#AAAAAA' : '#555555', dark ? '#383838' : '#DDDDDD')}
          >Cancel</button>
        </div>
      ) : (
        <select
          value=""
          onChange={e => {
            const val = e.target.value
            if (!val) return
            if (val === '__new__') { setShowNew(true); return }
            const tag = allTags.find(t => t.id === val)
            if (tag) onAdd(tag)
            e.target.value = ''
          }}
          style={{ ...field, background: dark ? '#2A2A2A' : '#FFFFFF' }}
        >
          <option value="">{selectedTags.length === 0 ? 'Add a tag…' : 'Add another tag…'}</option>
          {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          <option value="__new__">+ Create new tag…</option>
        </select>
      )}
    </div>
  )
}

// ── Data hooks ─────────────────────────────────────────────────────────

function useIdeas() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.ideas.list()
      setIdeas((data || []).map(i => ({ ...i, tags: normalizeTags(i) })))
    } catch (e) {
      console.error('Failed to load ideas', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = async (idea) => {
    const saved = await api.ideas.upsert(idea)
    const normalized = { ...saved, tags: normalizeTags(saved) }
    setIdeas(prev => {
      const idx = prev.findIndex(i => i.id === normalized.id)
      return idx >= 0 ? prev.map(i => i.id === normalized.id ? normalized : i) : [normalized, ...prev]
    })
    return normalized
  }

  const remove = async (id) => {
    await api.ideas.delete(id)
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const removeMany = (ids) => {
    setIdeas(prev => prev.filter(i => !ids.includes(i.id)))
  }

  return { ideas, loading, upsert, remove, removeMany, reload: load }
}

function useTags() {
  const [tags, setTags] = useState([])

  useEffect(() => {
    api.ideaTags.list().then(data => setTags(data || [])).catch(() => {})
  }, [])

  const createTag = async (name) => {
    const tag = await api.ideaTags.create(name)
    setTags(prev =>
      prev.find(t => t.id === tag.id)
        ? prev
        : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
    )
    return tag
  }

  return { tags, createTag }
}

function useVoteSession() {
  const [session, setSession]         = useState(null)
  const [votes, setVotes]             = useState([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [showResults, setShowResults] = useState(false)

  const loadLatest = useCallback(async () => {
    try {
      const sessions = await api.ideaVoteSessions.list()
      const latest = (sessions || [])[0]
      if (latest) {
        const { votes: v } = await api.ideaVoteSessions.get(latest.id)
        setSession(latest)
        setVotes(v || [])
      }
    } catch (e) {
      console.error('Failed to load vote session', e)
    } finally {
      setLoadingSession(false)
    }
  }, [])

  useEffect(() => { loadLatest() }, [loadLatest])

  const startSession = async () => {
    const s = await api.ideaVoteSessions.create()
    setSession(s)
    setVotes([])
    setShowResults(false)
    return s
  }

  const closeSession = async () => {
    if (!session) return
    await api.ideaVoteSessions.close(session.id)
    setSession(p => ({ ...p, status: 'closed' }))
    setShowResults(true)
  }

  const refreshVotes = useCallback(async () => {
    if (!session) return
    const { votes: v } = await api.ideaVoteSessions.get(session.id)
    setVotes(v || [])
  }, [session])

  const dismissResults = () => {
    setShowResults(false)
    setSession(null)
  }

  return { session, votes, loadingSession, showResults, startSession, closeSession, refreshVotes, dismissResults }
}

// ── Voting Banner (admin, session open) ────────────────────────────────

function VotingBanner({ session, votes, onCopyLink, onClose, onToggleParticipants, showParticipants, copied }) {
  const voteUrl = `${window.location.origin}/ideas/vote/${session.id}`

  return (
    <div style={{
      background: '#E8F9F3', border: '1px solid #4FD0A5', borderRadius: 8,
      padding: '12px 18px', marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    }}>
      {/* Pulse dot */}
      <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4FD0A5', opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
        <div style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: '#4FD0A5' }} />
      </div>

      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a7a5e' }}>Voting in progress</span>
      <span style={{ fontSize: 13, color: '#1a7a5e', opacity: 0.7 }}>
        {votes.length} {votes.length === 1 ? 'person has' : 'people have'} voted
      </span>

      {/* Vote link preview */}
      <span style={{ fontSize: 12, color: '#1a7a5e', opacity: 0.6, fontFamily: 'monospace', background: 'rgba(79,208,165,0.15)', padding: '2px 8px', borderRadius: 4 }}>
        {voteUrl.replace('https://', '')}
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onCopyLink}
          style={btn(copied ? '#4FD0A5' : '#FFFFFF', copied ? '#1E1E1E' : '#1a7a5e', copied ? '#4FD0A5' : '#4FD0A5')}
        >
          {copied ? '✓ Copied' : '🔗 Copy link'}
        </button>
        <button
          onClick={onToggleParticipants}
          style={btn(showParticipants ? '#1a7a5e' : '#FFFFFF', showParticipants ? '#FFFFFF' : '#1a7a5e', '#4FD0A5')}
        >
          {votes.length} votes {showParticipants ? '▲' : '▼'}
        </button>
        <button onClick={onClose} style={btn('#FFF0F0', '#CC3333', '#FFCCCC')}>Close vote</button>
      </div>
    </div>
  )
}

// ── Participant Panel ──────────────────────────────────────────────────

function ParticipantPanel({ votes, onRefresh }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8,
      padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Participants ({votes.length})
        </span>
        <button
          onClick={onRefresh}
          style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: FONT, padding: 0 }}
        >
          ↻ Refresh
        </button>
      </div>

      {votes.length === 0 ? (
        <p style={{ fontSize: 13, color: '#AAAAAA', margin: 0 }}>No votes yet. Share the link to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {votes.map(v => (
            <span key={v.id} style={{
              background: '#F3F3F3', border: '1px solid #E2E0DC',
              borderRadius: 20, padding: '4px 12px', fontSize: 12, color: '#555555',
            }}>
              {v.email}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Results View ───────────────────────────────────────────────────────

function ResultsView({ votes, ideas, onPromote, onDismiss }) {
  const [selected, setSelected] = useState(new Set())
  const [promoting, setPromoting] = useState(false)

  // Tally votes per idea
  const tally = {}
  votes.forEach(v => {
    const ids = Array.isArray(v.idea_ids) ? v.idea_ids : []
    ids.forEach(id => { tally[id] = (tally[id] || 0) + 1 })
  })

  // Top 5 by vote count
  const topIdeas = [...ideas]
    .filter(i => tally[i.id] > 0)
    .sort((a, b) => (tally[b.id] || 0) - (tally[a.id] || 0))
    .slice(0, 5)

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handlePromote = async () => {
    if (selected.size === 0 || promoting) return
    setPromoting(true)
    try {
      await onPromote([...selected])
    } finally {
      setPromoting(false)
    }
  }

  const rankColors = ['#4FD0A5', '#93C5FD', '#FFD966', '#AAAAAA', '#AAAAAA']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1E1E1E', margin: '0 0 6px 0' }}>Voting Results</h2>
          <p style={{ fontSize: 13, color: '#888888', margin: 0 }}>
            {votes.length} {votes.length === 1 ? 'person' : 'people'} voted
            {topIdeas.length > 0 ? ` · top ${topIdeas.length} idea${topIdeas.length !== 1 ? 's' : ''} shown` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDismiss} style={btn('#F3F3F3', '#555555', '#DDDDDD')}>Back to Ideas</button>
          <button
            onClick={handlePromote}
            disabled={selected.size === 0 || promoting}
            style={{ ...btn('#4FD0A5', '#1E1E1E'), opacity: selected.size === 0 || promoting ? 0.5 : 1 }}
          >
            {promoting ? 'Moving…' : selected.size > 0 ? `Move ${selected.size} to Planning` : 'Move to Planning'}
          </button>
        </div>
      </div>

      {/* Instruction */}
      {topIdeas.length > 0 && (
        <p style={{ fontSize: 13, color: '#AAAAAA', margin: '0 0 16px 0' }}>
          Select ideas below to move them to the Planning tab as epics.
        </p>
      )}

      {/* Results list */}
      {topIdeas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, color: '#AAAAAA' }}>No votes were cast in this session.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {topIdeas.map((idea, i) => {
            const count = tally[idea.id] || 0
            const ideaTags = idea.tags || []
            const isSelected = selected.has(idea.id)

            return (
              <div
                key={idea.id}
                onClick={() => toggle(idea.id)}
                style={{
                  background: isSelected ? '#F0FFF8' : '#FFFFFF',
                  border: `2px solid ${isSelected ? '#4FD0A5' : '#E2E0DC'}`,
                  borderRadius: 8, padding: '18px 22px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 18,
                  transition: 'all 0.15s',
                }}
              >
                {/* Rank badge */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: rankColors[i] || '#E2E0DC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#1E1E1E',
                }}>
                  {i + 1}
                </div>

                {/* Idea info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1E1E1E' }}>{idea.title}</span>
                    {ideaTags.map(t => <TagBadge key={t.id} id={t.id} name={t.name} />)}
                  </div>
                  {idea.description && (
                    <p style={{ fontSize: 13, color: '#888888', margin: 0 }}>
                      {idea.description.slice(0, 120)}{idea.description.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>

                {/* Vote count */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4FD0A5', lineHeight: 1 }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>
                    vote{count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: `2px solid ${isSelected ? '#4FD0A5' : '#DDDDDD'}`,
                  borderRadius: 5, background: isSelected ? '#4FD0A5' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isSelected && <span style={{ color: '#1E1E1E', fontSize: 13, fontWeight: 800 }}>✓</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── IdeaCard ───────────────────────────────────────────────────────────

function IdeaCard({ idea, onClick, dragging, dragOver, isDuplicate, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const [hovered, setHovered] = useState(false)
  const tags = idea.tags || []
  const preview = (idea.description || '').trim().slice(0, 140)

  return (
    <div
      draggable
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        background: '#FFFFFF',
        border: dragOver ? '2px solid #4FD0A5' : isDuplicate ? '1px solid #FFD966' : '1px solid #E2E0DC',
        borderRadius: 8,
        padding: dragOver ? '19px 23px' : '20px 24px',
        cursor: dragging ? 'grabbing' : 'grab',
        boxShadow: hovered && !dragging ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
        opacity: dragging ? 0.35 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s, border 0.1s',
        userSelect: 'none',
        display: 'flex', flexDirection: 'column',
        minWidth: 0,
      }}
    >
      {/* Upper content — grows to fill cell, pushes tags to bottom */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* drag handle + title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: preview ? 8 : 0 }}>
          <span style={{
            fontSize: 14, color: hovered ? '#BBBBBB' : '#DDDDDD',
            lineHeight: 1.4, flexShrink: 0, marginTop: 2,
            transition: 'color 0.15s', cursor: 'grab',
          }}>⠿</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isDuplicate && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#FFF8E6', color: '#996600', border: '1px solid #FFD966',
                borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5,
              }}>
                ⚠ Possible duplicate
              </div>
            )}
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E1E1E', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {idea.title || <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>Untitled Idea</span>}
            </h3>
          </div>
        </div>

        {preview && (
          <p style={{ fontSize: 13, color: '#888888', margin: 0, lineHeight: 1.65 }}>
            {preview}{(idea.description || '').length > 140 ? '…' : ''}
          </p>
        )}
      </div>

      {/* Tags — always anchored to bottom */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 14 }}>
          {tags.map(t => <TagBadge key={t.id} id={t.id} name={t.name} />)}
        </div>
      )}
    </div>
  )
}

// ── CreateModal ────────────────────────────────────────────────────────

function CreateModal({ tags, onCreateTag, onSave, onClose }) {
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [saving, setSaving]           = useState(false)

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ id: crypto.randomUUID(), title: title.trim(), description, tagIds: selectedTags.map(t => t.id) })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = (tag) => {
    setSelectedTags(prev => prev.find(t => t.id === tag.id) ? prev : [...prev, tag])
  }

  const handleRemoveTag = (tag) => {
    setSelectedTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const handleCreateAndAdd = async (name) => {
    const tag = await onCreateTag(name)
    handleAddTag(tag)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '32px 36px', width: '100%', maxWidth: 560, fontFamily: FONT, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1E1E1E', margin: '0 0 24px 0' }}>New Idea</h2>

        <div style={{ marginBottom: 18 }}>
          <label style={fieldLabel}>Title *</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="What's the idea?"
            style={lightField}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={fieldLabel}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the idea in more detail…"
            rows={4}
            style={{ ...lightField, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={fieldLabel}>Tags</label>
          <MultiTagSelector
            selectedTags={selectedTags}
            allTags={tags}
            onAdd={handleAddTag}
            onRemove={handleRemoveTag}
            onCreateAndAdd={handleCreateAndAdd}
            dark={false}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('#F3F3F3', '#555555', '#DDDDDD')}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{ ...btn('#4FD0A5', '#1E1E1E'), opacity: (!title.trim() || saving) ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Idea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── IdeaDetail ─────────────────────────────────────────────────────────

function IdeaDetail({ initial, tags, saving, onCreateTag, onSave, onDelete, onBack, onPromote, duplicates = [], onSelectIdea }) {
  const [idea, setIdea]         = useState(initial)
  const [selectedTags, setSelectedTags] = useState(initial.tags || [])
  const [editing, setEditing]   = useState(false)

  const handleSave = async () => {
    await onSave({ ...idea, tagIds: selectedTags.map(t => t.id) })
    setEditing(false)
  }

  const handleCancel = () => {
    setIdea(initial)
    setSelectedTags(initial.tags || [])
    setEditing(false)
  }

  const handleAddTag = (tag) => {
    setSelectedTags(prev => prev.find(t => t.id === tag.id) ? prev : [...prev, tag])
  }

  const handleRemoveTag = (tag) => {
    setSelectedTags(prev => prev.filter(t => t.id !== tag.id))
  }

  const handleCreateAndAdd = async (name) => {
    const tag = await onCreateTag(name)
    handleAddTag(tag)
  }

  const handleDelete = () => {
    if (window.confirm('Delete this idea? This cannot be undone.')) onDelete(idea.id)
  }

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT }}
        >
          ← All ideas
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {editing ? (
            <>
              <button onClick={handleCancel} disabled={saving} style={btn('#F0F0F0', '#555555', '#DDDDDD')}>Cancel</button>
              <button onClick={handleSave}   disabled={saving} style={btn('#4FD0A5', '#1E1E1E')}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} style={btn('#FFF0F0', '#CC3333', '#FFCCCC')}>Delete</button>
              <button onClick={() => setEditing(true)} style={btn('#1E1E1E', '#FFFFFF')}>Edit</button>
              {onPromote && (
                <button
                  onClick={() => {
                    if (window.confirm(`Move "${idea.title}" to Planning? It will be converted to an epic and removed from Ideas.`)) {
                      onPromote(idea.id)
                    }
                  }}
                  style={btn('#4FD0A5', '#1E1E1E')}
                >
                  → Move to Planning
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Metadata block */}
      <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '24px 28px', marginBottom: 20 }}>
        {editing ? (
          <>
            <input
              value={idea.title}
              onChange={e => setIdea(p => ({ ...p, title: e.target.value }))}
              placeholder="Idea title"
              style={{ ...darkField, fontSize: 20, fontWeight: 600, marginBottom: 18 }}
            />
            <div>
              <label style={darkFieldLabel}>Tags</label>
              <MultiTagSelector
                selectedTags={selectedTags}
                allTags={tags}
                onAdd={handleAddTag}
                onRemove={handleRemoveTag}
                onCreateAndAdd={handleCreateAndAdd}
                dark={true}
              />
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 600, margin: '0 0 14px 0', lineHeight: 1.3 }}>
              {idea.title || <span style={{ color: '#555555', fontStyle: 'italic' }}>Untitled Idea</span>}
            </h2>
            {selectedTags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedTags.map(t => <TagBadge key={t.id} id={t.id} name={t.name} />)}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: '#555555', fontStyle: 'italic' }}>No tags</span>
            )}
          </>
        )}
      </div>

      {/* Possible duplicates panel */}
      {duplicates.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid #FFD966', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#FFF8E6', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>⚠</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#996600', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Possible duplicate{duplicates.length > 1 ? 's' : ''} detected
            </span>
          </div>
          <div style={{ background: '#FFFDF5', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {duplicates.map(d => (
              <button
                key={d.id}
                onClick={() => onSelectIdea && onSelectIdea(d.id)}
                style={{
                  background: '#FFFFFF', border: '1px solid #FFD966', borderRadius: 6,
                  padding: '9px 14px', textAlign: 'left', cursor: 'pointer',
                  fontFamily: FONT, fontSize: 13, color: '#1E1E1E', fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FFF8E6'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
              >
                <span>{d.title || <em style={{ color: '#AAAAAA' }}>Untitled</em>}</span>
                <span style={{ fontSize: 11, color: '#996600', fontWeight: 700, flexShrink: 0 }}>View →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description section */}
      <div>
        <div style={{ background: '#1E1E1E', borderRadius: '6px 6px 0 0', padding: '10px 18px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ color: '#4FD0A5', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>01</span>
          <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Description</span>
        </div>
        {editing ? (
          <textarea
            value={idea.description || ''}
            onChange={e => setIdea(p => ({ ...p, description: e.target.value }))}
            rows={10}
            placeholder="Describe the idea in detail…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 18px', fontSize: 14, lineHeight: 1.7, color: '#1E1E1E', resize: 'vertical', fontFamily: FONT, outline: 'none', background: '#FFFFFF' }}
          />
        ) : (
          <div style={{ border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '14px 18px', minHeight: 140, fontSize: 14, lineHeight: 1.75, color: idea.description ? '#1E1E1E' : '#CCCCCC', fontStyle: idea.description ? 'normal' : 'italic', whiteSpace: 'pre-wrap', background: '#FFFFFF' }}>
            {idea.description || 'No description yet. Click Edit to add one.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vote History List ──────────────────────────────────────────────────

function VoteHistoryList({ sessions, onSelect }) {
  if (sessions.length === 0) return null
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1E1E1E', margin: 0 }}>Vote History</h2>
        <span style={{ fontSize: 12, color: '#AAAAAA' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map(s => {
          const snap = s.result_snapshot || {}
          const promoted = (s.promoted_idea_ids || []).length
          const voters = snap.total_voters ?? 0
          const topIdea = (snap.ideas || [])[0]
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s)}
              style={{
                background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8,
                padding: '16px 22px', cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 20, transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ flexShrink: 0, minWidth: 100 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E1E1E' }}>{fmt(s.closed_at || s.created_at)}</div>
                <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{voters} voter{voters !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {topIdea
                  ? <span style={{ fontSize: 13, color: '#555555' }}>Top: <strong style={{ color: '#1E1E1E' }}>{topIdea.title}</strong> <span style={{ color: '#AAAAAA' }}>· {topIdea.vote_count} vote{topIdea.vote_count !== 1 ? 's' : ''}</span></span>
                  : <span style={{ fontSize: 13, color: '#AAAAAA', fontStyle: 'italic' }}>No votes cast</span>
                }
              </div>
              {promoted > 0 && (
                <span style={{ background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5', borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {promoted} promoted
                </span>
              )}
              <span style={{ color: '#CCCCCC', fontSize: 16, flexShrink: 0 }}>›</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vote History Detail ────────────────────────────────────────────────

function VoteHistoryDetail({ session, onBack }) {
  const [votes, setVotes] = useState([])
  const [loadingVotes, setLoadingVotes] = useState(true)

  useEffect(() => {
    api.ideaVoteSessions.get(session.id)
      .then(({ votes: v }) => setVotes(v || []))
      .catch(() => {})
      .finally(() => setLoadingVotes(false))
  }, [session.id])

  const snap = session.result_snapshot || {}
  const ideas = snap.ideas || []
  const promoted = new Set(session.promoted_idea_ids || [])
  const rankColors = ['#4FD0A5', '#93C5FD', '#FFD966', '#AAAAAA', '#AAAAAA']
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const ideaTitleById = Object.fromEntries(ideas.map(i => [i.id, i.title]))

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT, marginBottom: 28 }}>
        ← Vote History
      </button>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1E1E1E', margin: '0 0 6px 0' }}>
          Session — {fmt(session.closed_at || session.created_at)}
        </h2>
        <p style={{ fontSize: 13, color: '#888888', margin: 0 }}>
          {snap.total_voters ?? votes.length} participant{(snap.total_voters ?? votes.length) !== 1 ? 's' : ''}
          {promoted.size > 0 ? ` · ${promoted.size} idea${promoted.size !== 1 ? 's' : ''} moved to Planning` : ''}
        </p>
      </div>

      {ideas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <p style={{ fontSize: 15, color: '#AAAAAA' }}>No votes were cast in this session.</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>Results</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 40 }}>
            {ideas.map((idea, i) => {
              const wasPromoted = promoted.has(idea.id)
              return (
                <div key={idea.id} style={{
                  background: wasPromoted ? '#F0FFF8' : '#FFFFFF',
                  border: `2px solid ${wasPromoted ? '#4FD0A5' : '#E2E0DC'}`,
                  borderRadius: 8, padding: '16px 22px',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: rankColors[i] || '#E2E0DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#1E1E1E' }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#1E1E1E' }}>{idea.title}</span>
                      {idea.tag_name && <TagBadge name={idea.tag_name} />}
                      {wasPromoted && (
                        <span style={{ background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>MOVED TO PLANNING</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#4FD0A5', lineHeight: 1 }}>{idea.vote_count}</div>
                    <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>vote{idea.vote_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>Who voted for what</h3>
          {loadingVotes ? (
            <p style={{ fontSize: 13, color: '#AAAAAA' }}>Loading…</p>
          ) : votes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#AAAAAA' }}>No votes recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {votes.map(v => {
                const votedTitles = (v.idea_ids || []).map(id => ideaTitleById[id] || id)
                return (
                  <div key={v.id} style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#F3F3F3', border: '1px solid #E2E0DC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#888888' }}>
                      {(v.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E1E1E', marginBottom: 8 }}>{v.email}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {votedTitles.length > 0
                          ? votedTitles.map((title, idx) => (
                              <span key={idx} style={{ background: '#F8F7F6', border: '1px solid #E2E0DC', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#555555' }}>👍 {title}</span>
                            ))
                          : <span style={{ fontSize: 12, color: '#AAAAAA', fontStyle: 'italic' }}>No selections</span>
                        }
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#AAAAAA', flexShrink: 0 }}>{votedTitles.length}/5</div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Ideas Page ─────────────────────────────────────────────────────────

export default function IdeasPage() {
  const { ideas, loading, upsert, remove, removeMany } = useIdeas()
  const { tags, createTag }                             = useTags()
  const {
    session, votes, loadingSession, showResults,
    startSession, closeSession, refreshVotes, dismissResults,
  } = useVoteSession()

  const [activeTags, setActiveTags]         = useState(new Set())
  const [searchQuery, setSearchQuery]       = useState('')
  const [selectedId, setSelectedId]         = useState(null)
  const [showCreate, setShowCreate]         = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [startingVote, setStartingVote]     = useState(false)

  // Vote history
  const [closedSessions, setClosedSessions] = useState([])
  const [historySession, setHistorySession] = useState(null)

  useEffect(() => {
    api.ideaVoteSessions.list()
      .then(all => setClosedSessions((all || []).filter(s => s.status === 'closed')))
      .catch(() => {})
  }, [showResults])

  // Drag-to-rank state
  const [order, setOrder]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('ideas-order') || 'null') } catch { return null }
  })
  const [draggedId, setDraggedId]   = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  // Keep order in sync as ideas are added / removed
  useEffect(() => {
    if (ideas.length === 0) return
    setOrder(prev => {
      const base = prev || []
      const existingIds = new Set(ideas.map(i => i.id))
      // drop deleted ideas, append new ones at the end
      const pruned  = base.filter(id => existingIds.has(id))
      const newOnes = ideas.map(i => i.id).filter(id => !pruned.includes(id))
      const next = [...pruned, ...newOnes]
      localStorage.setItem('ideas-order', JSON.stringify(next))
      return next
    })
  }, [ideas])

  const selected = ideas.find(i => i.id === selectedId) || null

  const usedTagIds = [...new Set(ideas.flatMap(i => (i.tags || []).map(t => t.id)))]
  const usedTags   = tags.filter(t => usedTagIds.includes(t.id))

  // Potential duplicates — computed once per ideas change
  const duplicateMap = useMemo(() => buildDuplicateMap(ideas), [ideas])
  const duplicateIds = useMemo(() => new Set(duplicateMap.keys()), [duplicateMap])

  // Assign each tag a unique color by its index in the sorted tags list
  const tagColorMap = useMemo(() => {
    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))
    const map = {}
    sorted.forEach((tag, i) => { map[tag.id] = TAG_PALETTE[i % TAG_PALETTE.length] })
    return map
  }, [tags])
  const filtered = (activeTags.size > 0
    ? ideas.filter(i => (i.tags || []).some(t => activeTags.has(t.id)))
    : ideas
  ).filter(i => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (i.title || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
  })

  function toggleTag(id) {
    setActiveTags(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Apply saved order to the filtered list
  const sortedFiltered = useMemo(() => {
    if (!order) return filtered
    return [...filtered].sort((a, b) => {
      const ai = order.indexOf(a.id)
      const bi = order.indexOf(b.id)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [filtered, order])

  function handleDragStart(id) { setDraggedId(id) }
  function handleDragOver(e, id) { e.preventDefault(); if (id !== dragOverId) setDragOverId(id) }
  function handleDrop(targetId) {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return }
    setOrder(prev => {
      const base = prev || ideas.map(i => i.id)
      const from = base.indexOf(draggedId)
      const to   = base.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      const next = [...base]
      next.splice(from, 1)
      next.splice(to, 0, draggedId)
      localStorage.setItem('ideas-order', JSON.stringify(next))
      return next
    })
    setDraggedId(null)
    setDragOverId(null)
  }
  function handleDragEnd() { setDraggedId(null); setDragOverId(null) }

  // Auto-refresh votes every 20s when session is open
  useEffect(() => {
    if (!session || session.status !== 'open') return
    const interval = setInterval(refreshVotes, 20000)
    return () => clearInterval(interval)
  }, [session, refreshVotes])

  const handleCopyLink = () => {
    if (!session) return
    const url = `${window.location.origin}/ideas/vote/${session.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleStartVoting = async () => {
    setStartingVote(true)
    try { await startSession() }
    finally { setStartingVote(false) }
  }

  const handleCloseVote = () => {
    if (window.confirm(`Close the voting session? ${votes.length === 0 ? 'No votes have been cast yet.' : `${votes.length} ${votes.length === 1 ? 'person has' : 'people have'} voted.`} Participants will no longer be able to submit votes.`)) {
      closeSession()
    }
  }

  const handleSave = async (idea) => {
    setSaving(true)
    try {
      const saved = await upsert(idea)
      setSelectedId(saved.id)
      return saved
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    await remove(id)
    setSelectedId(null)
  }

  const handlePromote = async (ideaIds) => {
    await api.promoteIdeas(ideaIds, session?.id)
    removeMany(ideaIds)
    dismissResults()
  }

  const handlePromoteSingle = async (ideaId) => {
    await api.promoteIdeas([ideaId], session?.id)
    removeMany([ideaId])
    setSelectedId(null)
  }

  return (
    <TagColorContext.Provider value={tagColorMap}>
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, fontFamily: FONT }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 32px' }}>

        <h1 style={{ fontSize: 30, fontWeight: 400, color: '#1E1E1E', margin: '0 0 28px 0', letterSpacing: '-0.5px' }}>Ideas</h1>

        {/* ── History detail view ── */}
        {historySession ? (
          <VoteHistoryDetail
            session={historySession}
            onBack={() => setHistorySession(null)}
          />

        /* ── Idea detail view ── */
        ) : selected ? (
          <IdeaDetail
            key={selected.id}
            initial={selected}
            tags={tags}
            saving={saving}
            onCreateTag={createTag}
            onSave={handleSave}
            onDelete={handleDelete}
            onBack={() => setSelectedId(null)}
            onPromote={handlePromoteSingle}
            duplicates={duplicateMap.get(selected.id) || []}
            onSelectIdea={setSelectedId}
          />

        /* ── Results view (after vote closed) ── */
        ) : showResults && session?.status === 'closed' ? (
          <ResultsView
            votes={votes}
            ideas={ideas}
            onPromote={handlePromote}
            onDismiss={dismissResults}
          />

        /* ── Normal list view ── */
        ) : (
          <>
            {/* Voting banner */}
            {session?.status === 'open' && (
              <VotingBanner
                session={session}
                votes={votes}
                onCopyLink={handleCopyLink}
                onClose={handleCloseVote}
                onToggleParticipants={() => setShowParticipants(p => !p)}
                showParticipants={showParticipants}
                copied={copied}
              />
            )}

            {/* Participant list */}
            {showParticipants && session?.status === 'open' && (
              <ParticipantPanel votes={votes} onRefresh={refreshVotes} />
            )}

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 15, color: '#BBBBBB', pointerEvents: 'none',
              }}>🔍</span>
              <input
                type="text"
                placeholder="Search ideas by title or description…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  border: '1px solid #E2E0DC', borderRadius: 8,
                  padding: '10px 36px 10px 38px', fontSize: 14,
                  fontFamily: FONT, color: '#1E1E1E', background: '#FFFFFF',
                  outline: 'none',
                }}
                onFocus={e => { e.target.style.borderColor = '#4FD0A5' }}
                onBlur={e => { e.target.style.borderColor = '#E2E0DC' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 16, color: '#AAAAAA', lineHeight: 1, padding: 2,
                  }}
                >×</button>
              )}
            </div>

            {/* Toolbar: tag filters + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveTags(new Set())}
                  style={{
                    background: activeTags.size === 0 ? '#1E1E1E' : '#FFFFFF',
                    color: activeTags.size === 0 ? '#FFFFFF' : '#555555',
                    border: `1px solid ${activeTags.size === 0 ? '#1E1E1E' : '#E2E0DC'}`,
                    borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                  }}
                >All</button>

                {usedTags.map(t => {
                  const { bg, color, border } = tagColorMap[t.id] || tagPalette(t.name)
                  const isActive = activeTags.has(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(t.id)}
                      style={{
                        background: isActive ? '#1E1E1E' : bg,
                        color: isActive ? '#FFFFFF' : color,
                        border: `1px solid ${isActive ? '#1E1E1E' : border}`,
                        borderRadius: 6, padding: '5px 14px', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}
                    >{t.name}</button>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {(!session || session.status === 'closed') && !loadingSession && (
                  <button
                    onClick={handleStartVoting}
                    disabled={startingVote}
                    style={{ ...btn('#1E1E1E', '#FFFFFF'), opacity: startingVote ? 0.6 : 1 }}
                  >
                    {startingVote ? 'Starting…' : '🗳 Start voting'}
                  </button>
                )}
                <button onClick={() => setShowCreate(true)} style={btn('#4FD0A5', '#1E1E1E')}>+ New Idea</button>
              </div>
            </div>

            {/* Count */}
            <p style={{ fontSize: 13, color: '#AAAAAA', margin: '0 0 20px 0' }}>
              {loading ? 'Loading…' : filtered.length === 0
                ? (searchQuery.trim() || activeTags.size > 0 ? 'No ideas match your search' : 'No ideas yet')
                : `${filtered.length} idea${filtered.length !== 1 ? 's' : ''}`
              }
            </p>

            {/* Cards + history */}
            {!loading && (
              filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 14 }}>💡</div>
                  <p style={{ fontSize: 15, color: '#AAAAAA', margin: '0 0 24px 0' }}>
                    {searchQuery.trim() || activeTags.size > 0 ? 'No ideas match your search.' : 'No ideas yet. Add the first one.'}
                  </p>
                  {!searchQuery.trim() && activeTags.size === 0 && (
                    <button
                      onClick={() => setShowCreate(true)}
                      style={{ ...btn('#1E1E1E', '#FFFFFF'), padding: '10px 24px', fontSize: 14 }}
                    >
                      Create your first idea
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {sortedFiltered.map(idea => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onClick={() => !draggedId && setSelectedId(idea.id)}
                      dragging={draggedId === idea.id}
                      dragOver={dragOverId === idea.id && draggedId !== idea.id}
                      isDuplicate={duplicateIds.has(idea.id)}
                      onDragStart={() => handleDragStart(idea.id)}
                      onDragOver={e => handleDragOver(e, idea.id)}
                      onDrop={() => handleDrop(idea.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </div>
              )
            )}

            {/* Vote history */}
            {!loading && (
              <VoteHistoryList sessions={closedSessions} onSelect={setHistorySession} />
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateModal
          tags={tags}
          onCreateTag={createTag}
          onSave={handleSave}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
    </TagColorContext.Provider>
  )
}
