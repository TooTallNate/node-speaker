const fs = require('fs')
const wav = require('wav')
const Speaker = require('../')
const program = require('commander')

program.parse(process.argv)

function playFile (filepath) {
  const file = fs.createReadStream(filepath)
  const reader = new wav.Reader()
  reader.on('format', function (format) {
    const speaker = new Speaker(format)
    speaker.on('unpipe', () => {
      console.log('Done ' + filepath)
    })
    reader.pipe(speaker)
  })
  file.pipe(reader)
  console.log('Started playing ' + filepath)
}
program.args.forEach(playFile)
