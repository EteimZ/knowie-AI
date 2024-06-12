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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



app.get('/', (req, res) => {
  res.render('pages/upload');
});

// Endpoint to serve file upload page
app.get('/upload', (req, res) => {
  res.render('pages/upload');
});

// Endpoint to serve file upload page
app.post('/upload', upload.single('file'), (req, res, next) => {
  res.send({ message: "Successful" });
});

// Endpoint to serve file upload page
app.get('/chat/:filename', (req, res) => {
  const filename = req.params.filename;
  res.render('pages/chat', { filename: filename });
});

const port = process.env.PORT || 5000;  // Use environment variable for port or default to 3000

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});