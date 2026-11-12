import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { Icon } from './ui.jsx';
import { fmtInt } from '../utils/format.js';
import { PLANS, GST, fmtMoney } from '../data/plans.js';

const GROUPS = [...new Set(PLANS.map((p) => p.group))];

/** Admin flow to add a prepaid minute package from the VOICEARTAI plan list. */
export default function AddPackageModal({ balance, onClose, onAdded }) {
  const [planId, setPlanId] = useState(PLANS[0].id);
  const [minutes, setMinutes] = useState(PLANS[0].minutes);
  const [rate, setRate] = useState(PLANS[0].rate.toFixed(2));
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectPlan = (id) => {
    setPlanId(id);
    const p = PLANS.find((x) => x.id === id);
    if (p) { setMinutes(p.minutes); setRate(p.rate.toFixed(2)); }
  };

  const plan = PLANS.find((x) => x.id === planId);
  const planName = plan ? `${plan.group} · ${plan.tier}` : 'Custom';

  const minsNum = parseInt(minutes, 10) || 0;
  const rateNum = parseFloat(rate) || 0;
  const subtotal = useMemo(() => minsNum * rateNum, [minsNum, rateNum]);
  const gst = subtotal * GST;
  const total = subtotal + gst;
  const newRemaining = (balance?.remainingMinutes || 0) + minsNum;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (minsNum <= 0) { setError('Choose a package or enter minutes greater than zero.'); return; }
    setBusy(true);
    try {
      await api.post('/wallet/topup', {
        minutes: minsNum,
        ratePerMinute: rateNum > 0 ? rateNum : undefined,
        reference: reference.trim() || undefined,
        note: planName,
      });
      onAdded(minsNum);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ fontSize: 17 }}>Add minute package</h3>
            <div className="t-sub" style={{ marginTop: 3 }}>VOICEARTAI prepaid connected-minute plans.</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="field">
            <label>Plan</label>
            <PlanDropdown value={planId} onSelect={selectPlan} />
          </div>

          <div className="field">
            <label>Payment reference <span className="t-sub">optional — invoice / txn no.</span></label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. INV-2026-0912" />
          </div>

          {/* Billed summary with GST */}
          <div className="card" style={{ boxShadow: 'none', background: 'var(--paper)', padding: 14, marginTop: 6 }}>
            <Row k="Plan" v={planName} />
            <Row k="Minutes" v={`${fmtInt(minsNum)} min`} />
            <Row k="Rate" v={`₹${rateNum.toFixed(2)} / min`} />
            <div style={{ borderTop: '1px dashed var(--line-strong)', margin: '10px 0' }} />
            <Row k="Subtotal" v={fmtMoney(subtotal)} />
            <Row k="GST (18%)" v={fmtMoney(gst)} />
            <Row k="Total payable" v={fmtMoney(total)} strong accent />
            <div style={{ borderTop: '1px dashed var(--line-strong)', margin: '10px 0' }} />
            <Row k="Balance after" v={`${fmtInt(newRemaining)} min`} strong />
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

/** Custom, styled plan picker — grouped options with rate pills. */
function PlanDropdown({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const sel = PLANS.find((p) => p.id === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="pd-wrap" ref={ref}>
      <button type="button" className={`pd-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className="sel-label">
          <b>{sel ? sel.group : 'Choose a plan'}</b>
          <small>{sel ? `${sel.tier} · ${fmtInt(sel.minutes)} min · ₹${sel.rate.toFixed(2)}/min` : ''}</small>
        </span>
        <Icon.Caret className="chev" />
      </button>

      {open && (
        <div className="pd-panel">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="pd-group">{g}</div>
              {PLANS.filter((p) => p.group === g).map((p) => (
                <button type="button" key={p.id}
                  className={`pd-opt ${p.id === value ? 'sel' : ''}`}
                  onClick={() => { onSelect(p.id); setOpen(false); }}>
                  <span>
                    <div className="tier">{p.tier}</div>
                    <div className="mins">{fmtInt(p.minutes)} connected minutes</div>
                  </span>
                  <span className="pd-rate">₹{p.rate.toFixed(2)}/min</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
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
