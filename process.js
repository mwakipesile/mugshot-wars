var fs = require('fs');
var redis = require('redis-node');
var db = redis.createClient();
var exec = require('child_process').exec;

var files = fs.readdirSync('./static/images/new')

files.forEach(function(file){
		db.incr('booking', function(err, id){
			db.set('booking:' + id + ':id', id);
			db.set('booking:' + id + ':booking', id);
			db.set('booking:' + id + ':rating', '1000');
			db.set('booking:' + id + ':losses', '0');
			db.set('booking:' + id + ':wins', '0');
			db.set('booking:' + id + ':mugshot', file);
			console.log(file);
		});
});

exec('mv static/images/new/* static/images/mugshots/');
