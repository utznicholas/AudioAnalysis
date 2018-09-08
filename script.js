var context = new (window.AudioContext || window.webkitAudioContext)();

var SMOOTHING = 0.25;

var AVERAGING = 25;
var STDEVS = 5;

var AUDIOS = document.getElementsByTagName("audio");

var HIST_CANVAS = document.getElementById("history-canvas");
var BAR_CANVAS = document.getElementById("bar-canvas");
var WAVE_CANVAS = document.getElementById("wave-canvas");
var FILT_CANVAS = document.getElementById("filt-canvas");

var WIDTH = 1024;
var HEIGHT = 128;

var BAR_WIDTH = 3;
var BAR_SPACE = 2;

var MAX_LIGHT = 1;
var MIN_VALUE = 0.1;

var BAND_PASS = true;
var Q = 50;

function initializeCanvas(cvs, ctx) {
  cvs.width = WIDTH;
  cvs.height = HEIGHT;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

var FFT_SIZE = 2 * HEIGHT;

var sineControl = document.getElementById("sine-control");
var sineFreqControl = document.getElementById("sine-freq");
var sineFreqLabel = document.getElementById("sine-freq-label");
var sineVolControl = document.getElementById("sine-vol");
var oscillatorShape = document.getElementById("oscillator-shape");
sineFreqControl.addEventListener("change", function(e) {
  sineFreqLabel.innerText = "Frequency: " + Math.pow(2, (sineFreqControl.value / 10)) + "Hz";
});

function colorForVal(perc) {
  let hue = Math.max(240 - (300 * perc), 0);
  let sat = 1 / (1 + Math.pow(Math.E, -25 * (perc - 0.15)));
  let light = 0.5 / (1 + Math.pow(Math.E, -25 * (perc - 0.85))) + 0.5;
  light = perc > MIN_VALUE ? Math.min(light, MAX_LIGHT) : 0;
  //sat = 1;
  return `hsl(${hue}, ${sat * 100}%, ${light * 90}%)`;
}

function colorForVal2(perc) {
  let hue = Math.max(240 - (300 * perc), 0);
  let sat = 1 / (1 + Math.pow(Math.E, -25 * (perc - 0.15)));
  let light = 0.5 / (1 + Math.pow(Math.E, -10 * (perc - 0.5))) + 0.5;
  return `hsl(${hue}, ${sat * 100}%, ${light * 50}%)`;
}

class AnalyzerDisplay {
  constructor(analyser, canvas) {
    this.analyser = analyser;
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    initializeCanvas(this.canvas, this.ctx);
    
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.peaks = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.render.bind(this);
  }
  
  render() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.analyser.getByteFrequencyData(this.freqs);
    
    let h = this.canvas.height;
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let val = this.freqs[i];
      let perc = val / 255;
      this.ctx.fillStyle = colorForVal(perc);
      this.ctx.fillRect(i * (BAR_WIDTH + BAR_SPACE) + BAR_SPACE, h * (1 - perc), BAR_WIDTH, h * perc);
      
      if (this.peaks[i] > val) {
        this.peaks[i] += (val - this.peaks[i]) / AVERAGING;
        
      } else {
        this.peaks[i] = val;
      }
      perc = this.peaks[i] / 255;
      this.ctx.fillStyle = colorForVal(perc);
      this.ctx.fillRect(i * (BAR_WIDTH + BAR_SPACE) + BAR_SPACE, h * (1 - perc) - 1, BAR_WIDTH, 2);
    }
  }
}

class PeakDisplay {
  constructor(analyser, canvas) {
    this.analyser = analyser;
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    initializeCanvas(this.canvas, this.ctx);
    
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.times = new Uint8Array(this.analyser.frequencyBinCount);
    this.avgs = new Uint8Array(this.analyser.frequencyBinCount);
    this.ampavg = 0;
  }
  
  render() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.analyser.getByteFrequencyData(this.freqs);
    this.analyser.getByteTimeDomainData(this.times);
    
