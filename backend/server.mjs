import express from 'express';
import multer from 'multer';
import path from 'path';
import bodyParser from 'body-parser';
import { readPdfText } from 'pdf-text-reader';
import { OpenAI, Settings, Gemini, GEMINI_MODEL, Document, VectorStoreIndex } from "llamaindex";

// Gemini import
import {
  GoogleGenerativeAI,
} from "@google/generative-ai";

// Replicate import
import Replicate from 'replicate';

import dotenv from 'dotenv';
dotenv.config();

// supabase storage
import { StorageClient } from '@supabase/storage-js'
import fs from 'fs/promises';

import { decode } from "base64-arraybuffer";

const STORAGE_URL = process.env.STORAGE_URL
const SERVICE_KEY = process.env.SERVICE_KEY
const STORAGE_PATH = process.env.STORAGE_PATH

const storageClient = new StorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})

// Setup Gemini 
const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 0.75,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

// Set up replicate
const replicate = new Replicate();

// this helps to locate the file paths
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage for multer to keep the original filename
const storage = multer.memoryStorage({
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

app.get('/result', (req, res) => {
  res.render('pages/result');
});

app.get('/review', (req, res) => {
  res.render('pages/review');
});

// Endpoint to serve file upload page
app.post('/upload', upload.single('file'), async (req, res, next) => {

  const file = req.file;

  // decode file buffer to base64
  const fileBase64 = decode(file.buffer.toString("base64"));

  // upload the file to supabase
  const { data, error } = await storageClient.from('storage_bucket').upload(file.originalname, fileBase64, {
    contentType: 'application/pdf'
  });

  res.send({ message: "Successful" });
});

// Endpoint to serve chat page
app.get('/chat/:filename', (req, res) => {
  const filename = req.params.filename;
  res.render('pages/chat', { filename: filename });
});

// Endpoint to chat
app.post('/chat', async (req, res) => {

  const path = `${STORAGE_PATH}/${req.query.filename}`
  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "essay" });

  const index = await VectorStoreIndex.fromDocuments([document]);

  if (req.query.model == "gemini") {
    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;
    const nodesWithScore = await retriever.retrieve({ query: req.body.message });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n\tContext ${i + 1}: ${nodesWithScore[i]["node"].text}`
    }

    console.log(nodesWithScore.length)
    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(`Use the following contexts as guide to answer the prompt.  If the prompt is unrelated to the document, just reply to them normally. Contexts: \n\n ${text} and prompt: ${req.body.message}`);

    res.send({ message: result.response.text() })

  } else if (req.query.model == "llama3") {

    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;

    const prompt = req.body.message;

    const nodesWithScore = await retriever.retrieve({ query: prompt });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n ${nodesWithScore[i]["node"].text}`
    }

    const input = {
      prompt: `Use the following document as a guide to answer the prompt. If the prompt is unrelated to the document, just reply to them normally. Document: \n\n ${text} \n\n Prompt: ${prompt}`,
      max_new_tokens: 512,
      prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful AI assistant.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    };

    const output = await replicate.run("meta/meta-llama-3-8b-instruct", { input });

    let outputText = "";
    for (let i = 0; i < output.length; i++) {
      outputText += output[i];
    }

    res.send({ message: outputText })
  }
  else {

    switch (req.query.model) {
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

    // Query the index
    const queryEngine = index.asQueryEngine();
    const response = await queryEngine.query({
      query: req.body.message,
    });

    res.send({ message: response.toString() })
  }
})


app.get('/quiz', async (req, res) => {

  console.log(req.query.filename)

  const path = `${STORAGE_PATH}/${req.query.filename}`
  console.log(path)

  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "quiz" });

  const index = await VectorStoreIndex.fromDocuments([document]);

  const predefinedPrompt = `Generate a quiz from this document. Let the quiz be made up of 10 questions, with 4 options each, and one correct answer.  Let the difficulty level be hard. The questions should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "questions": [ { "question": "What is the capital of France?", "options": { "a": "Berlin", "b": "Madrid", "c": "Paris", "d": "Rome" }, "answer": "c" }, { "question": "Which planet is known as the Red Planet?", "options": { "a": "Earth", "b": "Mars", "c": "Jupiter", "d": "Venus" }, "answer": "b" } ]} _end_json`;

  if (req.query.model == "gemini") {
    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;
    const nodesWithScore = await retriever.retrieve({ query: "Useful facts." });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n\tContext ${i + 1}: ${nodesWithScore[i]["node"].text}`
    }

    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(`Generate a quiz from the contexts. Let the quiz be made up of 10 questions, with 4 options each, and one correct answer. Let the difficulty level be hard. The questions should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "questions": [ { "question": "What is the capital of France?", "options": { "a": "Berlin", "b": "Madrid", "c": "Paris", "d": "Rome" }, "answer": "c" }, { "question": "Which planet is known as the Red Planet?", "options": { "a": "Earth", "b": "Mars", "c": "Jupiter", "d": "Venus" }, "answer": "b" } ]} _end_json. Contexts: \n\n ${text}`);

    const responseText = result.response.text();
    console.log(responseText);
    // Extract the JSON part between start_json_ and _end_json
    const jsonStart = responseText.indexOf('start_json_') + 'start_json_'.length;
    const jsonEnd = responseText.indexOf('_end_json');
    const jsonString = responseText.substring(jsonStart, jsonEnd).trim();
    console.log(jsonString);

    res.render('pages/quiz', { message: jsonString });
  } else if (req.query.model == "llama3") {

    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;

    const nodesWithScore = await retriever.retrieve({ query: "Useful facts." });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n ${nodesWithScore[i]["node"].text}`
    }

    const input = {
      prompt: `Generate a quiz from this document.  Let the quiz be made up of 10 questions, with 4 options each, and one correct answer. Let the difficulty level be hard. The questions should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "questions": [ { "question": "What is the capital of France?", "options": { "a": "Berlin", "b": "Madrid", "c": "Paris", "d": "Rome" }, "answer": "c" }, { "question": "Which planet is known as the Red Planet?", "options": { "a": "Earth", "b": "Mars", "c": "Jupiter", "d": "Venus" }, "answer": "b" } ]} _end_json. Document: \n\n ${text}`,
      max_new_tokens: 1024,
      prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful AI assistant.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    };

    const output = await replicate.run("meta/meta-llama-3-8b-instruct", { input });

    let responseText = "";
    for (let i = 0; i < output.length; i++) {
      responseText += output[i];
    }
    console.log(responseText);

    // Extract the JSON part between start_json_ and _end_json
    const jsonStart = responseText.indexOf('start_json_') + 'start_json_'.length;
    const jsonEnd = responseText.indexOf('_end_json');
    const jsonString = responseText.substring(jsonStart, jsonEnd).trim();
    console.log(jsonString);
    res.render('pages/quiz', { message: jsonString });

  } else {
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

  }
})

