
0.3.0 / 2016-04-09
==================

  * Update to latest version win32.c
  * README: use SVG for appveyor badge

0.2.6 / 2015-09-24
==================

  * more travis/appveyor testing
  * src: modification so it works with nan@2 (#64, @santigimeno)
  * fix compile with io.js 2.1.0 on Linux (#56, @bradjc)
  * made it compile on freebsd (#55, @antxxxx)

0.2.5 / 2015-04-15
==================

  * package: update "bindings" to v1.2.1
  * package: update "nan" to v1.7.0
  * appveyor: test node v0.12, don't test v0.11
  * travis: test node v0.12, don't test v0.11

0.2.4 / 2015-02-20
==================

  * update "nan" to v1.6.2
  * update binding.cc for node v0.12 / iojs support (#47, @mrinalvirnave)

0.2.3 / 2015-02-20
==================

  * link pulse-simple when using mpg123 "pulse" backend (#48, @ReneHollander)

0.2.2 / 2015-01-13
==================

  * example: make sine.js produce 220hz, not 440hz (#38, @jproulx)
  * package: update "mocha" to v2.1.0
  * package: allow any "debug" v2
  * package: add "bugs" and "homepage" fields
  * travis: remove unused "matrix" field

0.2.1 / 2014-07-07
==================

  * src: call open() and close() on the dummy audio_output_t instance (#36)
  * README: document the `float` format option

0.2.0 / 2014-06-22
==================

  * gitignore: ignore root-level dev files
  * index: pass the `format` directly to the native open() binding
  * index: ensure a valid and supported "format" is given to Speaker instance
  * test: add quotes to test names
  * index: add `getFormat()` and `isSupported()` functions
  * binding: export the `MPG123_ENC_*` constants
  * binding: export the result of `get_formats()`
  * mpg123: add 64-bit float playback support for CoreAudio backend
  * index: use %o formatter some more
  * index: default `float` to 32-bit `bitDepth`

0.1.3 / 2014-06-15
==================

  * index: do not call `flush()` binding when the stream finishes "naturally"
  * index: use %o formatting from debug v1
  * package: update "nan" to v1.2.0
  * package: update "debug" to v1.0.0

0.1.2 / 2014-06-02
==================

  * package: update "nan" to v1.1.2
  * package: update "mocha" dev dependency

0.1.1 / 2014-05-27
==================

  * binding: update to nan v1.1.0 API, fixes node v0.11.13+
  * add appveyor.yml file for Windows testing
  * README: add appveyor build badge
  * README: use svg for travis badge
  * travis: don't test node v0.9.x
  * index: make _format() bind to the speaker instance
  * don't leave event listeners behind (#22, @LinusU)

0.1.0 / 2014-04-17
==================

  * index: abort write() call if `_close` is set (#28, #29)
  * package: tighten up the dependencies' versions
  * index: add a debug() call
  * index: emit "close" after setting `_closed`
  * index: use the "readable-stream" copy of Writable
  * package: pin "readable-stream" to any v1.0.x
  * examples: fix "sine" emitting "end" event
  * travis: test node v0.11
  * use `rvagg/nan`
  * fix History.md note
  * fix sinewave example on 0.10 (Stream API changes) (#12, @jfmatt)

0.0.10 / 2013-05-08
===================

  * pass the "open" error to the Speaker instance. Closes #7.
  * package: add "sound" as a keyword
  * travis: test node v0.10

0.0.9 / 2013-03-06
==================

  * update for v0.9.12 Writable stream API change
  * a couple more jsdoc comments

0.0.8 / 2013-02-10
==================

  * throw an Error if non-native endianness is specified

0.0.7 / 2013-01-14
==================

  * wait for the `format` event on pipe'd Readable instances
  * default the lowWaterMark and highWaterMark to 0
  * rename _opts() to _format()
  * package: allow any "readable-stream" version
  * add a few more debug calls

0.0.6 / 2012-12-15
==================

  * add node >= v0.9.4 compat

0.0.5 / 2012-11-16
==================

  * add initial tests (uses the "dummy" output module)
  * add "float" (32-bit and 64-bit) output support
  * ensure only one "close" event

0.0.4 / 2012-11-04
==================

  * mpg123: add linux arm support
  * guard against bindings that don't have a `deinit()` function

0.0.3 / 2012-11-03
==================

  * a two examples to the "examples" dir
  * emit an "open" event
  * emit a "close" event
  * emit a "flush" event
  * properly support the "pipe" event
  * mpg123: fix a CoreAudio backend compilation warning
  * add a timeout after the flush call to ensure the backend has time to play

0.0.2 / 2012-10-25
==================

  * support for Windows
  * support for Linux
  * support for Solaris
  * call `flush()` and `close()` at the end of the stream

0.0.1 / 2012-10-24
==================

  * Initial release
