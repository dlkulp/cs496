'use strict';

const express = require('express');
var bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Entities
class Book {
	constructor(id, title, isbn, genre, author, checkedIn) {
		this.id = id;
		this.title = title;
		this.isbn = isbn;
		this.genre = genre;
		this.author = author;
		this.checkedIn = checkedIn;
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
		this.id = id;
		this.name = name;
		this.balance = balance;
		this.checked_out = checked_out;
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

// Home
app.get('/', (req, res) => {
	res.status(200).send(new Date());
});

// Customer stuff
app.route('/customer/:customerId')
	.get((req, res) => {
		let custId = req.params.customerId;
		if (typeof datastore !== "undefined") {
			datastore.get(custId)
				.then((customer) => {
					res.status(200).send(customer[0]);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.delete((req, res) => {
		let custId = req.params.customerId;
		if (typeof datastore !== "undefined") {
			datastore.delete(custId)
				.then(() => {
					res.status(200).send(`$(custId) removed from datastore`);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.post((req, res) => {
		let [id, name, balance, checked_out] = [req.params.id, req.body.name, req.body.balance, req.body.checked_out];
		if (typeof datastore !== "undefined") {
			datastore.insert(new Customer(id, name, balance, checked_out).getJSON())
				.then(() => {
					res.status(200).send(`${name} added to datastore!`);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.patch((req, res) => {
		res.status(200).send("patch customer");
	});

app.route('/book/:bookId')
	.get((req, res) => {
		let bookId = req.params.bookId;
		if (typeof datastore !== "undefined") {
			datastore.get(bookId)
				.then((book) => {
					res.status(200).send(book[0]);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.delete((req, res) => {
		let bookId = req.params.bookId;
		if (typeof datastore !== "undefined") {
			datastore.delete(bookId)
				.then(() => {
					res.status(200).send(`$(bookId) removed from datastore`);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.post((req, res) => {
		let [id, title, isbn, genre, author, checkedIn] = [req.params.id, req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
		if (typeof datastore !== "undefined") {
			datastore.insert(new Book(id, title, isbn, genre, author, checkedIn).getJSON())
				.then(() => {
					res.status(200).send(`$(title) added to datastore`);
				});
		}
		else {
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.patch((req, res) => {
		res.status(200).send("patch book");
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