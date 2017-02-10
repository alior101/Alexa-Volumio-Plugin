 'use strict'; 

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var SpotifyWebApi = require('spotify-web-api-node');
var nodetools = require('nodetools');
var mqtt = require('mqtt');
var nconf = require('nconf');
var path = require('path');
var startup = nconf.argv();
var io=require('socket.io-client');

var socket= io.connect('http://localhost:3000');


var syslogMsg ="";


// Define the ControllerAlexa class
module.exports = ControllerAlexa;
function ControllerAlexa(context) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	self.logger.info('alexa: updating fixed variable for later deeper scopes');

}

ControllerAlexa.prototype.init_mqtt = function()
{
	var self = this;

}
ControllerAlexa.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	self.samplerate="128Kbps";

	self.logger.info('alexa: config username : '  + self.config.get('username'));
	self.logger.info('alexa: config mqtt host : '  + self.config.get('host'));

	//nconf.argv().file({ file: configFile })

	nconf.defaults({
	  "secure":"false",
	  "username":"oewmlizv",
	  "password":"VwO-mIaRmDXJ",
	  "host":"m20.cloudmqtt.com",
	  "port":"13451",
	  "cid":"clientid",
	  "subtopic":"/alexa/command",
	  "pubtopic":"/alexa/response"
	}) 

	var publish_topic = nconf.get('pubtopic');
	var subscribe_topic = nconf.get('subtopic');


	if (nconf.get('secure') == 'true') {
	  var connectstring = 'mqtts://';
	}
	else {
	  var connectstring = 'mqtt://';
	}

	connectstring = connectstring +  self.config.get('username') + ':' + self.config.get('password') + '@' +self.config.get('host') + ':' +self.config.get('username') + '?clientId=' + nconf.get('cid');
	var url = "mqtt://m20.cloudmqtt.com";

	self.logger.info('publishing to topic: ' +publish_topic);
	console.log('debug','publishing to topic: ' +publish_topic);
	console.log('publishing to topic: ' + publish_topic);

	//this.init_mqtt();
	var options = {
	  port: self.config.get('port'),
	  clientId: 'mqttjs_' + Math.random().toString(16).substr(2, 8),
	  username: self.config.get('username') ,
	  password: self.config.get('password') ,
	};

	console.log('connecting with URL ' + url);
	self.logger.info('connecting with URL ' + url + ' - ' + connectstring);

	var client = mqtt.connect(url,options);
	console.log('debug','Connecting with: ' + connectstring);

	client.on('error', function(){
		console.log("ERROR")
		client.end()
	})

	client.on('connect', function () {
	  console.log('client connected! ');
	  self.logger.info('client connected! ');

	  client.subscribe(subscribe_topic, function(err, granted)
	  {
		console.log('debug','subscribed with response error: ' +err +' granted: ' +granted)
	  })
	})

	client.on('message', function(topic, message) {
	  //console.log('message received: %s', message);
	  self.logger.info('alexa: message received: %s', message);

	  self.commandRouter = self.context.coreCommand;		

	  var req = JSON.parse(message);
		if(req.request.type == "LaunchRequest")
		{
			client.publish(publish_topic,'Hi!');
		}
		else if(req.request.intent)
		{
		  var name = req.request.intent.name;

		  
		  switch(name)
		  { 
			case "Search":
/*
				var value1 = req.request.intent.slots.MusicAlbum.value;
				var value2 = req.request.intent.slots.MusicGroup.value;
				var value3 = req.request.intent.slots.Musician.value;
				var returnedData = self.commandRouter.musicLibrary.search(value2);
		  		self.logger.info('alexa: parsed %s, val %s,%s,%s',name, value1,value2,value3);
				self.logger.info('alexa: returnedData %s',returnedData);				
				returnedData.then(function (result) {
					self.logger.info('alexa: musicLibrary.search %s', result);
				});					
*/
				break;
			case "Play":
				self.logger.info('alexa: activated ->Play');
				self.commandRouter.volumioPlay.bind(self.commandRouter);
				self.commandRouter.volumioPlay();
				client.publish(publish_topic,'OK');
				break;
			case "Next":
				self.logger.info('alexa: activated ->Next');
				self.commandRouter.volumioNext.bind(self.commandRouter);
				self.commandRouter.volumioNext();
				client.publish(publish_topic,'OK');
				break;
			case "Stop":
				self.logger.info('alexa: activated ->Stop');
				self.commandRouter.volumioStop.bind(self.commandRouter);
				self.commandRouter.volumioStop();
				client.publish(publish_topic,'OK');
				break;
			case "Pause":
				self.logger.info('->pause');
				self.commandRouter.volumioPause.bind(self.commandRouter);
				self.commandRouter.volumioPause();
				client.publish(publish_topic,'OK');
				break;
			case "ListPlaylists":
				self.logger.info('->list playlists');
				
				var returnedData = self.commandRouter.playListManager.listPlaylist();
				returnedData.then(function (data) {
					self.logger.info('alexa: playlist: ', data);
					client.publish(publish_topic,'Existing playlist: ' + data);
				});
				break;
			case "VolumeSet":
				var value = req.request.intent.slots.Repeat.value;

				self.logger.info('->volume up %s', value);

				socket.emit('volume', Number(value));
				
				client.publish(publish_topic,'Updated volume to ' + value);	
				break;

			case "SetPlaylists":
				self.logger.info('->set playlists');
				var playlist = req.request.intent.slots.Playlist.value;
				//var returnedData = self.commandRouter.playPlaylist(playlist);

				var returnedData = self.commandRouter.playListManager.listPlaylist();
				returnedData.then(function (data) {
					
					var data_up = data.map(function(x){ return x.toUpperCase() })
					var found_index = data_up.indexOf(playlist.toUpperCase() );
					if (found_index > -1) 
					{
						//In the array!
						self.logger.info('alexa: set playlist to : %s', data[found_index]);
						//debugger;
						var returnedData1 = self.commandRouter.playListManager.playPlaylist(data[found_index]);
						self.logger.info('playListManager.playPlaylist:  %s ', returnedData1);
						client.publish(publish_topic,'OK, setting playlist to; ' + data[found_index]);
					} 
					else 
					{
						//Not in the array
						returnedData.then(function (data) {
							self.logger.info('alexa: unknown playlist %s', playlist);
							client.publish(publish_topic,'Sorry, This playlist does not exist');
						});
					}
				});

				break;
		  }
		}
	});

}

