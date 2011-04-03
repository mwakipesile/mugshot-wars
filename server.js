var express = require('express'),
    app = express.createServer(
	express.cookieDecoder(),
	express.session({ secret: 'mugshotlol' })),
    redis = require('redis-node'),
    db = redis.createClient();

app.configure(function(){
	app.use(express.bodyDecoder());
	app.use(app.router);
	app.use(express.staticProvider(__dirname + '/static'));
});


function byRating(a, b) {
	var x = a[3];
	var y = b[3];
	return y - x;
}

app.get('/top', function(req, res){
	db.keys('booking:*:mugshot', function(err,keys){
		if (err) { throw err; }
		var bookings = [];
		var originalCount = 0;
		var returnCount = 0;
		keys.forEach(function(key){
			key = String(key);
			var split = key.split(':');
			if (!isNaN(split[1])) {
				originalCount++;
				db.mget('booking:' + split[1] + ':booking', 'booking:' + split[1] + ':name', 'booking:' + split[1] + ':mugshot', 'booking:' + split[1] + ':rating', function(err, booking){
					bookings.push(booking);
					returnCount++;
					if (originalCount == returnCount) {
						bookings.sort(byRating);
                				res.render('top.ejs', {  
                        				locals: {
                                				bookings: bookings,
								title: 'Top Inmates'
				                        }
				                });
					}
				});
			}
		});
	});
});

app.get('/status', function(req, res){
	db.get('rounds:' + req.headers['x-real-ip'], function(err, rounds){
		var levelUp = false;
		var levels = [1, 10, 20, 35, 60, 100, 150, 300];
		levels.forEach(function(level){
			if (rounds == level) {
				levelUp = true;
			}
		});
		res.render('status.ejs', {
			locals: {
				rounds: rounds,
				title: 'Your Status',
				levelUp: levelUp
			}
		});
	});
});

app.get('/battled/:winner/:loser', function(req, res){
	if (req.params.winner && req.params.loser) {
		//&& req.headers['referrer'] == 'http://mugshotwars.com/'
		var winner = req.params.winner;
		var loser = req.params.loser;
		req.session.winner = req.params.winner;
		req.session.loser = req.params.loser;
		db.incr('booking:' + winner + ':wins');
		db.incr('booking:' + loser + ':losses');
		db.incr('battles');
		db.mget('booking:' + winner + ':rating', 'booking:' + loser + ':rating', function (err, ratings) {
			if (err) { throw err; }
			ratings[0] = ratings[0] ? parseFloat(ratings[0]) : 1000;
			ratings[1] = ratings[1] ? parseFloat(ratings[1]) : 1000;
			var winnerExpected = 1 / (1 + (Math.pow(10,(ratings[1] - ratings[0]) / 400)));
			var loserExpected = 1 / (1 + (Math.pow(10,(ratings[0] - ratings[1]) / 400)));
			var k = 30;
			var winnerAdjustment = Math.round(ratings[0] + (k * (1 - winnerExpected)));
			var loserAdjustment = Math.round(ratings[1] + (k * (0 - loserExpected)));
			db.mset('booking:' + winner + ':rating', winnerAdjustment, 'booking:' + loser + ':rating', loserAdjustment, function (err, newRatings) {
				if (err) { throw err; }
				db.incr('rounds:' + req.headers['x-real-ip'], function(err, rounds){
				rounds = String(rounds);
				var levels = [1, 10, 20, 35, 60, 100, 150, 300];
				levels.forEach(function(level){
					if (rounds == level) {
						res.redirect('/status');
					}
				});
				res.redirect('/');
				});
			});
		});
	} else {
		res.redirect('/');
	}
});

app.get('/', function(req, res){
	db.keys('booking:*:mugshot', function(err,keys){
		if (err) { throw err; }
		var bookings = [];
		if (!keys.forEach) { res.redirect('/'); }
		keys.forEach(function(key){
			key = String(key);
			var split = key.split(':');
			if (!isNaN(split[1]))
				bookings.push(split[1]);
		});
		var offense = bookings[Math.floor(Math.random()*bookings.length)];
		var defense = bookings[Math.floor(Math.random()*bookings.length)];
		if (defense == offense) {
			defense = bookings[Math.floor(Math.random()*bookings.length)];
		}
		db.mget('booking:' + offense + ':name', 'booking:' + offense + ':mugshot', 'booking:' + offense + ':rating',
			'booking:' + defense + ':name', 'booking:' + defense + ':mugshot', 'booking:' + defense + ':rating',
			'rounds:' + req.headers['x-real-ip'], 'battles', function(err, reply){
			if (req.session.winner && req.session.loser) {
				db.mget('booking:' + req.session.winner + ':mugshot', 'booking:' + req.session.winner + ':rating',
					'booking:' + req.session.loser + ':mugshot', 'booking:' + req.session.loser + ':rating', function(err, previous){
	                		res.render('battle.ejs', {   
        	                		locals: {
							offense: offense,
							defense: defense,
                	        		        battle: reply,
							rounds: reply[6],
							title: 'Battle',
							battles: reply[7],
							previous: previous,
							winner: req.session.winner,
							loser: req.session.loser
        		                	}
		                	});
				});	
			} else {
	                	res.render('battle.ejs', {   
        	                	locals: {
						offense: offense,
						defense: defense,
                	        	        battle: reply,
						rounds: reply[6],
						title: 'Battle',
						battles: reply[7],
						previous: null
        	                	}
	                	});
			}
		});
	});	
});