    let amp = 0;
    //for (let i = 0; i < this.analyser.frequencyBinCount; i++) amp = Math.max(amp, Math.abs(this.times[i] - 127));
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) amp += Math.abs(this.times[i] - 127);
    amp /= this.analyser.frequencyBinCount;
    this.ampavg += (amp - this.ampavg) / AVERAGING;
    amp /= 127;
    amp = amp - (this.ampavg / 127);
    
    let h = this.canvas.height;
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let val = this.freqs[i];
      let avg = this.avgs[i];
      this.avgs[i] += (val - avg) / AVERAGING;
      
      val = Math.pow(val, 2) / 255;
      avg = Math.pow(avg, 2) / 255;
      //let perc = Math.max(0, (val - avg) / (255 - avg));
      
      //let perc = Math.abs(val - avg) / ((val + avg) / 2);
      //perc = 1 / (1 + Math.pow(Math.E, -10 * (perc - 0.5)))
      
      //let perc = 1 - Math.pow((val - avg) - 1, 2 * amp / 127);
      
      let perc = (val - avg) * amp;
      
      this.ctx.fillStyle = colorForVal(perc);
      this.ctx.fillRect(i * (BAR_WIDTH + BAR_SPACE) + BAR_SPACE, h * (1 - perc), BAR_WIDTH, h * perc);
    }
  }
}

class PeakDisplay2 {
  constructor(analyser, canvas) {
    this.analyser = analyser;
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    initializeCanvas(this.canvas, this.ctx);
    
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.avgs = new Uint8Array(this.analyser.frequencyBinCount);
    this.avgDifs = new Uint8Array(this.analyser.frequencyBinCount);
  }
  
  render() {
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.analyser.getByteFrequencyData(this.freqs);
    
    let h = this.canvas.height;
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let val = this.freqs[i];
      let avg = this.avgs[i];
      let avgDif = this.avgDifs[i];
      let dif = val - avg;
      
      this.avgs[i] += (val - avg) / AVERAGING;
      this.avgDifs[i] += (Math.abs(dif) - avgDif) / AVERAGING;
      
      val /= 255;
      avg /= 255;
      avgDif /= 255;
      
      let perc = 1 / (1 + Math.pow(Math.E, -10 * (((val - avg) / (avgDif * STDEVS)) - 0.5)));
      //let perc = (val - avg) / (avgDif * STDEVS);
      
      this.ctx.fillStyle = colorForVal(perc);
      this.ctx.fillRect(i * (BAR_WIDTH + BAR_SPACE) + BAR_SPACE, h * (1 - perc), BAR_WIDTH, h * perc);
    }
  }
}

class WaveFormDisplay {
  constructor(analyser, canvas) {
    this.analyser = analyser;
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    initializeCanvas(this.canvas, this.ctx);
    
    this.times = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.render.bind(this);
  }
  
  render() {
    let w = this.canvas.width;
    let h = this.canvas.height;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, w, h);
    
    this.analyser.getByteTimeDomainData(this.times);
    
    let thick = w / (this.analyser.frequencyBinCount - 1);
    let largest = 0.5;
    this.ctx.beginPath();
    this.ctx.lineWidth = 2;
    this.ctx.moveTo(-1 * thick, 0.5 * h);
    
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let val = this.times[i];
      let perc = val / 255;
      if (Math.abs(val - 128) > largest) largest = Math.abs(val - 127);
      this.ctx.lineTo(i * thick, perc * h);
    }
    
    this.ctx.strokeStyle = colorForVal2(largest / 127);
    this.ctx.stroke();
  }
}

class HistoryDisplay {
  constructor(analyser, canvas) {
    this.analyser = analyser;
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    initializeCanvas(this.canvas, this.ctx);
    
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
    this.x = 0;
    
    this.render.bind(this);
  }
  
