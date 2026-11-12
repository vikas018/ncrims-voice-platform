import { useEffect } from 'react';
import { Badge, Icon } from './ui.jsx';
import { PLAN_FAMILIES, COMMERCIAL_TERMS, GST, fmtMoney } from '../data/plans.js';
import { fmtInt } from '../utils/format.js';

const CATEGORIES = [...new Set(PLAN_FAMILIES.map((f) => f.category))];

/** Side-by-side plan + feature comparison to help choose a package. */
export default function PlansModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 840 }}>
        <div className="modal-head">
          <div>
            <h3 style={{ fontSize: 17 }}>VOICEARTAI Plans &amp; Features</h3>
            <div className="t-sub" style={{ marginTop: 3 }}>Compare what each plan includes to pick the right package.</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>

        <div className="modal-body">
          {CATEGORIES.map((cat) => {
            const fams = PLAN_FAMILIES.filter((f) => f.category === cat);
            return (
              <div key={cat} style={{ marginBottom: 22 }}>
                <h4 style={{ fontSize: 15 }}>{cat} Campaigns</h4>
                <p className="t-sub" style={{ margin: '3px 0 12px', maxWidth: '70ch' }}>{fams[0].categoryDesc}</p>

                <div className="plan-grid">
                  {fams.map((f) => (
                    <div className="plan-card" key={f.voice}>
                      <div className="plan-card-head">
                        <Badge tone={f.voice === 'Premium' ? 'b-info' : 'b-mut'}>{f.voice} Voice</Badge>
                        <span className="t-sub">{f.voiceDesc}</span>
                      </div>

                      <div className="plan-tiers">
                        {f.tiers.map((t) => (
                          <div className="plan-tier" key={t.tier}>
                            <div>
                              <div className="tt">{t.tier}</div>
                              <div className="t-sub num">{fmtInt(t.minutes)} min</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="num" style={{ fontWeight: 700 }}>₹{t.rate.toFixed(2)}<span className="t-sub">/min</span></div>
                              <div className="t-sub num">{fmtMoney(t.minutes * t.rate * (1 + GST))} incl. GST</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <ul className="plan-feats">
                        {f.features.map((ft) => (
                          <li key={ft}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                            {ft}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="card" style={{ boxShadow: 'none', background: 'var(--paper)', padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>Commercial terms</div>
            <ul className="plan-feats" style={{ columns: 2 }}>
              {COMMERCIAL_TERMS.map((t) => (
                <li key={t}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
