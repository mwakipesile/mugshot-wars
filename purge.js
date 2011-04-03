var redis = require('redis-node');
var db = redis.createClient();

var prompt = require('prompt');

/*prompt()
	.ask('What booking number?', 'id')
	.tap(function(vars){
		db.keys('booking:' + vars.id + '*', function(err, keys){
			keys.forEach(function(key){
				db.del(key, function(err, response) { console.log(response); });
			});
		});
	});*/

db.keys('booking:*:rating', function(err, keys){
	keys.forEach(function(key){
		db.get(key, function(err, rating){
			if (rating < 1000) {
				db.del(key);
				var split = key.split(':');
				var id = split[1];
				console.log(id + ': ' + rating);
				db.keys('booking:' + id + ':*', function(err, purgeable){
					purgeable.forEach(function(keyToPurge){
						console.log(keyToPurge);
						db.del(keyToPurge);
					});
				});
			}
		});
	});
});
