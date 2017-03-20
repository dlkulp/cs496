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
const redirect = {"host-dev": "https://cs496-157709.appspot.com","host-prod": "http://localhost:8080", "route": "/oauth2callback"};
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
}

class Task {
	constructor(name, description, color, taskList, weight) {
		[this.name, this.description, this.dateCreated, this.color, this.isActive, this.completed, this.taskList, this.weight] = [name, description, new Date(), color, true, false, `/tasklist/${taskList}`, weight];
	}
}

class TaskList {
	constructor(name, description, user, completeBy) {
		[this.name, this.description, this.user, this.dateCreated, this.completed, this.completeBy] = [name, description, user, new Date(), false, completeBy];
	}
}

// Route Functions
function httpGet(res, req, id, kind) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("get");
		if (typeof datastore !== "undefined") {
			let objKey = datastore.key([kind, id]);
			datastore.get(objKey)
				.then((entities) => {
					res.status(200).send(entities[0]);
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
		if (typeof datastore !== "undefined") {
			datastore.insert(entity)
				.then((ret) => {
					res.status(200).send(`${entity.key.id}`);
				})
				.catch((e) => {
					res.status(500).send("Unexpected Error: 1001: Unable to connect to database<br />Looks like we ran into a problem making a new " + entity.type + "!");
				});
		}
		else
			res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
	}
}

function httpDelete(res, req, id, kind, multiple) {
	if (typeof req.signedCookies["access"] === "undefined") 
		res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
	else {
		console.log("delete");
		if (typeof datastore !== "undefined") {
			let objKey = (!!multiple) ? id : datastore.key([kind, id]);
			datastore.delete(objKey)
				.then(() => {
					res.status(200).send("success");
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
				.then((ret) => {
					res.status(200).send("success");
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
		res.status(200).send(`<!doctype html><body>Hello ${data.user.id_token.given_name} ${data.user.id_token.family_name}!<br /><br /><a href="/signout">sign out</a></body></html>`);
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
					res.redirect("/");
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
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["Task", taskId]);
				// Get task
				datastore.get(objKey)
					.then((tasks) => {
						if (typeof tasks[0] == "undefined" || tasks[0].length == 0)
							res.status(404).send(`Unable to find entity ${taskId}`);
						else {
							let id = Number(tasks[0].taskList.substr(10));
							let key = datastore.key(["TaskList", id]);
							// Check list for user permisions
							datastore.get(key)
								.then((tasklist) => {
									// Send data if correct
									if (typeof tasklist[0] == "undefined" || tasklist[0].length == 0)
										res.status(404).send(`Unable to find entity ${taskId}`);
									else {
										if (tasklist[0].user == cookieData.user.id_token.email)
											res.status(200).send(tasks[0]);
										else
											res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${tasklist[0].user}`);
									}
								})
								.catch((e) => {
									console.dir(e);
									res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
								});
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.delete((req, res) => {
		let taskId = Number(req.params.taskId);
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["Task", taskId]);
				// Get task
				datastore.get(objKey)
					.then((tasks) => {
						if (typeof tasks[0] == "undefined" || tasks[0].length == 0)
							res.status(404).send(`Unable to find entity ${taskId}`);
						else {
							let id = Number(tasks[0].taskList.substr(10));
							let key = datastore.key(["TaskList", id]);
							// Check list for user permisions
							datastore.get(key)
								.then((tasklist) => {
									// Send data if correct
									if (typeof tasklist[0] == "undefined" || tasklist[0].length == 0)
										res.status(404).send(`Unable to find entity ${taskId}`);
									else {
										if (tasklist[0].user == cookieData.user.id_token.email)
											httpDelete(res, req, taskId, "Task");
										else
											res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${tasklist[0].user}`);
									}
								})
								.catch((e) => {
									console.dir(e);
									res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
								});
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.patch((req, res) => {
		let [taskData, taskId] = [req.body.task, Number(req.params.taskId)];
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["Task", taskId]);
				// Get task
				datastore.get(objKey)
					.then((tasks) => {
						if (typeof tasks[0] == "undefined" || tasks[0].length == 0)
							res.status(404).send(`Unable to find entity ${taskId}`);
						else {
							let id = Number(tasks[0].taskList.substr(10));
							let key = datastore.key(["TaskList", id]);
							// Check list for user permisions
							datastore.get(key)
								.then((tasklist) => {
									// Send data if correct
									if (typeof tasklist[0] == "undefined" || tasklist[0].length == 0)
										res.status(404).send(`Unable to find entity ${taskId}`);
									else {
										if (tasklist[0].user == cookieData.user.id_token.email)
											httpPatch(res, req, new Entity("Task", new Task(taskData.name, taskData.description, taskData.color, taskData.taskList, taskData.weight), taskId));
										else
											res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${tasklist[0].user}`);
									}
								})
								.catch((e) => {
									console.dir(e);
									res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
								});
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	});
app.route('/tasks')
	.post((req, res) => {
		if (typeof req.signedCookies["access"] === "undefined")
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			let [name, description, color, taskList, weight] = [req.body.name, req.body.description, req.body.color, `${req.body.taskList}`, req.body.weight];
			httpPost(res, req, new Entity("Task", new Task(name, description, color, taskList, weight)));
		}
	});

// User stuff -- note: new users are made when oauthing (must be associated with a google user)
app.route('/tasklist/:tasklistId')
	.get((req, res) => {
		let tasklistId = Number(req.params.tasklistId);
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["TaskList", tasklistId]);
				// Get task list
				datastore.get(objKey)
					.then((entities) => {
						if (typeof entities[0] == "undefined" || entities[0].length == 0)
							res.status(404).send(`Unable to find entity ${tasklistId}`);
						else {
							let list = entities[0];
							// Check user email
							if (list.user == cookieData.user.id_token.email) {
								const query = datastore.createQuery("Task").filter("taskList", "=", `/tasklist/${tasklistId}`);
								// Get tasks in list and send everything
								datastore.runQuery(query)
									.then((entities) => {
										if (typeof entities[0] == "undefined" || entities[0].length == 0)
											res.status(200).send(list);
										else {
											list.tasks = entities[0];
											res.status(200).send(list);
										}
									})
									.catch((e) => {
										console.dir(e);
										res.status(500).send("Unexpected Error: 1001: Unable to connect to database<br />" + JSON.stringify(e));
									});
							}
							else
								res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${list.user}`);
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.delete((req, res) => {
		let tasklistId = Number(req.params.tasklistId);
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["TaskList", tasklistId]);
				// Get task list
				datastore.get(objKey)
					.then((entities) => {
						if (typeof entities[0] == "undefined" || entities[0].length == 0)
							res.status(404).send(`Unable to find entity ${taskId}`);
						else {
							let list = entities[0];
							// Check user email
							if (list.user == cookieData.user.id_token.email) {
								// Get all tasks in tasklist and remove them all
								const query = datastore.createQuery("Task").filter("taskList", "=", `/tasklist/${tasklistId}`);
								datastore.runQuery(query)
									.then((entities) => {
										if (typeof entities[0] == "undefined" || entities[0].length == 0)
											res.status(404).send(`Unable to find entity ${taskId}`);
										else {
											var keys = [];
											for (let entity of entities[0])
												keys.push(entity[datastore.KEY]);
											keys.push(datastore.key(["TaskList", tasklistId]));
											httpDelete(res, req, keys, "TaskList", true);
										}
									})
									.catch((e) => {
										console.dir(e);
										res.status(500).send("Unexpected Error: 1001: Unable to connect to database<br />" + JSON.stringify(e));
									});
							}
							else
								res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${list.user}`);
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	})
	.patch((req, res) => {
		let [taskListData, tasklistId] = [req.body.taskList, Number(req.params.tasklistId)];
		if (typeof req.signedCookies["access"] === "undefined") 
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			console.log("get");
			let cookieData = JSON.parse(req.signedCookies["access"]);
			if (typeof datastore !== "undefined") {
				let objKey = datastore.key(["TaskList", tasklistId]);
				// Get task list
				datastore.get(objKey)
					.then((entities) => {
						if (typeof entities[0] == "undefined" || entities[0].length == 0)
							res.status(404).send(`Unable to find entity ${taskId}`);
						else {
							let list = entities[0];
							// Check user email
							if (list.user == cookieData.user.id_token.email)
								httpPatch(res, req, new Entity("TaskList", new TaskList(taskListData.name, taskListData.description, taskListData.user, taskListData.completeBy), tasklistId));
							else
								res.status(403).send(`You are not authorized to view this data!<br/>Currently signed in as: ${list.user}`);
						}
					})
					.catch((e) => {
						console.dir(e);
						res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
					});
			}
			else
				res.status(500).send("Unexpected Error: 1001: Unable to connect to database");
		}
	});
app.route('/tasklists')
	.post((req, res) => {
		if (typeof req.signedCookies["access"] === "undefined")
			res.status(401).send("You are not signed in!  Please <a href='/login'>sign in</a> and try again!");
		else {
			let [name, description, user, completeBy] = [req.body.name, req.body.description, JSON.parse(req.signedCookies.access).user.id_token.email, req.body.completeBy];
			httpPost(res, req, new Entity("TaskList", new TaskList(name, description, user, completeBy)));
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