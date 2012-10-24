/**
 * Module dependencies.
 */

var inherits = require('util').inherits;
var Writable = require('stream').Writable;
var debug = require('debug')('audio-output');
var binding = require('bindings')('binding');

// node v0.8.x compat
if (!Writable) Writable = require('readable-stream/writable');

/**
 * Module exports.
 */

exports = module.exports = Output;

/**
 * Export information about the `mpg123_module_t` being used.
 */

exports.api_version = binding.api_version;
exports.description = binding.description;
exports.module_name = binding.name;

/**
 * The `Output` class accepts raw PCM data written to it, and then sends that data
 * to the default output device of the OS.
 *
 * @param {Object} options object
 * @api public
 */

function Output (opts) {
  if (!(this instanceof Output)) return new Output(opts);
  Writable.call(this, opts);

  // set default options
  if (!opts) opts = {};
  if (null == opts.signed) opts.signed = true;
  if (null == opts.channels) opts.channels = 2;
  if (null == opts.bitDepth) opts.bitDepth = 16;
  if (null == opts.sampleRate) opts.sampleRate = 44100;

  // initialize the audio handle
  // TODO: open async?
  this.audio_handle = new Buffer(binding.sizeof_audio_output_t);
  binding.open(this.audio_handle, opts);

  // chunks are sent over to the backend in "samplesPerFrame * blockAlign" size.
  // this is necessary because if we send too big of chunks at once, then there
  // won't be any data ready when the audio callback comes (experienced with the
  // CoreAudio backend)
  if (null == opts.samplesPerFrame) opts.samplesPerFrame = 1024;

  // copy over the opts
  for (var i in opts) this[i] = opts[i];

  // calculate the "block align"
  this.blockAlign = this.bitDepth / 8 * this.channels;
}
inherits(Output, Writable);

/**
 * `_write()` callback for the Writable base class.
 *
 * TODO: figure out how to flush() and close()...
 */

Output.prototype._write = function (chunk, done) {
  debug('_write() (%d bytes)', chunk.length);
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