ControllerAlexa.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

ControllerAlexa.prototype.addToBrowseSources = function () {
	var data = {name: 'Alexa', uri: 'alexa',plugin_type:'user_interface',plugin_name:'alexa'};
	this.commandRouter.volumioAddToBrowseSources(data);
};

// Plugin methods -----------------------------------------------------------------------------
/*
ControllerAlexa.prototype.startAlexaDaemon = function() {
	var self = this;

	var defer=libQ.defer();

	exec("/usr/bin/sudo /bin/systemctl start alexa.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting SPOPD: ' + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage('AlexaD Daemon Started');
			defer.resolve();
		}
	});

	return defer.promise;
};

ControllerAlexa.prototype.spopDaemonConnect = function(defer) {
	var self = this;

	// TODO use names from the package.json instead
	self.servicename = 'alexa';
	self.displayname = 'Alexa';


	// Each core gets its own set of Alexa sockets connected
	var nHost='localhost';
	var nPort=34000;
	self.connAlexaCommand = libNet.createConnection(nPort, nHost); // Socket to send commands and receive track listings
	self.connAlexaStatus = libNet.createConnection(nPort, nHost, function(){
		self.addToBrowseSources();
		defer.resolve();
	}); // Socket to listen for status changes

	// Start a listener for receiving errors
	self.connAlexaCommand.on('error', function(err) {
		self.logger.info('SPOP command error:');
		self.logger.info(err);

		try
		{
			defer.reject();
		} catch(ecc) {}

	});
	self.connAlexaStatus.on('error', function(err) {
		self.logger.info('SPOP status error:');
		self.logger.info(err);

		try
		{
			defer.reject();
		} catch(ecc) {}
	});

	// Init some command socket variables
	self.bAlexaCommandGotFirstMessage = false;
	self.spopCommandReadyDeferred = libQ.defer(); // Make a promise for when the Alexa connection is ready to receive events (basically when it emits 'spop 0.0.1').
	self.spopCommandReady = self.spopCommandReadyDeferred.promise;
	self.arrayResponseStack = [];
	self.sResponseBuffer = '';

	// Start a listener for command socket messages (command responses)
	self.connAlexaCommand.on('data', function(data) {
		self.sResponseBuffer = self.sResponseBuffer.concat(data.toString());

		//self.commandRouter.logger.info("DATA: "+self.sResponseBuffer);

		// If the last character in the data chunk is a newline, this is the end of the response
		if (data.slice(data.length - 1).toString() === '\n') {

			self.commandRouter.logger.info("FIRST BRANCH");

			// If this is the first message, then the connection is open
			if (!self.bAlexaCommandGotFirstMessage) {
				self.bAlexaCommandGotFirstMessage = true;
				try {
					self.spopCommandReadyDeferred.resolve();
				} catch (error) {
					self.pushError(error);
				}
				// Else this is a command response
			} else {
				try {
					self.commandRouter.logger.info("BEFORE: SPOP HAS "+self.arrayResponseStack.length+" PROMISE IN STACK");

					if(self.arrayResponseStack!==undefined && self.arrayResponseStack.length>0)
						self.arrayResponseStack.shift().resolve(self.sResponseBuffer);

					self.commandRouter.logger.info("AFTER: SPOP HAS "+self.arrayResponseStack.length+" PROMISE IN STACK");

				} catch (error) {
					self.pushError(error);
				}
			}

			// Reset the response buffer
			self.sResponseBuffer = '';
		}
	});

	// Init some status socket variables
	self.bAlexaStatusGotFirstMessage = false;
	self.sStatusBuffer = '';

	// Start a listener for status socket messages
	self.connAlexaStatus.on('data', function(data) {
		self.sStatusBuffer = self.sStatusBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the status update
		if (data.slice(data.length - 1).toString() === '\n') {
			// Put socket back into monitoring mode
			self.connAlexaStatus.write('idle\n');

			// If this is the first message, then the connection is open
			if (!self.bAlexaStatusGotFirstMessage) {
				self.bAlexaStatusGotFirstMessage = true;
				// Else this is a state update announcement
			} else {
				var timeStart = Date.now();
				var sStatus = self.sStatusBuffer;

				self.commandRouter.logger.info("STATUS");

				self.commandRouter.logger.info(sStatus);

				self.logStart('Alexa announces state update')
				//.then(function(){
				// return self.getState.call(self);
				// })
					.then(function() {
						return self.parseState.call(self, sStatus);
					})
					.then(libFast.bind(self.pushState, self))
					.fail(libFast.bind(self.pushError, self))
					.done(function() {
						return self.logDone(timeStart);
					});
			}

			// Reset the status buffer
			self.sStatusBuffer = '';
		}
	});

	// Define the tracklist
	self.tracklist = [];

	// Start tracklist promise as rejected, so requestors do not wait for it if not immediately available.
	// This is okay because no part of Volumio requires a populated tracklist to function.
	self.tracklistReadyDeferred = null;
	self.tracklistReady = libQ.reject('Tracklist not yet populated.');

	// Attempt to load tracklist from database on disk
	// TODO make this a relative path

	// Create a spotifyAPI object and then get an access token
	self.spotifyApiConnect();

};

*/
ControllerAlexa.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing AlexaD daemon");
/*
	exec("/usr/bin/sudo /usr/bin/killall alexa", function (error, stdout, stderr) {
		if(error){
			self.logger.info('Cannot kill alexa Daemon')
		}
	});
*/
	return libQ.resolve();
};

