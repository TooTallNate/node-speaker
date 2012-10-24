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

  // TODO: open async?
  this.audio_handle = new Buffer(binding.sizeof_audio_output_t);

  if (!opts) opts = {};
  if (null == opts.signed) opts.signed = true;
  if (null == opts.channels) opts.channels = 2;
  if (null == opts.bitDepth) opts.bitDepth = 16;
  if (null == opts.sampleRate) opts.sampleRate = 44100;
  binding.open(this.audio_handle, opts);
}
inherits(Output, Writable);

/**
 * `_write()` callback for the Writable base class.
 *
 * TODO: figure out how to flush() and close()...
 */

Output.prototype._write = function (chunk, done) {
  debug('_write() (%d bytes)', chunk.length);
  binding.write(this.audio_handle, chunk, chunk.length, function (r) {
    debug('wrote %d bytes', r);
    if (r != chunk.length) {
      done(new Error('write() failed: ' + r));
    } else {
      done();
    }
  });
};