  render() {
    this.x++;
    this.x %= this.canvas.width;
    
    this.ctx.fillStyle = "#f00";
    this.ctx.fillRect(this.x + 1, 1, 1, this.canvas.height)
    
    this.analyser.getByteFrequencyData(this.freqs);
    
    let h = this.canvas.height;
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let val = this.freqs[i];
      let perc = val / 255;
      this.ctx.fillStyle = colorForVal(perc);
      this.ctx.fillRect(this.x, this.canvas.height - i, 1, 1);
    }
  }
}

function SpectralDisplay() {
  this.analyser = context.createAnalyser();
  this.bandAnalyser = context.createAnalyser();
  
  this.analyser.minDecibels = -120;
  this.analyser.maxDecibels = 0;
  this.analyser.fftSize = FFT_SIZE;
  this.analyser.smoothingTimeConstant = SMOOTHING;
  
  this.bandAnalyser.minDecibels = -120;
  this.bandAnalyser.maxDecibels = 0;
  this.bandAnalyser.fftSize = FFT_SIZE;
  this.bandAnalyser.smoothingTimeConstant = SMOOTHING;
  
  this.playing = true;
  
  let merger = context.createChannelMerger(AUDIOS.length + 1);
  
  //create audio source nodes and link to merger node
  for (let i = 0; i < AUDIOS.length; i++) {
    let source = context.createMediaElementSource(AUDIOS[i]);
    source.connect(merger);
  }
  
  //create oscillator node
  this.oscillator = context.createOscillator();
  this.oscillator.detune.value = 100;
  
  oscillatorShape.addEventListener("change", (e) => {
    this.oscillator.type = e.target.value;
  });
  
  this.oscillatorGain = context.createGain();
  this.oscillator.connect(this.oscillatorGain);
  let setOscillatorGain = () => {
    this.oscillatorGain.gain.value = sineVolControl.value;
  }
  sineVolControl.addEventListener("change", setOscillatorGain);
  setOscillatorGain();
  
  this.oscillatorMute = context.createGain();
  let sineMute = (e) => {
    if (sineControl.checked) {
      this.oscillatorMute.gain.value = 1;
      
    } else {
      this.oscillatorMute.gain.value = 0;
    }
  }
  this.oscillatorGain.connect(this.oscillatorMute);
  this.oscillatorMute.connect(merger);
  sineControl.addEventListener("click", sineMute);
  sineMute();
  
  let sineFrequency = () => {
    this.oscillator.frequency.value = Math.pow(2, sineFreqControl.value / 10);
  }
  sineFrequency();
  sineFreqControl.addEventListener("change", sineFrequency);
  
  // band analysis
  let FREQS = [63, 160, 400, 1000, 2500, 6250, 16000];
  this.bandMerge = context.createChannelMerger(FREQS.length);

  this.filts = [];
  for (let i = 0; i < FREQS.length; i++) {
    let filt = context.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = FREQS[i];
    filt.Q.value = Q;
    merger.connect(filt);
    filt.connect(this.bandMerge);
    this.filts[i] = filt;
  }

  this.bandMerge.connect(this.bandAnalyser);
  merger.connect(this.analyser);
  
  this.analyser.connect(context.destination);
  this.oscillator.start();
  
  this.historyDisplay = new HistoryDisplay(this.analyser, HIST_CANVAS);
  this.analyserDisplay = new AnalyzerDisplay(this.analyser, BAR_CANVAS);
  this.waveFormDisplay = new WaveFormDisplay(this.analyser, WAVE_CANVAS);
  
  this.bandAnalyserDisplay = new PeakDisplay2(this.bandAnalyser, FILT_CANVAS);
  //this.bandWaveDisplay = new WaveFormDisplay(this.bandAnalyser, FILT_CANVAS);
  
  this.dislpays = [this.historyDisplay, this.analyserDisplay, this.waveFormDisplay, this.bandAnalyserDisplay];
  
  window.requestAnimationFrame(this.draw.bind(this));
}

SpectralDisplay.prototype.draw = function () {
  if (this.playing) {
    for (let i = 0; i < this.dislpays.length; i++) this.dislpays[i].render();
    
    
    window.requestAnimationFrame(this.draw.bind(this));
  }
}

var display = new SpectralDisplay();