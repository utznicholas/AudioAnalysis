var context = new (window.AudioContext || window.webkitAudioContext)();

var SMOOTHING = 0.5;

var AUDIOS = document.getElementsByTagName("audio");
var HIST_CANVAS = document.getElementById("history-canvas");
var HIST_CTX = HIST_CANVAS.getContext("2d");
var BAR_CANVAS = document.getElementById("bar-canvas");
var BAR_CTX = BAR_CANVAS.getContext("2d");
var WAVE_CANVAS = document.getElementById("wave-canvas");
var WAVE_CTX = WAVE_CANVAS.getContext("2d");

var WIDTH = 1024;
var HEIGHT = 128;

var BAR_WIDTH = 3;
var BAR_SPACE = 2;

var MAX_LIGHT = 1;
var MIN_VALUE = 0.1;

function initializeCanvas(cvs, ctx) {
  cvs.width = WIDTH;
  cvs.height = HEIGHT;
  ctx.fillstyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

initializeCanvas(HIST_CANVAS, HIST_CTX);
initializeCanvas(BAR_CANVAS, BAR_CTX);
initializeCanvas(WAVE_CANVAS, WAVE_CTX);

//BAR_CTX.fillStyle = "#fff";
//BAR_CTX.fillRect((128 * BAR_WIDTH) + (129 * BAR_SPACE), 0, WIDTH, HEIGHT);

var FFT_SIZE = 2 * HEIGHT;

var sineControl = document.getElementById("sine-control");
var sineFreqControl = document.getElementById("sine-freq");
var sineFreqLabel = document.getElementById("sine-freq-label");
var sineVolControl = document.getElementById("sine-vol");
var oscillatorShape = document.getElementById("oscillator-shape");
sineFreqControl.addEventListener("change", function(e) {
  sineFreqLabel.innerText = "Frequency: " + Math.pow(2, (sineFreqControl.value / 10)) + "Hz";
});

function SpectralDisplay() {
  this.analyser = context.createAnalyser();
  
  this.analyser.minDecibels = -120;
  this.analyser.maxDecibels = 0;
  this.freqs = new Uint8Array(this.analyser.frequencyBinCount);
  this.times = new Uint8Array(this.analyser.frequencyBinCount);
  
  this.playing = true;
  
  let _this = this;
  
  let merger = context.createChannelMerger(AUDIOS.length + 1);
  
  //create audio source nodes and link to merger node
  for (let i = 0; i < AUDIOS.length; i++) {
    let source = context.createMediaElementSource(AUDIOS[i]);
    source.connect(merger);
  }
  
  //create oscillator node
  this.oscillator = context.createOscillator();
  this.oscillator.detune.value = 100;
  
  oscillatorShape.addEventListener("change", function() {
    _this.oscillator.type = oscillatorShape.value;
  });
  
  this.oscillatorGain = context.createGain();
  this.oscillator.connect(this.oscillatorGain);
  function setOscillatorGain() {
    _this.oscillatorGain.gain.value = sineVolControl.value;
  }
  sineVolControl.addEventListener("change", setOscillatorGain);
  setOscillatorGain();
  
  this.oscillatorMute = context.createGain();
  function sineMute(e) {
    if (sineControl.checked) {
      _this.oscillatorMute.gain.value = 1;
      
    } else {
      _this.oscillatorMute.gain.value = 0;
    }
  }
  this.oscillatorGain.connect(this.oscillatorMute);
  this.oscillatorMute.connect(merger);
  sineControl.addEventListener("click", sineMute);
  sineMute();
  
  function sineFrequency() {
    _this.oscillator.frequency.value = Math.pow(2, sineFreqControl.value / 10);
  }
  sineFrequency();
  sineFreqControl.addEventListener("change", sineFrequency);
  
  merger.connect(this.analyser);
  this.analyser.connect(context.destination);
  this.oscillator.start();
  
  window.requestAnimationFrame(function() {
    _this.draw();
  });
}

SpectralDisplay.prototype.colorForVal = function (val) {
  let percent = val / 255;
  let hue = Math.max(240 - (300 * percent), 0);
  let sat = 1 / (1 + Math.pow(Math.E, -25 * (percent - 0.15)));
  let light = 0.5 / (1 + Math.pow(Math.E, -25 * (percent - 0.85))) + 0.5;
  light = percent > MIN_VALUE ? Math.min(light, MAX_LIGHT) : 0;
  //sat = 1;
  return `hsl(${hue}, ${sat * 100}%, ${light * 90}%)`;
}

SpectralDisplay.prototype.colorForVal2 = function (val) {
  let percent = val / 255;
  let hue = Math.max(240 - (300 * percent), 0);
  let sat = 1 / (1 + Math.pow(Math.E, -25 * (percent - 0.15)));
  let light = 0.5 / (1 + Math.pow(Math.E, -25 * (percent - 0.85))) + 0.5;
  return `hsl(${hue}, ${sat * 100}%, ${light * 50}%)`;
}

var x = 0;

SpectralDisplay.prototype.draw = function () {
  
  if (this.playing) {
    /*
    var data = HIST_CTX.getImageData(0, 0, WIDTH, HEIGHT);
    HIST_CTX.fillstyle = "#000";
    HIST_CTX.fillRect(0, 0, WIDTH, HEIGHT);
    HIST_CTX.putImageData(data, 3, 0);
    */
    x++;
    x %= WIDTH;
    
    this.analyser.smoothingTimeConstant = SMOOTHING;
    this.analyser.fftSize = FFT_SIZE;
    
    this.analyser.getByteFrequencyData(this.freqs);
    this.analyser.getByteTimeDomainData(this.times);
    
    HIST_CTX.fillStyle = "#f00";
    HIST_CTX.fillRect(x + 1, 1, 1, HEIGHT);
    
    BAR_CTX.fillStyle = "#000";
    BAR_CTX.fillRect(0, 0, HEIGHT * (BAR_WIDTH + BAR_SPACE) + BAR_SPACE, HEIGHT);
    
    WAVE_CTX.fillStyle = "#000";
    WAVE_CTX.fillRect(0, 0, WIDTH, HEIGHT);
    
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let value = this.freqs[i];
      let percent = value / 255;
      let color = this.colorForVal(value);
      HIST_CTX.fillStyle = color;
      HIST_CTX.fillRect(x, HEIGHT - i, 1, 1);
      BAR_CTX.fillStyle = color;
      BAR_CTX.fillRect(i * (BAR_WIDTH + BAR_SPACE)+ BAR_SPACE, HEIGHT - (HEIGHT * percent), BAR_WIDTH, HEIGHT * percent);
    }
    
    let thickness = WIDTH / (this.analyser.frequencyBinCount - 1);
    let largest = 0.5;
    WAVE_CTX.beginPath();
    WAVE_CTX.moveTo(-1 * thickness, 0.5 * HEIGHT);
    
    for (let i = 0; i < this.analyser.frequencyBinCount; i++) {
      let value = this.times[i];
      let percent = value / 255;
      if (Math.abs(value - 128) > largest) largest = Math.abs(value - 128);
      WAVE_CTX.lineTo(i * thickness, percent * HEIGHT);
    }
    
    let color = this.colorForVal2(largest * 2);
    WAVE_CTX.strokeStyle = color;
    WAVE_CTX.stroke();
    
    //TODO: use BiquadFilterNode to get high, low and mid sounds
    
    let _this = this;
    window.requestAnimationFrame(function() {
      _this.draw();
    });
  }
}

var display = new SpectralDisplay();