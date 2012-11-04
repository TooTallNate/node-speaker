0.0.4 / 2012-11-04
==================

 - mpg123: add linux arm support
 - guard against bindings that don't have a `deinit()` function

0.0.3 / 2012-11-03
==================

 - a two examples to the "examples" dir
 - emit an "open" event
 - emit a "close" event
 - emit a "flush" event
 - properly support the "pipe" event
 - mpg123: fix a CoreAudio backend compilation warning
 - add a timeout after the flush call to ensure the backend has time to play

0.0.2 / 2012-10-25
==================

 - support for Windows
 - support for Linux
 - support for Solaris
 - call `flush()` and `close()` at the end of the stream

0.0.1 / 2012-10-24
==================

 - Initial release
