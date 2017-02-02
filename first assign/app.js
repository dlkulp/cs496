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

// Print stuff
app.get('/', (req, res) => {
	res.status(200).send(new Date());
});

// Customer stuff
app.route('/customer/:customerId')
	.get((req, res) => {
		let custId = req.params.customerId;
		datastore.get(custId)
			.then(() => {
				// Do something?
			});
	})
	.delete((req, res) => {
		let custId = req.params.customerId;
		datastore.delete(custId)
			.then(() => {
				// Do something?
			});
	})
	.post((req, res) => {
		let [id, name, balance, checked_out] = [req.body.id, req.body.name, req.body.balance, req.body.checked_out];
		datastore.insert(new Customer(id, name, balance, checked_out).getJSON());
	})
	.patch((req, res) => {

	});

app.route('/book/:bookId')
	.get((req, res) => {
		let bookId = req.params.bookId;
		datastore.get(bookId)
			.then(() => {
				// Do something?
			});
	})
	.delete((req, res) => {
		let bookId = req.params.bookId;
		datastore.delete(bookId)
			.then(() => {
				// Do something?
			});
	})
	.post((req, res) => {
		let [id, title, isbn, genre, author, checkedIn] = [req.body.id, req.body.title, req.body.isbn, req.body.genre, req.body.author, req.body.checkedIn];
		datastore.insert(new Book(id, title, isbn, genre, author, checkedIn).getJSON());
	})
	.patch((req, res) => {

	});

	//app.query

// Check Books in and out
app.route('/customers/:customerId/books/:bookId')
	.put((req, res) => {
		let [custId, bookId] = [req.params.customerId, req.params.bookId];
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
	})
	.delete((req, res) => {
		let [custId, bookId] = [req.params.customerId, req.params.bookId];
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
	});

// Start server and list on port
if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;