'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const request = require('request');
const app = express();
app.enable('trust proxy');
const Datastore = require('@google-cloud/datastore');
const datastore = Datastore({
	projectId: "cs496-157709"
});
const loadJsonFile = require('load-json-file');
const secrets = loadJsonFile.sync("secrets.json");
const redirect = {"host-prod": "https://cs496-157709.appspot.com","host-dev": "http://localhost:8080", "route": "/oauth2callback"};
const getAuthCode = "https://accounts.google.com/o/oauth2/v2/auth?" + 
	"scope=email%20profile&" + 
	"state=&" + 
	`redirect_uri=${encodeURIComponent(redirect["host-prod"] + redirect.route)}&` + 
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

class Task {
	constructor(name, description, user, dateCreated, color, isActive, completed, taskList, weight) {
		[this.name, this.description, this.user, this.dateCreated, this.color, this.isActive, this.completed, this.taskList, this.weight] = [name, description, user, dateCreated, color, isActive, completed, taskList, weight];
	}
	getJSON() {
		return {
			"name": this.name,
			"description": this.description,
			"user": this.user,
			"dateCreated": this.dateCreated,
			"color": this.color,
			"isActive" : this.isActive,
			"completed": this.completed,
			"taskList": this.taskList,
			"weight": this.weight
		};
	}
}

class User {
	constructor(email, taskList, displayName) {
		[this.email, this.taskList, this.displayName, this.dateJoined] = [email, taskList, displayName, new Date()];
	}
	getJSON() {
		return {
			"email": this.email,
			"taskList": this.taskList,
			"displayName": this.displayName,
			"dateJoined": this.dateJoined
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

function httpPost(res, req, entity, signin) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("post");
		if (typeof datastore !== "undefined") {
			// See if user already exists
			if (typeof signin !== "undefined") {
				const query = datastore.createQuery("User").filter("Display Name", "=", entity.data.displayName);
				datastore.runQuery(query)
					.then((results) => {
						let users = results[0];
						if (users.length >= 1) { 
							cookieData.user.entityId = users[0].key.id;
							res.cookie("access", JSON.stringify(cookieData), {signed:true, maxAge: 1000 * 60 * 60});
							res.status(200).send(JSON.stringify(results));
						}
					})
					.catch((e) => {
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database<br />Looks like we ran into a problem making your account!<br />" + JSON.stringify(e));
					});
			}
			else
				datastore.insert(entity.getJSON())
					.then((ret) => {
						if (typeof signin === "undefined")
							res.status(200).send(`${entity.key.id} added to datastore!`);
						else {
							let cookieData = JSON.parse(req.signedCookies.access);
							cookieData.user.entityId = entity.key.id;
							res.cookie("access", JSON.stringify(cookieData), {signed:true, maxAge: 1000 * 60 * 60});
							res.status(200).send(JSON.stringify(coodieData));
						}
					})
					.catch((e) => {
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database<br />Looks like we ran into a problem making your account!<br />" + JSON.stringify(e));
					});
		}
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
		res.status(200).send(`Hello ${data.user.id_token.given_name} ${data.user.id_token.family_name}!<br /><br /><a href="/signout">sign out</a>`);
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
		//https://accounts.google.com/AccountChooser?continue=https://accounts.google.com/o/oauth2/v2/auth?scope%3Demail%2Bprofile%26state%3Dk4pm4NCZt253JG7GVg8Lo4lzQgzL7R8u4kPRIHoPy9imwJpq%26redirect_uri%3Dhttps://cs496-157709.appspot.com/oauth2callback%26response_type%3Dcode%26client_id%3D546294694523-fj6r3hndd1730f38lr2d84tjjn6ft2h0.apps.googleusercontent.com%26from_login%3D1%26as%3D275857da4272acb7&btmpl=authsub&scc=1&oauth=1
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
					redirect_uri: redirect["host-prod"] + redirect.route, 
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
					httpPost(res, req, new Entity("User", new User(userData.id_token.email, [], userData.id_token.name).getJSON()), "signin");
				}
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

// Task stuff
app.route('/task/:taskId')
	.get((req, res) => {
		let taskId = Number(req.params.taskId);
		httpGet(res, req, taskId, "Task");
	})
	.delete((req, res) => {
		let taskId = Number(req.params.taskId);
		httpDelete(res, req, taskId, "Task");
	})
	.patch((req, res) => {
		let [taskData, taskId] = [req.body.task, Number(req.params.taskId)];
		httpPatch(res, req, new Entity("Task", taskData, taskId));
	});
app.route('/tasks')
	.post((req, res) => {
		if (typeof req.signedCookies["access"] === "undefined")
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			let [name, description, user, dateCreated, color, isActive, completed, taskList, weight] = [req.body.name, req.body.description, JSON.parse(req.signedCookies.access).user.entityId, req.body.dateCreated, req.body.color, req.body.isActive, req.body.completed, req.body.taskList, req.body.weight];
			httpPost(res, req, new Entity("Task", new Task(name, description, user, dateCreated, color, isActive, completed, taskList, weight).getJSON()));
		}
	});

// User stuff -- note: new users are made when oauthing (must be associated with a google user)
app.route('/user/:userId')
	.get((req, res) => {
		let userId = Number(req.params.userId);
		httpGet(res, req, userId, "User");
	})
	.delete((req, res) => {
		let userId = Number(req.params.userId);
		httpDelete(res, req, userId, "User");
	})
	.patch((req, res) => {
		let [userData, userId] = [req.body.user, Number(req.params.userId)];
		httpPatch(res, req, new Entity("User", userData, userId));
	});


// Start server and list on port
if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;