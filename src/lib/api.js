// Central API client — all calls go through the Flask backend
import { supabase } from '@/lib/supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function request(method, path, body, { authRequired = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (authRequired) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`)
  }
  return res.json()
}

// ── Epics ──────────────────────────────────────────────────────────────

export const api = {
  epics: {
    list:   ()      => request('GET',    '/api/epics'),
    upsert: (epic)  => request('POST',   '/api/epics', epic),
    delete: (id)    => request('DELETE', `/api/epics/${id}`),
  },

  // ── Ideas ───────────────────────────────────────────────────────────

  ideas: {
    list:   ()     => request('GET',    '/api/ideas'),
    upsert: (idea) => request('POST',   '/api/ideas', idea),
    delete: (id)   => request('DELETE', `/api/ideas/${id}`),
  },

  // ── Idea Tags ────────────────────────────────────────────────────────

  ideaTags: {
    list:   ()     => request('GET',  '/api/idea-tags'),
    create: (name) => request('POST', '/api/idea-tags', { name }),
  },

  // ── Idea Vote Sessions ───────────────────────────────────────────────

  ideaVoteSessions: {
    list:   ()                   => request('GET',  '/api/idea-vote-sessions'),
    create: ()                   => request('POST', '/api/idea-vote-sessions'),
    get:    (id)                 => request('GET',  `/api/idea-vote-sessions/${id}`, undefined, { authRequired: false }),
    close:  (id)                 => request('POST', `/api/idea-vote-sessions/${id}/close`),
    vote:   (id, email, ideaIds) => request('POST', `/api/idea-vote-sessions/${id}/vote`, { email, ideaIds }, { authRequired: false }),
  },

  promoteIdeas: (ideaIds) => request('POST', '/api/promote-ideas', { ideaIds }),

  // ── Sessions ────────────────────────────────────────────────────────

  sessions: {
    list:           ()          => request('GET',    '/api/sessions'),
    create:         (data)      => request('POST',   '/api/sessions', data),
    get:            (id)        => request('GET',    `/api/sessions/${id}`),
    delete:         (id)        => request('DELETE', `/api/sessions/${id}`),
    close:          (id)        => request('POST',   `/api/sessions/${id}/close`),
    revote:         (id)        => request('POST',   `/api/sessions/${id}/revote`),
    addParticipant: (id, email) => request('POST',   `/api/sessions/${id}/add-participant`, { email }),
  },

  // ── Votes ────────────────────────────────────────────────────────────

  votes: {
    submit: (data) => request('POST', '/api/votes', data),
  },

  // ── AI ───────────────────────────────────────────────────────────────

  ai: {
    generateEpic:  (title, context) => request('POST', '/api/ai/generate-epic',  { title, context }),
    suggestWsjf:   (epic)           => request('POST', '/api/ai/suggest-wsjf',   { epic }),
  },
}
