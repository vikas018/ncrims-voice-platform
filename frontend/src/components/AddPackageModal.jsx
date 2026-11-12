import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { Icon } from './ui.jsx';
import { fmtInt } from '../utils/format.js';

const PRESETS = [5000, 10000, 25000, 50000];
const fmtMoney = (n) =>
  n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Admin flow to add a prepaid minute package with commercial terms. */
export default function AddPackageModal({ balance, onClose, onAdded }) {
  const [minutes, setMinutes] = useState(10000);
  const [rate, setRate] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rateNum = parseFloat(rate);
  const minsNum = parseInt(minutes, 10) || 0;
  const amount = useMemo(() => (rate !== '' && rateNum > 0 ? minsNum * rateNum : null), [rate, rateNum, minsNum]);
  const newRemaining = (balance?.remainingMinutes || 0) + minsNum;
  const newTotal = (balance?.totalMinutes || 0) + minsNum;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (minsNum <= 0) { setError('Enter a package size greater than zero.'); return; }
    setBusy(true);
    try {
      const body = { minutes: minsNum };
      if (rate !== '' && rateNum > 0) body.ratePerMinute = rateNum;
      if (reference.trim()) body.reference = reference.trim();
      if (note.trim()) body.note = note.trim();
      await api.post('/wallet/topup', body);
      onAdded(minsNum);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ fontSize: 17 }}>Add minute package</h3>
            <div className="t-sub" style={{ marginTop: 3 }}>Credit prepaid connected-minutes to the NCRIMS wallet.</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          {/* Preset packages */}
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)' }}>Package size</label>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 8, margin: '8px 0 14px' }}>
            {PRESETS.map((p) => (
              <button type="button" key={p} onClick={() => setMinutes(p)}
                className="card" style={{
                  padding: '12px 8px', textAlign: 'center', cursor: 'pointer', boxShadow: 'none',
                  borderColor: minsNum === p ? 'var(--teal)' : 'var(--line)',
                  background: minsNum === p ? 'var(--teal-50)' : 'var(--card)',
                }}>
                <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{fmtInt(p)}</div>
                <div className="t-sub">minutes</div>
              </button>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field" style={{ margin: 0 }}>
              <label>Custom minutes</label>
              <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="num" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Rate (₹ / min) <span className="t-sub">optional</span></label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 3.50" value={rate}
                onChange={(e) => setRate(e.target.value)} className="num" />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Payment reference <span className="t-sub">optional — invoice / txn no.</span></label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INV-2026-0912" />
          </div>
          <div className="field">
            <label>Note <span className="t-sub">optional</span></label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Q4 prepaid top-up" />
          </div>

          {/* Live summary */}
          <div className="card" style={{ boxShadow: 'none', background: 'var(--paper)', padding: 14, marginTop: 6 }}>
            <Row k="Minutes added" v={`${fmtInt(minsNum)} min`} />
            <Row k="Rate" v={rate !== '' && rateNum > 0 ? `${fmtMoney(rateNum)} / min` : '—'} />
            <Row k="Total amount" v={fmtMoney(amount)} strong />
            <div style={{ borderTop: '1px dashed var(--line-strong)', margin: '10px 0' }} />
            <Row k="Balance now" v={`${fmtInt(balance?.remainingMinutes || 0)} min`} />
            <Row k="Balance after" v={`${fmtInt(newRemaining)} min`} strong accent />
            <Row k="New total allotted" v={`${fmtInt(newTotal)} min`} />
          </div>

          {error && <div className="err-text">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn" disabled={busy}><Icon.Plus />{busy ? 'Adding…' : `Add ${fmtInt(minsNum)} minutes`}</button>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ k, v, strong, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span className="t-sub" style={{ fontSize: 13 }}>{k}</span>
      <span className="num" style={{
        fontWeight: strong ? 700 : 500,
        fontSize: strong ? 15 : 13.5,
        color: accent ? 'var(--teal)' : 'var(--txt)',
      }}>{v}</span>
    </div>
  );
}
