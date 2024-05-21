const express = require('express');
const app = express();

// Define a route for the root path ('/')
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Define another route for a specific path ('/about')
app.get('/about', (req, res) => {
  res.send('This is the about page.');
});


const port = process.env.PORT || 3000;  // Use environment variable for port or default to 3000

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});