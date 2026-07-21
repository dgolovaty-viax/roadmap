import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'

// ── Shared style constants (mirrors IdeasPage) ─────────────────────────

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

// Rank circle colours — top priority is teal, then blue, amber, grey…
const RANK_COLORS = ['#4FD0A5', '#93C5FD', '#FFD966', '#9F9FAA']

function rankColor(i) {
  return RANK_COLORS[i] || '#9F9FAA'
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

function Card({ card, rank, dragging, onClick, onDragStart, onDragEnd, onDragOver }) {
  const [hovered, setHovered] = useState(false)
  const preview = (card.description || '').trim().slice(0, 120)

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
      </div>
    </div>
  )
}

// ── Card edit / create modal ───────────────────────────────────────────

function CardModal({ initial, onSave, onDelete, onClose }) {
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

        <div style={{ marginBottom: 28 }}>
          <label style={fieldLabel}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional detail…"
            rows={4}
            style={{ ...lightField, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

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
          onSave={patch => saveCard(editCard, patch)}
          onDelete={() => deleteCard(editCard)}
          onClose={() => setEditCard(null)}
        />
      )}
    </div>
  )
}
