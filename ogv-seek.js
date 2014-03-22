var port = 8080;
var prefix = "/tmp/";

var http = require("http");
var url = require("url");
var spawn = require("child_process").spawn;
var exec = require("child_process").exec;
var path = require("path");
var fs = require("fs");

var statsCache = {};


function getTimeString(timeParam) {
	var time = parseInt(timeParam);
	if(isNaN(time)) {
		console.log("ignoring NaN timestamp...");
		time = 0;
	}

	var hours = (time / 3600) | 0;
	time -= hours * 3600;
	var minutes = (time / 60) | 0;
	time -= minutes * 60;
	var seconds = time;

	return hours + ":" + minutes + ":" + seconds;
}


function chopOgg(res, file, timestring) {
	var child = spawn("oggz-chop",["-s", timestring, file]);
	res.setHeader("Content-Type", "video/ogg");
	res.on("close", function() { child.kill(); console.log("response channel closed.")});
	child.stdout.on("data", function(data) { res.write(data); });
	child.stdout.on("end", function() { res.end(); });	
	child.on("exit", function() { res.end(); console.log("oggz-chop exited."); });
}


function serveOggWithStats(res, file, stats, range) {
	res.setHeader("Content-Type", "video/ogg");
	res.setHeader("Accept-Ranges", "bytes");

	var length = stats.size;
	var options = {};
	if(range) {
		options.start = range.start;
		options.end = range.end;
		length = range.end - range.start;
	} else {
		res.setHeader("X-Content-Duration", stats.duration);
	}
	res.setHeader("Content-Length", length);

	var stream = fs.createReadStream(file, options);
	stream.pipe(res);
}


function serveOgg(res, file, range) {

	var stats = statsCache[file];
	if(stats) {
		serveOggWithStats(res, file, stats, range);
	} else {
		fs.stat(file, function(err, stats) {
			if(err) {
				reportError(res);
				return;
			}
			exec("oggz-info " + file, function(error, stdout, stderr) {
				if(error) {
					reportError(res);
					return;
				}
				var duration = stdout.split("\n")[0].split(": ")[1];
				var hours = parseInt(duration.split(":")[0]);
				var minutes = parseInt(duration.split(":")[1]);
				var seconds = parseFloat(duration.split(":")[2]);

				duration = (hours * 3600) + (minutes * 60) + seconds;
				stats.duration = duration;
				statsCache[file] = stats;
				serveOggWithStats(res, file, stats, range);
			});
		
		});
	}
}


function reportError(res) {
	res.writeHead(500, {'Content-Type': 'text/plain'});
	res.write("Internal Server Error");
	res.end();
}


function parseRange(headers) {
	if(!headers.range) {
		return;
	}
	var rangestring = headers.range.split("=")[1];
	var start = parseInt(rangestring.split("-")[0]);
	var end = parseInt(rangestring.split("-")[1]);

	start = (isNaN(start) || start < 0) ? 0 : start;
	end = (end <= start) ? null : end;

	var result = {};
	result.start = start;
	result.end = end;
	return result;
}



var server = http.createServer(function(req, res) {
	var range = parseRange(req.headers);
	console.log("### range: " + range);
	var parsedurl = url.parse(req.url, true);
	var timeParam = parsedurl.query.t;

	var timestring = getTimeString(timeParam);
	console.log("parsed path: " + parsedurl.pathname);
	console.log("parsed time: " + timestring);

	var file = prefix + parsedurl.pathname;
	file = path.normalize(file);

	if(file.indexOf(prefix) == 0) {
		fs.exists(file, function(exists) {
			if(exists) {
				if(timeParam) {
					chopOgg(res, file, timestring);
				} else {
					console.log("no time given, directly streaming file");
					serveOgg(res, file, range);
				}
			} else {
				reportError(res);
			}
		});
	} else {
		reportError(res);
	}
});

prefix = path.normalize(prefix);
server.listen(port);
console.log("listening on port " + port);
console.log("try http://localhost:"+port+"/test.ogv?t=5 to jump 5 seconds into " + prefix + "test.ogv");
