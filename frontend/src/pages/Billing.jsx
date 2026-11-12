import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge, Icon, Toast } from '../components/ui.jsx';
import AddPackageModal from '../components/AddPackageModal.jsx';
import PlansModal from '../components/PlansModal.jsx';
import { fmtInt, fmtDateTime } from '../utils/format.js';

const fmtMoney = (n) =>
  n == null ? null : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Billing() {
  const { user } = useAuth();
  const { refreshBalance } = useOutletContext();
  const [balance, setBalance] = useState(null);
  const [txns, setTxns] = useState([]);
  const [toast, setToast] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const load = () => {
    api.get('/wallet').then(setBalance).catch(() => {});
    api.get('/wallet/transactions').then((d) => setTxns(d.transactions)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const notify = (message, bad) => { setToast({ message, bad }); setTimeout(() => setToast(null), 3000); };

  const onPackageAdded = async (minutes) => {
    setShowAdd(false);
    notify(`Added ${fmtInt(minutes)} minutes to the wallet.`);
    load();
    await refreshBalance();
  };

  if (!balance) return null;
  const pct = balance.totalMinutes ? Math.round((balance.remainingMinutes / balance.totalMinutes) * 1000) / 10 : 0;

  return (
    <>
      <div className="page-head">
        <div><h1>Billing &amp; Minutes</h1><div className="desc">Prepaid connected-minute wallet, usage, and transaction ledger.</div></div>
        <div className="pill-row">
          <button className="btn ghost" onClick={() => setShowPlans(true)}>Compare plans</button>
          {user?.role === 'admin' && <button className="btn" onClick={() => setShowAdd(true)}><Icon.Plus />Add minute package</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--txt-2)', fontWeight: 600 }}>Remaining balance</div>
            <div style={{ fontSize: 38, fontWeight: 740, letterSpacing: '-.02em', marginTop: 4 }} className="num">
              {fmtInt(balance.remainingMinutes)} <span style={{ fontSize: 18, color: 'var(--txt-2)', fontWeight: 600 }}>min</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <div><div style={{ fontSize: 12, color: 'var(--txt-2)', fontWeight: 600 }}>Total allotted</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }} className="num">{fmtInt(balance.totalMinutes)}</div></div>
            <div><div style={{ fontSize: 12, color: 'var(--txt-2)', fontWeight: 600 }}>Consumed</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }} className="num">{fmtInt(balance.consumedMinutes)}</div></div>
          </div>
        </div>
        <div className="bal-bar">
          <i style={{ width: `${pct}%`, background: 'var(--teal)' }} />
          <i style={{ width: `${100 - pct}%`, background: 'var(--line-strong)' }} />
        </div>
        <div className="hint" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{pct}% remaining</span></div>
        <div className="mini-note" style={{ marginTop: 16 }}>
          <Icon.Info />
          <span><b>Pulse billing:</b> connected calls bill a 1-minute minimum, then by actual connected duration. Unanswered, busy &amp; failed calls cost 0 minutes. 18% GST applies on packages.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Transaction ledger</h3><span className="t-sub">Append-only · every debit traces to a call</span></div>
        <div className="tbl-wrap">
          {txns.length === 0 ? (
            <div className="empty">No transactions yet.</div>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Reference</th><th>Amount</th><th>Minutes</th><th>Balance after</th></tr></thead>
              <tbody>
                {txns.map((t) => {
                  const ref = t.callLogId?.patientName
                    || [t.reference, t.note].filter(Boolean).join(' · ')
                    || '—';
                  return (
                    <tr key={t._id}>
                      <td className="num">{fmtDateTime(t.createdAt)}</td>
                      <td><Badge tone={t.type === 'credit' ? 'b-good' : 'b-bad'}>{t.type[0].toUpperCase() + t.type.slice(1)}</Badge></td>
                      <td>{t.reason === 'package_topup' ? 'Package top-up' : t.reason === 'call_billed' ? 'Call billed' : 'Adjustment'}</td>
                      <td className="t-sub">{ref}</td>
                      <td className="num">{fmtMoney(t.amount) || '—'}</td>
                      <td className={`ledger-amt num ${t.type === 'credit' ? 'cr' : 'db'}`}>{t.type === 'credit' ? '+' : '−'}{fmtInt(t.minutes)}</td>
                      <td className="num">{fmtInt(t.balanceAfter)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showAdd && <AddPackageModal balance={balance} onClose={() => setShowAdd(false)} onAdded={onPackageAdded} />}
      {showPlans && <PlansModal onClose={() => setShowPlans(false)} />}
      <Toast {...(toast || {})} onDone={() => setToast(null)} />
    </>
  );
}
