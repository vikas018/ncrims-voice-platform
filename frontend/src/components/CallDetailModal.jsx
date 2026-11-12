import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { Badge, Icon } from './ui.jsx';
import {
  fmtDuration, fmtDateTime, statusTone, outcomeTone, STATUS_LABEL, OUTCOME_LABEL,
} from '../utils/format.js';

const WAVE = [40, 70, 55, 90, 45, 65, 80, 35, 60, 75, 50, 85, 40, 55, 70, 45, 60, 30];

/** Parse "AI: ...\nPatient: ..." transcript text into turns for display. */
function parseTranscript(text) {
  if (!text) return [];
  return text.split('\n').filter(Boolean).map((line) => {
    const isAI = /^ai[:\s]/i.test(line) || /assistant/i.test(line.slice(0, 10));
    const say = line.replace(/^(ai|assistant|patient|user|customer)\s*:\s*/i, '');
    return { who: isAI ? 'ai' : 'pt', say };
  });
}

export default function CallDetailModal({ call: initial, onClose }) {
  const [call, setCall] = useState(initial);
  const [playing, setPlaying] = useState(false);

  // Fetch the full record (transcript may be large / omitted from the list).
  useEffect(() => {
    api.get(`/calls/${initial._id}`).then((d) => setCall(d.call)).catch(() => {});
  }, [initial._id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const turns = parseTranscript(call.transcript);
  const hasRecording = Boolean(call.recordingUrl);

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3 style={{ fontSize: 17 }}>{call.patientName}</h3>
            <div className="t-sub num" style={{ marginTop: 3 }}>
              {call.phoneNumber} · {call.campaignId?.name || ''} · {fmtDateTime(call.createdAt)}
            </div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
        </div>

        <div className="modal-body">
          <div className="pill-row" style={{ marginBottom: 18 }}>
            <Badge tone={statusTone(call.status)}>{STATUS_LABEL[call.status]}</Badge>
            <Badge tone={outcomeTone(call.outcome)}>{OUTCOME_LABEL[call.outcome]}</Badge>
          </div>

          <div className="modal-meta">
            <div className="mm"><div className="k">Duration</div><div className="v num">{fmtDuration(call.durationSeconds)}</div></div>
            <div className="mm"><div className="k">Billed minutes</div><div className="v num">{call.billedMinutes} min</div></div>
            <div className="mm"><div className="k">Doctor / Dept</div><div className="v">{call.doctorOrDept || '—'}</div></div>
            <div className="mm"><div className="k">Appointment</div><div className="v num">{fmtDateTime(call.appointmentAt)}</div></div>
          </div>

          {hasRecording ? (
            <div className="player">
              <button className="play" onClick={() => setPlaying((p) => !p)} aria-label="Play recording">
                <Icon.Play />
              </button>
              <div className="wave">
                {WAVE.map((h, i) => (
                  <i key={i} className={playing && i < 8 ? 'on' : ''} style={{ height: `${h}%` }} />
                ))}
              </div>
              <span className="t-sub num">{fmtDuration(call.durationSeconds)}</span>
            </div>
          ) : (
            <div className="mini-note" style={{ marginBottom: 18 }}>
              <Icon.Info /><span>No recording — this call was {STATUS_LABEL[call.status].toLowerCase()}.</span>
            </div>
          )}

          {turns.length > 0 && (
            <div className="transcript">
              <div className="th">Transcript</div>
              {turns.map((t, i) => (
                <div className="turn" key={i}>
                  <div className={`who ${t.who}`}>{t.who === 'ai' ? 'AI' : 'Patient'}</div>
                  <div className="say">{t.say}</div>
                </div>
              ))}
            </div>
          )}

          {hasRecording && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <a className="btn ghost sm" href={call.recordingUrl} target="_blank" rel="noreferrer">
                <Icon.Download />Download recording
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
