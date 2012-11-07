
var assert = require('assert');
var Speaker = require('../');

describe('exports', function () {

  it('should export a Function', function () {
    assert.equal('function', typeof Speaker);
  });

  it('should have an "api_version" property', function () {
    assert(Speaker.hasOwnProperty('api_version'));
    assert('number', typeof Speaker.api_version);
  });

  it('should have a "description" property', function () {
    assert(Speaker.hasOwnProperty('description'));
    assert('string', typeof Speaker.description);
  });

  it('should have a "module_name" property', function () {
    assert(Speaker.hasOwnProperty('module_name'));
    assert('string', typeof Speaker.module_name);
  });

});

describe('Speaker', function () {

  it('should return a Speaker instance', function () {
    var s = new Speaker();
    assert(s instanceof Speaker);
  });

  it('should be a writable stream', function () {
    var s = new Speaker();
    assert.equal(s.writable, true);
    assert.notEqual(s.readable, true);
  });

  it('should emit an "open" event after the first write()', function (done) {
    var s = new Speaker();
    var called = false;
    s.on('open', function () {
      called = true;
      done();
    });
    assert.equal(called, false);
    s.write(Buffer(0));
  });

  it('should emit a "flush" event after end()', function (done) {
    var s = new Speaker();
    var called = false;
    s.on('flush', function () {
      called = true;
      done();
    });
    assert.equal(called, false);
    s.end(Buffer(0));
  });

  it('should emit a "close" event after end()', function (done) {
    var s = new Speaker();
    var called = false;
    s.on('close', function () {
      called = true;
      done();
    });
    assert.equal(called, false);
    s.end(Buffer(0));
  });

});
