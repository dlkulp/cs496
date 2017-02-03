'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const Datastore = require('@google-cloud/datastore');
const projectId = "cs496-155216";
const datastore = Datastore({
  projectId: projectId
});
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Entities
class Entity {
	constructor(kind, name, data) {
		[this.kind, this.name, this.data] = [kind, name, data];
	}
	getJSON() {
		return {
			"key": datastore.key([this.name, this.kind]),
			"data": this.data
		}
	}
}

class Book {
	constructor(id, title, isbn, genre, author, checkedIn) {
		[this.id, this.title, this.isbn, this.genre, this.author, this.checkedIn] = [id, title, isbn, genre, author, checkedIn];
	}
	getJSON() {
		return {
			"id": this.id,
			"title": this.title,
			"isbn": this.isbn,
			"genre": this.genre,
			"author": this.author,
			"checkedIn": this.checkedIn
		};
	}
}

class Customer {
	constructor(id, name, balance, checked_out) {
		[this.id, this.name, this.balance, this.checked_out] = [id, name, balance, checked_out];
	}
	getJSON() {
		return {
			"id": this.id,
			"name": this.name,
			"balance": this.balance,
			"checked_out": this.checked_out
		}
	}
}

// Route Functions
function httpGet(res, id) {
	if (typeof datastore !== "undefined") {
		datastore.get(id)
			.then((entity) => {
				res.status(200).send(entity[0]);
			});
	}
	else {
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpPost(res, entity, ) {
	if (typeof datastore !== "undefined") {
		datastore.insert(entity)
			.then(() => {
				res.status(200).send(`${name} added to datastore!`);
			});
	}
	else {
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpDelete(res, id) {
	if (typeof datastore !== "undefined") {
		datastore.delete(id)
			.then(() => {
				res.status(200).send(`$(id) removed from datastore`);
			});
	}
	else {
		res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

// Home
app.get('/', (req, res) => {
	res.status(200).send(new Date());
});

// Customer stuff
app.route('/customers/:customerId')
	.get((req, res) => {
		let custId = req.params.customerId;
		httpGet(res, custId);
	})
	.delete((req, res) => {
		let custId = req.params.customerId;
		httpDelete(res, custId);
	})
	.patch((req, res) => {
		res.status(200).send("patch customer");
	});
app.post('/customers', (req, res) => {
	let [id, name, balance, checked_out] = [req.params.id, req.body.name, req.body.balance, req.body.checked_out];
	httpPost(res, new Entity("customer", "name", new Customer(id, name, balance, checked_out).getJSON()));
});

app.route('/books/:bookId')
	.get((req, res) => {
		let bookId = req.params.bookId;
		httpGet(res, bookId)
	})
	.delete((req, res) => {
		let bookId = req.params.bookId;
		httpDelete(res, bookId);
	})
	.patch((req, res) => {
		res.status(200).send("patch book");
	});
app.post('/books', (req, res) => {
	let [id, title, isbn, genre, author, checkedIn] = [req.params.id, req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
	httpPost(res, new Book(id, title, isbn, genre, author, checkedIn).getJSON());
});

// Check Books in and out
app.route('/customers/:customerId/books/:bookId')
	.put((req, res) => {
		let [custId, bookId] = [req.params.customerId, req.params.bookId];
		if (typeof datastore !== "undefined") {
			datastore.get(bookId)
				.then ((books) => {
					if (books[0].checkedIn) {
						datastore.get(custId)
							.then((customers) => {
								customers[0].checked_out[customers[0].checked_out.length] = bookId;
								datastore.update({key: custId, checked_out: customers[0].checked_out})
									.then(() => {
										// Do something?
									});
							});
						datastore.update({key: bookId, checkedIn: false});
					}
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.delete((req, res) => {
		let [custId, bookId] = [req.params.customerId, req.params.bookId];
		if (typeof datastore !== "undefined") {
			datastore.get(bookId)
				.then ((books) => {
					if (!books[0].checkedIn) {
						datastore.get(custId)
							.then((customers) => {
								for (let i = 0; i < customers[0].checked_out.length; i++) 
									if (customers[0].checked_out[i] == bookId) {
										customers[0].checked_out.splice(i, 1);
										break;
									}

								datastore.update({key: custId, checked_out: customers[0].checked_out})
									.then(() => {
										// Do something?
									});
							});
						datastore.update({key: bookId, checkedIn: true});
					}
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