import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function NotificationBell() {
  const { notifications, jobs, assignments, markContacted } = useContractData()
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [contactingId, setContactingId] = useState(null)
  const [contactNotes, setContactNotes] = useState('')

  const today = formatDate(new Date())

  const jobMap = useMemo(() => {
    const m = {}
    jobs.forEach(j => { m[String(j.job_id)] = j })
    return m
  }, [jobs])

  const dueNotifications = useMemo(() => {
    return notifications
      .filter(n => !n.contacted && n.notify_date && n.notify_date <= today)
      .map(n => {
        const job = jobMap[String(n.job_id)]
        const asg = assignments.find(a => a.job_id === n.job_id && (a.phase || 'main') === 'main')
        return { ...n, job, assignment: asg }
      })
      .sort((a, b) => (a.notify_date || '').localeCompare(b.notify_date || ''))
  }, [notifications, today, jobMap, assignments])

  const dueCount = dueNotifications.length

  async function handleContact(method) {
    if (!contactingId) return
    await markContacted(contactingId, method, user?.name || '', contactNotes)
    setContactingId(null)
    setContactNotes('')
  }

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          position: 'relative', background: 'var(--apple-bg)', border: 'none',
          borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'var(--apple-transition)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#e5e5ea'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {dueCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: 'var(--apple-red)', color: 'white',
            fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
          }}>
            {dueCount}
          </span>
        )}
      </button>

      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
            background: 'white', zIndex: 51, boxShadow: '-8px 0 40px rgba(0,0,0,0.1)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--apple-separator)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--apple-text)' }}>
                Action Required {dueCount > 0 && <span style={{ color: 'var(--apple-red)' }}>({dueCount})</span>}
              </h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <ViewAllButton onClick={() => { setDrawerOpen(false) }} />
                <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--apple-secondary)', padding: 0 }}>x</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
              {dueNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--apple-tertiary)' }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</p>
                  <p style={{ fontSize: 14 }}>All caught up! No contacts due.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {dueNotifications.map(n => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      onContact={() => setContactingId(n.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {contactingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 16 }}>How did you contact them?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'called', label: 'Called', icon: '&#9742;' },
                { key: 'voicemail', label: 'Left Voicemail', icon: '&#128172;' },
                { key: 'text', label: 'Sent Text', icon: '&#9993;' },
                { key: 'no_answer', label: 'No Answer', icon: '&#10060;' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleContact(opt.key)}
                  style={{
                    background: 'var(--apple-bg)', border: '1px solid var(--apple-separator)',
                    borderRadius: 10, padding: '12px 8px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, color: 'var(--apple-text)',
                    transition: 'var(--apple-transition)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e8f4fd'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--apple-bg)'}
                >
                  <span dangerouslySetInnerHTML={{ __html: opt.icon }} style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />
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
              style={{ width: '100%', background: 'var(--apple-bg)', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--apple-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function ViewAllButton({ onClick }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => { onClick(); navigate('/notifications') }}
      style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--apple-blue)', cursor: 'pointer', padding: 0 }}
    >
      View All
    </button>
  )
}

function NotificationCard({ notification: n, onContact }) {
  const phone = n.job?.phone || ''
  const telHref = phone ? `tel:${formatPhone(phone)}` : null
  const isOverdue = n.notify_date < formatDate(new Date())
  const methodLabel = n.notify_type === 'call' ? 'Call' : 'Text'

  return (
    <div style={{
      background: isOverdue ? '#fff0f0' : '#fff8f0',
      border: `1px solid ${isOverdue ? '#f5c6cb' : '#ffeeba'}`,
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: isOverdue ? '#f8d7da' : '#fff3cd',
          color: isOverdue ? '#721c24' : '#856404',
        }}>
          {methodLabel} {isOverdue ? 'overdue' : 'today'}
        </span>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)', marginBottom: 2 }}>
        {n.job?.owner || 'Unknown Owner'}
      </p>
      {telHref ? (
        <a href={telHref} style={{ fontSize: 16, fontWeight: 600, color: 'var(--apple-blue)', textDecoration: 'none', display: 'block', marginBottom: 4 }}>
          {phone}
        </a>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', marginBottom: 4 }}>No phone number</p>
      )}
      <p style={{ fontSize: 12, color: 'var(--apple-secondary)', marginBottom: 2 }}>
        {n.job?.full_address || ''}
      </p>
      {n.assignment && (
        <p style={{ fontSize: 11, color: 'var(--apple-tertiary)' }}>
          Crew: {n.assignment.crew_name} on {n.assignment.planned_date}
        </p>
      )}
      <button
        onClick={onContact}
        style={{
          marginTop: 8, width: '100%', background: 'var(--apple-green)', color: 'white',
          border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'var(--apple-transition)',
        }}
      >
        Mark Contacted
      </button>
    </div>
  )
}
