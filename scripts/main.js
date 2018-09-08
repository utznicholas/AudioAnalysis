var context = new (window.AudioContext || window.webkitAudioContext)();

var SMOOTHING = 0.25;

var AVERAGING = 25;
var STDEVS = 5;

var BAND_PASS = false;
var Q = 50;

var FFT_SIZE = 256;

var AUDIOS = document.getElementsByTagName("audio");
var HIST_CANVAS = document.getElementById("history-canvas");
var BAR_CANVAS = document.getElementById("bar-canvas");
var WAVE_CANVAS = document.getElementById("wave-canvas");
var FILT_CANVAS = document.getElementById("filt-canvas");

var sineControl = document.getElementById("sine-control");
var sineFreqControl = document.getElementById("sine-freq");
var sineFreqLabel = document.getElementById("sine-freq-label");
var sineVolControl = document.getElementById("sine-vol");
var oscillatorShape = document.getElementById("oscillator-shape");
sineFreqControl.addEventListener("change", function(e) {
  sineFreqLabel.innerText = "Frequency: " + Math.pow(2, (sineFreqControl.value / 10)) + "Hz";
});

function App() {
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
  
  let size = this.analyser.frequencyBinCount;
  let source =  new AnalyserSourceNode(this.analyser);
  this.source = source;
  
  let histDisp = new HistoryDisplay(size, HIST_CANVAS);
  source.connect(histDisp, AnalyserSourceNode.FREQUENCY)
  
  let wavDisp = new LineDisplay(size, WAVE_CANVAS);
  source.connect(wavDisp, AnalyserSourceNode.TIME);
  
  let peaknode = new PeakNode(size, 7);
  source.connect(peaknode);
  
  let specDisp = new DotBarDisplay(size, BAR_CANVAS);
  source.connect(specDisp);
  peaknode.connect(specDisp, 0, 1);
  
  let stdevNode = new StdevNode(size, 100);
  source.connect(stdevNode);
  
  let apeakNode = new AntiPeakNode(size, 100);
  source.connect(apeakNode);
  
  let difNode = new DifferenceNode(size);
  source.connect(difNode);
  apeakNode.connect(difNode, 0, 1);
  
  let outNode = new OutlierNode(size, 2);
  difNode.connect(outNode, 0, 0);
  stdevNode.connect(outNode, 0, 1);
  
  let devDisp = new DotBarDisplay(size, FILT_CANVAS);
  difNode.connect(devDisp, 0, 0);
  apeakNode.connect(devDisp, 0, 1);
}

App.prototype.render = function() {
  if (this.playing) {
    this.source.process();
    window.requestAnimationFrame(this.render.bind(this));
  }
}

var app = new App();
window.requestAnimationFrame(app.render.bind(app));