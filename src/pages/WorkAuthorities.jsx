import { useState, useMemo, useRef } from 'react'
import { useContractData } from '../lib/useContractData'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { FEEDERS, feederStyle } from '../lib/feeder'

const WA_COLORS = ['#2E86AB', '#A23B72', '#F18F01', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#3498db', '#34495e']

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })
}

function getWeekDays(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const days = []
  for (let i = 0; i < 5; i++) {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    days.push(formatDate(dd))
  }
  return days
}

function Section({ title, subtitle, children, right }) {
  return (
    <section style={{ background: 'white', borderRadius: 'var(--apple-radius-lg)', boxShadow: 'var(--apple-shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--apple-separator)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--apple-text)' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--apple-secondary)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  )
}

export default function WorkAuthorities() {
  const { jobs, workAuthorities, addWorkAuthority, removeWorkAuthority } = useContractData()
  const { contractId, contracts, user, fetchContracts } = useAuth()
  const role = user?.role || 'crew'
  const canEdit = role === 'admin' || role === 'foreman'
  const [weekDate, setWeekDate] = useState(() => formatDate(new Date()))
  const fileRef = useRef()
  const mapRef = useRef()

  const [waNumber, setWaNumber] = useState('')
  const [waFeeder, setWaFeeder] = useState('')
  const [waColor, setWaColor] = useState(WA_COLORS[0])
  const [waDates, setWaDates] = useState([])
  const [waDateInput, setWaDateInput] = useState('')
  const [waNotes, setWaNotes] = useState('')
  const [waFile, setWaFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [uploadingMap, setUploadingMap] = useState(false)

  const contract = contracts.find(c => c.id === contractId)
  const mapPdfPath = contract?.map_pdf_path

  const uniqueFeeders = useMemo(() => {
    const fromJobs = [...new Set(jobs.map(j => String(j.feeder)).filter(Boolean))]
    const all = [...new Set([...FEEDERS, ...fromJobs])]
    return all.sort()
  }, [jobs])

  const weekDays = useMemo(() => getWeekDays(weekDate), [weekDate])

  const coverage = useMemo(() => {
    const map = {}
    uniqueFeeders.forEach(f => { map[f] = {} })
    workAuthorities.forEach(wa => {
      if (!map[wa.feeder]) map[wa.feeder] = {}
      ;(wa.dates || []).forEach(d => {
        if (!map[wa.feeder][d]) map[wa.feeder][d] = []
        map[wa.feeder][d].push(wa)
      })
    })
    return map
  }, [workAuthorities, uniqueFeeders])

  function prevWeek() {
    const d = new Date(weekDate + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    setWeekDate(formatDate(d))
  }
  function nextWeek() {
    const d = new Date(weekDate + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    setWeekDate(formatDate(d))
  }
  function goToday() { setWeekDate(formatDate(new Date())) }

  function addDate() {
    if (!waDateInput || waDates.includes(waDateInput)) return
    setWaDates([...waDates, waDateInput].sort())
    setWaDateInput('')
  }

  function addWeekDates() {
    const baseDate = waDateInput || formatDate(new Date())
    const week = getWeekDays(baseDate)
    setWaDates([...new Set([...waDates, ...week])].sort())
  }

  function removeDate(d) {
    setWaDates(waDates.filter(x => x !== d))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!waNumber.trim() || !waFeeder || waDates.length === 0 || submitting) return
    setSubmitting(true)

    let pdfPath = null
    if (waFile) {
      const fileName = `${contractId}/${Date.now()}_${waFile.name}`
      const { error: uploadErr } = await supabase.storage.from('work-authorities').upload(fileName, waFile)
      if (uploadErr) console.error('PDF upload:', uploadErr)
      else pdfPath = fileName
    }

    await addWorkAuthority(waNumber.trim(), waFeeder, waDates, pdfPath, waNotes.trim(), waColor)
    setWaNumber(''); setWaFeeder(''); setWaDates([]); setWaNotes(''); setWaFile(null); setWaColor(WA_COLORS[0])
    if (fileRef.current) fileRef.current.value = ''
    setSubmitting(false)
  }

  async function handleViewPdf(wa) {
    if (!wa.pdf_path) return
    const win = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('work-authorities').createSignedUrl(wa.pdf_path, 3600)
    if (error || !data?.signedUrl) {
      if (win) win.close()
      console.error('PDF download:', error)
      return
    }
    win.location.href = data.signedUrl
  }

  async function handleRemove(id) {
    await removeWorkAuthority(id)
    setConfirmRemove(null)
  }

  async function handleMapUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMap(true)
    const fileName = `${contractId}/map_${Date.now()}_${file.name}`
    const { error: uploadErr } = await supabase.storage.from('work-authorities').upload(fileName, file)
    if (uploadErr) { console.error('Map upload:', uploadErr); setUploadingMap(false); return }
    await supabase.from('contracts').update({ map_pdf_path: fileName }).eq('id', contractId)
    setUploadingMap(false)
    if (mapRef.current) mapRef.current.value = ''
    await fetchContracts()
  }

  async function handleViewMap() {
    if (!mapPdfPath) return
    const win = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('work-authorities').createSignedUrl(mapPdfPath, 3600)
    if (error || !data?.signedUrl) {
      if (win) win.close()
      console.error('Map download:', error)
      return
    }
    win.location.href = data.signedUrl
  }

  const today = formatDate(new Date())
  const btnPrimary = { background: 'var(--apple-blue)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'var(--apple-transition)' }
  const btnSecondary = { background: 'var(--apple-bg)', color: 'var(--apple-text)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
  const btnDanger = { background: '#fff0f0', color: 'var(--apple-red)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }} className="space-y-5">
      {/* Contract Map */}
      <Section
        title="Contract Map"
        subtitle={mapPdfPath ? 'Map uploaded' : 'Upload a PDF map showing work authority areas'}
        right={mapPdfPath ? (
          <button onClick={handleViewMap} style={btnPrimary}>View Map</button>
        ) : null}
      >
        {canEdit && (
          <div className="flex items-center gap-3">
            <label style={{
              display: 'inline-block', textAlign: 'center', padding: '10px 20px', borderRadius: 10,
              border: '2px dashed var(--apple-separator)', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              color: uploadingMap ? 'var(--apple-tertiary)' : 'var(--apple-blue)',
            }}>
              {uploadingMap ? 'Uploading...' : mapPdfPath ? 'Replace Map PDF' : 'Upload Map PDF'}
              <input ref={mapRef} type="file" accept=".pdf" onChange={handleMapUpload} disabled={uploadingMap} style={{ display: 'none' }} />
            </label>
          </div>
        )}
        {!canEdit && !mapPdfPath && (
          <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', textAlign: 'center' }}>No map uploaded yet</p>
        )}
      </Section>

      {/* Calendar View */}
      <Section title="WA Coverage" subtitle="Work authority coverage by feeder — Mon to Fri">
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <button onClick={prevWeek} style={{ ...btnSecondary, padding: '6px 12px' }}>&#9664; Prev</button>
          <button onClick={goToday} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>Today</button>
          <button onClick={nextWeek} style={{ ...btnSecondary, padding: '6px 12px' }}>Next &#9654;</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--apple-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--apple-separator)', width: 80 }}>
                  Feeder
                </th>
                {weekDays.map(d => (
                  <th key={d} style={{
                    textAlign: 'center', padding: '8px 6px', fontSize: 11, fontWeight: 500,
                    color: d === today ? 'var(--apple-blue)' : 'var(--apple-secondary)',
                    borderBottom: '1px solid var(--apple-separator)',
                    background: d === today ? '#e8f4fd' : 'transparent',
                  }}>
                    {formatShort(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueFeeders.map(feeder => {
                const fs = feederStyle(feeder)
                return (
                  <tr key={feeder}>
                    <td style={{ padding: '10px 10px', fontWeight: 600, borderBottom: '1px solid var(--apple-separator)' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: fs.bg, color: fs.border }}>
                        {feeder}
                      </span>
                    </td>
                    {weekDays.map(d => {
                      const was = coverage[feeder]?.[d] || []
                      const hasCoverage = was.length > 0
                      return (
                        <td key={d} style={{
                          textAlign: 'center', padding: '6px 4px',
                          borderBottom: '1px solid var(--apple-separator)',
                          background: d === today ? '#f8fbff' : 'transparent',
                        }}>
                          {hasCoverage ? (
                            <div className="flex flex-wrap justify-center gap-1">
                              {was.map(wa => {
                                const c = wa.color || '#155724'
                                return (
                                  <span key={wa.id} style={{
                                    display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                                    fontSize: 10, fontWeight: 600,
                                    background: c + '20', color: c,
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {wa.wa_number}
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--apple-tertiary)' }}>--</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {uniqueFeeders.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--apple-tertiary)' }}>No feeders found. Import jobs first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Add WA Form */}
      {canEdit && (
        <Section title="Add Work Authority" subtitle="Enter WA details and optionally attach the PDF">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 4 }}>WA Number</label>
                <input value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="e.g. WA-001" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 4 }}>Feeder</label>
                <select value={waFeeder} onChange={e => setWaFeeder(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Select feeder...</option>
                  {uniqueFeeders.map(f => (
                    <option key={f} value={f}>{feederStyle(f).label || f}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color */}
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 6 }}>Color</label>
            <div className="flex gap-2 flex-wrap" style={{ marginBottom: 16 }}>
              {WA_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setWaColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    background: c, cursor: 'pointer',
                    outline: waColor === c ? '3px solid var(--apple-blue)' : '2px solid transparent',
                    outlineOffset: 2,
                    transition: 'outline 0.15s ease',
                  }}
                />
              ))}
            </div>

            {/* Dates */}
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 4 }}>Dates</label>
            <div className="flex gap-2 flex-wrap" style={{ marginBottom: 8 }}>
              <input type="date" value={waDateInput} onChange={e => setWaDateInput(e.target.value)} />
              <button type="button" onClick={addDate} style={btnSecondary}>Add Date</button>
              <button type="button" onClick={addWeekDates} style={btnSecondary}>Add Mon-Fri</button>
            </div>
            {waDates.length > 0 && (
              <div className="flex flex-wrap gap-1" style={{ marginBottom: 12 }}>
                {waDates.map(d => (
                  <span key={d} className="flex items-center gap-1" style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: 'var(--apple-bg)', color: 'var(--apple-text)',
                  }}>
                    {formatShort(d)}
                    <button type="button" onClick={() => removeDate(d)} style={{
                      background: 'none', border: 'none', color: 'var(--apple-red)',
                      cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
                    }}>x</button>
                  </span>
                ))}
              </div>
            )}

            {/* PDF */}
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 4 }}>PDF Attachment (optional)</label>
            <input ref={fileRef} type="file" accept=".pdf" onChange={e => setWaFile(e.target.files?.[0] || null)} style={{ marginBottom: 12, fontSize: 13 }} />

            {/* Notes */}
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--apple-secondary)', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <textarea value={waNotes} onChange={e => setWaNotes(e.target.value)} rows={2} placeholder="Any additional notes..." style={{ width: '100%', marginBottom: 16 }} />

            <button type="submit" disabled={submitting || !waNumber.trim() || !waFeeder || waDates.length === 0} style={{
              ...btnPrimary, width: '100%', padding: '12px 20px',
              opacity: submitting || !waNumber.trim() || !waFeeder || waDates.length === 0 ? 0.5 : 1,
            }}>
              {submitting ? 'Saving...' : 'Add Work Authority'}
            </button>
          </form>
        </Section>
      )}

      {/* WA List */}
      <Section title="Work Authorities" subtitle={`${workAuthorities.length} total`}>
        <div className="space-y-2">
          {workAuthorities.map(wa => {
            const waCol = wa.color || '#9ca3af'
            const dateCount = (wa.dates || []).length
            const firstDate = wa.dates?.[0] ? formatShort(wa.dates[0]) : ''
            const lastDate = wa.dates?.length > 1 ? formatShort(wa.dates[wa.dates.length - 1]) : ''
            return (
              <div key={wa.id} style={{ padding: '12px 14px', background: 'var(--apple-bg)', borderRadius: 10, borderLeft: `4px solid ${waCol}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: waCol, display: 'inline-block' }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--apple-text)' }}>{wa.wa_number}</span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: waCol + '20', color: waCol }}>
                        {wa.feeder}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--apple-secondary)', marginTop: 2 }}>
                      {dateCount} day{dateCount !== 1 ? 's' : ''}{firstDate ? `: ${firstDate}` : ''}{lastDate ? ` - ${lastDate}` : ''}
                    </p>
                    {wa.notes && <p style={{ fontSize: 12, color: 'var(--apple-tertiary)', marginTop: 2 }}>{wa.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {wa.pdf_path && (
                      <button onClick={() => handleViewPdf(wa)} style={{ ...btnSecondary, fontSize: 12, padding: '4px 10px' }}>
                        View PDF
                      </button>
                    )}
                    {canEdit && confirmRemove === wa.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleRemove(wa.id)} style={{ ...btnDanger, background: 'var(--apple-red)', color: 'white' }}>Yes</button>
                        <button onClick={() => setConfirmRemove(null)} style={{ ...btnSecondary, fontSize: 12, padding: '4px 8px' }}>No</button>
                      </div>
                    ) : canEdit ? (
                      <button onClick={() => setConfirmRemove(wa.id)} style={btnDanger}>Remove</button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
          {workAuthorities.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--apple-tertiary)', textAlign: 'center', padding: 16 }}>No work authorities added yet</p>
          )}
        </div>
      </Section>
    </div>
  )
}