app.get('/details/:booking', function(req, res){
    if (req.params.booking) {
	db.incr('hits');
	db.incr('hits:details');
	db.mget('booking:' + req.params.booking + ':id',
	    'booking:' + req.params.booking + ':mugshot',
	    'booking:' + req.params.booking + ':name',
	    'booking:' + req.params.booking + ':sex',
	    'booking:' + req.params.booking + ':dob',
	    'booking:' + req.params.booking + ':booking',
	    'booking:' + req.params.booking + ':intake',
	    'booking:' + req.params.booking + ':housed',
	    'booking:' + req.params.booking + ':charges',
	    'booking:' + req.params.booking + ':rating',
	    'booking:' + req.params.booking + ':wins',
	    'booking:' + req.params.booking + ':losses',
	    function(err, reply){
		res.render('details.ejs', {
       		    	locals: {
         			inmate: reply,
				title: 'Mugshot Details'
       			} 
		});
	});
    } else {
	res.send('Are you sure you should be here?');
    }

});

app.get('/stats/:stat', function(req, res){
	switch(req.params.stat){
		case 'battles':
			db.get('battles', function(err, battles) {
				battles = String(battles * 11);
				res.send(battles); });
			break;
		case 'hourly':
			db.lrange('snapshots', 0, -1, function(err, snapshots) {
				var inmatesPerHour = [];
				var hour = 0;
				snapshots.forEach(function(snapshot){
					db.llen('snapshot:' + snapshot, function(err, list){
						inmatesPerHour.push([snapshot, list]);
						hour++;
						if (hour == snapshots.length) {
							res.send(inmatesPerHour);
						}
					});
				});
    			});
			break;
		case 'gender':
			var males = 0;
			var females = 0;
			var keyCount = 1;
			db.keys('booking:*:sex', function(err, keys){
				keys.forEach(function(key){
					db.get(key, function(err, sex){
						if (sex == 'M') {
							males++;
						} else if (sex == 'F') {
							females++;
						}
						keyCount++;
						if (keyCount == keys.length) {
							res.send([[2, males], [4, females]]);
						}
					});
				});
			});
			break;
		case 'age':
			var first = 0;
			var second = 0;
			var third = 0;
			var fourth = 0;
			var fifth = 0;
			var sixth = 0;
			var keyCount = 1;
			var today = new Date();
			db.keys('booking:*:dob', function(err, keys){
				keys.forEach(function(key){
					db.get(key, function(err, dob){
						//console.log(dob);
						var split = dob.split('-');
						if (split[2]) {
							var d = new Date(split[2],split[0],split[1]);
							var age = Math.floor((today.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
							if (age >= 13 && age <= 17) { first++; }
							if (age >= 18 && age <= 24) { second++; }
							if (age >= 25 && age <= 34) { third++; }
							if (age >= 35 && age <= 44) { fourth++; }
							if (age >= 45 && age <= 54) { fifth++; }
							if (age >= 55) { sixth++; }
						}
						keyCount++;
						if (keyCount == keys.length) {
							res.send([[0, first], [1, second], [2, third], [3, fourth], [4, fifth], [5, sixth]]);
						}
					});
				});
			});
			break;
		default:
			res.send('Should you be here?');
			break;
	}
});

app.get('/statistics', function(req, res){
	var title = 'Statistics';
	res.render('statistics.ejs', {
       		locals: {
			title: title
		}
	});
});

app.get('/about', function(req, res){
	var title = 'About';
	res.render('about.ejs', {
		locals: {
			title: title
		}
	});
});

app.get('/admin', function(req, res){
	db.mget('hits','hits:index','hits:details',function(err, reply) { res.send(reply); });
});

app.listen(3000, function(err, status){
	console.log('Running...');
});
