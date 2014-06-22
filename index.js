
/**
 * Module dependencies.
 */

var os = require('os');
var debug = require('debug')('speaker');
var binding = require('bindings')('binding');
var inherits = require('util').inherits;
var Writable = require('readable-stream/writable');

// determine the native host endianness, the only supported playback endianness
var endianness = 'function' == os.endianness ?
                 os.endianness() :
                 'LE'; // assume little-endian for older versions of node.js

/**
 * Module exports.
 */

exports = module.exports = Speaker;

/**
 * Export information about the `mpg123_module_t` being used.
 */

exports.api_version = binding.api_version;
exports.description = binding.description;
exports.module_name = binding.name;

/**
 * Returns the `MPG123_ENC_*` constant that corresponds to the given "format"
 * object, or `null` if the format is invalid.
 *
 * @param {Object} format - format object with `channels`, `sampleRate`, `bitDepth`, etc.
 * @return {Number} MPG123_ENC_* constant, or `null`
 * @api public
 */

exports.getFormat = function getFormat (format) {
  var f = null;
  if (format.bitDepth == 32 && format.float && format.signed) {
    f = binding.MPG123_ENC_FLOAT_32;
  } else if (format.bitDepth == 64 && format.float && format.signed) {
    f = binding.MPG123_ENC_FLOAT_64;
  } else if (format.bitDepth == 8 && format.signed) {
    f = binding.MPG123_ENC_SIGNED_8;
  } else if (format.bitDepth == 8 && !format.signed) {
    f = binding.MPG123_ENC_UNSIGNED_8;
  } else if (format.bitDepth == 16 && format.signed) {
    f = binding.MPG123_ENC_SIGNED_16;
  } else if (format.bitDepth == 16 && !format.signed) {
    f = binding.MPG123_ENC_UNSIGNED_16;
  } else if (format.bitDepth == 24 && format.signed) {
    f = binding.MPG123_ENC_SIGNED_24;
  } else if (format.bitDepth == 24 && !format.signed) {
    f = binding.MPG123_ENC_UNSIGNED_24;
  } else if (format.bitDepth == 32 && format.signed) {
    f = binding.MPG123_ENC_SIGNED_32;
  } else if (format.bitDepth == 32 && !format.signed) {
    f = binding.MPG123_ENC_UNSIGNED_32;
  }
  return f;
}

/**
 * Returns `true` if the given "format" is playable via the "output module"
 * that was selected during compilation, or `false` if not playable.
 *
 * @param {Number} format - MPG123_ENC_* format constant
 * @return {Boolean} true if the format is playable, false otherwise
 * @api public
 */

exports.isSupported = function isSupported (format) {
  if ('number' !== typeof format) format = exports.getFormat(format);
  return (binding.formats & format) === format;
}

/**
 * The `Speaker` class accepts raw PCM data written to it, and then sends that data
 * to the default output device of the OS.
 *
 * @param {Object} opts options object
 * @api public
 */

function Speaker (opts) {
  if (!(this instanceof Speaker)) return new Speaker(opts);

  // default lwm and hwm to 0
  if (!opts) opts = {};
  if (null == opts.lowWaterMark) opts.lowWaterMark = 0;
  if (null == opts.highWaterMark) opts.highWaterMark = 0;

  Writable.call(this, opts);

  // chunks are sent over to the backend in "samplesPerFrame * blockAlign" size.
  // this is necessary because if we send too big of chunks at once, then there
  // won't be any data ready when the audio callback comes (experienced with the
  // CoreAudio backend)
  this.samplesPerFrame = 1024;

  // the `audio_output_t` struct pointer Buffer instance
  this.audio_handle = null;

  // flipped after close() is called, no write() calls allowed after
  this._closed = false;

  // set PCM format
  this._format(opts);

  // bind event listeners
  this._format = this._format.bind(this);
  this.on('finish', this._flush);
  this.on('pipe', this._pipe);
  this.on('unpipe', this._unpipe);
}
inherits(Speaker, Writable);

/**
 * Calls the audio backend's `open()` function, and then emits an "open" event.
 *
 * @api private
 */

Speaker.prototype._open = function () {
  debug('open()');
  if (this.audio_handle) {
    throw new Error('_open() called more than once!');
  }
  // set default options, if not set
  if (null == this.channels) {
    debug('setting default %o: %o', 'channels', 2);
    this.channels = 2;
  }
  if (null == this.bitDepth) {
    var depth = this.float ? 32 : 16;
    debug('setting default %o: %o', 'bitDepth', depth);
    this.bitDepth = depth;
  }
  if (null == this.sampleRate) {
    debug('setting default %o: %o', 'sampleRate', 44100);
    this.sampleRate = 44100;
  }
  if (null == this.signed) {
    debug('setting default %o: %o', 'signed', this.bitDepth != 8);
    this.signed = this.bitDepth != 8;
  }

  var format = exports.getFormat(this);
  if (null == format) {
    throw new Error('invalid PCM format specified');
  }

  if (!exports.isSupported(format)) {
    throw new Error('specified PCM format is not supported by "' + binding.name + '" backend');
  }

  // calculate the "block align"
  this.blockAlign = this.bitDepth / 8 * this.channels;

  // initialize the audio handle
  // TODO: open async?
  this.audio_handle = new Buffer(binding.sizeof_audio_output_t);
  var r = binding.open(this.audio_handle, this.channels, this.sampleRate, format);
  if (0 !== r) {
    throw new Error('open() failed: ' + r);
  }

  this.emit('open');
  return this.audio_handle;
};

