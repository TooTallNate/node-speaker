'use strict'

/**
 * Module dependencies.
 */

const os = require('os')
const debug = require('debug')('speaker')
const Writable = require('readable-stream/writable')
const buildType = process.config.target_defaults.default_configuration
var binding

try {
  const bindingPath = require.resolve(`./build/${buildType}/binding`)
  process.dlopen(module, bindingPath,
                 os.constants.dlopen.RTLD_LAZY |
                 os.constants.dlopen.RTLD_GLOBAL)
  binding = module.exports
} catch (err) {
  /* This will catch errors for Node.js < v9,
   * where os.constants.dlopen is not defined.
   * Try to be more forgiving, catching any exception,
   * and try using the 'bindings' module.
   */
  binding = require('bindings')('binding')
}

/**
 * The `Speaker` class accepts raw PCM data written to it, and then sends that data
 * to the default output device of the OS.
 *
 * @param {Object} opts options object
 * @api public
 */

class Speaker extends Writable {
  constructor (opts) {
    // default lwm and hwm to 0
    if (!opts) opts = {}
    if (opts.lowWaterMark == null) opts.lowWaterMark = 0
    if (opts.highWaterMark == null) opts.highWaterMark = 0

    super(opts)

    // the `ao_device` struct pointer Buffer instance
    this._audio_handle = null

    // flipped after close() is called, no write() calls allowed after
    this._closed = false

    // set PCM format
    this._format(opts)

    // bind event listeners
    this._format = this._format.bind(this)
    this.on('finish', this.close)
    this.on('pipe', this._pipe)
    this.on('unpipe', this._unpipe)
  }

  /**
   * Calls the audio backend's `open()` function, and then emits an "open" event.
   *
   * @api private
   */

  _open () {
    debug('open()')
    if (this._audio_handle) {
      throw new Error('_open() called more than once!')
    }
    // set default options, if not set
    if (this.channels == null) {
      debug('setting default %o: %o', 'channels', 2)
      this.channels = 2
    }
    if (this.bitDepth == null) {
      const depth = this.float ? 32 : 16
      debug('setting default %o: %o', 'bitDepth', depth)
      this.bitDepth = depth
    }
    if (this.sampleRate == null) {
      debug('setting default %o: %o', 'sampleRate', 44100)
      this.sampleRate = 44100
    }

    // initialize the audio handle
    // TODO: open async?
    this._audio_handle = binding.open(this.channels, this.sampleRate, this.bitDepth)
    if (!this._audio_handle) {
      throw new Error('open() failed')
    }

    this.emit('open')
    return this._audio_handle
  }

  /**
   * Set given PCM formatting options. Called during instantiation on the passed in
   * options object, on the stream given to the "pipe" event, and a final time if
   * that stream emits a "format" event.
   *
   * @param {Object} opts
   * @api private
   */

  _format (opts) {
    debug('format(object keys = %o)', Object.keys(opts))
    if (opts.channels != null) {
      debug('setting %o: %o', 'channels', opts.channels)
      this.channels = opts.channels
    }
    if (opts.bitDepth != null) {
      debug('setting %o: %o', 'bitDepth', opts.bitDepth)
      this.bitDepth = opts.bitDepth
    }
    if (opts.sampleRate != null) {
      debug('setting %o: %o', 'sampleRate', opts.sampleRate)
      this.sampleRate = opts.sampleRate
    }
    if (opts.samplesPerFrame != null) {
      debug('setting %o: %o', 'samplesPerFrame', opts.samplesPerFrame)
      this.samplesPerFrame = opts.samplesPerFrame
    }
  }

  /**
   * `_write()` callback for the Writable base class.
   *
   * @param {Buffer} chunk
   * @param {String} encoding
   * @param {Function} done
   * @api private
   */

  _write (chunk, encoding, done) {
    debug('_write() (%o bytes)', chunk.length)

    if (this._closed) {
      // close() has already been called. this should not be called
      return done(new Error('write() call after close() call'))
    }
    let handle = this._audio_handle
    if (!handle) {
      // this is the first time write() is being called; need to _open()
      try {
        handle = this._open()
      } catch (e) {
        return done(e)
      }
    }

    binding.write(handle, chunk, chunk.length, (ok) => {
      if (!ok) {
        done(new Error(`write() failed: ${ok}`))
      } else {
        debug('write successful')
        done()
      }
    })
  }

  /**
   * Called when this stream is pipe()d to from another readable stream.
   * If the "sampleRate", "channels", "bitDepth" properties are
   * set, then they will be used over the currently set values.
   *
   * @api private
   */

  _pipe (source) {
    debug('_pipe()')
    this._format(source)
    source.once('format', this._format)
  }

  _unpipe (source) {
    debug('_unpipe()')
    source.removeListener('format', this._format)
  }

  /**
   * Closes the audio backend. Normally this function will be called automatically
   * after the audio backend has finished playing the audio buffer through the
   * speakers.
   *
   * @api public
   */

  close () {
    debug('close(%o)')
    if (this._closed) return debug('already closed...')

    if (this._audio_handle) {
      // TODO: async maybe?
      debug('invoking close() native binding')
      binding.close(this._audio_handle)
      this._audio_handle = null
    } else {
      debug('not invoking close() bindings since no `_audio_handle`')
    }

    this._closed = true
    this.emit('close')
  }
}

/**
 * Module exports.
 */

exports = module.exports = Speaker
