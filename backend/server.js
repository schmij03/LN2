// Imports
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb'); // See https://www.mongodb.com/docs/drivers/node/current/quick-start/
const cors = require('cors')
const http = require('http');
const bodyParser = require('body-parser');

// Set up App
const app = express();
app.use(cors()); // Allow all cross-origing requests. More information: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
app.use(express.static('public')); // Host all static files in the folder /public
app.use(bodyParser.json()); // Support json encoded bodies
const port = process.env.PORT || '3001'; // Use the PORT variable if set (e.g., when deploying to Heroku)
app.set('port', port);

const server = http.createServer(app);

// TODO: Use your MongoDB Connection String here
const uri = "mongodb+srv://admin:adminadmin@cluster0.g3mbk.mongodb.net/test?authSource=admin&replicaSet=atlas-pg426q-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true";

// Create the client and connect to the database
let database;
const client = new MongoClient(uri);
client.connect((error, db) => {
    if (error || !db) {
        console.log("Could not connect to MongoDB:")
        console.log(error.message);
    }
    else {
        database = db.db('grumpiorganisator');
        console.log("Successfully connected to MongoDB.");
    }
})

//##################################################################################################
// ENDPOINTS 
//##################################################################################################

//--------------------------------------------------------------------------------------------------
// Welcome message
//--------------------------------------------------------------------------------------------------
app.get('/api', async (req, res) => {
    res.send("Willkommen beim Grümpi Organisator");
})

//--------------------------------------------------------------------------------------------------
// Get all teams
//--------------------------------------------------------------------------------------------------
app.get('/api/teams', async (req, res) => {
    try {
        const collection = database.collection('team');

        // You can specify a query/filter here
        // See https://www.mongodb.com/docs/drivers/node/current/fundamentals/crud/query-document/
        const query = {};
        // Example: Filter for a label, e.g. http://localhost:3001/api/albums?label=Columbia
        if (req.query.label) {
            query.label = req.query.label;
        }

        // Get all objects that match the query
        const result = await collection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Get a team by its id
//--------------------------------------------------------------------------------------------------
app.get('/api/teams/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('team');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.findOne(query);

        if (!result) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send(result);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Update a team
//--------------------------------------------------------------------------------------------------
app.put('/api/teams/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;
    let team = req.body;
    delete team._id; // delete the _id from the object, because the _id cannot be updated

    try {
        const collection = database.collection('team');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.updateOne(query, { $set: team });

        if (result.matchedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send({ status: "Object with id " + id + " has been updated." });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


//--------------------------------------------------------------------------------------------------
// Create a new team
//--------------------------------------------------------------------------------------------------
app.post('/api/teams', async (req, res) => {

    try {
        const collection = database.collection('team');

        var team = {
            name: req.body.name,
            sportart: req.body.sportart,
            players:req.body.players           
             };
        const result = await collection.insertOne(team);

        res.status(201).send({ _id: result.insertedId });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


//--------------------------------------------------------------------------------------------------
// Delete a team
//--------------------------------------------------------------------------------------------------
app.delete('/api/teams/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('team');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.deleteOne(query);

        if (result.deletedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            let responseBody = {
                status: "Object with id " + id + " has been successfully deleted."
            }
            res.send(responseBody);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


//--------------------------------------------------------------------------------------------------
// Get all events
//--------------------------------------------------------------------------------------------------
app.get('/api/events', async (req, res) => {
    try {
        const collection = database.collection('event');

        // You can specify a query/filter here
        // See https://www.mongodb.com/docs/drivers/node/current/fundamentals/crud/query-document/
        const query = {};
        // Example: Filter for a label, e.g. http://localhost:3001/api/albums?label=Columbia
        if (req.query.label) {
            query.label = req.query.label;
        }

        // Get all objects that match the query
        const result = await collection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Get a event by its id
//--------------------------------------------------------------------------------------------------
app.get('/api/events/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('event');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.findOne(query);

        if (!result) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send(result);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Update a event
//--------------------------------------------------------------------------------------------------
app.put('/api/events/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;
    let event = req.body;
    delete event._id; // delete the _id from the object, because the _id cannot be updated

    try {
        const collection = database.collection('event');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.updateOne(query, { $set: event });

        if (result.matchedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send({ status: "Object with id " + id + " has been updated." });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Create a new event
//--------------------------------------------------------------------------------------------------
app.post('/api/events', async (req, res) => {

    try {
        const collection = database.collection('event');

        var event = {
            name: req.body.name,
            eventdate: req.body.eventdate,
            eventinfo: req.body.eventinfo,
            teams:req.body.teams
        };
        const result = await collection.insertOne(event);

        res.status(201).send({ _id: result.insertedId });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Delete an event
//--------------------------------------------------------------------------------------------------
app.delete('/api/events/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('event');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.deleteOne(query);

        if (result.deletedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            let responseBody = {
                status: "Object with id " + id + " has been successfully deleted."
            }
            res.send(responseBody);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


//--------------------------------------------------------------------------------------------------
// Get all players
//--------------------------------------------------------------------------------------------------
app.get('/api/players', async (req, res) => {
    try {
        const collection = database.collection('player');

        // You can specify a query/filter here
        // See https://www.mongodb.com/docs/drivers/node/current/fundamentals/crud/query-document/
        const query = {};

        // Get all objects that match the query
        const result = await collection.find(query).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Get an player by their id
//--------------------------------------------------------------------------------------------------
app.get('/api/players/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('player');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.findOne(query);

        if (!result) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send(result);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Create a new player
//--------------------------------------------------------------------------------------------------
app.post('/api/players', async (req, res) => {

    try {
        const collection = database.collection('player');

        var player = {
            name: req.body.name,
            gender: req.body.gender,
            birthdate: req.body.birthdate
        };
        const result = await collection.insertOne(player);

        res.status(201).send({ _id: result.insertedId });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Update a player
//--------------------------------------------------------------------------------------------------

app.put('/api/players/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;
    let player = req.body;
    delete player._id; // delete the _id from the object, because the _id cannot be updated

    try {
        const collection = database.collection('player');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.updateOne(query, { $set: player });

        if (result.matchedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            res.send({ status: "Object with id " + id + " has been updated." });
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})

//--------------------------------------------------------------------------------------------------
// Delete a player
//--------------------------------------------------------------------------------------------------
app.delete('/api/players/:id', async (req, res) => {

    // read the path parameter :id
    let id = req.params.id;

    try {
        const collection = database.collection('player');
        const query = { _id: ObjectId(id) }; // filter by id
        const result = await collection.deleteOne(query);

        if (result.deletedCount === 0) {
            let responseBody = {
                status: "No object with id " + id
            }
            res.status(404).send(responseBody);
        }
        else {
            let responseBody = {
                status: "Object with id " + id + " has been successfully deleted."
            }
            res.send(responseBody);
        }
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
})


//--------------------------------------------------------------------------------------------------
// Start the server
//--------------------------------------------------------------------------------------------------
server.listen(port, () => console.log("app listening on port " + port));
