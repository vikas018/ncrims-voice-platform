import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client.js';
import { Badge, Icon, Toast } from '../components/ui.jsx';
import { useVapiCall } from '../hooks/useVapiCall.js';
import { downloadTemplate } from '../utils/csvTemplate.js';
import { fmtInt, CAMPAIGN_TYPE_LABEL } from '../utils/format.js';

export default function Campaigns() {
  const { refreshBalance } = useOutletContext();
  const [campaigns, setCampaigns] = useState([]);
  const [toast, setToast] = useState(null);

  // new-campaign builder state
  const [form, setForm] = useState({ name: '', type: 'camp_announcement', language: 'hinglish' });
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
      // reset builder
      setForm({ name: '', type: 'camp_announcement', language: 'hinglish' });
      setCampaignId(null); setPreview(null); setFileName(''); setFileObj(null);
      await load();
      await refreshBalance();
    } catch (e) { notify(e.message, true); }
    finally { setBusy(false); }
  };

  const callLabel = { idle: 'Test Call in Browser', connecting: 'Connecting…', live: 'End call', ending: 'Ending…' }[call.state];

  return (
    <>
      <div className="page-head">
        <div><h1>Campaigns</h1><div className="desc">Upload patients, preview, and launch outbound AI calls.</div></div>
      </div>

      {/* Builder */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h3>Create new campaign</h3>
          <Badge tone="b-info">{preview ? 'Step 2 · Review & launch' : 'Step 1 · Details'}</Badge>
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
                onChange={(e) => setForm({ ...form, type: e.target.value })}>
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

          {/* Test call */}
          <div className="testcall" style={{ marginTop: 20 }}>
            <button className={`pulse-btn ${call.state === 'live' ? 'live' : ''}`}
              onClick={() => (call.state === 'idle' ? call.start() : call.stop())} aria-label="Test call">
              <Icon.Phone width="26" height="26" />
            </button>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15 }}>{callLabel}</h4>
              <p className="t-sub" style={{ marginTop: 3, maxWidth: '52ch' }}>
                {call.state === 'live'
                  ? (call.isLive ? 'You are live with the AI agent — speak now.' : 'Demo mode: simulated live call. Set VITE_VAPI_PUBLIC_KEY for a real browser call.')
                  : 'Hear the AI agent live in your browser before you launch. Zero cost, no phone number — your demo button.'}
              </p>
            </div>
            {call.state === 'live' && <span className="badge b-bad"><span className="bd" />● LIVE</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <button className="btn" onClick={launch} disabled={busy || !preview}>
              <Icon.Play />{busy ? 'Launching…' : preview ? `Launch ${fmtInt(preview.summary.valid)} calls` : 'Launch calls'}
            </button>
            <div className="mini-note" style={{ marginLeft: 'auto' }}>
              <Icon.Info />
              <span>Unanswered/busy calls cost 0 minutes. Connected calls bill a 60-second minimum pulse.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Existing */}
      <div className="card">
        <div className="card-head"><h3>All campaigns</h3></div>
        <div className="tbl-wrap">
          {campaigns.length === 0 ? (
            <div className="empty">No campaigns yet.</div>
          ) : (
            <table>
              <thead><tr><th>Campaign</th><th>Type</th><th>Patients</th><th>Connected</th><th>Confirmed</th><th>Min used</th><th>Status</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c._id}>
                    <td><div className="t-name">{c.name}</div></td>
                    <td><Badge tone="b-info">{CAMPAIGN_TYPE_LABEL[c.type]}</Badge></td>
                    <td className="num">{fmtInt(c.stats.total)}</td>
                    <td className="num">{fmtInt(c.stats.connected)}</td>
                    <td className="num">{c.stats.confirmed ? fmtInt(c.stats.confirmed) : '—'}</td>
                    <td className="num">{fmtInt(c.stats.minutesConsumed)}</td>
                    <td><Badge tone={c.status === 'running' ? 'b-good' : 'b-mut'}>{c.status[0].toUpperCase() + c.status.slice(1)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </>
  );
}
