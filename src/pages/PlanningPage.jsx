import { useAuth } from '@/contexts/AuthContext'

export default function PlanningPage() {
  const { user } = useAuth()

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

  return (
    <div className="min-h-screen bg-[#F8F7F6]">
      {/* Header */}
      <div className="bg-[#1E1E1E] border-b border-[#383838]">
        <div className="max-w-[1100px] mx-auto px-16 py-12">
          <div className="inline-flex items-center gap-2 mb-6">
            <span
              className="text-[11px] font-medium tracking-[0.12em] uppercase px-3 py-1 rounded"
              style={{
                color: '#90E9B8',
                background: 'rgba(144,233,184,0.12)',
                border: '1px solid rgba(144,233,184,0.3)',
              }}
            >
              Internal
            </span>
          </div>
          <h1
            className="text-white mb-4"
            style={{ fontSize: '42px', fontWeight: 400, letterSpacing: '-1.26px', lineHeight: 1.15 }}
          >
            Planning
          </h1>
          <p className="text-[rgba(255,255,255,0.6)] text-[15px] leading-[1.7]">
            Welcome, {displayName}. Internal planning tools and resources for the viax team.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1100px] mx-auto px-16 py-[80px]">
        {/* Placeholder cards */}
        <div className="grid grid-cols-3 gap-6">
          {[
            {
              icon: '◎',
              title: 'Sprint Planning',
              body: 'Manage upcoming sprints, assign work items, and track delivery commitments.',
            },
            {
              icon: '↗',
              title: 'Roadmap Editing',
              body: 'Update work item statuses, add new cards, and manage pillar priorities.',
            },
            {
              icon: '⇄',
              title: 'Team Sync',
              body: 'Coordinate across pillars, surface dependencies, and align on delivery timelines.',
            },
          ].map(({ icon, title, body }) => (
            <div
              key={title}
              className="bg-[#FEFEFE] rounded-lg p-7"
              style={{ border: '1px solid #E2E0DC' }}
            >
              <div
                className="text-xl mb-4"
                style={{ color: '#5ED49A' }}
              >
                {icon}
              </div>
              <h3
                className="text-[#1E1E1E] mb-2"
                style={{ fontSize: '17px', fontWeight: 500 }}
              >
                {title}
              </h3>
              <p className="text-[#555555] text-[14px] leading-[1.7]">{body}</p>
              <div
                className="mt-6 text-[13px] font-medium"
                style={{ color: '#8A8A8A' }}
              >
                Coming soon →
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
