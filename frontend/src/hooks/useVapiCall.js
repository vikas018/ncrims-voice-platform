import { useRef, useState, useCallback } from 'react';

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
  const vapiRef = useRef(null);
  const timers = useRef([]);

  const publicKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
  const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;
  const isLive = Boolean(publicKey && assistantId);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    setState('connecting');

    if (!isLive) {
      // --- Demo simulation ---
      timers.current.push(setTimeout(() => setState('live'), 1200));
      return;
    }

    // --- Real Vapi Web SDK ---
    // The specifier is held in a variable so the bundler treats this as a pure
    // runtime import — the app builds and runs without the package installed.
    // To enable live calls: `npm i @vapi-ai/web` and set the two VITE_VAPI_* vars.
    try {
      const sdk = '@vapi-ai/web';
      const { default: Vapi } = await import(/* @vite-ignore */ sdk);
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;
      vapi.on('call-start', () => setState('live'));
      vapi.on('call-end', () => setState('idle'));
      vapi.on('error', () => setState('idle'));
      await vapi.start(assistantId);
    } catch (err) {
      console.error('Vapi SDK not available, falling back to demo:', err);
      timers.current.push(setTimeout(() => setState('live'), 1200));
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

  return { state, isLive, start, stop };
}

export default useVapiCall;
