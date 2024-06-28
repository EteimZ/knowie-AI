# MK Project

Simple demonstration for [Monkie Kid's](https://en.wikipedia.org/wiki/Lego_Monkie_Kid) project.

## Usage

clone the repo then `cd` into it and run:

```bash
npm install
```

Then create an `.env` file and put the following environment variables into it.

```bash
OPENAI_API_KEY=......................
GEMINI_API_KEY=..................
REPLICATE_API_TOKEN=...........
```

To set up supabase storage add the following too:

```bash
STORAGE_URL =
SERVICE_KEY =
STORAGE_PATH=
```

All of these values can be optained from supabase dashboard.

Then run:

```bash
npm run dev
```

## Resources
- [How to use EJS with express](https://www.digitalocean.com/community/tutorials/how-to-use-ejs-to-template-your-node-application)