/** Tiny element helper: h('button', { class: 'primary', onclick }, 'Text'). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else el.setAttribute(key, value);
  }
  el.append(...children.filter((c) => c !== null && c !== undefined));
  return el;
}

export function starsEl(count) {
  const el = h('span', { class: 'stars', 'aria-label': `${count} of 3 stars` });
  for (let i = 0; i < 3; i++) el.append(h('span', { class: i < count ? '' : 'off' }, '★'));
  return el;
}

export function backButton(go) {
  return h('button', { class: 'back', onclick: () => go('list') }, '← Songs');
}

export function micError(err) {
  const denied = err && err.name === 'NotAllowedError';
  const text = denied
    ? 'Microphone access was blocked. Allow it in the browser address bar, then try again.'
    : 'Could not open the microphone. Check that an input device is plugged in.';
  return h('div', { class: 'notice error' }, text);
}