app.get('/flashcards', async (req, res) => {

  const path = `${STORAGE_PATH}/${req.query.filename}`
  const essay = await readPdfText({ url: path });
  const document = new Document({ text: essay, id_: "quiz" });

  const predefinedPrompt = `Extract important concepts from this document and their short definitions/explanations. Put it in key value pairs. Let there be eight concept and explanation pairs. The explanations for each concept should not exceed 180 characters long. The pairs should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "concepts": [ { "concept": "nutrition", "explanation": "The taking in and use of food and other nourishing material by the body" }, { "concept": " Intellectual Property", "explanation": "Legal rights that protect creations of the mind, such as inventions, literary and artistic works, designs, symbols, names, and images used in commerce. " } ]} _end_json`

  const index = await VectorStoreIndex.fromDocuments([document]);

  if (req.query.model == "gemini") {
    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;
    const nodesWithScore = await retriever.retrieve({ query: "Useful facts." });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n\tContext ${i + 1}: ${nodesWithScore[i]["node"].text}`
    }

    const chatSession = model.startChat({
      generationConfig,
      history: [],
    });

    const result = await chatSession.sendMessage(`Extract important concepts from this document and their short definitions/explanations. Put it in key value pairs. Let there be eight concept and explanation pairs. The explanations for each concept should not exceed 180 characters long. The pairs should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "concepts": [ { "concept": "nutrition", "explanation": "The taking in and use of food and other nourishing material by the body" }, { "concept": " Intellectual Property", "explanation": "Legal rights that protect creations of the mind, such as inventions, literary and artistic works, designs, symbols, names, and images used in commerce. " } ]} _end_json. Contexts: \n\n ${text}`);

    const responseText = result.response.text();

    // Extract the JSON part between start_json_ and _end_json
    const jsonStart = responseText.indexOf('start_json_') + 'start_json_'.length;
    const jsonEnd = responseText.indexOf('_end_json');
    const jsonString = responseText.substring(jsonStart, jsonEnd).trim();

    res.render('pages/flashcards', { message: jsonString });

  } else if (req.query.model == "llama3") {
    const retriever = index.asRetriever();
    retriever.similarityTopK = 3;

    const nodesWithScore = await retriever.retrieve({ query: "Useful facts." });

    let text = "";
    for (let i = 0; i < nodesWithScore.length; i++) {
      text += `\n\n ${nodesWithScore[i]["node"].text}`
    }

    const input = {
      prompt: `Extract important concepts from this document and their short definitions/explanations. Put it in key value pairs. Let there be eight concept and explanation pairs. The explanations for each concept should not exceed 180 characters long. The pairs should be formatted in json, json should start with a start_json_ tag and end with a _end_json tag. For example here's is a sample response: start_json_ { "concepts": [ { "concept": "nutrition", "explanation": "The taking in and use of food and other nourishing material by the body" }, { "concept": " Intellectual Property", "explanation": "Legal rights that protect creations of the mind, such as inventions, literary and artistic works, designs, symbols, names, and images used in commerce. " } ]} _end_json. Contexts: \n\n ${text}`,
      max_new_tokens: 512,
      prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful AI assistant.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
    };

    const output = await replicate.run("meta/meta-llama-3-8b-instruct", { input });

    let responseText = "";
    for (let i = 0; i < output.length; i++) {
      responseText += output[i];
    }

    // Extract the JSON part between start_json_ and _end_json
    const jsonStart = responseText.indexOf('start_json_') + 'start_json_'.length;
    const jsonEnd = responseText.indexOf('_end_json');
    const jsonString = responseText.substring(jsonStart, jsonEnd).trim();

    res.render('pages/flashcards', { message: jsonString });
  } else {

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
  }

})

app.get("/storage/url", (res, req) => {
  req.send({url: STORAGE_PATH});
})


const port = process.env.PORT || 5000;  // Use environment variable for port or default to 3000

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});