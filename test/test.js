/* eslint-env mocha */

'use strict'

/**
 * Module dependencies.
 */

const os = require('os')
const assert = require('assert')
const bufferAlloc = require('buffer-alloc')
const Speaker = require('../')

const endianness = os.endianness()
const opposite = endianness === 'LE' ? 'BE' : 'LE'

describe('exports', function () {
  it('should export a Function', function () {
    assert.equal('function', typeof Speaker)
  })

  it('should have an "api_version" property', function () {
    assert(Speaker.hasOwnProperty('api_version'))
    assert('number', typeof Speaker.api_version)
  })

  it('should have a "description" property', function () {
    assert(Speaker.hasOwnProperty('description'))
    assert('string', typeof Speaker.description)
  })

  it('should have a "module_name" property', function () {
    assert(Speaker.hasOwnProperty('module_name'))
    assert('string', typeof Speaker.module_name)
  })
})

describe('Speaker', function () {
  it('should return a Speaker instance', function () {
    const s = new Speaker()
    assert(s instanceof Speaker)
  })

  it('should be a writable stream', function () {
    const s = new Speaker()
    assert.equal(s.writable, true)
    assert.notEqual(s.readable, true)
  })

  it('should emit an "open" event after the first write()', function (done) {
    const s = new Speaker()
    let called = false
    s.on('open', function () {
      called = true
      done()
    })
    assert.equal(called, false)
    s.write(bufferAlloc(0))
  })

  it('should emit a "flush" event after end()', function (done) {
    const s = new Speaker()
    let called = false
    s.on('flush', function () {
      called = true
      done()
    })
    assert.equal(called, false)
    s.end(bufferAlloc(0))
  })

  it('should emit a "close" event after end()', function (done) {
    this.slow(1000)
    const s = new Speaker()
    let called = false
    s.on('close', function () {
      called = true
      done()
    })
    assert.equal(called, false)
    s.end(bufferAlloc(0))
  })

  it('should only emit one "close" event', function (done) {
    const s = new Speaker()
    let count = 0
    s.on('close', function () {
      count++
    })
    assert.equal(0, count)
    s.close()
    assert.equal(1, count)
    s.close()
    assert.equal(1, count)
    done()
  })

  it('should accept a device option', function (done) {
    const s = new Speaker({ device: 'test' })

    assert.equal(s.device, 'test')

    s.on('close', done)
    s.end(bufferAlloc(0))
  })

  it('should not throw an Error if native "endianness" is specified', function () {
    assert.doesNotThrow(function () {
      // eslint-disable-next-line no-new
      new Speaker({ endianness: endianness })
    })
  })

  it('should throw an Error if non-native "endianness" is specified', function () {
    assert.throws(function () {
      // eslint-disable-next-line no-new
      new Speaker({ endianness: opposite })
    })
  })

  it('should throw an Error if a non-supported "format" is specified', function (done) {
    const speaker = new Speaker({
      bitDepth: 31,
      signed: true
    })
    speaker.once('error', (err) => {
      assert.equal('invalid PCM format specified', err.message)
      done()
    })
    speaker.write('a')
  })
})
