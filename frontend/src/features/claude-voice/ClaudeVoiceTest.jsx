/**
 * /voice-test — standalone page to test a Claude-driven Hindi voice chat.
 *
 * ISOLATED TEST FEATURE, parallel to the Vapi web-call assistant. Renders
 * outside the authenticated AppShell so it's easy to open and compare.
 *
 * Gated by VITE_ENABLE_CLAUDE_VOICE at the route level (see App.jsx).
 */
import { useEffect, useRef, useState } from 'react';
import { useClaudeVoice, isSupported } from './useClaudeVoice.js';
import { DEFAULT_FIRST_MESSAGE, DEFAULT_SYSTEM_PROMPT } from './config.js';

const STATUS_LABEL = {
  idle: 'Idle',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
  error: 'Error',
};
const STATUS_COLOR = {
  idle: '#8FB0B2',
  listening: '#2e9e5b',
  thinking: '#c9871f',
  speaking: '#2b7de0',
  error: '#c0392b',
};

export default function ClaudeVoiceTest() {
  const voice = useClaudeVoice();
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [firstMessage, setFirstMessage] = useState(DEFAULT_FIRST_MESSAGE);
  const scrollRef = useRef(null);

  const running = voice.status !== 'idle' && voice.status !== 'error';

  // Keep the editable prompts in sync with the hook (only matters before Start).
  useEffect(() => {
    voice.setSystemPrompt(systemPrompt);
  }, [systemPrompt, voice]);
  useEffect(() => {
    voice.setFirstMessage(firstMessage);
  }, [firstMessage, voice]);

  // Auto-scroll the transcript.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [voice.transcript, voice.interim]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0 }}>Gemini Voice — Hindi Test</h2>
            <div style={styles.sub}>
              Browser STT → Gemini → browser TTS. Separate from the Vapi assistant.
            </div>
          </div>
          <div style={{ ...styles.statusPill, background: STATUS_COLOR[voice.status] }}>
            <span style={styles.dot} /> {STATUS_LABEL[voice.status]}
          </div>
        </div>

        {!isSupported && (
          <div style={styles.warn}>
            Voice is not supported in this browser. Please use <b>Google Chrome</b> on desktop.
          </div>
        )}

        <div style={styles.grid}>
          <label style={styles.label}>
            System prompt
            <textarea
              style={styles.textarea}
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={running}
            />
          </label>
          <label style={styles.label}>
            First message (bot speaks this first)
            <textarea
              style={styles.textarea}
              rows={2}
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              disabled={running}
            />
          </label>
        </div>

        <div style={styles.controls}>
          {!running ? (
            <button style={styles.startBtn} onClick={voice.start} disabled={!isSupported}>
              ● Start
            </button>
          ) : (
            <button style={styles.stopBtn} onClick={voice.stop}>
              ■ Stop
            </button>
          )}
          <span style={styles.hint}>
            Speak in Hindi after the greeting. Talk over the bot to interrupt it.
          </span>
        </div>

        {voice.errorMsg && <div style={styles.err}>{voice.errorMsg}</div>}

        <div style={styles.transcript} ref={scrollRef}>
          {voice.transcript.length === 0 && (
            <div style={styles.empty}>Press Start — the bot will greet you, then listen.</div>
          )}
          {voice.transcript.map((m, i) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              style={{
                ...styles.bubble,
                ...(m.role === 'user' ? styles.bubbleUser : styles.bubbleBot),
              }}
            >
              <div style={styles.bubbleWho}>{m.role === 'user' ? 'You' : 'Bot'}</div>
              {m.text}
            </div>
          ))}
          {voice.interim && (
            <div style={{ ...styles.bubble, ...styles.bubbleUser, opacity: 0.6 }}>
              <div style={styles.bubbleWho}>You</div>
              {voice.interim}…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1b1c',
    color: '#e8f0f0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '32px 16px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 680,
    background: '#15282a',
    border: '1px solid #244043',
    borderRadius: 14,
    padding: 22,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  sub: { fontSize: 13, color: '#9FC2C4', marginTop: 4 },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  dot: { width: 8, height: 8, borderRadius: 999, background: 'rgba(255,255,255,.85)' },
  warn: {
    marginTop: 14,
    padding: '10px 12px',
    background: '#3a2a12',
    border: '1px solid #6b4e1f',
    borderRadius: 8,
    fontSize: 13.5,
  },
  grid: { display: 'grid', gap: 12, marginTop: 18 },
  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#bcd6d7' },
  textarea: {
    width: '100%',
    background: '#0f1f21',
    color: '#e8f0f0',
    border: '1px solid #2b4a4d',
    borderRadius: 8,
    padding: '9px 11px',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  controls: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, flexWrap: 'wrap' },
  startBtn: {
    background: '#2e9e5b',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '11px 22px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  stopBtn: {
    background: '#c0392b',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    padding: '11px 22px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  hint: { fontSize: 12.5, color: '#8FB0B2' },
  err: {
    marginTop: 12,
    padding: '9px 12px',
    background: '#3a1715',
    border: '1px solid #6b2a24',
    borderRadius: 8,
    fontSize: 13,
    color: '#f4b8b2',
  },
  transcript: {
    marginTop: 16,
    height: 320,
    overflowY: 'auto',
    background: '#0f1f21',
    border: '1px solid #244043',
    borderRadius: 10,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  empty: { color: '#6d8c8e', fontSize: 13.5, margin: 'auto', textAlign: 'center' },
  bubble: { maxWidth: '82%', padding: '9px 12px', borderRadius: 12, fontSize: 14.5, lineHeight: 1.45 },
  bubbleUser: { alignSelf: 'flex-end', background: '#1d4f6b', borderBottomRightRadius: 3 },
  bubbleBot: { alignSelf: 'flex-start', background: '#20383a', borderBottomLeftRadius: 3 },
  bubbleWho: { fontSize: 11, fontWeight: 700, opacity: 0.65, marginBottom: 2 },
};
