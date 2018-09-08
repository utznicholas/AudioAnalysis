
class ProcessorNode {
  constructor(size, inputs = 1, outputs = 1) {
    this.size = size;
    this._inputs = [];
    for (let i = 0; i < inputs; i++) this._inputs[i] = {ready: true, node: null, channel: 0};
    this._outputs = [];
    this.out = [];
    for (let i = 0; i < outputs; i++) {
      this._outputs[i] = [];
      this.out[i] = new Float32Array(size);
    }
  }
  
  connect(node, outChannel = 0, inChannel = 0) {
    this._outputs[outChannel].push({
      node: node,
      channel: inChannel
    });
    node._connected(this, outChannel, inChannel);
  }
  
  _connected(node, outChannel, inChannel) {
    let input = this._inputs[inChannel];
    input.node = node;
    input.channel = outChannel;
    input.ready = false;
  }
  
  _dataReady(inChannel = 0) {
    this._inputs[inChannel].ready = true;
    for (let i = 0; i < this._inputs.length; i++) {
      if (!this._inputs[i].ready && this._inputs[i].node !== null) return;
    }
    this.process();
    this.output();
  }
  
  process() {
    
  }
  
  isConnected(channel = 0) {
    return this._inputs[channel].node !== null
  }
  
  getInput(channel = 0) {
    let input = this._inputs[channel];
    return input.node.out[input.channel];
  }
  
  output() {
    for (let i = 0; i < this._inputs.length; i++) this._inputs[i].ready = false;
    for (let i = 0; i < this._outputs.length; i++) {
      let o = this._outputs[i];
      for (let j = 0; j < o.length; j++) {
        let oj = o[j];
        oj.node._dataReady(oj.channel);
      }
    }
  }
}

class AnalyserSourceNode extends ProcessorNode {
  constructor(analyser) {
    super(analyser.frequencyBinCount, 0, 2);
    this.analyser = analyser;
    this.freqs = new Uint8Array(analyser.frequencyBinCount);
    this.times = new Uint8Array(analyser.frequencyBinCount);
  }
  
  _connected(node, outC, inC) {
    throw new Error("SourceNode cannot have inputs");
  }
  
  process() {
    this.analyser.getByteFrequencyData(this.freqs);
    this.analyser.getByteTimeDomainData(this.times);
    
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      this.out[0][i] = this.freqs[i] / 255;
      this.out[1][i] = this.times[i] / 255;
    }
    
    this.output();
  }
  
  static get FREQUENCY() {
    return 0;
  }
  
  static get TIME() {
    return 1;
  }
}

class AveragingNode extends ProcessorNode {
  constructor(size, averaging) {
    super(size);
    this.averaging = averaging;
  }
  
  process() {
    let inputs = this.getInput();
    let outputs = this.out[0];
    for (let i = 0; i < this.size; i++) {
      outputs[i] += (inputs[i] - outputs[i]) / this.averaging;
    }
  }
}

class StdevNode extends ProcessorNode {
  constructor(size, averaging) {
    super(size, 1, 2);
    this.averaging = averaging;
  }
  
  process() {
    let inputs = this.getInput(0);
    let avgs = this.out[1];
    let avgDifs = this.out[0];
    for (let i = 0; i < this.size; i++) {
      let dif = inputs[i] - avgs[i]
      avgs[i] += dif / this.averaging;
      avgDifs[i] += (Math.abs(dif) - avgDifs[i]) / this.averaging;
    }
  }
}

class LogisticNode extends ProcessorNode {
  constructor(size) {
    super(size, 1, 1);
  }
  
  process() {
    let input = this.getInput();
    let output = this.out[0];
    for (let i = 0; i < this.size; i++) {
      output[i] = 1 / (1 + Math.pow(Math.E, -10 * (input[i] - 0.5)));
    }
  }
}

class DifferenceNode extends ProcessorNode {
  constructor(size) {
    super(size, 2, 1);
  }
  
  process() {
    let a = this.getInput(0);
    let b = this.getInput(1);
    let out = this.out[0];
    for (let i = 0; i < this.size; i++) {
      out[i] = a[i] - b[i];
    }
  }
}

class PeakNode extends ProcessorNode {
  constructor(size, averaging) {
    super(size, 1, 1);
    this.averaging = averaging;
  }
  
  process() {
    let input = this.getInput();
    let output = this.out[0];
    for (let i = 0; i < this.size; i++) {
      if (output[i] > input[i]) output[i] += (input[i] - output[i]) / this.averaging;
      else output[i] = input[i];
    }
  }
}

