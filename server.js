
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "12mb" }));

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.originalUrl);
  next();
});

app.use(express.static(path.join(__dirname)));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Drishti AI",
    aiConfigured: Boolean(GEMINI_API_KEY),
    provider: "Gemini"
  });
});

// Vision endpoint
app.post("/api/vision", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY Railway par set nahi hai."
      });
    }

    const { image, mode, query, language, question } = req.body || {};

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "Image missing hai. Camera se image capture karein."
      });
    }

    const match = image.match(
      /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Image format valid nahi hai."
      });
    }

    if (image.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        error: "Image bahut badi hai. Chhoti photo try karein."
      });
    }

    const mimeType = match[1] === "image/jpg"
      ? "image/jpeg"
      : match[1];

    const base64Data = match[2];

    const lang = language === "en-IN" ? "English" : "Hindi";

    const prompts = {
      scene: `You are Drishti AI, a visual assistant for blind and low-vision users. Describe the scene in natural ${lang}. Start with the most important information. Explain objects, approximate positions (left, right, center, near, far), people, furniture, doors, visible paths and surroundings. Be helpful and easy to listen to. Only describe what is visible. Never claim a road, crossing, stairs or environment is safe.`,

      outfit: `You are Drishti AI clothing assistant. In ${lang}, describe visible clothing, colours, garment types, patterns, layers, shoes, bags, watches and accessories. Only describe visible details. Do not guess identity, age, personality or sensitive traits.`,

      ocr: `You are Drishti AI text reader. Read and transcribe visible text from this image in ${lang} or its original language. Preserve words, numbers and labels accurately. Mark unclear text instead of guessing.`,

      find: `You are Drishti AI helping a blind user find an object. The user is searching for: ${String(query || "an object").slice(0, 200)}. In ${lang}, say if it is clearly visible and describe its approximate position in the image (left, right, center, top, bottom), and nearby objects. Never claim it is found if uncertain. This is not physical navigation.`,

      ask: `You are Drishti AI. Answer the user's question about this image in ${lang}. Only use visible information. Avoid guesses. Do not guarantee safety.`,

      detail: `You are Drishti AI for blind and low-vision users. Give a detailed description in ${lang} of everything clearly visible: overall scene, objects and relative positions, colours, text, clothing, accessories and background. Avoid speculation and safety guarantees.`
    };

    const prompt = prompts[mode] || prompts.scene;

    const extraQuestion = question
      ? `\nUser follow-up question: ${String(question).slice(0, 1000)}`
      : "";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt + extraQuestion
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API request failed."
      });
    }

    const answer = data.candidates
      ?.flatMap(candidate => candidate.content?.parts || [])
      ?.filter(part => typeof part.text === "string")
      ?.map(part => part.text)
      ?.join("\n")
      .trim() || "";

    if (!answer) {
      console.error("Gemini returned no text:", data);

      return res.status(502).json({
        error: "Gemini se jawab nahi mila. Dobara try karein."
      });
    }

    return res.json({ answer });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Server error. Dobara try karein."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Drishti AI running on port ${PORT}`);
});
  
