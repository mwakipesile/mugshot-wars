var express = require('express'),
    app = express.createServer(
	express.cookieDecoder(),
	express.session({ secret: 'mugshotlol' })),
    redis = require('redis-node'),
    db = redis.createClient();


var levels = [1, 10, 20, 35, 60, 100, 150, 300, 500, 1000, 2000, 4000, 7000, 10000];


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
			var split = String(key).split(':');
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
								title: 'Top Mugshots'
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
		levels.forEach(function(level){
			if (rounds == level.rounds) {
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

app.get('/about', function(req, res){
	res.render('about.ejs', {
		locals: {
			title: 'About'
		}
	});
});

app.listen(3333, function(err, status){
	console.log('Running...');
});
