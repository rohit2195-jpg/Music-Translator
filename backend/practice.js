import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';


dotenv.config()


// The client gets the API key from the environment variable `GEMINI_API_KEY`.
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY)

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "what is the meaning of life",
  });
  console.log(response.text);
}

main();