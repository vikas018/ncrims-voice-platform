import { useEffect, useRef, useState } from 'react';
import { Badge, Icon } from './ui.jsx';

/**
 * FREE announcement-call preview — no Vapi, no API, no credits, unlimited.
 * Speaks YOUR message aloud (browser speech), then lets you respond by
 * pressing a key OR saying the number out loud (browser speech recognition).
 */
const SAMPLE = { name: 'Rohit', doctor: 'Dr. Mehra', date: '18 November' };

const KEYS = [
  { digit: '1', label: 'Confirm', words: ['1', 'one', 'ek', 'confirm', 'haan', 'yes'], say: 'Dhanyavaad! Aapka appointment confirm ho gaya hai.' },
  { digit: '2', label: 'Reschedule', words: ['2', 'two', 'do', 'reschedule'], say: 'Theek hai, hum aapko naya samay batayenge. Dhanyavaad.' },
  { digit: '3', label: 'Cancel', words: ['3', 'three', 'teen', 'cancel', 'nahin', 'no'], say: 'Aapka appointment cancel kar diya gaya hai. Dhanyavaad.' },
];

function fill(msg) {
  return (msg || '')
    .replace(/\{name\}/gi, SAMPLE.name)
    .replace(/\{doctor\}/gi, SAMPLE.doctor)
    .replace(/\{date\}/gi, SAMPLE.date);
}

function speak(text, onEnd) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'hi-IN';
    const hindi = window.speechSynthesis.getVoices().find((v) => /hi[-_]IN|hindi/i.test(v.lang + v.name));
    if (hindi) u.voice = hindi;
    u.rate = 0.95;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  } catch { if (onEnd) onEnd(); }
}

export default function AnnouncementPreview({ message }) {
  const [phase, setPhase] = useState('idle'); // idle | playing | awaiting | listening | done
  const [outcome, setOutcome] = useState(null);
  const [heard, setHeard] = useState('');
  const mounted = useRef(true);
  const recRef = useRef(null);
  const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => { mounted.current = false; window.speechSynthesis?.cancel(); try { recRef.current?.stop(); } catch { /* noop */ } };
  }, []);

  const play = () => {
    setOutcome(null); setHeard('');
    setPhase('playing');
    speak(fill(message), () => mounted.current && setPhase('awaiting'));
  };

  const stop = () => { window.speechSynthesis?.cancel(); setPhase('awaiting'); };

  const press = (k) => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setOutcome(k); setPhase('done'); speak(k.say);
  };

  const matchWord = (transcript) => {
    const t = transcript.toLowerCase();
    setHeard(transcript);
    return KEYS.find((k) => k.words.some((w) => t.includes(w)));
  };

  const listen = () => {
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    recRef.current = rec;
    rec.lang = 'en-IN'; // picks up digits + Hindi/English words well
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e) => {
      for (let i = 0; i < e.results[0].length; i++) {
        const k = matchWord(e.results[0][i].transcript);
        if (k) return press(k);
      }
      setPhase('awaiting');
    };
    rec.onerror = () => mounted.current && setPhase('awaiting');
    rec.onend = () => mounted.current && setPhase((p) => (p === 'listening' ? 'awaiting' : p));
    setPhase('listening');
    try { rec.start(); } catch { setPhase('awaiting'); }
  };

  const reset = () => { window.speechSynthesis?.cancel(); try { recRef.current?.stop(); } catch { /* noop */ } setPhase('idle'); setOutcome(null); setHeard(''); };

  const playing = phase === 'playing';
  const showKeypad = phase === 'awaiting' || phase === 'listening' || phase === 'done';

  return (
    <div className="testcall" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button className="pulse-btn" onClick={playing ? stop : play}
          style={{ animation: playing ? 'none' : undefined, background: playing ? 'var(--bad)' : undefined }}
          aria-label={playing ? 'Stop' : 'Play announcement'}>
          {playing
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <Icon.Play width="26" height="26" />}
        </button>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
            Preview Announcement <Badge tone="b-good">FREE · unlimited</Badge>
          </h4>
          <p className="t-sub" style={{ marginTop: 3, maxWidth: '58ch' }}>
            {playing ? 'Playing — click the red button to stop.'
              : phase === 'listening' ? '🎤 Listening… say "one", "two" or "three".'
              : phase === 'awaiting' ? 'Message finished — press a key or say the number out loud.'
              : phase === 'done' ? `Patient chose ${outcome.digit} → ${outcome.label}.${heard ? ` (heard: "${heard}")` : ''}`
              : 'Hear your message in the browser, then respond by keypad or voice. No calls, no cost.'}
          </p>
        </div>
      </div>

      {showKeypad && (
        <div className="pill-row" style={{ alignItems: 'center' }}>
          {KEYS.map((k) => (
            <button key={k.digit} className="btn ghost" disabled={phase === 'done' && outcome?.digit !== k.digit}
              onClick={() => press(k)}
              style={{
                borderColor: outcome?.digit === k.digit ? 'var(--teal)' : undefined,
                background: outcome?.digit === k.digit ? 'var(--teal-50)' : undefined,
                opacity: phase === 'done' && outcome?.digit !== k.digit ? 0.45 : 1,
              }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{k.digit}</b> · {k.label}
            </button>
          ))}
          {SpeechRec && phase !== 'done' && (
            <button className="btn" onClick={listen} disabled={phase === 'listening'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" /></svg>
              {phase === 'listening' ? 'Listening…' : 'Say it'}
            </button>
          )}
          {phase === 'done' && <button className="btn ghost" onClick={reset}>Replay</button>}
        </div>
      )}
    </div>
  );
}
