'use strict'

/**
 * Code adapted from:
 * https://web.archive.org/web/20110816002016/http://blogs.msdn.com/b/dawate/archive/2009/06/24/intro-to-audio-programming-part-3-synthesizing-simple-wave-audio-using-c.aspx
 */

const Readable = require('stream').Readable
const bufferAlloc = require('buffer-alloc')
const Speaker = require('../')

// the frequency to play
const freq = parseFloat(process.argv[2], 10) || 440.0 // Concert A, default tone

// seconds worth of audio data to generate before emitting "end"
const duration = parseFloat(process.argv[3], 10) || 2.0

console.log('generating a %dhz sine wave for %d seconds', freq, duration)

// A SineWaveGenerator readable stream
const sine = new Readable()
sine.bitDepth = 16
sine.channels = 2
sine.sampleRate = 44100
sine.samplesGenerated = 0
sine._read = read

// create a SineWaveGenerator instance and pipe it to the speaker
sine.pipe(new Speaker())

// the Readable "_read()" callback function
function read (n) {
  const sampleSize = this.bitDepth / 8
  const blockAlign = sampleSize * this.channels
  const numSamples = n / blockAlign | 0
  const buf = bufferAlloc(numSamples * blockAlign)
  const amplitude = 32760 // Max amplitude for 16-bit audio

  // the "angle" used in the function, adjusted for the number of
  // channels and sample rate. This value is like the period of the wave.
  const t = (Math.PI * 2 * freq) / this.sampleRate

  for (let i = 0; i < numSamples; i++) {
    // fill with a simple sine wave at max amplitude
    for (let channel = 0; channel < this.channels; channel++) {
      const s = this.samplesGenerated + i
      const val = Math.round(amplitude * Math.sin(t * s)) // sine wave
      const offset = (i * sampleSize * this.channels) + (channel * sampleSize)
      buf[`writeInt${this.bitDepth}LE`](val, offset)
    }
  }

  this.push(buf)

  this.samplesGenerated += numSamples
  if (this.samplesGenerated >= this.sampleRate * duration) {
    // after generating "duration" second of audio, emit "end"
    this.push(null)
  }
}
