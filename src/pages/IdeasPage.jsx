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
    cursor: 'pointer', fontFamily: FONT, transition: 'opacity 0.15s',
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

  return { ideas, loading, upsert, remove }
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
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tag, setTag] = useState(null)
  const [saving, setSaving] = useState(false)

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
  const [idea, setIdea] = useState(initial)
  const [tag, setTag] = useState(initial.idea_tags || null)
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
              <button onClick={handleSave} disabled={saving} style={btn('#4FD0A5', '#1E1E1E')}>{saving ? 'Saving…' : 'Save'}</button>
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
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px',
              padding: '14px 18px', fontSize: 14, lineHeight: 1.7,
              color: '#1E1E1E', resize: 'vertical', fontFamily: FONT,
              outline: 'none', background: '#FFFFFF',
            }}
          />
        ) : (
          <div style={{
            border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px',
            padding: '14px 18px', minHeight: 140, fontSize: 14, lineHeight: 1.75,
            color: idea.description ? '#1E1E1E' : '#CCCCCC',
            fontStyle: idea.description ? 'normal' : 'italic',
            whiteSpace: 'pre-wrap', background: '#FFFFFF',
          }}>
            {idea.description || 'No description yet. Click Edit to add one.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ideas Page ─────────────────────────────────────────────────────────

export default function IdeasPage() {
  const { ideas, loading, upsert, remove } = useIdeas()
  const { tags, createTag } = useTags()
  const [activeTag, setActiveTag] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = ideas.find(i => i.id === selectedId) || null

  // Tags that are actually used by at least one idea
  const usedTagIds = [...new Set(ideas.map(i => i.tag_id).filter(Boolean))]
  const usedTags = tags.filter(t => usedTagIds.includes(t.id))

  const filtered = activeTag ? ideas.filter(i => i.tag_id === activeTag) : ideas

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

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, fontFamily: FONT }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 32px' }}>

        <h1 style={{ fontSize: 30, fontWeight: 400, color: '#1E1E1E', margin: '0 0 28px 0', letterSpacing: '-0.5px' }}>Ideas</h1>

        {selected ? (
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
        ) : (
          <>
            {/* Toolbar: tag filters + new button */}
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

              <button onClick={() => setShowCreate(true)} style={btn('#4FD0A5', '#1E1E1E')}>+ New Idea</button>
            </div>

            {/* Count */}
            <p style={{ fontSize: 13, color: '#AAAAAA', margin: '0 0 20px 0' }}>
              {loading ? 'Loading…' : filtered.length === 0 ? (activeTag ? 'No ideas with this tag' : 'No ideas yet') : `${filtered.length} idea${filtered.length !== 1 ? 's' : ''}`}
            </p>

            {/* Card list */}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filtered.map(idea => (
                    <IdeaCard key={idea.id} idea={idea} onClick={() => setSelectedId(idea.id)} />
                  ))}
                </div>
              )
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
