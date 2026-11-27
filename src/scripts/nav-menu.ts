/**
 * Dropdown menus in the main navigation (disclosure pattern: a button with
 * aria-expanded that shows or hides a list of ordinary links).
 *
 * Opens on: mouse hover, click/tap on the button, Enter/Space (native button), and
 * keyboard focus on the button. Arrow Down from the button moves into the list.
 * Closes on: Escape (focus returns to the button), clicking or tapping outside,
 * tabbing out of the menu, or the mouse leaving it (when it was opened by hovering).
 *
 * Without this script, CSS shows the list on hover and focus-within instead.
 */

type Reason = 'hover' | 'click' | 'focus';

function initMenu(menu: HTMLElement): void {
  const button = menu.querySelector<HTMLButtonElement>('.nav-menu__button');
  const list = menu.querySelector<HTMLElement>('.nav-menu__list');
  if (!button || !list) return;

  let openedBy: Reason | null = null;
  let leaveTimer: number | undefined;

  const isOpen = () => menu.hasAttribute('data-open');
  const links = () => Array.from(list.querySelectorAll<HTMLAnchorElement>('a'));

  function open(reason: Reason): void {
    window.clearTimeout(leaveTimer);
    if (!isOpen()) openedBy = reason;
    menu.setAttribute('data-open', '');
    button!.setAttribute('aria-expanded', 'true');
  }
  function close(returnFocus = false): void {
    window.clearTimeout(leaveTimer);
    openedBy = null;
    menu.removeAttribute('data-open');
    button!.setAttribute('aria-expanded', 'false');
    if (returnFocus) button!.focus();
  }

  // Click / tap / Enter / Space (buttons fire "click" for all of these).
  button.addEventListener('click', () => {
    if (!isOpen()) open('click');
    else if (openedBy === 'hover' || openedBy === 'focus') openedBy = 'click'; // keep it open
    else close();
  });

  // Hover (mouse and pen only; a tap must not open and then immediately close it).
  menu.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') open('hover');
  });
  menu.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'touch' || openedBy !== 'hover') return;
    leaveTimer = window.setTimeout(() => close(), 200);
  });

  // Keyboard focus on the button opens the menu (not focus from a mouse click).
  button.addEventListener('focus', () => {
    if (button.matches(':focus-visible')) open('focus');
  });

  // Arrow Down from the button moves into the list; Escape anywhere closes.
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      open('click');
      links()[0]?.focus();
    }
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close(true);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = links();
      const i = items.indexOf(document.activeElement as HTMLAnchorElement);
      if (i === -1) return;
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? Math.min(i + 1, items.length - 1) : i - 1;
      if (next < 0) button.focus();
      else items[next].focus();
    }
  });

  // Tabbing out of the menu, or clicking/tapping elsewhere, closes it.
  menu.addEventListener('focusout', (e) => {
    if (!menu.contains(e.relatedTarget as Node | null)) close();
  });
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !menu.contains(e.target as Node)) close();
  });
}

document.documentElement.classList.add('js-nav');
for (const menu of document.querySelectorAll<HTMLElement>('[data-nav-menu]')) initMenu(menu);
