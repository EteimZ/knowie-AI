import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';
import { readPdfText } from 'pdf-text-reader';
import { OpenAI, Settings, Gemini, GEMINI_MODEL, Document, VectorStoreIndex } from "llamaindex";

import dotenv from 'dotenv';
dotenv.config();

// this helps to locate the file paths
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.render('pages/upload');
});

// Endpoint to serve file upload page
app.get('/upload', (req, res) => {
  res.render('pages/upload');
});
// app.get('/flashcards', (req, res) => {
//   res.render('pages/flashcards');
// });


// Endpoint to serve file upload page
app.post('/upload', upload.single('file'), (req, res, next) => {
  res.send({ message: "Successful" });
});

// Endpoint to serve chat page
app.get('/chat/:filename', (req, res) => {
  const filename = req.params.filename;
  res.render('pages/chat', { filename: filename });
});

// Endpoint to chat
app.post('/chat', async (req, res) => {
  if (req.query.model == "gemini") {

  }

  switch (req.query.model) {
    case "gemini":
      Settings.llm = new Gemini({
        model: GEMINI_MODEL.GEMINI_PRO_1_5_FLASH_PREVIEW,
      });
      break;

    case "gpt-4":
      Settings.llm = new OpenAI({ model: "gpt-4-turbo", temperature: 0.7 });
      break;

    case "gpt-4o":
      Settings.llm = new OpenAI({ model: "gpt-4o", temperature: 0.7 });
      break;

    default:
      Settings.llm = new OpenAI({ model: "gpt-3.5-turbo" });
      break;
  }

  const path = `./uploads/${req.query.filename}`
  
  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "essay" });

  const index = await VectorStoreIndex.fromDocuments([document]);

  // Query the index
  const queryEngine = index.asQueryEngine();
  const response = await queryEngine.query({
    query: req.body.message,
  });

  res.send({ message: response.toString() })
})

app.get('/quiz', async (req, res) => {

  switch (req.query.model) {
    case "gemini":
      Settings.llm = new Gemini({
        model: GEMINI_MODEL.GEMINI_PRO_1_5_FLASH_PREVIEW,
      });
      break;

    case "gpt-4":
      Settings.llm = new OpenAI({ model: "gpt-4-turbo", temperature: 0.7 });
      break;

    case "gpt-4o":
      Settings.llm = new OpenAI({ model: "gpt-4o", temperature: 0.7 });
      break;

    default:
      Settings.llm = new OpenAI({ model: "gpt-3.5-turbo" });
      break;
  }

  const path = `./uploads/${req.query.filename}`
  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "quiz" });

  const index = await VectorStoreIndex.fromDocuments([document]);

  const predefinedPrompt = `Generate a quiz from this document. Let the quiz be made up of 10 questions, with 4 options each, and one correct answer. Let the difficulty level be hard. The questions should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "questions": [ { "question": "What is the capital of France?", "options": { "a": "Berlin", "b": "Madrid", "c": "Paris", "d": "Rome" }, "answer": "c" }, { "question": "Which planet is known as the Red Planet?", "options": { "a": "Earth", "b": "Mars", "c": "Jupiter", "d": "Venus" }, "answer": "b" } ]} _end_json`;

  // Query the index
  const queryEngine = index.asQueryEngine();
  const response = await queryEngine.query({
    query: predefinedPrompt,
  });

  const text = response.toString();

  // Extract the JSON part between start_json_ and _end_json
  const jsonStart = text.indexOf('start_json_') + 'start_json_'.length;
  const jsonEnd = text.indexOf('_end_json');
  const jsonString = text.substring(jsonStart, jsonEnd).trim();

  res.render('pages/quiz', { message: jsonString })
})

app.get('/flashcards', async (req, res) => {

  switch (req.query.model) {
    case "gemini":
      Settings.llm = new Gemini({
        model: GEMINI_MODEL.GEMINI_PRO_1_5_FLASH_PREVIEW,
      });
      break;

    case "gpt-4":
      Settings.llm = new OpenAI({ model: "gpt-4-turbo", temperature: 0.7 });
      break;

    case "gpt-4o":
      Settings.llm = new OpenAI({ model: "gpt-4o", temperature: 0.7 });
      break;

    default:
      Settings.llm = new OpenAI({ model: "gpt-3.5-turbo" });
      break;
  }

  const path = `./uploads/${req.query.filename}`
  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "quiz" });

  const index = await VectorStoreIndex.fromDocuments([document]);

  const predefinedPrompt = `Extract important concepts from this document and their short definitions/explanations. Put it in key value pairs. Let there be four concept and explanation pair. The pairs should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "concepts": [ { "concept": "nutrition", "explanation": "The taking in and use of food and other nourishing material by the body" }, { "concept": " Intellectual Property", "explanation": "Legal rights that protect creations of the mind, such as inventions, literary and artistic works, designs, symbols, names, and images used in commerce. " } ]} _end_json`;

  // Query the index
  const queryEngine = index.asQueryEngine();
  const response = await queryEngine.query({
    query: predefinedPrompt,
  });

  const text = response.toString();

  // Extract the JSON part between start_json_ and _end_json
  const jsonStart = text.indexOf('start_json_') + 'start_json_'.length;
  const jsonEnd = text.indexOf('_end_json');
  const jsonString = text.substring(jsonStart, jsonEnd).trim();

  res.render('pages/flashcards', { message: jsonString })
})










const port = process.env.PORT || 5000;  // Use environment variable for port or default to 3000

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});