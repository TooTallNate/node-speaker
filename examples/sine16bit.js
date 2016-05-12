/**
 * Code adapted from:
 * http://blogs.msdn.com/b/dawate/archive/2009/06/24/intro-to-audio-programming-part-3-synthesizing-simple-wave-audio-using-c.aspx
 */

var Readable = require('stream').Readable;
var Speaker = require('../');

// node v0.8.x compat
if (!Readable) Readable = require('readable-stream/readable');

// the frequency to play
var freq = parseFloat(process.argv[2], 10) || 440.0; // Concert A, default tone

// seconds worth of audio data to generate before emitting "end"
var duration = parseFloat(process.argv[3], 10) || 2.0;

console.log('generating a %dhz sine wave for %d seconds', freq, duration);

var opts = {
    bitDepth: 16,
    channels: 2,
    float: false,
    sampleRate: 44100,
    signed: true
},
samplesGenerated = 0;

var speaker = new Speaker({
    bitDepth: opts.bitDepth,
    channels: opts.channels,
    float: opts.float,
    sampleRate: opts.sampleRate,
    signed: opts.signed
});

// A SineWaveGenerator readable stream
var sine = new Readable();
sine._read = read;

// create a SineWaveGenerator instance and pipe it to the speaker
sine.pipe(speaker);

// the Readable "_read()" callback function
function read(n) {
    var sampleSize = opts.bitDepth / 8;
    var blockAlign = sampleSize * opts.channels;
    var numSamples = n / blockAlign | 0;
    var buf = new Buffer(numSamples * blockAlign);
    var amplitude = 32767; // Max amplitude for 16-bit audio (0x7FFF)

    // the "angle" used in the function, adjusted for the number of
    // channels and sample rate. This value is like the period of the wave.
    var t = (Math.PI * 2 * freq) / opts.sampleRate;

    for (var i = 0; i < numSamples; i++) {
        // fill with a simple sine wave at max amplitude
        for (var channel = 0; channel < opts.channels; channel++) {
            var s = samplesGenerated + i;
            var val = Math.round(amplitude * Math.sin(t * s)); // sine wave
            var offset = (i * sampleSize * opts.channels) + (channel * sampleSize);
            buf.writeInt16LE(val, offset);
        }
    }

    this.push(buf);

    samplesGenerated += numSamples;
    if (samplesGenerated >= opts.sampleRate * duration) {
        // after generating "duration" second of audio, emit "end"
        this.push(null);
    }
}
