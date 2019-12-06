'use strict'

/**
 * Module dependencies.
 */

const os = require('os')
const debug = require('debug')('speaker')
const binding = require('bindings')('binding')
const { Writable } = require('stream')

// determine the native host endianness, the only supported playback endianness
const endianness = os.endianness()

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

    // chunks are sent over to the backend in "samplesPerFrame * blockAlign" size.
    // this is necessary because if we send too big of chunks at once, then there
    // won't be any data ready when the audio callback comes (experienced with the
    // CoreAudio backend)
    this.samplesPerFrame = 1024

    // the `audio_output_t` struct pointer Buffer instance
    this.audio_handle = null

    // flipped after close() is called, no write() calls allowed after
    this._closed = false

    // set PCM format
    this._format(opts)

    // bind event listeners
    this._format = this._format.bind(this)
    this.on('finish', this._flush)
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
    if (this.audio_handle) {
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
    if (this.signed == null) {
      debug('setting default %o: %o', 'signed', this.bitDepth !== 8)
      this.signed = this.bitDepth !== 8
    }
    if (this.device == null) {
      debug('setting default %o: %o', 'device', null)
      this.device = null
    }

    const format = Speaker.getFormat(this)
    if (format == null) {
      throw new Error('invalid PCM format specified')
    }

    if (!Speaker.isSupported(format)) {
      throw new Error(`specified PCM format is not supported by "${binding.name}" backend`)
    }

    // calculate the "block align"
    this.blockAlign = this.bitDepth / 8 * this.channels

    // initialize the audio handle
    // TODO: open async?
    this.audio_handle = binding.open(this.channels, this.sampleRate, format, this.device)

    this.emit('open')
    return this.audio_handle
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
    if (opts.float != null) {
      debug('setting %o: %o', 'float', opts.float)
      this.float = opts.float
    }
    if (opts.signed != null) {
      debug('setting %o: %o', 'signed', opts.signed)
      this.signed = opts.signed
    }
    if (opts.samplesPerFrame != null) {
      debug('setting %o: %o', 'samplesPerFrame', opts.samplesPerFrame)
      this.samplesPerFrame = opts.samplesPerFrame
    }
    if (opts.device != null) {
      debug('setting %o: %o', 'device', opts.device)
      this.device = opts.device
    }
    if (opts.endianness == null || endianness === opts.endianness) {
      // no "endianness" specified or explicit native endianness
      this.endianness = endianness
    } else {
      // only native endianness is supported...
      this.emit('error', new Error(`only native endianness ("${endianness}") is supported, got "${opts.endianness}"`))
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
    let b
    let left = chunk
    let handle = this.audio_handle
    if (!handle) {
      // this is the first time write() is being called; need to _open()
      try {
        handle = this._open()
      } catch (e) {
        return done(e)
      }
    }
    const chunkSize = this.blockAlign * this.samplesPerFrame

    const write = () => {
      if (this._closed) {
        debug('aborting remainder of write() call (%o bytes), since speaker is `_closed`', left.length)
        return done()
      }
      b = left
      if (b.length > chunkSize) {
        const t = b
        b = t.slice(0, chunkSize)
        left = t.slice(chunkSize)
      } else {
        left = null
      }
      debug('writing %o byte chunk', b.length)
      binding.write(handle, b).then(onwrite, onerror)
    }

    const onerror = (e) => {
      this.emit('error', e)
    }

    const onwrite = (r) => {
      debug('wrote %o bytes', r)
      if (r !== b.length) {
        done(new Error(`write() failed: ${r}`))
      } else if (left) {
        debug('still %o bytes left in this chunk', left.length)
        write()
      } else {
        debug('done with this chunk')
        done()
      }
    }

    write()
  }

  /**
   * Called when this stream is pipe()d to from another readable stream.
   * If the "sampleRate", "channels", "bitDepth", and "signed" properties are
   * set, then they will be used over the currently set values.
   *
   * @api private
   */

  _pipe (source) {
    debug('_pipe()')
    this._format(source)
    source.once('format', this._format)
  }

  /**
   * Called when this stream is pipe()d to from another readable stream.
   * If the "sampleRate", "channels", "bitDepth", and "signed" properties are
   * set, then they will be used over the currently set values.
   *
   * @api private
   */

  _unpipe (source) {
    debug('_unpipe()')
    source.removeListener('format', this._format)
  }

  /**
   * Emits a "flush" event and then calls the `.close()` function on
   * this Speaker instance.
   *
   * @api private
   */

  _flush () {
    debug('_flush()')
    this.emit('flush')
    this.close(false)
  }

  /**
   * Closes the audio backend. Normally this function will be called automatically
   * after the audio backend has finished playing the audio buffer through the
   * speakers.
   *
   * @param {Boolean} flush - if `false`, then don't call the `flush()` native binding call. Defaults to `true`.
   * @api public
   */

  close (flush) {
    debug('close(%o)', flush)
    if (this._closed) return debug('already closed...')

    if (this.audio_handle) {
      if (flush !== false) {
        // TODO: async most likely…
        debug('invoking flush() native binding')
        binding.flush(this.audio_handle)
      }

      // TODO: async maybe?
      debug('invoking close() native binding')
      binding.close(this.audio_handle)
      this.audio_handle = null
    } else {
      debug('not invoking flush() or close() bindings since no `audio_handle`')
    }

    this._closed = true
    this.emit('close')
  }
}

