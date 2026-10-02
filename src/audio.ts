/** Procedural bed. Starts silent so the picture carries the film. */
export function createScore() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let enabled = false;

  function ensure(): void {
    if (context) return;
    const AudioCtx = window.AudioContext;
    context = new AudioCtx();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.4;
    filter.connect(master);

    const fundamental = context.createOscillator();
    fundamental.type = 'sine';
    fundamental.frequency.value = 78;
    const fifth = context.createOscillator();
    fifth.type = 'triangle';
    fifth.frequency.value = 156;
    const fifthGain = context.createGain();
    fifthGain.gain.value = 0.18;
    fundamental.connect(filter);
    fifth.connect(fifthGain);
    fifthGain.connect(filter);
    fundamental.start();
    fifth.start();

    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let noise = 0;
    for (let i = 0; i < length; i += 1) {
      noise = noise * 0.96 + (Math.random() * 2 - 1) * 0.04;
      data[i] = noise;
    }
    const wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 540;
    const windGain = context.createGain();
    windGain.gain.value = 0.22;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    wind.start();
  }

  return {
    get enabled() {
      return enabled;
    },
    toggle(): boolean {
      ensure();
      enabled = !enabled;
      const now = context!.currentTime;
      master!.gain.cancelScheduledValues(now);
      master!.gain.linearRampToValueAtTime(enabled ? 0.055 : 0, now + 0.35);
      if (context!.state === 'suspended') void context!.resume();
      return enabled;
    },
    setPlace(z: number): void {
      if (!filter || !context) return;
      const next = 280 + Math.min(900, Math.max(0, z / 6));
      filter.frequency.setTargetAtTime(next, context.currentTime, 0.4);
    },
  };
}
