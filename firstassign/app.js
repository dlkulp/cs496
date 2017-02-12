'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const app = express();
app.enable('trust proxy');
// Add this: "@google-cloud/datastore": "^0.7.0" to package.json if data store is needed for some reason
//const Datastore = require('@google-cloud/datastore');
//const datastore = Datastore({
//	projectId: "cs496-157709"//,
	//keyFilename: "cs496-1caf1fa42d50.json"
//});
const loadJsonFile = require('load-json-file');
const secrets = loadJsonFile.sync("secrets.json");
const redirect = {"host-prod": "https://cs496-157709.appspot.com","host-dev": "http://localhost:8080", "route": "/oauth2callback"};
const getAuthCode = "https://accounts.google.com/o/oauth2/v2/auth?" + 
	"scope=email%20profile&" + 
	"state=&" + 
	`redirect_uri=${encodeURIComponent(redirect["host-dev"] + redirect.route)}&` + 
	"response_type=code&" + 
	`client_id=${secrets.clientIdURL}`;
const getIDToken = "https://www.googleapis.com/oauth2/v4/token";

// Allow Params in Body and cookies
app.use(bodyParser.json({ type: ["json", "+json"]})); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(cookieParser(secrets.cookie));

// Entities
class Entity {
	constructor(kind, data, id) {
		this.data = data;
		this.key = (typeof id === "undefined") ? datastore.key(kind) : datastore.key([kind, id]);
	}
	getJSON() {
		return {
			"key": this.key,
			"data": this.data
		}
	}
}

class Book {
	constructor(title, isbn, genre, author, checkedIn) {
		[this.title, this.isbn, this.genre, this.author, this.checkedIn] = [title, isbn, genre, author, checkedIn];
	}
	getJSON() {
		return {
			"title": this.title,
			"isbn": this.isbn,
			"genre": this.genre,
			"author": this.author,
			"checkedIn": this.checkedIn
		};
	}
}

class Customer {
	constructor(name, balance, checked_out) {
		[this.name, this.balance, this.checked_out] = [name, balance, checked_out];
	}
	getJSON() {
		return {
			"name": this.name,
			"balance": this.balance,
			"checked_out": this.checked_out
		}
	}
}

// Route Functions
function httpGet(res, req, id, kind, multiple) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("get");
		if (typeof datastore !== "undefined") {
			let objKey = (!!multiple) ? id : datastore.key([kind, id]);
			datastore.get(objKey)
				.then((entities) => {
					res.status(200).send((!!multiple) ? entities : entities[0]);
				})
				.catch((e) => {
					console.dir(e);
					res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
				});
		}
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpPost(res, req, entity) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("post");
		if (typeof datastore !== "undefined")
			datastore.insert(entity.getJSON())
				.then((ret) => {
					res.status(200).send(`${entity.key.id} added to datastore!`);
				})
				.catch((e) => {
					console.dir(e);
					res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
				});
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpPut(res, req, entity) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("put");
		if (typeof datastore !== "undefined")
			datastore.upsert(entity.getJSON())
				.then((ret) => {
					res.status(200).send(`${entity.key.id} added to datastore!`);
				})
				.catch((e) => {
					console.dir(e);
					res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
				});
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpDelete(res, req, id, kind) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("delete");
		if (typeof datastore !== "undefined") {
			let objKey = datastore.key([kind, id]);
			datastore.delete(objKey)
				.then(() => {
					res.status(200).send(`${id} removed from datastore`);
				})
				.catch((e) => {
					console.dir(e);
					res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
				});
		}
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpPatch(res, req, entity) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("patch");
		if (typeof datastore !== "undefined")
			datastore.update(entity)
				.then(() => {
					res.status(200).send(`${entity.data.id} updated`);
				})
				.catch((e) => {
					console.dir(e);
					if (e.code == 404)
						res.status(404).send("404 Not found, no entity matches id");
					else
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
				});
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to databse");
	}
}

