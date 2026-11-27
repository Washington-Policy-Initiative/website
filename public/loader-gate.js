/*
 * Loading screen gate. Loaded as a small blocking script in <head> (an external file, so
 * the CSP's script-src 'self' still applies; no inline code). It runs before the page is
 * drawn, so it can decide without a flash whether to show the loading screen:
 * only on the first page of a browser session. The flag lives in sessionStorage (cleared
 * when the tab closes); nothing is sent anywhere. If storage is blocked, no loader shows.
 */
try {
  if (!sessionStorage.getItem('wpi-loaded')) {
    sessionStorage.setItem('wpi-loaded', '1');
    document.documentElement.classList.add('show-loader');
  }
} catch (e) {
  /* Storage unavailable (private mode, blocked): skip the loading screen. */
}
