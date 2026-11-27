
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname)));

const API_KEY = process.env.OPENAI_API_KEY;

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Drishti AI",
    aiConfigured: Boolean(API_KEY)
  });
});

// AI Vision endpoint
app.post("/api/vision", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "OpenAI API key server par set nahi hai."
      });
    }

    const { image, mode, query, language, question } = req.body || {};

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "Image missing hai. Camera se image capture karein."
      });
    }

    const match = image.match(
      /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/
    );

    if (!match) {
      return res.status(400).json({
        error: "Image format valid nahi hai."
      });
    }

    if (image.length > 10 * 1024 * 1024) {
      return res.status(413).json({
        error: "Image bahut badi hai."
      });
    }

    const lang = language === "en-IN" ? "English" : "Hindi";

    const prompts = {
      scene: `You are Drishti AI, a visual assistant for blind and low-vision users. Describe the scene in natural ${lang}. Start with the most important information. Explain objects, their approximate positions (left, right, center, near, far), people, furniture, doors, visible paths and surroundings. Be helpful and detailed but easy to listen to. Only describe what is visible. Never claim a road, crossing, stairs or environment is safe.`,

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
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt + extraQuestion
                },
                {
                  type: "input_image",
                  image_url: image,
                  detail: "high"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "AI request failed."
      });
    }

    const answer = data.output
      ?.flatMap(item => item.content || [])
      ?.filter(item => item.type === "output_text")
      ?.map(item => item.text)
      ?.join("\n") || "";

    if (!answer) {
      return res.status(502).json({
        error: "AI se jawab nahi mila."
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
            