ControllerAlexa.prototype.onStart = function() {
	var self = this;
	self.logger.info('ControllerAlexa.prototype.onStart');
	var defer=libQ.defer();
/*
	self.startAlexaDaemon()
		.then(function(e)
		{
			setTimeout(function () {
				self.logger.info("Connecting to daemon");
				self.spopDaemonConnect(defer);
			}, 5000);
		})
		.fail(function(e)
		{
			defer.reject(new Error());
		});
*/
	//this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildSPOPDAndRestartDaemon.bind(this));
 	defer.resolve();
	return defer.promise;};


ControllerAlexa.prototype.listPlaylists=function()
{
	var self=this;

	var defer=libQ.defer();
	var commandDefer=self.sendAlexaCommand('ls',[]);
	commandDefer.then(function(results){
		var resJson=JSON.parse(results);
		//   self.logger.info(JSON.stringify(resJson));

		//	self.commandRouter.logger.info(resJson);
		var response={
			navigation: {
				"prev": {
					uri: 'spotify'
				},
				"lists": [
					{
						"availableListViews": [
							"list"
						],
						"items": [

						]
					}
				]
			}
		};

		for(var i in resJson.playlists)
		{
			if(resJson.playlists[i].hasOwnProperty('name') && resJson.playlists[i].name !== '')
			{
				if(resJson.playlists[i].type == 'playlist')
				{
					response.navigation.lists[0].items.push({
						service: 'spop',
						type: 'folder',
						title: resJson.playlists[i].name,
						icon: 'fa fa-list-ol',
						uri: 'spotify/playlists/'+resJson.playlists[i].index
					});
				}
				else if(resJson.playlists[i].type == 'folder')
				{
					for(var j in resJson.playlists[i].playlists)
					{
						response.navigation.lists[0].items.push({
							service: 'spop',
							type: 'folder',
							title: resJson.playlists[i].playlists[j].name,
							icon: 'fa fa-list-ol',
							uri: 'spotify/playlists/'+resJson.playlists[i].playlists[j].index
						});
					}
				}
			}
		}

		defer.resolve(response);

	})
		.fail(function()
		{
			defer.fail(new Error('An error occurred while listing playlists'));
		});

	return defer.promise;
};

ControllerAlexa.prototype.listPlaylist=function(curUri)
{
	var self=this;

	var uriSplitted=curUri.split('/');

	var defer=libQ.defer();
	var commandDefer=self.sendAlexaCommand('ls',[uriSplitted[2]]);
	commandDefer.then(function(results){
		var resJson=JSON.parse(results);

		var response={
			navigation: {
				prev: {
					uri: 'spotify/playlists'
				},
				"lists": [
					{
						"availableListViews": [
							"list"
						],
						"items": [

						]
					}
				]
			}
		};

		for(var i in resJson.tracks)
		{
			response.navigation.lists[0].items.push({
				service: 'spop',
				type: 'song',
				title: resJson.tracks[i].title,
				artist:resJson.tracks[i].artist,
				album: resJson.tracks[i].album,
				icon: 'fa fa-spotify',
				uri: resJson.tracks[i].uri
			});
		}

		defer.resolve(response);
	})
		.fail(function()
		{
			defer.fail(new Error('An error occurred while listing playlists'));
		});

	return defer.promise;
};

ControllerAlexa.prototype.spotifyApiConnect=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	self.spotifyApi= new SpotifyWebApi({
		clientId : '7160366cc0944645bb1f32a7b81dd1ee',
		clientSecret : 'ab4691ab353b4da6a35b151eb73dfd59',
		redirectUri : 'http://localhost'
	});

	// Retrieve an access token
	self.spotifyClientCredentialsGrant()
		.then(function(data) {
				self.logger.info('Spotify credentials grant success');
				defer.resolve();
			}, function(err) {
				self.logger.info('Spotify credentials grant failed with ' + err);
			}
		);

	return defer.promise;
}

ControllerAlexa.prototype.spotifyClientCredentialsGrant=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	var now = d.getTime();

	// Retrieve an access token
	self.spotifyApi.clientCredentialsGrant()
		.then(function(data) {
			self.spotifyApi.setAccessToken(data.body['access_token']);
			self.spotifyAccessToken = data.body['access_token'];
			self.spotifyAccessTokenExpiration = data.body['expires_in'] * 1000 + now;
			self.logger.info('Spotify access token expires at ' + self.spotifyAccessTokenExpiration);
			self.logger.info('Spotify access token is ' + data.body['access_token']);
			defer.resolve();
		}, function(err) {
			self.logger.info('Spotify credentials grant failed with ' + err);
		});

	return defer.promise;
}

ControllerAlexa.prototype.spotifyCheckAccessToken=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	var now = d.getTime();

	if (self.spotifyAccessTokenExpiration < now)
	{
		self.spotifyClientCredentialsGrant()
			.then(function(data) {
				self.logger.info('Refreshed Spotify access token');
			});
	}

	defer.resolve();

	return defer.promise;

};

ControllerAlexa.prototype.featuredPlaylists=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
				var spotifyDefer = self.spotifyApi.getFeaturedPlaylists();
				spotifyDefer.then(function (results) {
					var response = {
						navigation: {
							prev: {
								uri: 'spotify'
							},
							"lists": [
								{
									"availableListViews": [
										"list",
										"grid"
									],
									"items": [

									]
								}
							]
						}
					};

					for (var i in results.body.playlists.items) {
						var playlist = results.body.playlists.items[i];
						response.navigation.lists[0].items.push({
							service: 'spop',
							type: 'playlist',
							title: playlist.name,
							albumart: playlist.images[0].url,
							uri: playlist.uri
						});
					}
					defer.resolve(response);
				}, function (err) {
					self.logger.info('An error occurred while listing Spotify featured playlists ' + err);
				});
			}
		);

	return defer.promise;
};

