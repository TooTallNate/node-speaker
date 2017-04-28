var fs = require('fs');
var wav = require('wav');
var Speaker = require('../');
var program = require('commander');

program.parse(process.argv);

function playFile(filepath) {
	var file = fs.createReadStream(filepath);
	var reader = new wav.Reader();
	reader.on('format', function (format) {
		speaker = new Speaker(format);
		speaker.on('unpipe', () => {
			console.log('Done ' + filepath);
		});
		reader.pipe(speaker);
	});
	file.pipe(reader);
	console.log('Started playing ' + filepath);
}
program.args.forEach(playFile);
