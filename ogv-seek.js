var port = 8080;
var file = "/tmp/test.ogv";

var http = require("http");
var url = require("url");
var spawn = require("child_process").spawn;

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
	res.setHeader("content-type", "video/ogg");
	res.on("close", function() { child.kill(); console.log("response channel closed.")});
	child.stdout.on("data", function(data) { res.write(data); });
	child.stdout.on("end", function() { res.end; });	
	child.on("exit", function() { res.end; console.log("oggz-chop exited."); });
}


var server = http.createServer(function(req, res) {
	var parsedurl = url.parse(req.url, true);
	var timeParam = parsedurl.query.t;

	var timestring = getTimeString(timeParam);
	console.log("parsed path: " + parsedurl.pathname);
	console.log("parsed time: " + timestring);

	chopOgg(res, file, timestring);
});

server.listen(port);
console.log("listening on port " + port);
console.log("try http://localhost:"+port+"/bla?t=5 to jump 5 seconds into the ogv file");
