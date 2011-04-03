console.log('Brainerd Custody Smart Scraper v0.1');

console.log('Loading dependencies...');

var scraper = require('scraper'),
        sys = require('sys'),
        exec = require('child_process').exec,
        fs = require('fs'),
        redis = require('redis-node'),
        db = redis.createClient(),
	cron = require('cron');

// custom functions

function puts(error, stdout, stderr) { sys.puts(stdout) }
String.prototype.trimAll = function() { return this.replace(/\s+/g, ' '); };

console.log('Initializing hourly timer...');

new cron.CronJob('0 0 * * * *', function(){

console.log('Downloading...');

scraper('http://www.co.crow-wing.mn.us/Sheriff/Jail/custody2.html', function(err, $, urlInfo) {
        if (err) {throw err;}
	console.log('Processing data...');
	var bookings = [];

	var body = $('body');
	var table = body[0]._childNodes[4].childNodes[7];
	var rows = table._childNodes;
	rows.shift();
	rows.shift()

	rows.forEach(function(row){
		var booking = [];
		var innerCount = 0;
		row._childNodes.forEach(function(cell){
			var image = $(cell).find('img').attr('src');
			if (image) {
				var split = image.split('/');
				booking.image = split[1];
                        	fs.stat('static/images/mugshots/' + split[1], function(err, stat){
                                	if (stat == undefined) {
                                        	console.log('Grabbing ' + split[1] + '...');
                                	        exec('wget --directory-prefix=static/images/mugshots http://www.co.crow-wing.mn.us/Sheriff/Jail/BookingPhotos/' + split[1]);
                        	        }
	                        });

			} else {
				switch(innerCount) {
					case 2:
						booking.name = $(cell).text().trimAll().trim();
						break;
					case 3:
						booking.sex = $(cell).text().trimAll().trim();
						break;
					case 4:
						booking.dob = $(cell).text().trimAll().trim();
						break;
					case 5:
						booking.booking = $(cell).text().trimAll().trim();
						break;
					case 6:
						booking.intake = $(cell).text().trimAll().trim();
						break;
					case 7:
						booking.housed = $(cell).text().trimAll().trim();
						break;
					case 8:
						var charges = [];
						$(cell._childNodes[1]).find('tr').each(function(){
							if ($(this).text().trimAll() != ' ') {
								var charge = [];
								$(this).find('td').each(function(){
									var text = $(this).text().trimAll().trim();
									if (text != '' && text != '-')
										charge.push(text);
								});
								charges.push(charge);
							}
						});
						booking.charges = charges;
						break;
				}
			}
			innerCount++;
		});
		bookings.push(booking);
	});

        var d = new Date();
        var snapshot = d.getTime();
        db.rpush('snapshots',snapshot, function() { console.log('Snapshot added to set'); });

        var bookingIndex = 0;
        bookings.forEach(function(booking){
		if (booking.name != undefined) {
	                booking.id = bookingIndex;

        	        db.rpush('snapshot:' + snapshot, booking.booking, function() { console.log('Booking ' + booking.booking + ' added to snapshot subset'); });

                	db.set('booking:' + booking.booking + ':id', booking.id);
                	db.set('booking:' + booking.booking + ':snapshot', snapshot);
                	db.set('booking:' + booking.booking + ':mugshot', booking.image);
                	db.set('booking:' + booking.booking + ':name', booking.name);
                	db.set('booking:' + booking.booking + ':sex', booking.sex);
                	db.set('booking:' + booking.booking + ':dob', booking.dob);
                	db.set('booking:' + booking.booking + ':booking', booking.booking);
                	db.set('booking:' + booking.booking + ':intake', booking.intake);
                	db.set('booking:' + booking.booking + ':housed', booking.housed);
                	db.set('booking:' + booking.booking + ':charges', booking.charges);
                	db.setnx('booking:' + booking.booking + ':rating', '1000');
                       
                	//console.log(booking);
	        	bookingIndex++;
		}
        });
	// keep memory in check
	//process.exit();
});

}); // end cron
