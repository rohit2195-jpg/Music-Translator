// the tiny "tick" the real click wheel makes, synthesized so no audio file is needed

let ctx: AudioContext | null = null;

export function playClick() {
  try {
    ctx ??= new AudioContext();
    const length = Math.floor(ctx.sampleRate * 0.004);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
  } catch {
    // audio not available, stay silent
  }
}
