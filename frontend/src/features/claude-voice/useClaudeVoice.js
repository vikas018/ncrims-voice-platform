/**
 * useClaudeVoice — browser-only Hindi voice loop driven by Claude.
 *
 * ISOLATED TEST FEATURE. Does not touch useVapiCall or any Vapi code.
 *
 * Pipeline:
 *   Web Speech API (SpeechRecognition, hi-IN) for STT
 *     -> POST /api/claude-voice/chat for the reply
 *       -> speechSynthesis (Hindi voice) for TTS
 *
 * Flow:   Start -> bot speaks FIRST MESSAGE -> listen -> backend -> speak reply -> listen ...
 * Barge-in: if the user speaks a full phrase while the bot is talking, TTS is
 *           cancelled and we switch to listening.
 * Status:  idle | listening | thinking | speaking | error
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FIRST_MESSAGE,
  DEFAULT_SYSTEM_PROMPT,
  STT_LANG,
  TTS_LANG,
} from './config.js';
import { sendChat } from './claudeVoiceApi.js';

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export const isSupported = Boolean(SR && synth);

// Spoken aloud if the API call fails — an apology in Hindi.
const HINDI_ERROR =
  'Maaf kijiye, abhi takneeki samasya ho rahi hai. Kripya thodi der baad koshish karein.';

export function useClaudeVoice() {
  const [status, setStatus] = useState('idle'); // idle|listening|thinking|speaking|error
  const [transcript, setTranscript] = useState([]); // [{ role, text }]
  const [interim, setInterim] = useState(''); // live partial user speech
  const [errorMsg, setErrorMsg] = useState('');

  const recRef = useRef(null);
  const hindiVoiceRef = useRef(null);
  const activeRef = useRef(false); // is a session running
  const statusRef = useRef('idle'); // mirror of status for use inside callbacks
  const historyRef = useRef([]); // full [{role, content}] sent to the API
  const systemRef = useRef(DEFAULT_SYSTEM_PROMPT);
  const firstRef = useRef(DEFAULT_FIRST_MESSAGE);

  const setStat = useCallback((s) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // ---- pick a Hindi TTS voice once voices are available ----
  useEffect(() => {
    if (!synth) return undefined;
    const load = () => {
      const voices = synth.getVoices();
      hindiVoiceRef.current =
        voices.find((v) => v.lang === TTS_LANG) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('hi')) ||
        null;
    };
    load();
    synth.onvoiceschanged = load;
    return () => {
      if (synth) synth.onvoiceschanged = null;
    };
  }, []);

  // Speak one chunk; resolves when it finishes (or is cancelled / errors).
  const speak = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!synth || !text) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = TTS_LANG;
        if (hindiVoiceRef.current) u.voice = hindiVoiceRef.current;
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      }),
    []
  );

  // Split on Hindi/Latin sentence enders so playback feels incremental, and so
  // a barge-in can cancel between sentences.
  const speakChunks = useCallback(
    async (text) => {
      const parts = text
        .split(/(?<=[।?!])\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      const chunks = parts.length ? parts : [text];
      for (const c of chunks) {
        if (!activeRef.current || statusRef.current !== 'speaking') break; // cancelled / barged-in
        // eslint-disable-next-line no-await-in-loop
        await speak(c);
      }
    },
    [speak]
  );

  // Send a finished user phrase to Claude, speak the reply.
  const processUser = useCallback(
    async (text) => {
      const clean = text.trim();
      if (!clean) return;
      setInterim('');
      historyRef.current.push({ role: 'user', content: clean });
      setTranscript((t) => [...t, { role: 'user', text: clean }]);
      setStat('thinking');

      let reply;
      try {
        reply = await sendChat({ system: systemRef.current, messages: historyRef.current });
      } catch (e) {
        if (!activeRef.current) return;
        setErrorMsg(e?.message || 'Claude request failed.');
        reply = HINDI_ERROR;
      }
      if (!activeRef.current) return;

      const spoken = reply || HINDI_ERROR;
      historyRef.current.push({ role: 'assistant', content: spoken });
      setTranscript((t) => [...t, { role: 'assistant', text: spoken }]);
      setStat('speaking');
      await speakChunks(spoken);

      if (activeRef.current) setStat('listening');
    },
    [setStat, speakChunks]
  );

  const buildRecognition = useCallback(() => {
    const rec = new SR();
    rec.lang = STT_LANG;
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (ev) => {
      let finalText = '';
      let interimText = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }

      const st = statusRef.current;
      if (st === 'speaking') {
        // Barge-in only on a FINAL phrase — interim results here are usually the
        // bot's own TTS leaking into the mic, not the user.
        if (finalText) {
          if (synth) synth.cancel();
          setStat('listening');
          processUser(finalText);
        }
        return;
      }
      if (st === 'listening') {
        if (interimText) setInterim(interimText);
        if (finalText) processUser(finalText);
      }
      // thinking / idle / error: ignore mic input
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        activeRef.current = false;
        if (synth) synth.cancel();
        setErrorMsg('Microphone access was blocked. Allow the mic, then press Start again.');
        setStat('error');
      }
      // 'no-speech' / 'aborted' are normal; onend restarts recognition.
    };

    rec.onend = () => {
      // Chrome stops recognition on silence — restart it while the session runs.
      if (activeRef.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };

    return rec;
  }, [processUser, setStat]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setErrorMsg('Voice is not supported in this browser. Please use Google Chrome on desktop.');
      setStat('error');
      return;
    }
    if (activeRef.current) return;

    setErrorMsg('');
    setInterim('');
    historyRef.current = [];
    activeRef.current = true;

    const first = firstRef.current.trim();
    if (first) {
      historyRef.current.push({ role: 'assistant', content: first });
      setTranscript([{ role: 'assistant', text: first }]);
    } else {
      setTranscript([]);
    }

    // Start recognition first (this prompts for mic permission). Results are
    // ignored until status becomes 'listening'.
    const rec = buildRecognition();
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* start may throw if called twice in quick succession */
    }

    if (first) {
      setStat('speaking');
      await speakChunks(first);
    }
    if (activeRef.current) setStat('listening');
  }, [buildRecognition, speakChunks, setStat]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (synth) synth.cancel();
    if (recRef.current) {
      recRef.current.onend = null;
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
      recRef.current = null;
    }
    setInterim('');
    setStat('idle');
  }, [setStat]);

  const setSystemPrompt = useCallback((v) => {
    systemRef.current = v;
  }, []);
  const setFirstMessage = useCallback((v) => {
    firstRef.current = v;
  }, []);

  // Clean up on unmount so the mic/TTS never keep running.
  useEffect(
    () => () => {
      activeRef.current = false;
      if (synth) synth.cancel();
      if (recRef.current) {
        recRef.current.onend = null;
        try {
          recRef.current.stop();
        } catch {
          /* noop */
        }
      }
    },
    []
  );

  return {
    status,
    transcript,
    interim,
    errorMsg,
    isSupported,
    start,
    stop,
    setSystemPrompt,
    setFirstMessage,
  };
}

export default useClaudeVoice;