/**
 * Set given PCM formatting options. Called during instantiation on the passed in
 * options object, on the stream given to the "pipe" event, and a final time if
 * that stream emits a "format" event.
 *
 * @param {Object} opts
 * @api private
 */

Speaker.prototype._format = function (opts) {
  debug('format(object keys = %o)', Object.keys(opts));
  if (null != opts.channels) {
    debug('setting %o: %o', 'channels', opts.channels);
    this.channels = opts.channels;
  }
  if (null != opts.bitDepth) {
    debug('setting %o: %o', "bitDepth", opts.bitDepth);
    this.bitDepth = opts.bitDepth;
  }
  if (null != opts.sampleRate) {
    debug('setting %o: %o', "sampleRate", opts.sampleRate);
    this.sampleRate = opts.sampleRate;
  }
  if (null != opts.float) {
    debug('setting %o: %o', "float", opts.float);
    this.float = opts.float;
  }
  if (null != opts.signed) {
    debug('setting %o: %o', "signed", opts.signed);
    this.signed = opts.signed;
  }
  if (null != opts.samplesPerFrame) {
    debug('setting %o: %o', "samplesPerFrame", opts.samplesPerFrame);
    this.samplesPerFrame = opts.samplesPerFrame;
  }
  if (null == opts.endianness || endianness == opts.endianness) {
    // no "endianness" specified or explicit native endianness
    this.endianness = endianness;
  } else {
    // only native endianness is supported...
    this.emit('error', new Error('only native endianness ("' + endianness + '") is supported, got "' + opts.endianness + '"'));
  }
};

/**
 * `_write()` callback for the Writable base class.
 *
 * @param {Buffer} chunk
 * @param {String} encoding
 * @param {Function} done
 * @api private
 */

Speaker.prototype._write = function (chunk, encoding, done) {
  debug('_write() (%o bytes)', chunk.length);

  if (this._closed) {
    // close() has already been called. this should not be called
    return done(new Error('write() call after close() call'));
  }
  var b;
  var self = this;
  var left = chunk;
  var handle = this.audio_handle;
  if (!handle) {
    // this is the first time write() is being called; need to _open()
    try {
      handle = this._open();
    } catch (e) {
      return done(e);
    }
  }
  var chunkSize = this.blockAlign * this.samplesPerFrame;

  function write () {
    if (self._closed) {
      debug('aborting remainder of write() call (%o bytes), since speaker is `_closed`', left.length);
      return done();
    }
    b = left;
    if (b.length > chunkSize) {
      var t = b;
      b = t.slice(0, chunkSize);
      left = t.slice(chunkSize);
    } else {
      left = null;
    }
    debug('writing %o byte chunk', b.length);
    binding.write(handle, b, b.length, onwrite);
  }

  function onwrite (r) {
    debug('wrote %o bytes', r);
    if (r != b.length) {
      done(new Error('write() failed: ' + r));
    } else if (left) {
      debug('still %o bytes left in this chunk', left.length);
      write();
    } else {
      debug('done with this chunk');
      done();
    }
  }

  write();
};

/**
 * Called when this stream is pipe()d to from another readable stream.
 * If the "sampleRate", "channels", "bitDepth", and "signed" properties are
 * set, then they will be used over the currently set values.
 *
 * @api private
 */

Speaker.prototype._pipe = function (source) {
  debug('_pipe()');
  this._format(source);
  source.once('format', this._format);
};

/**
 * Called when this stream is pipe()d to from another readable stream.
 * If the "sampleRate", "channels", "bitDepth", and "signed" properties are
 * set, then they will be used over the currently set values.
 *
 * @api private
 */

Speaker.prototype._unpipe = function (source) {
  debug('_unpipe()');
  source.removeListener('format', this._format);
};

/**
 * Emits a "flush" event and then calls the `.close()` function on
 * this Speaker instance.
 *
 * @api private
 */

Speaker.prototype._flush = function () {
  debug('_flush()');
  this.emit('flush');
  this.close(false);
};

/**
 * Closes the audio backend. Normally this function will be called automatically
 * after the audio backend has finished playing the audio buffer through the
 * speakers.
 *
 * @param {Boolean} flush - if `false`, then don't call the `flush()` native binding call. Defaults to `true`.
 * @api public
 */

Speaker.prototype.close = function (flush) {
  debug('close(%o)', flush);
  if (this._closed) return debug('already closed...');

  if (this.audio_handle) {
    if (false !== flush) {
      // TODO: async most likely…
      debug('invoking flush() native binding');
      binding.flush(this.audio_handle);
    }

    // TODO: async maybe?
    debug('invoking close() native binding');
    binding.close(this.audio_handle);
    this.audio_handle = null;
  } else {
    debug('not invoking flush() or close() bindings since no `audio_handle`');
  }

  this._closed = true;
  this.emit('close');
};