ControllerAlexa.prototype.listWebPlaylist=function(curUri)
{
	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split(':');

	var spotifyDefer = self.getPlaylistTracks(uriSplitted[2], uriSplitted[4]);
	spotifyDefer.then(function (results) {
		var response = {
			navigation: {
				prev: {
					uri: 'spotify'
				},
				"lists": [
					{
						"availableListViews": [
							"list",
							"grid"
						],
						"items": [

						]
					}
				]
			}
		};
		for (var i in results) {
			response.navigation.lists[0].items.push(results[i]);
		}
		defer.resolve(response);
	});

	return defer.promise;
};

ControllerAlexa.prototype.listWebNew=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getNewReleases();
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						"lists": [
							{
								"availableListViews": [
									"list",
									"grid"
								],
								"items": [

								]
							}
						]
					}
				};

				for (var i in results.body.albums.items) {
					var album = results.body.albums.items[i];
					response.navigation.lists[0].items.push({
						service: 'spop',
						type: 'folder',
						title: album.name,
						albumart: album.images[0].url,
						uri: album.uri
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify new albums ' + err);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype.listWebAlbum=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split(':');

	var spotifyDefer = self.getAlbumTracks(uriSplitted[2]);
	spotifyDefer.then(function (results) {
		var response = {
			navigation: {
				prev: {
					uri: 'spotify'
				},
				"lists": [
					{
						"availableListViews": [
							"list"
						],
						"items": [

						]
					}
				]
			}
		};
		for (var i in results) {
			response.navigation.lists[0].items.push(results[i]);
		}
		defer.resolve(response);
	});

	return defer.promise;
};



ControllerAlexa.prototype.listWebCategories=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getCategories();
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						"lists": [
							{
								"availableListViews": [
									"list",
									"grid"
								],
								"items": [

								]
							}
						]
					}
				};

				for (var i in results.body.categories.items) {
					response.navigation.lists[0].items.push({
						service: 'spop',
						type: 'spotify-category',
						title: results.body.categories.items[i].name,
						albumart: results.body.categories.items[i].icons[0].url,
						uri: 'spotify/category/' + results.body.categories.items[i].id
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify categories ' + err);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype.listWebCategory=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split('/');

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getPlaylistsForCategory(uriSplitted[2]);
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify/categories'
						},
						"lists": [
							{
								"availableListViews": [
									"list",
									"grid"
								],
								"items": [

								]
							}
						]
					}
				};

				for (var i in results.body.playlists.items) {
					var playlist = results.body.playlists.items[i];
					response.navigation.lists[0].items.push({
						service: 'spop',
						type: 'folder',
						title: playlist.name,
						albumart: playlist.images[0].url,
						uri: playlist.uri
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify playlist category ' + err);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype.listWebArtist = function (curUri) {

	var self = this;

	var defer = libQ.defer();

	var uriSplitted = curUri.split(':');

	var artistId = uriSplitted[2];

	self.spotifyCheckAccessToken()
		.then(function (data) {
			var response = {
				navigation: {
					prev: {
						uri: 'spotify'
					},
					"lists": [
						{
							"availableListViews": [
								"list"
							],
							"items": [

							]
						}
					]
				}
			};
			var spotifyDefer = self.listArtistTracks(artistId);
			spotifyDefer.then(function (results) {
				for (var i in results) {
					response.navigation.lists[0].items.push(results[i]);
				}
				return response;
			})
				.then(function (data) {
					var response = data;
					var spotifyDefer = self.getArtistRelatedArtists(artistId);
					spotifyDefer.then(function (results) {
						response.navigation.lists[0].items.push({type: 'title', title: 'Related Artists'});
						for (var i in results) {
							response.navigation.lists[0].items.push(results[i]);
						}
						defer.resolve(response);
					})
				});
		});

	return defer.promise;
};

ControllerAlexa.prototype.listArtistTracks = function (id) {

	var self = this;

	var defer = libQ.defer();

	var list = [{type: 'title', title: 'Top Tracks'}];

	var spotifyDefer = self.getArtistTopTracks(id);
	spotifyDefer.then(function (data) {
		for (var i in data) {
			list.push(data[i]);
		}
		return list;
	})
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtistAlbums(id);
			spotifyDefer.then(function (results) {
				var title = {type: 'title', title: 'Albums'};
				var response = data;
				response.push(title);
				for (var i in results.body.items) {
					var albumart = '';
					var album = results.body.items[i];
					if (album.hasOwnProperty('images') && album.images.length > 0) {
						albumart = album.images[0].url;
					}
					;
					response.push({
						service: 'spop',
						type: 'folder',
						title: album.name,
						albumart: albumart,
						uri: album.uri,
					});
				}
				defer.resolve(response);
			})
		});

	return defer.promise;
};

