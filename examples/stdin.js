'use strict'

/**
 * Pipe data to stdin and it will be played through your speakers.
 */

const Speaker = require('../')

const speaker = new Speaker()
process.stdin.pipe(speaker)
