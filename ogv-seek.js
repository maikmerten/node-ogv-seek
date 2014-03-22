var port = 8080;
var prefix = "/tmp/";

var http = require("http");
var url = require("url");
var spawn = require("child_process").spawn;
var path = require("path");
var fs = require("fs");

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


function serveOgg(res, file) {
	fs.stat(file, function(err, stats) {
		if(err) {
			reportError(res);
			return;
		}
		res.setHeader("Content-Type", "video/ogg");
		res.setHeader("Content-Length", stats.size);
		var stream = fs.createReadStream(file);
		stream.pipe(res);
	});
}


function reportError(res) {
	res.writeHead(500, {'Content-Type': 'text/plain'});
	res.write("Internal Server Error");
	res.end();
}


var server = http.createServer(function(req, res) {
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
					serveOgg(res, file);
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