ControllerAlexa.prototype.getArtistTracks = function(id) {

	var self = this;

	var defer = libQ.defer();

	var list = [];

	var spotifyDefer = self.getArtistTopTracks(id);
	spotifyDefer.then(function (data) {
		for (var i in data) {
			list.push(data[i]);
		}
		return list;
	})
		.then(function (data) {
			var spotifyDefer = self.getArtistAlbumTracks(id);
			spotifyDefer.then(function (results) {
				var response = data;
				for (var i in results) {
					response.push(results[i]);
				}
				defer.resolve(response);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype.getArtistAlbumTracks = function(id) {

	var self = this;

	var defer = libQ.defer();

	var list = [];

	var spotifyDefer = self.spotifyApi.getArtistAlbums(id);
	spotifyDefer.then(function (results) {
		//	var response = data;
		var response = [];
		return results.body.items.map(function (a) {
			return a.id
		});
	})
		.then(function(albums) {
			var spotifyDefer = self.spotifyApi.getAlbums(albums);
			spotifyDefer.then(function (data) {
				var results = data;
				var response = [];
				for (var i in results.body.albums) {
					var album = results.body.albums[i];
					for (var j in album.tracks.items) {
						var track = album.tracks.items[j];
						var albumart = '';
						if (album.hasOwnProperty('images') && album.images.length > 0) {
							albumart = album.images[0].url;
						}
						response.push({
							service: 'spop',
							type: 'song',
							name: track.name,
							title: track.name,
							artist: track.artists[0].name,
							album: album.name,
							albumart: albumart,
							uri: track.uri
						});
					}
				}
				defer.resolve(response);
			});
		});


	return defer.promise;
};

ControllerAlexa.prototype.getArtistAlbums = function(artistId) {

	var self = this;

	var defer = libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtistAlbums(artistId);
			spotifyDefer.then(function (results) {
				var response = [];
				for (var i in results.body.items) {
					var albumart = '';
					var album = results.body.items[i];
					if (album.hasOwnProperty('images') && album.images.length > 0) {
						albumart = album.images[0].url;
					}
					response.push({
						service: 'spop',
						type: 'folder',
						title: album.name,
						albumart: albumart,
						uri: album.uri
					});
				}
				defer.resolve(response);
			});
		});
	return defer.promise;
};

ControllerAlexa.prototype.getArtistRelatedArtists = function (artistId) {

	var self = this;

	var defer = libQ.defer();

	var list = [];

	self.spotifyCheckAccessToken()
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtistRelatedArtists(artistId);
			spotifyDefer.then(function (results) {
				for (var i in results.body.artists) {
					var albumart = '';
					var artist = results.body.artists[i];
					if (artist.hasOwnProperty('images') && artist.images.length > 0) {
						albumart = artist.images[0].url;
					}
					var item = {
						service: 'spop',
						type: 'folder',
						title: artist.name,
						albumart: albumart,
						uri: artist.uri
					};
					if (albumart == '') {
						item.icon = 'fa fa-user';
					}
					list.push(item);
				}
				defer.resolve(list);
			})
		});

	return defer.promise;
};

// Controller functions

// Alexa stop
ControllerAlexa.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::stop');

	return self.sendAlexaCommand('stop', []);
};

ControllerAlexa.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerAlexa.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerAlexa.prototype.onUninstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerAlexa.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
		__dirname+'/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
		.then(function(uiconf)
		{
			uiconf.sections[0].content[0].value = self.config.get('host');
			uiconf.sections[0].content[1].value = self.config.get('port');
			uiconf.sections[0].content[2].value = self.config.get('username');
			uiconf.sections[0].content[3].value = self.config.get('password');
			//uiconf.sections[0].content[4].value = self.config.get('bitrate');

			defer.resolve(uiconf);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

ControllerAlexa.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerAlexa.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerAlexa.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise



// Rebuild a library of user's playlisted Spotify tracks


// Define a method to clear, add, and play an array of tracks
ControllerAlexa.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendAlexaCommand('uplay', [track.uri]);
};

// Alexa stop
ControllerAlexa.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::stop');

	return self.sendAlexaCommand('stop', []);
};

// Alexa pause
ControllerAlexa.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::pause');

	// TODO don't send 'toggle' if already paused
	return self.sendAlexaCommand('toggle', []);
};

// Alexa resume
ControllerAlexa.prototype.resume = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::resume');

	// TODO don't send 'toggle' if already playing
	return self.sendAlexaCommand('toggle', []);
};

// Alexa music library
ControllerAlexa.prototype.getTracklist = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::getTracklist');

	return self.tracklistReady
		.then(function() {
			return self.tracklist;
		});
};

// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise

// Send command to Alexa
ControllerAlexa.prototype.sendAlexaCommand = function(sCommand, arrayParameters) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::sendAlexaCommand');

	// Convert the array of parameters to a string
	var sParameters = libFast.reduce(arrayParameters, function(sCollected, sCurrent) {
		return sCollected + ' ' + sCurrent;
	}, '');


	var spopResponseDeferred = libQ.defer();
	// Pass the command to Alexa when the command socket is ready
	self.spopCommandReady
		.then(function() {
			return libQ.nfcall(libFast.bind(self.connAlexaCommand.write, self.connAlexaCommand), sCommand + sParameters + '\n', 'utf-8')
				/*.then(function()
				 {
				 spopResponseDeferred.resolve();
				 })
				 .fail(function(err)
				 {
				 spopResponseDeferred.reject(new Error(err));
				 })*/;
		});


	var spopResponse = spopResponseDeferred.promise;

	if(sCommand!=='status')
	{
		self.commandRouter.logger.info("ADDING DEFER FOR COMMAND " + sCommand);
		self.arrayResponseStack.push(spopResponseDeferred);
	}
	// Return a promise for the command response
	return spopResponse;
};

// Alexa get state
ControllerAlexa.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::getState');

	return self.sendAlexaCommand('status', []);
};

// Alexa parse state
ControllerAlexa.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::parseState');

	var objState = JSON.parse(sState);

	var nSeek = null;
	if ('position' in objState) {
		nSeek = objState.position * 1000;
	}

	var nDuration = null;
	if ('duration' in objState) {
		nDuration = objState.duration;
	}

	var sStatus = null;
	if ('status' in objState) {
		if (objState.status === 'playing') {
			sStatus = 'play';
		} else if (objState.status === 'paused') {
			sStatus = 'pause';
		} else if (objState.status === 'stopped') {
			sStatus = 'stop';
		}
	}

	var nPosition = null;
	if ('current_track' in objState) {
		nPosition = objState.current_track - 1;
	}

	return libQ.resolve({
		status: sStatus,
		position: nPosition,
		seek: nSeek,
		duration: nDuration,
		samplerate: self.samplerate, // Pull these values from somwhere else since they are not provided in the Alexa state
		bitdepth: null,
		channels: null,
		artist: objState.artist,
		title: objState.title,
		album: objState.album
	});
};

