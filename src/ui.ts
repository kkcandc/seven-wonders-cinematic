import { WONDERS } from './sim/wonders';

export interface Hud {
  onPlay(cb: () => void): void;
  onScrub(cb: (t: number) => void): void;
  onChip(cb: (index: number) => void): void;
  onSound(cb: () => void): void;
  onFull(cb: () => void): void;
  setProgress(t: number): void;
  setWonder(name: string, place: string, index: number): void;
  setPlaying(playing: boolean, exploring: boolean): void;
  setSound(on: boolean): void;
  ready(): void;
  fail(message: string): void;
}

export function mountHud(): Hud {
  const veil = document.querySelector<HTMLElement>('#veil');
  const title = document.querySelector<HTMLElement>('#wonder-name');
  const place = document.querySelector<HTMLElement>('#wonder-place');
  const play = document.querySelector<HTMLButtonElement>('#play');
  const sound = document.querySelector<HTMLButtonElement>('#sound');
  const full = document.querySelector<HTMLButtonElement>('#full');
  const scrub = document.querySelector<HTMLInputElement>('#scrub');
  const chips = document.querySelector<HTMLElement>('#chips');
  const mode = document.querySelector<HTMLElement>('#mode');
  if (!veil || !title || !place || !play || !sound || !full || !scrub || !chips || !mode) {
    throw new Error('HUD markup is missing');
  }

  WONDERS.forEach((wonder, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = wonder.chip;
    button.dataset.index = String(index);
    button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
    chips.append(button);
  });

  let scrubbing = false;
  let playCb = () => {};
  let scrubCb = (_t: number) => {};
  let chipCb = (_index: number) => {};
  let soundCb = () => {};
  let fullCb = () => {};
  let wonderIndex = -1;

  play.addEventListener('click', () => playCb());
  sound.addEventListener('click', () => soundCb());
  full.addEventListener('click', () => fullCb());
  scrub.addEventListener('pointerdown', () => {
    scrubbing = true;
  });
  window.addEventListener('pointerup', () => {
    scrubbing = false;
  });
  scrub.addEventListener('input', () => {
    scrubCb(Number(scrub.value));
  });
  chips.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const index = Number(target.dataset.index);
    if (Number.isFinite(index)) chipCb(index);
  });

  return {
    onPlay(cb) {
      playCb = cb;
    },
    onScrub(cb) {
      scrubCb = cb;
    },
    onChip(cb) {
      chipCb = cb;
    },
    onSound(cb) {
      soundCb = cb;
    },
    onFull(cb) {
      fullCb = cb;
    },
    setProgress(t) {
      if (scrubbing) return;
      scrub.value = String(t);
    },
    setWonder(name, where, index) {
      if (index === wonderIndex) return;
      wonderIndex = index;
      title.textContent = name;
      place.textContent = where;
      title.classList.remove('swap');
      void title.offsetWidth;
      title.classList.add('swap');
      chips.querySelectorAll<HTMLButtonElement>('.chip').forEach((chip, chipIndex) => {
        const active = chipIndex === index;
        chip.classList.toggle('active', active);
        chip.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    },
    setPlaying(playing, exploring) {
      play.textContent = exploring ? 'Resume' : playing ? 'Pause' : 'Play';
      play.setAttribute('aria-label', play.textContent);
      mode.textContent = exploring ? 'Exploring' : playing ? 'Film' : 'Paused';
    },
    setSound(on) {
      sound.textContent = on ? 'Mute' : 'Sound';
      sound.setAttribute('aria-pressed', on ? 'true' : 'false');
    },
    ready() {
      veil.classList.add('hide');
    },
    fail(message) {
      veil.classList.remove('hide');
      const heading = veil.querySelector('h2');
      const kicker = veil.querySelector('p');
      if (kicker) kicker.textContent = 'Seven Wonders';
      if (heading) heading.textContent = message;
    },
  };
}
