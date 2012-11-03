
/**
 * Module dependencies.
 */

var debug = require('debug')('speaker');
var binding = require('bindings')('binding');
var inherits = require('util').inherits;
var Writable = require('stream').Writable;

// node v0.8.x compat
if (!Writable) Writable = require('readable-stream/writable');

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
 * The `Speaker` class accepts raw PCM data written to it, and then sends that data
 * to the default output device of the OS.
 *
 * @param {Object} options object
 * @api public
 */

function Speaker (opts) {
  if (!(this instanceof Speaker)) return new Speaker(opts);
  Writable.call(this, opts);

  // set default options
  if (!opts) opts = {};
  if (null == opts.channels) opts.channels = 2;
  if (null == opts.bitDepth) opts.bitDepth = 16;
  if (null == opts.sampleRate) opts.sampleRate = 44100;
  if (null == opts.signed) opts.signed = opts.bitDepth != 8;

  // initialize the audio handle
  // TODO: open async?
  this.audio_handle = new Buffer(binding.sizeof_audio_output_t);
  binding.open(this.audio_handle, opts);

  // chunks are sent over to the backend in "samplesPerFrame * blockAlign" size.
  // this is necessary because if we send too big of chunks at once, then there
  // won't be any data ready when the audio callback comes (experienced with the
  // CoreAudio backend)
  if (null == opts.samplesPerFrame) opts.samplesPerFrame = 1024;

  // copy over options (not really used, but useful for logging)
  this.signed = opts.signed;
  this.channels = opts.channels;
  this.bitDepth = opts.bitDepth;
  this.sampleRate = opts.sampleRate;
  this.samplesPerFrame = opts.samplesPerFrame;

  // calculate the "block align"
  this.blockAlign = this.bitDepth / 8 * this.channels;

  // flipped after close() is called, no write() calls allowed after
  this._closed = false;

  // call `flush()` upon the "finish" event
  this.on('finish', this._flush);
}
inherits(Speaker, Writable);

/**
 * `_write()` callback for the Writable base class.
 */

Speaker.prototype._write = function (chunk, done) {
  debug('_write() (%d bytes)', chunk.length);
  if (this._closed) {
    // close() has already been called. this should not be called
    return done(new Error('write() call after close() call'));
  }
  var b;
  var left = chunk;
  var handle = this.audio_handle;
  var chunkSize = this.blockAlign * this.samplesPerFrame;

  function write () {
    b = left;
    if (b.length > chunkSize) {
      var t = b;
      b = t.slice(0, chunkSize);
      left = t.slice(chunkSize);
    } else {
      left = null;
    }
    debug('writing %d byte chunk', b.length);
    binding.write(handle, b, b.length, afterWrite);
  }
  function afterWrite (r) {
    debug('wrote %d bytes', r);
    if (r != b.length) {
      done(new Error('write() failed: ' + r));
    } else if (left) {
      write();
    } else {
      done();
    }
  }

  write();
};

/**
 * Calls the `flush()` and `close()` bindings for the audio backend.
 */

Speaker.prototype._flush = function () {
  debug('_flush()');

  // TODO: async definitely
  binding.flush(this.audio_handle);

  // XXX: The audio backends keep ~.5 seconds worth of buffered audio data
  // in their system, so presumably there will be .5 seconds *more* of audio data
  // coming out the speakers, so we must keep the event loop alive so the process
  // doesn't exit. This is a nasty, nasty hack and hopefully there's a better way
  // to be notified when the audio has acutally finished playing.
  setTimeout(this.close.bind(this), 600);
};

/**
 * Closes the audio backend. Normally this function will be called automatically
 * after the audio backend has finished playing the audio buffer through the
 * speakers.
 *
 * @api public
 */

Speaker.prototype.close = function () {
  debug('close()');

  // TODO: async maybe?
  binding.close(this.audio_handle);

  this.emit('close');
  this.audio_handle = null;
  this._closed = true;
};