/**
 * Export information about the `mpg123_module_t` being used.
 */

Speaker.api_version = binding.api_version
Speaker.description = binding.description
Speaker.module_name = binding.name

/**
 * Returns the `MPG123_ENC_*` constant that corresponds to the given "format"
 * object, or `null` if the format is invalid.
 *
 * @param {Object} format - format object with `channels`, `sampleRate`, `bitDepth`, etc.
 * @return {Number} MPG123_ENC_* constant, or `null`
 * @api public
 */

Speaker.getFormat = function getFormat (format) {
  if (Number(format.bitDepth) === 32 && format.float && format.signed) {
    return binding.MPG123_ENC_FLOAT_32
  } else if (Number(format.bitDepth) === 64 && format.float && format.signed) {
    return binding.MPG123_ENC_FLOAT_64
  } else if (Number(format.bitDepth) === 8 && format.signed) {
    return binding.MPG123_ENC_SIGNED_8
  } else if (Number(format.bitDepth) === 8 && !format.signed) {
    return binding.MPG123_ENC_UNSIGNED_8
  } else if (Number(format.bitDepth) === 16 && format.signed) {
    return binding.MPG123_ENC_SIGNED_16
  } else if (Number(format.bitDepth) === 16 && !format.signed) {
    return binding.MPG123_ENC_UNSIGNED_16
  } else if (Number(format.bitDepth) === 24 && format.signed) {
    return binding.MPG123_ENC_SIGNED_24
  } else if (Number(format.bitDepth) === 24 && !format.signed) {
    return binding.MPG123_ENC_UNSIGNED_24
  } else if (Number(format.bitDepth) === 32 && format.signed) {
    return binding.MPG123_ENC_SIGNED_32
  } else if (Number(format.bitDepth) === 32 && !format.signed) {
    return binding.MPG123_ENC_UNSIGNED_32
  } else {
    return null
  }
}

/**
 * Returns `true` if the given "format" is playable via the "output module"
 * that was selected during compilation, or `false` if not playable.
 *
 * @param {Number} format - MPG123_ENC_* format constant
 * @return {Boolean} true if the format is playable, false otherwise
 * @api public
 */

Speaker.isSupported = function isSupported (format) {
  if (typeof format !== 'number') format = Speaker.getFormat(format)
  return (binding.formats & format) === format
}

/**
 * Module exports.
 */

exports = module.exports = Speaker
