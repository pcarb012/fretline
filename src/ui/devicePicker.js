import { getInputDevice, setInputDevice } from '../store.js';
import { h } from './dom.js';

/**
 * Input device chooser. onChange(deviceId) runs after a new choice is saved.
 * refresh() reloads the list; call it again once mic access is granted so names appear.
 */
export function createDevicePicker(onChange) {
  const select = h('select', { 'aria-label': 'Input device' });

  async function refresh() {
    let devices = [];
    try {
      devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    } catch {
      // No device list available; the default input is used.
    }
    const saved = getInputDevice();
    const named = devices.filter((d) => d.deviceId && d.deviceId !== 'default');
    const options = [
      h('option', { value: '' }, 'Default input'),
      ...named.map((d, i) => h('option', { value: d.deviceId }, d.label || `Input ${i + 1}`)),
    ];
    select.replaceChildren(...options);
    select.value = options.some((o) => o.value === saved) ? saved : '';
  }

  select.addEventListener('change', () => {
    setInputDevice(select.value);
    onChange(select.value);
  });
  refresh();
  const hint = h('small', {}, 'With an audio interface, plug the guitar into input 1. Fretline reads the first channel.');
  return { el: h('div', { class: 'device-picker' }, h('label', {}, 'Input ', select), hint), refresh };
}
