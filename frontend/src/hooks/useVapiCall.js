import { useRef, useState, useCallback, useEffect } from 'react';

// Hard safety: auto-hang up a live demo call after this many seconds, so a
// forgotten call can't quietly burn Vapi credits.
const MAX_CALL_SECONDS = 120;

/**
 * Drives the "Test Call in Browser" button.
 *
 * DEMO MODE (default): simulates the call lifecycle so the UI works with zero
 * cost and no keys — perfect for building/iterating.
 *
 * LIVE MODE: when VITE_VAPI_PUBLIC_KEY + VITE_VAPI_ASSISTANT_ID are set AND the
 * '@vapi-ai/web' package is installed, it starts a real in-browser voice call.
 * We dynamic-import the SDK only when a key exists, so the app builds and runs
 * fine without the dependency.
 *
 *   state: 'idle' | 'connecting' | 'live' | 'ending'
 */
export function useVapiCall() {
  const [state, setState] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsed, setElapsed] = useState(0); // seconds the call has been live
  const [transcript, setTranscript] = useState([]); // [{ role: 'user'|'assistant', text }]
  const vapiRef = useRef(null);
  const timers = useRef([]);
  const stopRef = useRef(() => {});

  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
  const isLive = Boolean(publicKey && assistantId);

  const start = useCallback(async (overrides) => {
    if (state !== 'idle') return;
    setErrorMsg('');
    setTranscript([]);
    setState('connecting');

    if (!isLive) {
      // --- Demo simulation (no key set) ---
      timers.current.push(setTimeout(() => setState('live'), 1200));
      return;
    }

    // --- Real Vapi Web SDK ---
    try {
      // Literal dynamic import so Vite resolves + code-splits it properly.
      const { default: Vapi } = await import('@vapi-ai/web');
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;
      vapi.on('call-start', () => setState('live'));
      vapi.on('call-end', () => setState('idle'));
      // Live transcript: Vapi emits 'message' events; keep the FINAL lines.
      vapi.on('message', (msg) => {
        if (msg?.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript) {
          setTranscript((t) => [...t, { role: msg.role === 'assistant' ? 'assistant' : 'user', text: msg.transcript }]);
        }
      });
      vapi.on('error', (e) => {
        console.error('Vapi error event:', e);
        let msg = e?.error?.message ?? e?.errorMsg ?? e?.message ?? e;
        if (Array.isArray(msg)) msg = msg.join('; ');
        if (msg && typeof msg === 'object') { try { msg = JSON.stringify(msg); } catch { msg = 'call error'; } }
        setErrorMsg(`Vapi: ${msg}`);
        setState('idle');
      });

      // Only override the opening line — it's a safe override. (The system prompt
      // override needs a full model spec that Vapi is picky about, so we let the
      // call use the assistant's dashboard prompt; the edited instructions are
      // still saved with the campaign for production.)
      const ao = {};
      if (overrides?.firstMessage) ao.firstMessage = overrides.firstMessage;
      await vapi.start(assistantId, Object.keys(ao).length ? ao : undefined);
    } catch (err) {
      // Real failure — surface it instead of silently pretending (so we can debug).
      console.error('Vapi call failed:', err);
      setErrorMsg(err?.message || 'Could not start the call. Check the public key, mic permission, and Vapi credits.');
      setState('idle');
    }
  }, [state, isLive, publicKey, assistantId]);

  const stop = useCallback(() => {
    setState('ending');
    if (vapiRef.current) {
      try { vapiRef.current.stop(); } catch { /* noop */ }
      vapiRef.current = null;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTimeout(() => setState('idle'), 400);
  }, []);

  // Keep a ref to stop so the timer effect can auto-hang up without re-subscribing.
  stopRef.current = stop;

  // Live timer: counts seconds while the call is live, auto-hangs up at the cap,
  // and resets to 0 when the call ends.
  useEffect(() => {
    if (state !== 'live') { setElapsed(0); return undefined; }
    const id = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= MAX_CALL_SECONDS) stopRef.current();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  return { state, isLive, start, stop, errorMsg, elapsed, maxSeconds: MAX_CALL_SECONDS, transcript };
}

export default useVapiCall;
