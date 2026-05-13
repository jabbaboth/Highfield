import { useState, useMemo } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'

function formatDate(d) { return d.toISOString().split('T')[0] }

function formatPhone(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('64')) return `+${digits}`
  if (digits.startsWith('0')) return `+64${digits.slice(1)}`
  return phone
}

function Section({ title, subtitle, count, color, children }) {
  return (
    <section style={{ background: 'white', borderRadius: 'var(--apple-radius-lg)', boxShadow: 'var(--apple-shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--apple-separator)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--apple-secondary)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        {count > 0 && (
          <span style={{
            background: color || 'var(--apple-red)', color: 'white',
            fontSize: 12, fontWeight: 700, minWidth: 24, height: 24,
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 8px',
          }}>
            {count}
          </span>
        )}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  )
}

export default function Notifications() {
  const { notifications, jobs, assignments, markContacted, loading } = useContractData()
  const { user } = useAuth()
  const [contactingId, setContactingId] = useState(null)
  const [contactNotes, setContactNotes] = useState('')

  const today = formatDate(new Date())
  const in7days = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return formatDate(d)
  }, [])

  const jobMap = useMemo(() => {
    const m = {}
    jobs.forEach(j => { m[String(j.job_id)] = j })
    return m
  }, [jobs])

  const enriched = useMemo(() => {
    return notifications.map(n => {
      const job = jobMap[String(n.job_id)]
      const asg = assignments.find(a => a.job_id === n.job_id && (a.phase || 'main') === 'main')
      return { ...n, job, assignment: asg }
    })
  }, [notifications, jobMap, assignments])

  const actionToday = useMemo(() =>
    enriched.filter(n => !n.contacted && n.notify_date && n.notify_date <= today)
      .sort((a, b) => (a.notify_date || '').localeCompare(b.notify_date || '')),
    [enriched, today]
  )

  const upcoming = useMemo(() =>
    enriched.filter(n => !n.contacted && n.notify_date && n.notify_date > today && n.notify_date <= in7days)
      .sort((a, b) => (a.notify_date || '').localeCompare(b.notify_date || '')),
    [enriched, today, in7days]
  )

  const allPending = useMemo(() =>
    enriched.filter(n => !n.contacted && n.notify_date && n.notify_date > in7days)
      .sort((a, b) => (a.notify_date || '').localeCompare(b.notify_date || '')),
    [enriched, in7days]
  )

  const recentlyDone = useMemo(() =>
    enriched.filter(n => n.contacted)
      .sort((a, b) => (b.contacted_at || '').localeCompare(a.contacted_at || ''))
      .slice(0, 20),
    [enriched]
  )

  async function handleContact(method) {
    if (!contactingId) return
    await markContacted(contactingId, method, user?.name || '', contactNotes)
    setContactingId(null)
    setContactNotes('')
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--apple-secondary)' }}>Loading...</div>

  return (
    <div style={{ padding: 16, maxWidth: 800, margin: '0 auto' }} className="space-y-5">
      {/* Action Required Today */}
      <Section title="Action Required Today" subtitle="Contact these homeowners now" count={actionToday.length} color="var(--apple-red)">
        {actionToday.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--apple-tertiary)' }}>
            <p style={{ fontSize: 14 }}>All caught up! No contacts due today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionToday.map(n => (
              <NotifCard key={n.id} n={n} urgent onContact={() => setContactingId(n.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* Upcoming 7 Days */}
      <Section title="Upcoming" subtitle="Due in the next 7 days" count={upcoming.length} color="var(--apple-orange)">
        {upcoming.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 16, color: 'var(--apple-tertiary)', fontSize: 13 }}>Nothing upcoming</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(n => (
              <NotifCard key={n.id} n={n} onContact={() => setContactingId(n.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* All Pending */}
      {allPending.length > 0 && (
        <Section title="All Pending" subtitle="Further out" count={allPending.length} color="var(--apple-blue)">
          <div className="space-y-3">
            {allPending.map(n => (
              <NotifCard key={n.id} n={n} onContact={() => setContactingId(n.id)} />
            ))}
          </div>
        </Section>
      )}

      {/* Recently Done */}
      {recentlyDone.length > 0 && (
        <Section title="Recently Contacted" subtitle="Last 20 completed">
          <div className="space-y-2">
            {recentlyDone.map(n => (
              <div key={n.id} style={{ padding: '10px 14px', background: '#f0fff4', borderRadius: 10, borderLeft: '3px solid var(--apple-green)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--apple-text)' }}>{n.job?.owner || 'Unknown'}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--apple-secondary)' }}>{n.job?.full_address || ''}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, color: 'var(--apple-green)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {(n.contact_method || '').replace('_', ' ')}
                    </span>
                    <p style={{ fontSize: 10, color: 'var(--apple-tertiary)' }}>
                      {n.contacted_by} {n.contacted_at ? new Date(n.contacted_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Contact Modal */}
      {contactingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 16 }}>How did you contact them?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'called', label: 'Called' },
                { key: 'voicemail', label: 'Left Voicemail' },
                { key: 'text', label: 'Sent Text' },
                { key: 'no_answer', label: 'No Answer' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleContact(opt.key)}
                  style={{
                    background: 'var(--apple-bg)', border: '1px solid var(--apple-separator)',
                    borderRadius: 10, padding: '14px 8px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, color: 'var(--apple-text)',
                    transition: 'var(--apple-transition)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e8f4fd'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              value={contactNotes}
              onChange={e => setContactNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <button
              onClick={() => { setContactingId(null); setContactNotes('') }}
              style={{
                width: '100%', background: 'var(--apple-bg)', border: 'none', borderRadius: 8,
                padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                color: 'var(--apple-secondary)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotifCard({ n, urgent, onContact }) {
  const phone = n.job?.phone || ''
  const telHref = phone ? `tel:${formatPhone(phone)}` : null
  const methodLabel = n.notify_type === 'call' ? 'Call' : 'Text'
  const today = formatDate(new Date())
  const isOverdue = n.notify_date < today

  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: urgent ? (isOverdue ? '#fff0f0' : '#fff8f0') : 'var(--apple-bg)',
      border: urgent ? `1px solid ${isOverdue ? '#f5c6cb' : '#ffeeba'}` : '1px solid var(--apple-separator)',
    }}>
      <div className="flex items-start justify-between" style={{ marginBottom: 6 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: urgent ? (isOverdue ? '#f8d7da' : '#fff3cd') : '#e8f4fd',
          color: urgent ? (isOverdue ? '#721c24' : '#856404') : '#0071e3',
        }}>
          {methodLabel} {isOverdue ? '- OVERDUE' : urgent ? '- today' : `due ${n.notify_date}`}
        </span>
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 2 }}>
        {n.job?.owner || 'Unknown Owner'}
      </p>

      {telHref ? (
        <a href={telHref} style={{
          fontSize: 17, fontWeight: 600, color: 'var(--apple-blue)', textDecoration: 'none',
          display: 'inline-block', marginBottom: 4, padding: '2px 0',
        }}>
          {phone}
        </a>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', marginBottom: 4 }}>No phone number</p>
      )}

      <p style={{ fontSize: 13, color: 'var(--apple-secondary)', marginBottom: 2 }}>{n.job?.full_address || ''}</p>

      {n.assignment && (
        <p style={{ fontSize: 12, color: 'var(--apple-tertiary)' }}>
          Crew: <strong>{n.assignment.crew_name}</strong> on {n.assignment.planned_date}
        </p>
      )}

      {(n.job?.comments || n.job?.additional) && (
        <p style={{ fontSize: 11, color: 'var(--apple-tertiary)', marginTop: 4, fontStyle: 'italic' }}>
          {[n.job.comments, n.job.additional].filter(Boolean).join(' | ')}
        </p>
      )}

      <button
        onClick={onContact}
        style={{
          marginTop: 10, width: '100%', background: 'var(--apple-green)', color: 'white',
          border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', transition: 'var(--apple-transition)',
        }}
      >
        Mark Contacted
      </button>
    </div>
  )
}
