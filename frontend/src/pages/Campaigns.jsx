import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Icon, Toast } from '../components/ui.jsx';
import { useVapiCall } from '../hooks/useVapiCall.js';
import AnnouncementPreview from '../components/AnnouncementPreview.jsx';
import { downloadTemplate } from '../utils/csvTemplate.js';
import { fmtInt, CAMPAIGN_TYPE_LABEL, ENGINE_LABEL, DEFAULT_ENGINE } from '../utils/format.js';

export default function Campaigns() {
  const { refreshBalance } = useOutletContext();
  const [campaigns, setCampaigns] = useState([]);
  const [toast, setToast] = useState(null);

  // new-campaign builder state
  const DEFAULT_MESSAGE =
    'Namaste {name} ji. NCRIMS Hospital se. Aapka appointment {doctor} ke saath {date} ko hai. ' +
    'Confirm karne ke liye 1 dabayein. Reschedule ke liye 2 dabayein. Cancel ke liye 3 dabayein.';
  const DEFAULT_FIRST = 'Namaste! Main NCRIMS hospital se bol rahi hoon. Kya main aapki appointment confirm kar sakti hoon?';
  const DEFAULT_PROMPT =
    'You are a polite female appointment-confirmation assistant for NCRIMS hospital in India. ' +
    'Speak naturally in Hinglish, warm and brief. Confirm the appointment, help reschedule if asked. ' +
    'Keep replies to 1-2 short sentences. Thank them and end politely. Do not give medical advice.';
  const DEFAULT_FORM = {
    name: '', type: 'camp_announcement', engine: 'announcement', language: 'hinglish',
    announcementMessage: DEFAULT_MESSAGE, conversationFirstMessage: DEFAULT_FIRST, conversationPrompt: DEFAULT_PROMPT,
  };
  const [form, setForm] = useState(DEFAULT_FORM);
  const [campaignId, setCampaignId] = useState(null);
  const [preview, setPreview] = useState(null); // { summary, valid, invalid }
  const [fileName, setFileName] = useState('');
  const [fileObj, setFileObj] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const call = useVapiCall();

  const load = () => api.get('/campaigns').then((d) => setCampaigns(d.campaigns)).catch(() => {});
  useEffect(() => { load(); }, []);

  const notify = (message, bad = false) => {
    setToast({ message, bad });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. create the campaign shell (needed before we can attach a file)
  const ensureCampaign = async () => {
    if (campaignId) return campaignId;
    if (!form.name.trim()) { notify('Please enter a campaign name first', true); return null; }
    const { campaign } = await api.post('/campaigns', form);
    setCampaignId(campaign._id);
    return campaign._id;
  };

  // 2. preview a chosen file (no commit)
  const handleFile = async (file) => {
    if (!file) return;
    const id = await ensureCampaign();
    if (!id) return;
    setFileName(file.name);
    setFileObj(file);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const result = await api.postForm(`/campaigns/${id}/preview`, fd);
      setPreview(result);
    } catch (e) { notify(e.message, true); }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // 3. commit the list (creates queued call logs), then 4. trigger
  const launch = async () => {
    if (!campaignId || !fileObj) { notify('Upload a patient file first', true); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', fileObj);
      const committed = await api.postForm(`/campaigns/${campaignId}/upload`, fd);
      const trig = await api.post(`/campaigns/${campaignId}/trigger`, {});
      notify(`Launched: ${trig.placed} calls placed (${committed.skipped} rows skipped).`);
      // reset + close builder
      setForm(DEFAULT_FORM);
      setCampaignId(null); setPreview(null); setFileName(''); setFileObj(null);
      setShowCreate(false);
      await load();
      await refreshBalance();
    } catch (e) { notify(e.message, true); }
    finally { setBusy(false); }
  };

  // --- manage existing campaigns (pause / resume / complete / delete) ---
  const [actioningId, setActioningId] = useState(null);

  const campaignAction = async (c, action) => {
    setActioningId(c._id);
    try {
      await api.patch(`/campaigns/${c._id}/status`, { action });
      notify(`Campaign ${action === 'resume' ? 'resumed' : action === 'pause' ? 'paused' : 'completed'}.`);
      await load();
      if (action === 'resume') await refreshBalance();
    } catch (e) { notify(e.message, true); }
    finally { setActioningId(null); }
  };

  const removeCampaign = async (c) => {
    if (!window.confirm(`Delete "${c.name}" and all its call logs? This cannot be undone.`)) return;
    setActioningId(c._id);
    try {
      await api.del(`/campaigns/${c._id}`);
      notify(`Deleted "${c.name}".`);
      await load();
    } catch (e) { notify(e.message, true); }
    finally { setActioningId(null); }
  };

  // Launch an existing draft campaign that already has patients loaded.
  const launchExisting = async (c) => {
    setActioningId(c._id);
    try {
      const r = await api.post(`/campaigns/${c._id}/trigger`, {});
      notify(`Launched: ${r.placed} of ${r.total} calls placed.`);
      await load();
      await refreshBalance();
    } catch (e) { notify(e.message, true); }
    finally { setActioningId(null); }
  };

  const [showCreate, setShowCreate] = useState(false);
  const closeCreate = () => {
    setShowCreate(false);
    setForm(DEFAULT_FORM);
    setCampaignId(null); setPreview(null); setFileName(''); setFileObj(null);
  };

  // Real Vapi conversation calls burn credits — gate them behind a password.
  // (Simulated/no-key calls are free, so no password needed there.)
  const CALL_PASSWORD = '1995';
  const startConversationCall = () => {
    if (call.state !== 'idle') { call.stop(); return; }
    if (call.isLive) {
      const pw = window.prompt('Live call password (protects Vapi credits):');
      if (pw === null) return;
      if (pw !== CALL_PASSWORD) { notify('Wrong password — live call blocked to protect credits.', true); return; }
    }
    // Use whatever the user typed in the conversation form for this call.
    call.start({ firstMessage: form.conversationFirstMessage, systemPrompt: form.conversationPrompt });
  };

  const callLabel = { idle: 'Test Call in Browser', connecting: 'Connecting…', live: 'End call', ending: 'Ending…' }[call.state];

  return (
    <>
      <div className="page-head">
        <div><h1>Campaigns</h1><div className="desc">Upload patients, preview, and launch outbound AI calls.</div></div>
        {!showCreate && (
          <button className="btn" onClick={() => setShowCreate(true)}><Icon.Plus />New campaign</button>
        )}
      </div>

      {/* Builder — shown only when creating */}
      {showCreate && (
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h3>Create new campaign</h3>
          <div className="pill-row" style={{ alignItems: 'center' }}>
            <Badge tone="b-info">{preview ? 'Step 2 · Review & launch' : 'Step 1 · Details'}</Badge>
            <button className="iconbtn" onClick={closeCreate} aria-label="Close"><Icon.Close /></button>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gap: 14 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Campaign name</label>
              <input className="search" style={{ width: '100%' }} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diabetes Camp — Nov 2026" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Type</label>
              <select className="select" style={{ width: '100%' }} value={form.type}
                onChange={(e) => { const t = e.target.value; setForm({ ...form, type: t, engine: DEFAULT_ENGINE[t] }); }}>
                <option value="camp_announcement">Camp announcement</option>
                <option value="confirmation">Appointment confirmation</option>
                <option value="followup">Follow-up</option>
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Language</label>
              <select className="select" style={{ width: '100%' }} value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="hinglish">Hindi + English (Hinglish)</option>
                <option value="hi">Hindi</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {/* Calling mode (two-engine model) */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>Calling mode</label>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              {[
                { id: 'announcement', title: 'Announcement', desc: 'Patient listens and presses a key (1 = confirm, 2 = reschedule). Best for confirmations & camp announcements.' },
                { id: 'conversation', title: 'Conversation', desc: 'Interactive AI dialogue — the patient talks back. Best for follow-ups, qualifying & lead generation.' },
              ].map((m) => (
                <button type="button" key={m.id} onClick={() => setForm({ ...form, engine: m.id })}
                  className="card" style={{
                    padding: 14, textAlign: 'left', cursor: 'pointer', boxShadow: 'none',
                    borderColor: form.engine === m.id ? 'var(--teal)' : 'var(--line)',
                    background: form.engine === m.id ? 'var(--teal-50)' : 'var(--card)',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 650, fontSize: 13.5 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${form.engine === m.id ? 'var(--teal)' : 'var(--line-strong)'}`, display: 'grid', placeItems: 'center' }}>
                      {form.engine === m.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />}
                    </span>
                    {m.title}
                  </div>
                  <div className="t-sub" style={{ marginTop: 6 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Announcement message script — only for the announcement engine */}
          {form.engine === 'announcement' && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>Announcement message</label>
              <textarea value={form.announcementMessage} rows={4}
                onChange={(e) => setForm({ ...form, announcementMessage: e.target.value })}
                style={{ width: '100%', marginTop: 8, padding: '11px 13px', border: '1px solid var(--line-strong)',
                  borderRadius: 8, background: 'var(--card)', color: 'var(--txt)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="What the patient will hear…" />
              <div className="hint">
                Use <b>{'{name}'}</b>, <b>{'{doctor}'}</b>, <b>{'{date}'}</b> — filled per patient from your CSV. The preview below plays this exact message.
              </div>
            </div>
          )}

          {/* Upload */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>Patient list (CSV)</label>
              <div className="pill-row" style={{ alignItems: 'center' }}>
                <span className="t-sub">Need the format?</span>
                <button type="button" className="dl-link" onClick={() => downloadTemplate({ includeDemo: true })}>
                  Download sample template
                </button>
                <span className="t-sub">·</span>
                <button type="button" className="dl-link" onClick={() => downloadTemplate({ includeDemo: false })}>
                  Blank template
                </button>
              </div>
            </div>
            <div className={`dropzone ${drag ? 'drag' : ''}`} style={{ marginTop: 8 }}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)} onDrop={onDrop}>
              <div style={{ fontSize: 26 }}>📄</div>
              <h4>{fileName || 'Drag & drop your patient file here'}</h4>
              <p>or <span className="browse">browse to upload</span> · .csv · columns: Name, Phone, Doctor/Dept, Appointment, Purpose</p>
              <input ref={fileInput} type="file" accept=".csv,text/csv" hidden
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>

            {preview && (
              <>
                <div className="preview-summary">
                  <Badge tone="b-good">{fmtInt(preview.summary.valid)} valid</Badge>
                  {preview.summary.invalid > 0 && <Badge tone="b-bad">{fmtInt(preview.summary.invalid)} errors</Badge>}
                  <span className="t-sub">{fileName} · {fmtInt(preview.summary.total)} rows</span>
                </div>
                <div className="card" style={{ boxShadow: 'none' }}>
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr><th>✓</th><th>Name</th><th>Phone</th><th>Doctor / Dept</th><th>Appointment</th><th>Purpose</th></tr></thead>
                      <tbody>
                        {preview.valid.slice(0, 5).map((r, i) => (
                          <tr key={`v${i}`}>
                            <td><Badge tone="b-good" /></td>
                            <td className="t-name">{r.patientName}</td>
                            <td className="num">{r.phoneNumber}</td>
                            <td>{r.doctorOrDept || '—'}</td>
                            <td className="num">{r.appointmentAt || '—'}</td>
                            <td>{r.purpose || '—'}</td>
                          </tr>
                        ))}
                        {preview.invalid.slice(0, 3).map((r, i) => (
                          <tr key={`i${i}`} style={{ background: 'var(--bad-bg)' }}>
                            <td><Badge tone="b-bad" /></td>
                            <td className="t-name">{r.patientName || '(missing)'}</td>
                            <td className="num" style={{ color: 'var(--bad)' }}>{r.phoneRaw || '—'} ⚠</td>
                            <td colSpan="3" style={{ color: 'var(--bad)' }}>{r.errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Test experience — depends on the chosen calling mode */}
          <div style={{ marginTop: 20 }}>
            {form.engine === 'announcement' ? (
              // FREE unlimited announcement preview (browser speech, no credits)
              <AnnouncementPreview message={form.announcementMessage} />
            ) : (
              <>
              {/* Editable AI script for the conversation */}
              <div style={{ marginBottom: 14 }}>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label>First message <span className="t-sub">what the AI says when the patient answers</span></label>
                  <input value={form.conversationFirstMessage}
                    onChange={(e) => setForm({ ...form, conversationFirstMessage: e.target.value })} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>AI instructions <span className="t-sub">how the AI should behave</span></label>
                  <textarea value={form.conversationPrompt} rows={4}
                    onChange={(e) => setForm({ ...form, conversationPrompt: e.target.value })}
                    style={{ width: '100%', padding: '11px 13px', border: '1px solid var(--line-strong)', borderRadius: 8,
                      background: 'var(--card)', color: 'var(--txt)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
                  <div className="hint">These apply to the live test call. For production, they're saved with the campaign.</div>
                </div>
              </div>
              {/* Real AI conversation — password-locked to protect Vapi credits */}
              <div className="testcall">
                <button className={`pulse-btn ${call.state === 'live' ? 'live' : ''}`}
                  onClick={startConversationCall} aria-label="Test call">
                  <Icon.Phone width="26" height="26" />
                </button>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {callLabel}
                    {call.isLive && call.state === 'idle' && <Badge tone="b-warn">🔒 password</Badge>}
                  </h4>
                  <p className="t-sub" style={{ marginTop: 3, maxWidth: '54ch' }}>
                    {call.state === 'live'
                      ? (call.isLive ? 'You are live with the AI agent — speak now.' : 'Demo mode: simulated call (no Vapi key set).')
                      : call.isLive
                        ? 'Live AI conversation call. Password-protected so credits are never burned by accident.'
                        : 'Hear the AI agent live in your browser. Add a Vapi key for a real call; runs simulated otherwise.'}
                  </p>
                </div>
                {call.state === 'live' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className="badge b-bad"><span className="bd" />● LIVE</span>
                    <span className="num" style={{
                      fontWeight: 700, fontSize: 15,
                      color: call.elapsed >= call.maxSeconds - 15 ? 'var(--bad)' : call.elapsed >= 30 ? 'var(--warn)' : 'var(--txt)',
                    }}>
                      {Math.floor(call.elapsed / 60)}:{String(call.elapsed % 60).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
              {call.state === 'live' && (
                <div className="hint" style={{ marginTop: 6 }}>
                  Live call running — click the button to hang up. Auto-stops at {Math.floor(call.maxSeconds / 60)}:00 to protect credits.
                </div>
              )}
              {call.errorMsg && <div className="err-text" style={{ marginTop: 8 }}>⚠ {call.errorMsg}</div>}

              {/* Live transcript of the conversation */}
              {call.transcript.length > 0 && (
                <div className="transcript" style={{ marginTop: 12, maxHeight: 240, overflowY: 'auto' }}>
                  <div className="th">Live transcript</div>
                  {call.transcript.map((t, i) => (
                    <div className="turn" key={i}>
                      <div className={`who ${t.role === 'assistant' ? 'ai' : 'pt'}`}>{t.role === 'assistant' ? 'AI' : 'You'}</div>
                      <div className="say">{t.text}</div>
                    </div>
                  ))}
                </div>
              )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn" onClick={launch} disabled={busy || !preview}>
              <Icon.Play />{busy ? 'Launching…' : preview ? `Launch ${fmtInt(preview.summary.valid)} calls` : 'Launch calls'}
            </button>
            <div className="mini-note" style={{ marginLeft: 'auto' }}>
              <Icon.Info />
              <span>Unanswered/busy calls cost 0 minutes. Connected calls bill a 1-minute minimum, then by actual duration.</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Existing */}
      <div className="card">
        <div className="card-head"><h3>All campaigns</h3></div>
        <div className="tbl-wrap">
          {campaigns.length === 0 ? (
            <div className="empty">No campaigns yet.</div>
          ) : (
            <table>
              <thead><tr><th>Campaign</th><th>Type</th><th>Mode</th><th>Patients</th><th>Connected</th><th>Confirmed</th><th>Min used</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {campaigns.map((c) => {
                  const busyRow = actioningId === c._id;
                  return (
                    <tr key={c._id} style={{ opacity: busyRow ? 0.5 : 1 }}>
                      <td><div className="t-name">{c.name}</div></td>
                      <td><Badge tone="b-info">{CAMPAIGN_TYPE_LABEL[c.type]}</Badge></td>
                      <td><Badge tone={c.engine === 'conversation' ? 'b-good' : 'b-mut'}>{ENGINE_LABEL[c.engine] || 'Announcement'}</Badge></td>
                      <td className="num">{fmtInt(c.stats.total)}</td>
                      <td className="num">{fmtInt(c.stats.connected)}</td>
                      <td className="num">{c.stats.confirmed ? fmtInt(c.stats.confirmed) : '—'}</td>
                      <td className="num">{fmtInt(c.stats.minutesConsumed)}</td>
                      <td><Badge tone={c.status === 'running' ? 'b-good' : 'b-mut'}>{c.status[0].toUpperCase() + c.status.slice(1)}</Badge></td>
                      <td>
                        <div className="pill-row">
                          {c.status === 'draft' && c.stats.total > 0 && (
                            <button className="btn sm" disabled={busyRow} onClick={() => launchExisting(c)}>Launch</button>
                          )}
                          {c.status === 'running' && (
                            <button className="btn ghost sm" disabled={busyRow} onClick={() => campaignAction(c, 'pause')}>Pause</button>
                          )}
                          {c.status === 'paused' && (
                            <button className="btn ghost sm" disabled={busyRow} onClick={() => campaignAction(c, 'resume')}>Resume</button>
                          )}
                          {(c.status === 'running' || c.status === 'paused') && (
                            <button className="btn ghost sm" disabled={busyRow} onClick={() => campaignAction(c, 'complete')}>Complete</button>
                          )}
                          {c.status !== 'running' && (
                            <button className="btn ghost sm" disabled={busyRow} onClick={() => removeCampaign(c)}
                              style={{ color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 40%, transparent)' }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </>
  );
}
