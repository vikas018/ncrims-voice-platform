import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Spinner, Icon } from '../components/ui.jsx';
import { fmtInt, CAMPAIGN_TYPE_LABEL } from '../utils/format.js';

const CIRC = 2 * Math.PI * 52; // donut circumference for r=52

function Donut({ data }) {
  const total = data.connected + data.unanswered + data.busyFailed + data.queued || 1;
  const seg = (v) => (v / total) * CIRC;
  let offset = 0;
  const arcs = [
    { v: data.connected, color: 'var(--good)' },
    { v: data.unanswered, color: 'var(--warn)' },
    { v: data.busyFailed, color: 'var(--bad)' },
  ];
  return (
    <div className="donut">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r="52" fill="none" stroke="var(--line)" strokeWidth="16" />
        {arcs.map((a, i) => {
          const dash = `${seg(a.v)} ${CIRC}`;
          const el = (
            <circle key={i} cx="66" cy="66" r="52" fill="none" stroke={a.color} strokeWidth="16"
              strokeDasharray={dash} strokeDashoffset={-offset} />
          );
          offset += seg(a.v);
          return el;
        })}
      </svg>
      <div className="center">
        <b className="num">{fmtInt(total === 1 && !data.connected ? 0 : data.connected + data.unanswered + data.busyFailed + data.queued)}</b>
        <span>calls</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  // Load now, then auto-refresh every 15s and whenever the tab regains focus.
  useEffect(() => {
    let alive = true;
    const fetchSummary = () => api.get('/dashboard/summary').then((d) => { if (alive) setData(d); }).catch(() => {});
    fetchSummary();
    const id = setInterval(fetchSummary, 15000);
    const onFocus = () => fetchSummary();
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, []);

  if (!data) return <div style={{ padding: 40 }}><Spinner /></div>;

  const { today, outcomesToday, wallet, recentCampaigns } = data;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greet}, {user?.name?.split(' ')[0]}</h1>
          <div className="desc" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Here's your outreach activity for today.
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--good)', fontSize: 12, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />Live
            </span>
          </div>
        </div>
        <button className="btn" onClick={() => navigate('/campaigns')}><Icon.Plus />New campaign</button>
      </div>

      <div className="grid kpis">
        <div className="card kpi">
          <div className="lbl"><span className="kdot" style={{ background: 'var(--teal)' }} />Calls today</div>
          <div className="val num">{fmtInt(today.calls)}</div>
          <div className="sub">across all campaigns</div>
        </div>
        <div className="card kpi">
          <div className="lbl"><span className="kdot" style={{ background: 'var(--good)' }} />Connect rate</div>
          <div className="val num">{today.connectRate}%</div>
          <div className="sub">{fmtInt(today.connected)} connected</div>
        </div>
        <div className="card kpi">
          <div className="lbl"><span className="kdot" style={{ background: 'var(--info)' }} />Confirmed</div>
          <div className="val num">{fmtInt(today.confirmed)}</div>
          <div className="sub">appointments confirmed</div>
        </div>
        <div className="card kpi">
          <div className="lbl"><span className="kdot" style={{ background: 'var(--warn)' }} />Minutes used today</div>
          <div className="val num">{fmtInt(today.minutesUsed)}</div>
          <div className="sub num">{fmtInt(wallet.remainingMinutes)} of {fmtInt(wallet.totalMinutes)} left</div>
        </div>
      </div>

      <div className="two-col section-gap">
        <div className="card">
          <div className="card-head"><h3>Recent campaigns</h3>
            <button className="btn ghost sm" onClick={() => navigate('/campaigns')}>View all</button>
          </div>
          <div className="tbl-wrap">
            {recentCampaigns.length === 0 ? (
              <div className="empty">No campaigns yet — create your first one.</div>
            ) : (
              <table>
                <thead><tr><th>Campaign</th><th>Type</th><th>Patients</th><th>Connected</th><th>Status</th></tr></thead>
                <tbody>
                  {recentCampaigns.map((c) => (
                    <tr key={c._id} className="clickable" onClick={() => navigate('/campaigns')}>
                      <td><div className="t-name">{c.name}</div></td>
                      <td><Badge tone="b-info">{CAMPAIGN_TYPE_LABEL[c.type]}</Badge></td>
                      <td className="num">{fmtInt(c.stats.total)}</td>
                      <td className="num">{fmtInt(c.stats.connected)}</td>
                      <td>
                        <Badge tone={c.status === 'running' ? 'b-good' : 'b-mut'}>
                          {c.status[0].toUpperCase() + c.status.slice(1)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="card-head" style={{ border: 'none', padding: '4px 2px 14px' }}><h3>Call outcomes · today</h3></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Donut data={outcomesToday} />
            <div className="legend">
              <div className="row"><span className="sw" style={{ background: 'var(--good)' }} />Connected<span className="amt num">{fmtInt(outcomesToday.connected)}</span></div>
              <div className="row"><span className="sw" style={{ background: 'var(--warn)' }} />Unanswered<span className="amt num">{fmtInt(outcomesToday.unanswered)}</span></div>
              <div className="row"><span className="sw" style={{ background: 'var(--bad)' }} />Busy / Failed<span className="amt num">{fmtInt(outcomesToday.busyFailed)}</span></div>
              <div className="row"><span className="sw" style={{ background: 'var(--line-strong)' }} />Queued<span className="amt num">{fmtInt(outcomesToday.queued)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
