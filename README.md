# node-speaker

## Output [PCM audio][pcm] data to the speakers

[![Build Status](https://secure.travis-ci.org/TooTallNate/node-speaker.svg)](https://travis-ci.org/TooTallNate/node-speaker)
[![Build Status](https://ci.appveyor.com/api/projects/status/wix7wml3v55670kw?svg=true)](https://ci.appveyor.com/project/TooTallNate/node-speaker)

A Writable stream instance that accepts [PCM audio][pcm] data and outputs it
to the speakers. The output is backed by [libao][ao], which supports
a ton of audio backends.


## Installation

You need `libao` installed on your system before installig `node-speaker`.

- Debian
```sh
$ apt-get install libao-dev
```

- OSX:
```sh
$ brew install libao
```

Now, simply compile and install `node-speaker` using `npm`:

```sh
$ npm install speaker
```

## Example

Here's an example of piping `stdin` to the speaker, which should be 2 channel,
16-bit audio at 44,100 samples per second (a.k.a CD quality audio).

```javascript
const Speaker = require('speaker');

// Create the Speaker instance
const speaker = new Speaker({
  channels: 2,          // 2 channels
  bitDepth: 16,         // 16-bit samples
  sampleRate: 44100     // 44,100 Hz sample rate
});

// PCM data from stdin gets piped into the speaker
process.stdin.pipe(speaker);
```

## API

`require('speaker')` directly returns the `Speaker` constructor. It is the only
interface exported by `node-speaker`.

### new Speaker([ format ]) -> Speaker instance

Creates a new `Speaker` instance, which is a writable stream that you can pipe
PCM audio data to. The optional `format` object may contain any of the `Writable`
base class options, as well as any of these PCM formatting options:

* `channels` - The number of audio channels. PCM data must be interleaved. Defaults to `2`.
* `bitDepth` - The number of bits per sample. Defaults to `16` (16-bit).
* `sampleRate` - The number of samples per second per channel. Defaults to `44100`.

#### "open" event

Fired when the backend `open()` call has completed. This happens once the first
`write()` call happens on the speaker instance.

#### "close" event

Fired after the "flush" event, after the backend `close()` call has completed.
This speaker instance is essentially finished after this point.

## Audio Backend Selection

`node-speaker` is backed by `libao`'s "output modules", which in turn use one of
many popular audio backends like ALSA, pulseaudio, and lots more. The default
backends for each operating system depend on libao configuration. Please check
[libao's documentation][aodoc] for more information.

[pcm]: http://en.wikipedia.org/wiki/Pulse-code_modulation
[ao]: https://www.xiph.org/ao/
[aodoc]: https://xiph.org/ao/doc/config.html
