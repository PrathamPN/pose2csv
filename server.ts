import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.post("/api/analyze-posture", async (req, res) => {
    try {
      const { frameImage } = req.body; // base64 image
      
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Analyze this exercise frame. 
      Identify the exercise type (e.g., Squat, Push-up, Bicep Curl, Plank), 
      the posture quality (Good or Bad), and a brief reason if the posture is Bad.`;

      // Simple retry logic for 429/503
      let result;
      let lastError;
      for (let i = 0; i < 3; i++) {
        try {
          result = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [
              { text: prompt },
              {
                inlineData: {
                  data: frameImage.split(',')[1],
                  mimeType: "image/jpeg"
                }
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  exercise: { type: "STRING" },
                  quality: { type: "STRING", enum: ["good", "bad"] },
                  reason: { type: "STRING" }
                },
                required: ["exercise", "quality"]
              }
            }
          });
          break; // Success
        } catch (error: any) {
          lastError = error;
          if (error.status === 429 || error.status === 503) {
            console.log(`Gemini API error ${error.status}, retrying (${i+1}/3)...`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Simple backoff
            continue;
          }
          throw error; // Other errors fail immediately
        }
      }

      if (!result) throw lastError || new Error("Failed after retries");

      const text = result.text;
      if (!text) throw new Error("No response text from Gemini");
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze frame" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