// Announce updated Alexa state
ControllerAlexa.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};

// Pass the error if we don't want to handle it
ControllerAlexa.prototype.pushError = function(sReason) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::pushError(' + sReason + ')');

	// Return a resolved empty promise to represent completion
	return libQ.resolve();
};

// Scan tracks in playlists via Alexa and populates tracklist
// Metadata fields to roughly conform to Ogg Vorbis standards (http://xiph.org/vorbis/doc/v-comment.html)
ControllerAlexa.prototype.rebuildTracklistFromAlexaPlaylists = function(objInput, arrayPath) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::rebuildTracklistFromAlexaPlaylists');

	if (!('playlists' in objInput)) {
		throw new Error('Error building Alexa tracklist - no playlists found.');
	}

	var arrayPlaylists = objInput.playlists;
	// We want each playlist to be parsed sequentially instead of simultaneously so that Alexa is not overwhelmed
	// with requests. Use this chained promisedActions to guarantee sequential execution.
	var promisedActions = libQ.resolve();

	libFast.map(arrayPlaylists, function(curPlaylist) {
		/*
		 if (!('index' in curPlaylist)) {
		 return;
		 }*/
		var sPlaylistName = '';
		if (curPlaylist.name === '') {
			// The Starred playlist has a blank name
			sPlaylistName = 'Starred';
		} else {
			sPlaylistName = curPlaylist.name;
		}
		var arrayNewPath = arrayPath.concat(sPlaylistName);

		if (curPlaylist.type === 'folder') {
			promisedActions = promisedActions
				.then(function() {
					return self.rebuildTracklistFromAlexaPlaylists(curPlaylist, arrayNewPath);
				});

		} else if (curPlaylist.type === 'playlist') {
			var curPlaylistIndex = curPlaylist.index;

			promisedActions = promisedActions
				.then(function() {
					return self.sendAlexaCommand('ls', [curPlaylistIndex]);
				})
				.then(JSON.parse)
				.then(function(curTracklist) {
					var nTracks = 0;

					if (!('tracks' in curTracklist)) {
						return;
					}

					nTracks = curTracklist.tracks.length;

					for (var j = 0; j < nTracks; j++) {
						self.tracklist.push({
							'name': curTracklist.tracks[j].title,
							'service': self.servicename,
							'uri': curTracklist.tracks[j].uri,
							'browsepath': arrayNewPath,
							'album': curTracklist.tracks[j].album,
							'artists': libFast.map(curTracklist.tracks[j].artist.split(','), function(sArtist) {
								// TODO - parse other options in artist string, such as "feat."
								return sArtist.trim();

							}),
							'performers': [],
							'genres': [],
							'tracknumber': 0,
							'date': '',
							'duration': 0
						});
					}
				});
		}
	});

	return promisedActions;
};

// TODO delete below function - not used
ControllerAlexa.prototype.explodeAlbumUri = function(id) {
	var self=this;
	var defer=libQ.defer();

	self.spotifyApi.getAlbum(id, 'GB')
		.then(function(result)
		{
			self.commandRouter.logger.info(result);
			defer.resolve();
		});


	return defer.promise;
};

ControllerAlexa.prototype.getAlbumTracks = function(id) {

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
				var spotifyDefer = self.spotifyApi.getAlbum(id);
				spotifyDefer.then(function (results) {
					var response = [];
					var album = results.body.name;
					var albumart = results.body.images[0].url;
					for (var i in results.body.tracks.items) {
						var track = results.body.tracks.items[i];
						response.push({
							service: 'spop',
							type: 'song',
							title: track.name,
							name: track.name,
							artist:track.artists[0].name,
							album: album,
							albumart: albumart,
							uri: track.uri,
							samplerate: self.samplerate,
							bitdepth: '16 bit',
							trackType: 'spotify',
							duration: Math.trunc(track.duration_ms / 1000)
						});
					}
					defer.resolve(response);
				}, function (err) {
					self.logger.info('An error occurred while listing Spotify album tracks ' + err);
				});
			}
		);

	return defer.promise;
};

