/**
 * Default SYSTEM PROMPT + FIRST MESSAGE for the Claude voice test.
 *
 * Copied from the production Vapi conversation defaults (Campaigns.jsx) so the
 * two assistants behave the same and the comparison is fair. These are only
 * DEFAULTS — the /voice-test screen lets you edit both live before starting.
 */

// Bot speaks this FIRST, before listening.
export const DEFAULT_FIRST_MESSAGE =
  'Namaste! Main NCRIMS hospital se bol rahi hoon. Kya main aapki appointment confirm kar sakti hoon?';

// System prompt. The backend appends a Hindi-output instruction on top of this,
// so you don't need to repeat "reply in Hindi" here.
export const DEFAULT_SYSTEM_PROMPT =
  'You are a polite female appointment-confirmation assistant for NCRIMS hospital in India. ' +
  'Speak naturally, warm and brief. Confirm the appointment, help reschedule if asked. ' +
  'Keep replies to 1-2 short sentences. Thank them and end politely. Do not give medical advice.';

// Speech recognition language. Hindi (India). Web Speech handles Hinglish well
// under hi-IN too.
export const STT_LANG = 'hi-IN';

// Preferred TTS language for picking a Hindi voice.
export const TTS_LANG = 'hi-IN';
