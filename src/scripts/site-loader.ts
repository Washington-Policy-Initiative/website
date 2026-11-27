/**
 * Loading screen messages. The page starts with the first message; partway through the
 * animation it fades to one of the others, picked at random. Text only (textContent).
 * Does nothing unless public/loader-gate.js turned the loading screen on.
 */
const MESSAGES = [
  'Student-built website loading…',
  'Loading nonpartisan pixels…',
  'Checking our sources (twice)…',
  'Running the regressions…',
];
const SWAP_AT_MS = 1100; // about when the W finishes shrinking and growing
const FADE_MS = 250; // matches the CSS transition

if (document.documentElement.classList.contains('show-loader')) {
  const el = document.querySelector<HTMLElement>('[data-loader-message]');
  if (el) {
    window.setTimeout(() => {
      el.classList.add('is-swapping');
      window.setTimeout(() => {
        el.textContent = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        el.classList.remove('is-swapping');
      }, FADE_MS);
    }, SWAP_AT_MS);
  }
}
