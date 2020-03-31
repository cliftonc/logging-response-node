/**
 * Super simple examples of node server behaviours vs client response
 */
const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

let app = express();
let server = http.createServer(app);

/**
  Some helper functions to calculate time
  These would all be in modules
**/
const getDurationInMilliseconds = (start) => {
    const NS_PER_SEC = 1e9
    const NS_TO_MS = 1e6
    const diff = process.hrtime(start)
    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS
}

/**
 * Logging middleware - imagine this is your CSA Module
 * This becomes a module that is published to NPM and included in all services
 * Middleware always gets the req / res context - this is part of Express
 */
let logger = async (req, res, next) => {

  // Capture when request started
  const requestStart = process.hrtime();

  // Append a tracer for all downstream logging
  res.locals.tracer = uuidv4();

  // Place holder for errors
  let errorMessage = null;

  // Capture errors
  req.on("error", error => {
    errorMessage = error.message;
  });

  res.on('close', () => {
    errorMessage = `${req.method} ${req.originalUrl} [CLOSED]`
  });

  // Capture response finished
  res.on("finish", async () => {

    console.log('Server has now responded to the client ...');

    // Extract data from the request, connection and response
    const { rawHeaders, httpVersion, method, socket, url } = req;
    const { remoteAddress, remoteFamily } = socket;
    const { statusCode, statusMessage } = res;
    const headers = res.getHeaders();
    const processingTime = getDurationInMilliseconds(requestStart);

    let log = () => {
        // Log for now to console, but you can imagine sending this somewhere else
        console.log(
          JSON.stringify({
            tracer: res.locals.tracer,
            timestamp: Date.now(),
            processingTime,
            // rawHeaders,
            errorMessage,
            httpVersion,
            method,
            remoteAddress,
            remoteFamily,
            url,
            response: {
              statusCode,
              statusMessage,
              headers
            }
          })
        );
    };

    // Simple delay in logging to indicate it doesn't block the client
    setTimeout(log, 2000);

  });

  next();
}
// Load the middleware
app.use(logger);

/**
 * API Route handlers
 */
let api = express.Router();

// Basic index page
api.get('/', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.end(`Look at your console, and click:
    <br/><a href="/sync-five">do work while you wait to respond</a>
    OR <a href="/async-five">respond and then do work</a>
    Also, note that there is a 2s logging delay to show it has no impact on the client performance.
    `);
});

// Simulate a long running process where we wait until work complete before responding
// In your browser refresh the page a lot
api.get('/sync-five', async (req, res) => {
  console.log(`Starting work for ${res.locals.tracer}`);
  const requestStart = process.hrtime();

  // This function could be something 'expensive'
  await new Promise(resolve => setTimeout(resolve, 5000));

  res.set('Content-Type', 'text/html');
  res.end('<html>Wow that seemed REALLY slow! <a href="/">back</a><html>');

  console.log(`Server has now finished work on ${res.locals.tracer} in ${getDurationInMilliseconds(requestStart)}`);
});

// Simulate a long running process where we respond, and then do the work
// In your browser refresh the page a lot
api.get('/async-five', async (req, res) => {
  console.log(`Starting work for ${res.locals.tracer}`);
  const requestStart = process.hrtime();

  res.set('Content-Type', 'text/html');
  res.end('<html>Wow that seemed fast! <a href="/">back</a></html>');

  // This function could be something 'expensive'
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`Server has now finished work on ${res.locals.tracer} in ${getDurationInMilliseconds(requestStart)}`);
});

// load the routes
app.use(api);

server.listen(3000, () => {
  console.log(`Started on port 3000`);
});