// Helper Functions
function randString(len) {
	let str = "";
	for (let i = 0; i < len; i++) {
		let temp = Math.round(Math.random() * 36).toString(36);
		str += (isNaN(temp) && Math.round(Math.random())) ? temp.toUpperCase() : temp;
	}
	return str;
}

function parseJwt (token) {
	let base64Url = token.split('.')[1];
	let base64 = base64Url.replace('-', '+').replace('_', '/');
	return JSON.parse(new Buffer(base64, "base64"));
};

// Home
app.get('/', (req, res) => {
	if (typeof req.signedCookies["access"] !== "undefined") {
		let data = JSON.parse(req.signedCookies["access"]);
		res.status(200).send(`name: ${data.user.id_token.given_name} ${data.user.id_token.family_name}<br />profile: <a href="https://plus.google.com/u/0/${data.user.id_token.sub}">${data.user.id_token.name}</a><br />state: ${data.state}<br /><br /><a href="/signout">sign out</a>`);
	}
	else
		res.status(200).send(`${new Date()}<br /><br /><a href="/login">log in</a>`);
});

// Sign in
app.get('/login', (req, res) => {
	if (typeof req.signedCookies["access"] === "undefined") {
		let state = randString(48);
		let authCode = getAuthCode.slice(0, 73) + state + getAuthCode.slice(73);
		res.cookie("access", JSON.stringify({"state": state}), {signed:true, maxAge: 1000 * 60 * 60});
		res.redirect(authCode);
	}
	else
		res.redirect("/");
});

app.get("/oauth2callback", (req, res) => {
	let error = req.query.error;
	let code = req.query.code;
	let state = req.query.state;
	if (typeof code !== "undefined" && JSON.parse(req.signedCookies.access).state == state) {
		res.cookie("access", JSON.stringify({"state": state, "code": code}), {signed:true, maxAge: 1000 * 60 * 60});
		request.post(
			getIDToken, 
			{form: 
				{
					code, 
					client_id: secrets.clientIdURL, 
					client_secret: secrets.client, 
					redirect_uri: redirect["host-dev"] + redirect.route, 
					grant_type:"authorization_code"
				}
			},
			(error, response, body) => {
				if (!error && response.statusCode == 200) {
					let cookieData = JSON.parse(req.signedCookies.access);
					let userData = JSON.parse(body);
					userData.id_token = parseJwt(userData.id_token);
					cookieData.user = userData;
					res.cookie("access", JSON.stringify(cookieData), {signed:true, maxAge: 1000 * 60 * 60});
				}
				res.redirect("/");
    		}
		);
	}
	else
		res.redirect("/");
});

app.get("/signout", (req, res) => {
	if (typeof req.signedCookies["access"] !== "undefined")
		res.clearCookie("access");
	res.redirect("/");
});

// Customer stuff
app.route('/customers/:customerId')
	.get((req, res) => {
		let custId = Number(req.params.customerId);
		httpGet(res, req, custId, "Customer");
	})
	.delete((req, res) => {
		let custId = Number(req.params.customerId);
		httpDelete(res, req, custId, "Customer");
	})
	.patch((req, res) => {
		let [custData, custId] = [req.body.customer, Number(req.params.customerId)];
		httpPatch(res, req, new Entity("Customer", custData, custId));
	});
app.route('/customers')
	.post((req, res) => {
		let [name, balance, checked_out] = [req.body.name, Number(req.body.balance), req.body.checked_out];
		httpPost(res, req, new Entity("Customer", new Customer(name, balance, checked_out).getJSON()));
	})
	.put((req, res) => {
		let [name, balance, checked_out] = [req.body.name, Number(req.body.balance), req.body.checked_out];
		httpPut(res, req, new Entity("Customer", new Customer(name, balance, checked_out).getJSON()));
	});
