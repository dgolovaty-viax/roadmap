// Central API client — all calls go through the Flask backend

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
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

  // ── Sessions ────────────────────────────────────────────────────────

  sessions: {
    list:   ()           => request('GET',  '/api/sessions'),
    create: (data)       => request('POST', '/api/sessions', data),
    get:    (id)         => request('GET',  `/api/sessions/${id}`),
    delete: (id)         => request('DELETE', `/api/sessions/${id}`),
    close:          (id)         => request('POST', `/api/sessions/${id}/close`),
    revote:         (id)         => request('POST', `/api/sessions/${id}/revote`),
    addParticipant: (id, email)  => request('POST', `/api/sessions/${id}/add-participant`, { email }),
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

