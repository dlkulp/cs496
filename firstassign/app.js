'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.enable('trust proxy');
// Must put @google-cloud/datastore": "^0.1.1" into dependencies section before uncommenting (package.json is weird about what's allowed for comments)
const Datastore = require('@google-cloud/datastore');
const datastore = Datastore({
	projectId: "cs496-157709"
});

// Allow Params in Body
app.use(bodyParser.json({ type: ["json", "+json"]})); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

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
function httpGet(res, id, kind, multiple) {
	console.log(`get: ${id}`);
	if (typeof datastore !== "undefined") {
		let objKey = datastore.key([kind, id]);
		datastore.get(objKey)
			.then((entity) => {
				res.status(200).send(entity[0]);
			})
			.catch((e) => {
				console.dir(e);
				res.status(500).send("Unexpexted Error: 1001: Unable to connect to database");
			});
	}
	else
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
}

function httpPost(res, entity) {
	console.log("post");
	if (typeof datastore !== "undefined")
		datastore.insert(entity.getJSON())
			.then((ret) => {
				res.status(200).send(`${entity.key.id} added to datastore!`);
			})
			.catch((e) => {
				console.dir(e);
				res.status(500).send("Unexpexted Error: 1001: Unable to connect to database");
			});
	else
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
}

function httpDelete(res, id, kind) {
	console.log("delete");
	if (typeof datastore !== "undefined") {
		let objKey = datastore.key([kind, id]);
		datastore.delete(objKey)
			.then(() => {
				res.status(200).send(`${id} removed from datastore`);
			})
			.catch((e) => {
				console.dir(e);
				res.status(500).send("Unexpexted Error: 1001: Unable to connect to database");
			});
	}
	else
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
}

function httpPatch(res, entity) {
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
					res.status(500).send("Unexpexted Error: 1001: Unable to connect to database");
			});
	else
		res.status(500).send("Unexpected Error: 1001: Unable to connect to databse");
}

// Home
app.get('/', (req, res) => {
	res.status(200).send(new Date());
});

// Customer stuff
app.get('customer/:customerId/books', (req, res) => {
	// let custId = Number(req.params.customerId);
	// let objKey = datastore.key([kind, id]);
	// 	datastore.get(objKey)
	// 		.then((entity) => {
				res.status(200)//.send(entity[0]);
			// })
			// .catch((e) => {
			// 	console.dir(e);
			// 	res.status(500).send("Unexpexted Error: 1001: Unable to connect to database");
			// });
});
app.route('/customers/:customerId')
	.get((req, res) => {
		let custId = Number(req.params.customerId);
		httpGet(res, custId, "Customer");
	})
	.delete((req, res) => {
		let custId = Number(req.params.customerId);
		httpDelete(res, custId, "Customer");
	})
	.patch((req, res) => {
		let [custData, custId] = [req.body.customer, Number(req.params.customerId)];
		httpPatch(res, new Entity("Customer", custData, custId));
	});
app.post('/customers', (req, res) => {
	let [name, balance, checked_out] = [req.body.name, Number(req.body.balance), req.body.checked_out];
	httpPost(res, new Entity("Customer", new Customer(name, balance, checked_out).getJSON()));
});

// Books stuff
app.route('/books/:bookId')
	.get((req, res) => {
		let bookId = Number(req.params.bookId);
		httpGet(res, bookId, "Book");
	})
	.delete((req, res) => {
		let bookId = Number(req.params.bookId);
		httpDelete(res, bookId, "Book");
	})
	.patch((req, res) => {
		let [bookData, bookId] = [req.body.book, Number(req.params.bookId)];
		httpPatch(res, new Entity("Book", bookData, bookId));
	});
app.post('/books', (req, res) => {
	let [title, isbn, genre, author, checkedIn] = [req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
	httpPost(res, new Entity("Book", new Book(title, isbn, genre, author, checkedIn).getJSON()));
});

// Check Books in and out
app.route('/customers/:customerId/books/:bookId')
	.put((req, res) => {
		console.log("check out");
		let [custId, bookId] = [Number(req.params.customerId), Number(req.params.bookId)];
		if (typeof datastore !== "undefined") {
			datastore.get(datastore.key(["Book", bookId]))
				.then ((books) => {
					if (books[0].checkedIn) {
						books[0].checkedIn = false;
						datastore.get(datastore.key(["Customer", custId]))
							.then((customers) => {
								customers[0].checked_out[customers[0].checked_out.length] = bookId;
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
	})
	.delete((req, res) => {
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
	});

// Start server and list on port
if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;