app.get('/customer/:customerId/books', (req, res) => {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("get all customer's books");
		let custId = Number(req.params.customerId);
		let objKey = datastore.key(["Customer", custId]);
		datastore.get(objKey)
			.then((entity) => {
				let keys = [];
				for (let i = 0; i < entity[0].checked_out.length; i++)
					keys[i] = datastore.key(["Book", Number(entity[0].checked_out[i].replace("/books/", ""))]);
				httpGet(res, req, keys, "Book", true);
			})
			.catch((e) => {
				console.dir(e);
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
			});
	}
});

// Books stuff
app.route('/books/:bookId')
	.get((req, res) => {
		let bookId = Number(req.params.bookId);
		httpGet(res, req, bookId, "Book");
	})
	.delete((req, res) => {
		let bookId = Number(req.params.bookId);
		httpDelete(res, req, bookId, "Book");
	})
	.patch((req, res) => {
		let [bookData, bookId] = [req.body.book, Number(req.params.bookId)];
		httpPatch(res, req, new Entity("Book", bookData, bookId));
	});
app.route('/books')
	.post((req, res) => {
		let [title, isbn, genre, author, checkedIn] = [req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
		httpPost(res, req, new Entity("Book", new Book(title, isbn, genre, author, checkedIn).getJSON()));
	})
	.put((req, res) => {
		let [title, isbn, genre, author, checkedIn] = [req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
		httpPut(res, req, new Entity("Book", new Book(title, isbn, genre, author, checkedIn).getJSON()));
	});
app.get('/books', (req, res) => {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("get books by checkIn status");
		let checkStat = (req.query.checkedIn.toUpperCase() === "TRUE");
		const query = datastore.createQuery("Book").filter("checkedIn", "=", checkStat);
		datastore.runQuery(query)
			.then((entities) => {
				res.status(200).send(entities[0]);
			})
			.catch((e) => {
				console.dir(e);
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
			});
	}
});

// Check Books in and out
app.route('/customers/:customerId/books/:bookId')
	.put((req, res) => {
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("check out");
			let [custId, bookId] = [Number(req.params.customerId), Number(req.params.bookId)];
			if (typeof datastore !== "undefined") {
				datastore.get(datastore.key(["Book", bookId]))
					.then ((books) => {
						if (books[0].checkedIn) {
							books[0].checkedIn = false;
							datastore.get(datastore.key(["Customer", custId]))
								.then((customers) => {
									customers[0].checked_out[customers[0].checked_out.length] = `/books/${bookId}`;
									datastore.update(customers[0])
										.then(() => {
											datastore.update(new Entity("Book", books[0], bookId))
												.then(() => {
													res.status(200).send(`${books[0].title} checked out to ${customers[0].name}`);
												});
										});
								});
						} 
						else 
							res.status(500).send(`${bookId} not available for checkout`);
					});
			}
			else {
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
			}
		}
	})
	.delete((req, res) => {
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("check in");
			let [custId, bookId] = [Number(req.params.customerId), Number(req.params.bookId)];
			if (typeof datastore !== "undefined") {
				datastore.get(datastore.key(["Book", bookId]))
					.then ((books) => {
						if (!books[0].checkedIn) {
							books[0].checkedIn = true;
							datastore.get(datastore.key(["Customer", custId]))
								.then((customers) => {
									for (let i = 0; i < customers[0].checked_out.length; i++) 
										if (customers[0].checked_out[i] == bookId) {
											customers[0].checked_out.splice(i, 1);
											break;
										}
									datastore.update(customers[0])
										.then(() => {
											datastore.update(new Entity("Book", books[0], bookId))
												.then(() => {
													res.status(200).send(`${customers[0].name} checked in ${books[0].title}`);
												});
										});
								});
						}
						else 
							res.status(500).send(`${bookId} not available for checkin`);
					});
			}
			else {
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
			}
		}
	});

// Start server and list on port
if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;