'use strict';

const express = require('express');
const app = express();

// Print stuff
app.get('/', (req, res) => {
	res.status(200).send(new Date());
});

// Start server and list on port
if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}`);
	});
}

module.exports = app;