class AntiPeakNode extends ProcessorNode {
  constructor(size, averaging) {
    super(size, 1, 1);
    this.averaging = averaging;
  }
  
  process() {
    let input = this.getInput();
    let output = this.out[0];
    for (let i = 0; i < this.size; i++) {
      if (output[i] < input[i]) output[i] += (input[i] - output[i]) / this.averaging;
      else output[i] = input[i];
    }
  }
}

class OutlierNode extends ProcessorNode {
  constructor(size, n = 1) {
    super(size, 2, 1);
    this.n = n;
  }
  
  process() {
    let dif = this.getInput(0);
    let stdev = this.getInput(1);
    let out = this.out[0];
    for (let i = 0; i < this.size; i++) {
      out[i] = 1 / (1 + Math.pow(Math.E, -2.5 * ((dif[i] / stdev[i]) - (this.n + 0.5))));
    }
  }
}

class QuotientNode extends ProcessorNode {
  constructor(size) {
    super(size, 2, 1);
  }
  
  process() {
    let div = this.getInput(0);
    let divis = this.getInput(1);
    let quot = this.out[0];
    for (let i = 0; i < this.size; i++) {
      quot[i] = div[i] / divis[i];
    }
  }
}

class DisplayNode extends ProcessorNode {
  constructor(size, inputs, canvas) {
    super(size, inputs, 0);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
  
  static colorForPerc(perc) {
    let hue = Math.max(240 - (300 * perc), 0);
    let sat = 1 / (1 + Math.pow(Math.E, -25 * (perc - 0.15)));
    let light = 0.5 / (1 + Math.pow(Math.E, -25 * (perc - 0.85))) + 0.5;
    light = perc > 0.1 ? Math.min(light, 1) : 0;
    //sat = 1;
    return `hsl(${hue}, ${sat * 100}%, ${light * 90}%)`;
  }
  
  static colorForPerc2(perc) {
    let hue = Math.max(240 - (300 * perc), 0);
    let sat = 1 / (1 + Math.pow(Math.E, -25 * (perc - 0.15)));
    let light = 0.5 / (1 + Math.pow(Math.E, -10 * (perc - 0.5))) + 0.5;
    return `hsl(${hue}, ${sat * 100}%, ${light * 50}%)`;
  }
  
  process() {
    this.render(this.ctx, this.canvas.height);
  }
  
  render(ctx, h) {
    
  }
  
  clear() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

class DotBarDisplay extends DisplayNode {
  constructor(size, canvas) {
    super(size, 2, canvas);
  }
  
  render(ctx, h) {
    this.clear();
    let inputs = this.getInput();
    for (let i = 0; i < this.size; i++) {
      let perc = inputs[i];
      ctx.fillStyle = DisplayNode.colorForPerc(perc);
      ctx.fillRect((i * 5) + 2, h * (1 - perc), 3, h * perc);
    }
    
    if (this.isConnected(1)) {
      let peaks = this.getInput(1);
      for (let i = 0; i < this.size; i++) {
        let perc = peaks[i];
        ctx.fillStyle = perc > inputs[i] ? DisplayNode.colorForPerc(perc) : "#000";
        ctx.fillRect((i * 5) + 2, h * (1 - perc), 3, 1);
      }
    }
  }
}

class LineDisplay extends DisplayNode {
  constructor(size, canvas) {
    super(size, 1, canvas);
  }
  
  render(ctx, h) {
    this.clear();
    let w = this.canvas.width / (this.size - 1);
    let max = 0.0;
    
    let input = this.getInput();
    
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1 * w, 0.5 * h);
    
    for (let i = 0; i < this.size; i++) {
      let perc = input[i];
      max = Math.max(max, Math.abs(perc - 0.5));
      ctx.lineTo(i * w, perc * h);
    }
    
    ctx.strokeStyle = DisplayNode.colorForPerc2(max * 2);
    ctx.stroke();
  }
}

class HistoryDisplay extends DisplayNode {
  constructor(size, canvas) {
    super(size, 1, canvas);
    this.x = 0;
  }
  
  render(ctx, h) {
    this.x++;
    this.x %= this.canvas.width;
    ctx.fillStyle = "#f00";
    ctx.fillRect(this.x + 1, 1, 1, h);
    
    let input = this.getInput();
    
    for (let i = 0; i < this.size; i++) {
      let perc = input[i];
      ctx.fillStyle = DisplayNode.colorForPerc(perc);
      ctx.fillRect(this.x, h - i, 1, 1);
    }
  }
}