ControllerAlexa.prototype.getPlaylistTracks = function(userId, playlistId) {

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getPlaylist(userId, playlistId);
			spotifyDefer.then(function (results) {

				var response = [];

				for (var i in results.body.tracks.items) {
					var track = results.body.tracks.items[i].track;
					var item = {
						service: 'spop',
						type: 'song',
						name: track.name,
						title: track.name,
						artist: track.artists[0].name,
						album: track.album.name,
						uri: track.uri,
						samplerate: self.samplerate,
						bitdepth: '16 bit',
						trackType: 'spotify',
						albumart: track.album.images[0].url,
						duration: Math.trunc(track.duration_ms / 1000)
					};
					response.push(item);
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while exploding listing Spotify playlist tracks ' + err);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype.getArtistTopTracks = function(id) {

	var self = this;

	var defer = libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtistTopTracks(id, 'GB');
			spotifyDefer.then(function (results) {
				var response = [];
				for (var i in results.body.tracks) {
					var albumart = '';
					var track = results.body.tracks[i];
					if (track.album.hasOwnProperty('images') && track.album.images.length > 0) {
						albumart = track.album.images[0].url;
					}
					response.push({
						service: 'spop',
						type: 'song',
						name: track.name,
						title: track.name,
						artist: track.artists[0].name,
						album: track.album.name,
						albumart: albumart,
						duration: parseInt(track.duration_ms / 1000),
						samplerate: self.samplerate,
						bitdepth: '16 bit',
						trackType: 'spotify',
						uri: track.uri
					});
				}
				defer.resolve(response);
			}), function (err) {
				self.logger.info('An error occurred while listing Spotify artist tracks ' + err);
			}
		});

	return defer.promise;
};

ControllerAlexa.prototype.getTrack = function(id) {

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getTrack(id);
			spotifyDefer.then(function (results) {

				var response = [];
				var artist = '';
				var album = '';
				var title = '';
				var albumart = '';

				if (results.body.artists.length > 0) {
					artist = results.body.artists[0].name;
				}

				if (results.body.hasOwnProperty('album') && results.body.album.hasOwnProperty('name')) {
					album = results.body.album.name;
				}

				if (results.body.album.hasOwnProperty('images') && results.body.album.images.length > 0) {
					albumart = results.body.album.images[0].url;
				}
				else {
					albumart = '';
				}

				var item = {
					uri: results.body.uri,
					service: 'spop',
					name: results.body.name,
					artist: artist,
					album: album,
					type: 'song',
					duration: parseInt(results.body.duration_ms / 1000),
					tracknumber: results.body.track_number,
					albumart: albumart,
					samplerate: self.samplerate,
					bitdepth: '16 bit',
					trackType: 'spotify'
				};
				response.push(item);
				defer.resolve(response);
			});
		});

	return defer.promise;
};


ControllerAlexa.prototype.explodeUri = function(uri) {

	var self = this;

	var defer=libQ.defer();

	var uriSplitted;

	var response;
/*
	if (uri.startsWith('spotify/playlists')) {
		// TODO replace this with SpotifyAPI when we have Oauth support

		uriSplitted=uri.split('/');

		var commandDefer=self.sendAlexaCommand('ls',[uriSplitted[2]]);
		commandDefer.then(function(results){
			var resJson=JSON.parse(results);

			var response=[];
			for(var i in resJson.tracks)
			{
				var albumart=self.getAlbumArt({artist:resJson.tracks[i].artist,album:resJson.tracks[i].album},"");

				var item={
					uri: resJson.tracks[i].uri,
					service: 'spop',
					type: 'song',
					name: resJson.tracks[i].title,
					title: resJson.tracks[i].title,
					artist:resJson.tracks[i].artist,
					album: resJson.tracks[i].album,
					duration: resJson.tracks[i].duration/1000,
					albumart: albumart,
					samplerate: self.samplerate,
					bitdepth: '16 bit',
					trackType: 'spotify'

				};

				response.push(item);
			}
			defer.resolve(response);
		})
			.fail(function()
			{
				defer.fail(new Error('An error occurred while listing playlists'));
			});
	}
	else if(uri.startsWith('spotify:artist:'))
	{
		uriSplitted=uri.split(':');
		// TODO *jpa* Add tracks from albums next
		response = self.getArtistTracks(uriSplitted[2]);
		defer.resolve(response);
	}
	else if(uri.startsWith('spotify:album:'))
	{
		uriSplitted=uri.split(':');
		response = self.getAlbumTracks(uriSplitted[2]);
		defer.resolve(response);
	}
	else if (uri.startsWith('spotify:user:'))
	{
		uriSplitted=uri.split(':');
		response = self.getPlaylistTracks(uriSplitted[2], uriSplitted[4]);
		defer.resolve(response);
	}
	else if (uri.startsWith('spotify:track:'))
	{
		uriSplitted = uri.split(':');
		response = self.getTrack(uriSplitted[2]);
		defer.resolve(response);
	}
	else {
		self.logger.info('Bad URI while exploding Spotify URI: ' + uri);
	}
*/
	return defer.promise;
};

ControllerAlexa.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};

ControllerAlexa.prototype.logDone = function(timeStart) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');
	return libQ.resolve();
};

ControllerAlexa.prototype.logStart = function(sCommand) {
	var self = this;
	self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);
	return libQ.resolve();
};



ControllerAlexa.prototype.createSPOPDFile = function () {
	var self = this;

	var defer=libQ.defer();


	try {

		fs.readFile(__dirname + "/mqtt.conf.tmpl", 'utf8', function (err, data) {
			if (err) {
				defer.reject(new Error(err));
				return console.log(err);
			}
			var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
			var hwdev = 'hw:' + outdev;

			var conf1 = data.replace("${username}", self.config.get('username'));
			var conf2 = conf1.replace("${password}", self.config.get('password'));
			var conf4 = conf3.replace("${outdev}", hwdev);
			var conf3 = conf2.replace("${port}", self.config.get('port'));
			var conf3 = conf2.replace("${host}", self.config.get('host'));

			fs.writeFile("/etc/mqtt.conf", conf4, 'utf8', function (err) {
				if (err)
					defer.reject(new Error(err));
				else defer.resolve();
			});


		});


	}
	catch (err) {


	}

	return defer.promise;

};

ControllerAlexa.prototype.saveMQTTAccount = function (data) {
	var self = this;

	var defer = libQ.defer();

	self.config.set('host', data['host']);
	self.config.set('port', data['port']);
	self.config.set('username', data['username']);
	self.config.set('password', data['password']);

	self.logger.info("Saving configuration! %s, %s, %s, %s",data['host'], data['port'], data['username'], data['password']  );
	self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated, please Disable and Re-enable plugin to take effect.');

	//var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	//this.config.loadFile(configFile);

	//self.onVolumioStart()
	
/*	
	self.rebuildSPOPDAndRestartDaemon()
		.then(function(e){
			self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
			defer.resolve({});
		})
		.fail(function(e)
		{
			defer.reject(new Error());
		});
*/	
	return defer.promise;
};


