import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// ── Shared constants ───────────────────────────────────────────────────

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

const TAG_PALETTE = [
  { bg: '#E8F9F3', color: '#1a7a5e', border: '#4FD0A5' },
  { bg: '#E8F0FE', color: '#1a56db', border: '#93C5FD' },
  { bg: '#FFF8E6', color: '#996600', border: '#FFD966' },
  { bg: '#F3F0FF', color: '#5B21B6', border: '#C4B5FD' },
  { bg: '#FFF0F6', color: '#9D174D', border: '#FBCFE8' },
  { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
]

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

// ── TagBadge ───────────────────────────────────────────────────────────

function TagBadge({ name }) {
  if (!name) return null
  const { bg, color, border } = tagPalette(name)
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
      padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

// ── TagSelector ────────────────────────────────────────────────────────

function TagSelector({ value, tags, onSelect, onCreateAndSelect, dark }) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const field = dark ? darkField : lightField

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const tag = await onCreateAndSelect(name)
    onSelect(tag)
    setNewName('')
    setShowNew(false)
  }

  if (showNew) {
    return (
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
    )
  }

  return (
    <select
      value={value || ''}
      onChange={e => {
        if (e.target.value === '__new__') { setShowNew(true); return }
        const tag = tags.find(t => t.id === e.target.value)
        onSelect(tag || null)
      }}
      style={{ ...field, background: dark ? '#2A2A2A' : '#FFFFFF' }}
    >
      <option value="">No tag</option>
      {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      <option value="__new__">+ Create new tag…</option>
    </select>
  )
}

// ── Data hooks ─────────────────────────────────────────────────────────

function useIdeas() {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.ideas.list()
      setIdeas(data || [])
    } catch (e) {
      console.error('Failed to load ideas', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = async (idea) => {
    const saved = await api.ideas.upsert(idea)
    setIdeas(prev => {
      const idx = prev.findIndex(i => i.id === saved.id)
      return idx >= 0 ? prev.map(i => i.id === saved.id ? saved : i) : [saved, ...prev]
    })
    return saved
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
        if (latest.status === 'closed') setShowResults(true)
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
            const tagName = idea.idea_tags?.name
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1E1E1E' }}>{idea.title}</span>
                    {tagName && <TagBadge name={tagName} />}
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

function IdeaCard({ idea, onClick }) {
  const [hovered, setHovered] = useState(false)
  const tagName = idea.idea_tags?.name
  const preview = (idea.description || '').trim().slice(0, 140)

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: preview ? 8 : 0 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E1E1E', margin: 0, lineHeight: 1.4 }}>
          {idea.title || <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>Untitled Idea</span>}
        </h3>
        {tagName && <TagBadge name={tagName} />}
      </div>

      {preview && (
        <p style={{ fontSize: 13, color: '#888888', margin: '8px 0 14px 0', lineHeight: 1.65 }}>
          {preview}{(idea.description || '').length > 140 ? '…' : ''}
        </p>
      )}

      <div style={{ fontSize: 12, color: '#CCCCCC', marginTop: preview ? 0 : 12 }}>
        {new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
    </div>
  )
}

// ── CreateModal ────────────────────────────────────────────────────────

function CreateModal({ tags, onCreateTag, onSave, onClose }) {
  const [title, setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [tag, setTag]           = useState(null)
  const [saving, setSaving]     = useState(false)

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ id: crypto.randomUUID(), title: title.trim(), description, tagId: tag?.id || null })
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
          <label style={fieldLabel}>Tag</label>
          <TagSelector
            value={tag?.id || ''}
            tags={tags}
            onSelect={setTag}
            onCreateAndSelect={onCreateTag}
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

function IdeaDetail({ initial, tags, saving, onCreateTag, onSave, onDelete, onBack }) {
  const [idea, setIdea]     = useState(initial)
  const [tag, setTag]       = useState(initial.idea_tags || null)
  const [editing, setEditing] = useState(false)

  const handleSave = async () => {
    await onSave({ ...idea, tagId: tag?.id || null })
    setEditing(false)
  }

  const handleCancel = () => {
    setIdea(initial)
    setTag(initial.idea_tags || null)
    setEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('Delete this idea? This cannot be undone.')) onDelete(idea.id)
  }

  const tagName = tag?.name

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
              <label style={darkFieldLabel}>Tag</label>
              <TagSelector
                value={tag?.id || ''}
                tags={tags}
                onSelect={setTag}
                onCreateAndSelect={onCreateTag}
                dark={true}
              />
            </div>
          </>
        ) : (
          <>
            <h2 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 600, margin: '0 0 14px 0', lineHeight: 1.3 }}>
              {idea.title || <span style={{ color: '#555555', fontStyle: 'italic' }}>Untitled Idea</span>}
            </h2>
            {tagName
              ? <TagBadge name={tagName} />
              : <span style={{ fontSize: 12, color: '#555555', fontStyle: 'italic' }}>No tag</span>
            }
          </>
        )}
      </div>

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

  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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
              {/* Date */}
              <div style={{ flexShrink: 0, minWidth: 100 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E1E1E' }}>{fmt(s.closed_at || s.created_at)}</div>
                <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{voters} voter{voters !== 1 ? 's' : ''}</div>
              </div>

              {/* Top idea preview */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {topIdea ? (
                  <span style={{ fontSize: 13, color: '#555555' }}>
                    Top: <span style={{ fontWeight: 600, color: '#1E1E1E' }}>{topIdea.title}</span>
                    <span style={{ color: '#AAAAAA' }}> · {topIdea.vote_count} vote{topIdea.vote_count !== 1 ? 's' : ''}</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: '#AAAAAA', fontStyle: 'italic' }}>No votes cast</span>
                )}
              </div>

              {/* Promoted badge */}
              {promoted > 0 && (
                <span style={{
                  background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5',
                  borderRadius: 5, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                  flexShrink: 0,
                }}>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.ideaVoteSessions.get(session.id)
      .then(({ votes: v }) => setVotes(v || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session.id])

  const snap = session.result_snapshot || {}
  const ideas = snap.ideas || []
  const promoted = new Set(session.promoted_idea_ids || [])
  const rankColors = ['#4FD0A5', '#93C5FD', '#FFD966', '#AAAAAA', '#AAAAAA']
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Build a title lookup from snapshot for voter breakdown
  const ideaTitleById = {}
  ideas.forEach(i => { ideaTitleById[i.id] = i.title })

  return (
    <div>
      {/* Back */}
      <button
        onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT, marginBottom: 28 }}
      >
        ← Vote History
      </button>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1E1E1E', margin: '0 0 6px 0' }}>
          Session — {fmt(session.closed_at || session.created_at)}
        </h2>
        <p style={{ fontSize: 13, color: '#888888', margin: 0 }}>
          {snap.total_voters ?? votes.length} participant{(snap.total_voters ?? votes.length) !== 1 ? 's' : ''}
          {promoted.size > 0 ? ` · ${promoted.size} idea${promoted.size !== 1 ? 's' : ''} promoted to Planning` : ''}
        </p>
      </div>

      {/* Results */}
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
                  {/* Rank */}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: rankColors[i] || '#E2E0DC',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#1E1E1E',
                  }}>{i + 1}</div>

                  {/* Title + tag */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#1E1E1E' }}>{idea.title}</span>
                      {idea.tag_name && <TagBadge name={idea.tag_name} />}
                      {wasPromoted && (
                        <span style={{
                          background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5',
                          borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                        }}>MOVED TO PLANNING</span>
                      )}
                    </div>
                  </div>

                  {/* Vote count */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#4FD0A5', lineHeight: 1 }}>{idea.vote_count}</div>
                    <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>vote{idea.vote_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Voter breakdown */}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>
            Who voted for what
          </h3>
          {loading ? (
            <p style={{ fontSize: 13, color: '#AAAAAA' }}>Loading…</p>
          ) : votes.length === 0 ? (
            <p style={{ fontSize: 13, color: '#AAAAAA' }}>No votes recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {votes.map(v => {
                const votedTitles = (v.idea_ids || []).map(id => ideaTitleById[id] || id)
                return (
                  <div key={v.id} style={{
                    background: '#FFFFFF', border: '1px solid #E2E0DC',
                    borderRadius: 8, padding: '14px 18px',
                    display: 'flex', alignItems: 'flex-start', gap: 16,
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: '#F3F3F3', border: '1px solid #E2E0DC',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#888888',
                    }}>
                      {(v.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E1E1E', marginBottom: 8 }}>{v.email}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {votedTitles.map((title, idx) => (
                          <span key={idx} style={{
                            background: '#F8F7F6', border: '1px solid #E2E0DC',
                            borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#555555',
                          }}>
                            👍 {title}
                          </span>
                        ))}
                        {votedTitles.length === 0 && (
                          <span style={{ fontSize: 12, color: '#AAAAAA', fontStyle: 'italic' }}>No selections</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#AAAAAA', flexShrink: 0 }}>
                      {votedTitles.length}/5
                    </div>
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

  const [activeTag, setActiveTag]           = useState(null)
  const [selectedId, setSelectedId]         = useState(null)
  const [showCreate, setShowCreate]         = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [copied, setCopied]                 = useState(false)
  const [startingVote, setStartingVote]     = useState(false)

  // History
  const [closedSessions, setClosedSessions] = useState([])
  const [historySession, setHistorySession] = useState(null)

  useEffect(() => {
    api.ideaVoteSessions.list()
      .then(all => setClosedSessions((all || []).filter(s => s.status === 'closed')))
      .catch(() => {})
  }, [showResults]) // re-fetch when results are dismissed (session just closed)

  const selected = ideas.find(i => i.id === selectedId) || null

  const usedTagIds = [...new Set(ideas.map(i => i.tag_id).filter(Boolean))]
  const usedTags   = tags.filter(t => usedTagIds.includes(t.id))
  const filtered   = activeTag ? ideas.filter(i => i.tag_id === activeTag) : ideas

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

  return (
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

            {/* Toolbar: tag filters + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setActiveTag(null)}
                  style={{
                    background: activeTag === null ? '#1E1E1E' : '#FFFFFF',
                    color: activeTag === null ? '#FFFFFF' : '#555555',
                    border: `1px solid ${activeTag === null ? '#1E1E1E' : '#E2E0DC'}`,
                    borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s',
                  }}
                >All</button>

                {usedTags.map(t => {
                  const { bg, color, border } = tagPalette(t.name)
                  const isActive = activeTag === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTag(isActive ? null : t.id)}
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
                {!session && !loadingSession && (
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
                ? (activeTag ? 'No ideas with this tag' : 'No ideas yet')
                : `${filtered.length} idea${filtered.length !== 1 ? 's' : ''}`
              }
            </p>

            {/* Cards */}
            {!loading && (
              filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                  <div style={{ fontSize: 36, marginBottom: 14 }}>💡</div>
                  <p style={{ fontSize: 15, color: '#AAAAAA', margin: '0 0 24px 0' }}>
                    {activeTag ? 'No ideas with this tag.' : 'No ideas yet. Add the first one.'}
                  </p>
                  {!activeTag && (
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
                  {filtered.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onClick={() => setSelectedId(idea.id)} />
                  ))}
                </div>
              )
            )}

            {/* Vote history */}
            {!loading && (
              <VoteHistoryList
                sessions={closedSessions}
                onSelect={setHistorySession}
              />
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
  )
}
