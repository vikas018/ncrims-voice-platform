import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Icon, Spinner } from '../components/ui.jsx';
import CallDetailModal from '../components/CallDetailModal.jsx';
import { downloadCsv } from '../utils/csvTemplate.js';
import {
  fmtInt, fmtDuration, fmtTime, fmtDateTime, statusTone, outcomeTone,
  STATUS_LABEL, OUTCOME_LABEL,
} from '../utils/format.js';

export default function CallLogs() {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', campaignId: '', status: '', outcome: '' });
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const limit = 25;

  useEffect(() => { api.get('/campaigns').then((d) => setCampaigns(d.campaigns)).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page, limit });
    Object.entries(filters).forEach(([k, v]) => v && qs.append(k, v));
    api.get(`/calls?${qs}`).then((d) => { setCalls(d.calls); setTotal(d.total); }).catch(() => {}).finally(() => setLoading(false));
  }, [filters, page]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const pages = Math.ceil(total / limit) || 1;

  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && qs.append(k, v));
      const { calls: all } = await api.get(`/calls/export?${qs}`);
      const headers = ['Patient', 'Phone', 'Campaign', 'Status', 'Outcome', 'Duration (sec)', 'Billed minutes', 'Date'];
      const rows = all.map((c) => [
        c.patientName, c.phoneNumber, c.campaignId?.name || '',
        STATUS_LABEL[c.status], OUTCOME_LABEL[c.outcome],
        c.durationSeconds || 0, c.billedMinutes || 0, fmtDateTime(c.createdAt),
      ]);
      downloadCsv(`ncrims-call-logs-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } catch (e) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Call Logs</h1><div className="desc">Every call with status, outcome, recording, and transcript.</div></div>
        <button className="btn ghost" onClick={exportCsv} disabled={exporting}>
          <Icon.Download />{exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="filters">
        <input className="search" placeholder="Search patient or number…" value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)} />
        <select className="select" value={filters.campaignId} onChange={(e) => setFilter('campaignId', e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select className="select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All status</option>
          <option value="connected">Connected</option>
          <option value="unanswered">Unanswered</option>
          <option value="busy">Busy</option>
          <option value="failed">Failed</option>
        </select>
        <select className="select" value={filters.outcome} onChange={(e) => setFilter('outcome', e.target.value)}>
          <option value="">All outcomes</option>
          <option value="confirmed">Confirmed</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="not_interested">Not interested</option>
        </select>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          {loading ? (
            <div className="empty"><Spinner /></div>
          ) : calls.length === 0 ? (
            <div className="empty">No calls match these filters.</div>
          ) : (
            <table>
              <thead><tr><th>Patient</th><th>Campaign</th><th>Status</th><th>Outcome</th><th>Duration</th><th>Billed min</th><th>Time</th><th /></tr></thead>
              <tbody>
                {calls.map((c) => (
                  <tr key={c._id} className="clickable" onClick={() => setSelected(c)}>
                    <td><div className="t-name">{c.patientName}</div><div className="t-sub num">{c.phoneNumber}</div></td>
                    <td>{c.campaignId?.name || '—'}</td>
                    <td><Badge tone={statusTone(c.status)}>{STATUS_LABEL[c.status]}</Badge></td>
                    <td><Badge tone={outcomeTone(c.outcome)}>{OUTCOME_LABEL[c.outcome]}</Badge></td>
                    <td className="num">{fmtDuration(c.durationSeconds)}</td>
                    <td className="num">{c.billedMinutes}</td>
                    <td className="t-sub num">{fmtTime(c.createdAt)}</td>
                    <td>▸</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)' }}>
          <span className="t-sub num">Showing {calls.length} of {fmtInt(total)} calls</span>
          <div className="pill-row">
            <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn ghost sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {selected && <CallDetailModal call={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