ControllerAlexa.prototype.rebuildSPOPDAndRestartDaemon = function () {
	var self=this;
	var defer=libQ.defer();

	self.createSPOPDFile()
		.then(function(e)
		{
			var edefer=libQ.defer();
/*
			exec("killall spopd", function (error, stdout, stderr) {
				edefer.resolve();
			});
*/
			return edefer.promise;
		});
/*
		.then(self.startAlexaDaemon.bind(self))
		.then(function(e)
		{	
			setTimeout(function () {
				self.logger.info("Connecting to daemon");
				self.spopDaemonConnect(defer);
			}, 5000);
			
		});
*/
	return defer.promise;
};

ControllerAlexa.prototype.seek = function (timepos) {
	this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerAlexa::seek to ' + timepos);
	return this.sendAlexaCommand('seek '+timepos, []);
};

// TODO - didn't have time to update the search function for the new grid view UI....
ControllerAlexa.prototype.search = function (query) {

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.search(query.value, ['artist', 'album', 'playlist', 'track']);
			spotifyDefer.then(function (results) {

				var list = [];

				// TODO put in internationalized strings
				// Show artists, albums, playlists then tracks

				if(results.body.hasOwnProperty('artists') && results.body.artists.items.length > 0)
				{
					var artistlist = [];
					var artists = self._searchArtists(results);
					for (var i in artists) {
						artistlist.push(artists[i]);
					}
					list.push({type: 'title', title: 'Spotify Artists', availableListViews: ["list", "grid"], items: artistlist});
				}
				if(results.body.hasOwnProperty('albums') && results.body.albums.items.length > 0)
				{
					var albumlist = [];
					var albums = self._searchAlbums(results);
					for (var i in albums) {
						albumlist.push(albums[i]);
					}
					list.push({type:'title',title:'Spotify Albums', availableListViews: ["list", "grid"], items: albumlist});
				}
				if(results.body.hasOwnProperty('playlists') && results.body.playlists.items.length > 0)
				{
					var playlistlist = [];
					var playlists = self._searchPlaylists(results);
					for (var i in playlists) {
						playlistlist.push(playlists[i]);
					}
					list.push({type:'title',title:'Spotify Playlists', availableListViews: ["list", "grid"], items: playlistlist});
				}
				if(results.body.hasOwnProperty('tracks') && results.body.tracks.items.length > 0)
				{
					var songlist = [];
					var tracks = self._searchTracks(results);
					for (var i in tracks) {
						songlist.push(tracks[i]);
					}
					list.push({type:'title',title:'Spotify Tracks', availableListViews: ["list"], items: songlist});
				}
				defer.resolve(list);
			}, function (err) {
				self.logger.info('An error occurred while searching ' + err);
			});
		});

	return defer.promise;
};

ControllerAlexa.prototype._searchArtists = function (results) {

	var list = [];

	for (var i in results.body.artists.items) {
		var albumart = '';
		var artist = results.body.artists.items[i];
		if (artist.hasOwnProperty('images') && artist.images.length > 0) {
			albumart = artist.images[0].url;
		};
		var item = {
			service: 'spop',
			type: 'folder',
			title: artist.name,
			albumart: albumart,
			uri: artist.uri
		};
		if (albumart == '') {
			item.icon = 'fa fa-user';
		}
		list.push(item);
	}

	return list;

};

ControllerAlexa.prototype._searchAlbums = function (results) {

	var list = [];

	for (var i in results.body.albums.items) {
		var albumart = '';
		var album = results.body.albums.items[i];
		if (album.hasOwnProperty('images') && album.images.length > 0) {
			albumart = album.images[0].url;
		};
		list.push({
			service: 'spop',
			type: 'folder',
			title: album.name,
			albumart: albumart,
			uri: album.uri,
		});
	}

	return list;
};

ControllerAlexa.prototype._searchPlaylists = function (results) {

	var list = [];

	for (var i in results.body.playlists.items) {
		var albumart = '';
		var playlist = results.body.playlists.items[i];
		if (playlist.hasOwnProperty('images') && playlist.images.length > 0) {
			albumart = playlist.images[0].url;
		};
		list.push({
			service: 'spop',
			type: 'folder',
			title: playlist.name,
			albumart: albumart,
			uri: playlist.uri
		});
	}

	return list;
};

ControllerAlexa.prototype._searchTracks = function (results) {

	var list = [];

	for (var i in results.body.tracks.items) {
		var albumart = '';
		var track = results.body.tracks.items[i];
		if (track.album.hasOwnProperty('images') && track.album.images.length > 0) {
			albumart = track.album.images[0].url;
		};
		list.push({
			service: 'spop',
			type: 'song',
			title: track.name,
			artist: track.artists[0].name,
			album: track.album.name,
			albumart: albumart,
			uri: track.uri
		});
	}

	return list;
};



// Receive player queue updates from commandRouter and broadcast to all connected clients
ControllerAlexa.prototype.pushQueue = function(queue) {
	var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'ControllerAlexa::pushQueue');
/*
	// pass queue to the helper
	self.helper.setQueue(queue);

	// broadcast playlist changed to all idlers
	self.idles.forEach(function(client) {
		client.write('changed: playlist\n');
	});
*/
	// TODO q-stuff
};

// Receive player state updates from commandRouter and broadcast to all connected clients
ControllerAlexa.prototype.pushState = function(state, socket) {
	var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'ControllerAlexa::pushState');
/*
	// if requested by client, respond
	if (socket) {
		socket.write(self.helper.printStatus(state));
		// else broadcast to all idlers
	} else {
		// pass state to the helper
		self.helper.setStatus(state);

		// broadcast state changed to all idlers
		self.idles.forEach(function(client) {
			client.write('changed: player\n');
		});
	}
*/
	// TODO q-stuff
};
