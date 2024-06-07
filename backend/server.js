const express = require('express');
const multer  = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const llama = require("llamaindex");

require('dotenv').config()

// Configure storage for multer to keep the original filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
      cb(null, file.originalname); 
  }
});
const upload = multer({ storage: storage });

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));


app.get('/', (req, res) => {
  res.render('pages/index');
});

app.get('/upload', (req, res) => {
  res.render('pages/upload');
});

const port = process.env.PORT || 5000;  // Use environment variable for port or default to 3000

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});