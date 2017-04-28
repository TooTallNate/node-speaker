/* eslint-env mocha */

'use strict'

/**
 * Module dependencies.
 */

const os = require('os')
const assert = require('assert')
const bufferAlloc = require('buffer-alloc')
const Speaker = require('../')

describe('exports', function () {
  it('should export a Function', function () {
    assert.equal('function', typeof Speaker)
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
})
