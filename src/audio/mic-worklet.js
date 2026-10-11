// Collects 2048-sample windows with a hop of 1024 and posts them to the main thread.
const WINDOW = 2048;
const HOP = 1024;

class MicWindowProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(WINDOW);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.filled++] = channel[i];
      if (this.filled === WINDOW) this.emit();
    }
    return true;
  }

  emit() {
    // currentTime is the start of this render quantum; the window ends just after it.
    this.port.postMessage({ samples: this.buffer.slice(), endTime: currentTime + 128 / sampleRate });
    this.buffer.copyWithin(0, HOP);
    this.filled = WINDOW - HOP;
  }
}

registerProcessor('mic-window', MicWindowProcessor);
