const io_client = require('socket.io-client')
const axios = require('axios')
const domain = "csgoempire.com"
const socketEndpoint = `wss://trade.${domain}/trade`
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { CSGOEmpire } = require("csgoempire-api");
const fs = require('fs');
var csgoempireApiKey

fs.readFile('api.key', 'utf-8', (err, api_key) => {
	if (err) {
		console.error(err);
		return;
	}
	const empire_api = new CSGOEmpire(api_key)

	app.get('/', (req, res) => {
		res.sendFile(__dirname + '/index.html')
	});
	app.get('/index.js', (req, res) => {
		res.type('application/javascript');
		res.sendFile(__dirname + '/index.js')
	});
	app.get('/style.css', (req, res) => {
		res.sendFile(__dirname + '/style.css')
	});


	const listOfEvents = [
		'timesync',
		'new_item',
		'updated_item',
		'auction_update',
		'deleted_item',
		'trade_status',
		'disconnect'
	];
	var users = []

	io.on('connection', (socket) => {
		function update_client() {
			empire_api.getMetadata().then((data) => {
				socket.emit("update_balance", data.user.balance)
			})
			empire_api.getActiveAuctions().then((res) => {
				let active_auctions = res.active_auctions
				if (active_auctions) {
					socket.emit("active_auctions", active_auctions)
				}
			})
		}

		console.log('A user connected');

		users.push(socket)
		update_client()

		socket.on("buy", (item) => {
			item = item.item
			var value = item.market_value
			if (item.auction_highest_bid) {
				value = item.auction_highest_bid
			}

			console.log(value)

			empire_api.placeBid(item.id, value).then(res => {
				socket.emit("log", res)
				if (res.message == 'This auction already finished.') {
					socket.emit("deleted_item", [item.id])
				}
				if (res.success) {
					update_client()
				}
			})
		})
		socket.on('disconnect', () => {
			users = users.filter(item => item !== socket)
			console.log('A user disconnected');
		});
	});


	http.listen(3000, function () {
		console.log('listening on *:3000');
	});


	axios.defaults.headers.common['Authorization'] = `Bearer ${api_key}`

	async function initSocket() {
		console.log("Connecting to websocket...")

		try {
			// Get the user data from the socket
			const userData = (await axios.get(`https://${domain}/api/v2/metadata/socket`)).data

			// Initalize socket connection
			const socket = io_client(
				socketEndpoint,
				{
					transports: ["websocket"],
					path: "/s/",
					secure: true,
					rejectUnauthorized: false,
					reconnect: true,
					extraHeaders: { 'User-agent': `${userData.user.id} API Bot` } //this lets the server know that this is a bot
				}
			)

			// Create a promise that resolves when the socket connects successfully
			const connectPromise = new Promise((resolve, reject) => {
				socket.on('connect', async () => {
					// Log when connected
					console.log(`Connected to websocket`)

					// Handle the Init event
					socket.on('init', (data) => {
						if (data && data.authenticated) {
							console.log(`Successfully authenticated as ${data.name}`)

							// Emit the default filters to ensure we receive events
							socket.emit('filters', {
								price_max: 9999999
							})

						} else {
							// When the server asks for it, emit the data we got earlier to the socket to identify this client as the user
							socket.emit('identify', {
								uid: userData.user.id,
								model: userData.user,
								authorizationToken: userData.socket_token,
								signature: userData.socket_signature
							})
						}
					})

					// Listen for the following event to be emitted by the socket after we've identified the user
					socket.on('timesync', (data) => console.log(`Timesync: ${JSON.stringify(data)}`))

					// Resolve the promise with the socket object when the socket connects successfully
					resolve(socket)
				})

				// Reject the promise if the socket disconnects
				socket.on("disconnect", (reason) => {
					console.log(`Socket disconnected: ${reason}`)
					reject(reason)
				})

				// Handle error cases
				socket.on("close", (reason) => console.log(`Socket closed: ${reason}`))
				socket.on('error', (data) => console.log(`WS Error: ${data}`))
				socket.on('connect_error', (data) => console.log(`Connect Error: ${data}`))
			})

			// Return the connect promise
			return connectPromise

		} catch (e) {
			console.log(`Error while initializing the Socket. Error: ${e}`)
			throw e // Rethrow the error so the caller can handle it
		}
	}

	function notifyAll(event, data) {
		users.forEach(user => {
			user.emit(event, data)
		})
	}

	initSocket().then(empire_socket => {
		listOfEvents.forEach((event) => {
			empire_socket.on(event, (data) => {
				notifyAll(event, data)
			})
		})
	}).catch(error => {
		console.error(`Error initializing socket: ${error}`)
	})

})