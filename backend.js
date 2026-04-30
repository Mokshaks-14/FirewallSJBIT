const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors()); // Allows all connections
app.use(express.json());

// Replace with your Stability API Key
const STABILITY_API_KEY = "sk-QW6Uerp6y2gKjcYHS71ziBF34im8FYPmQVAgUsoma1On7b1K"; 

app.post('/generate', async (req, res) => {
    console.log("📥 RECEIVED REQUEST:", req.body.prompt); // LOGGING ADDED

    const { prompt, sliders } = req.body;
    const fullPrompt = `Forensic sketch, ${prompt}, age ${sliders.age}, pencil style`;

    try {
        const response = await axios.post(
            "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
            {
                text_prompts: [{ text: fullPrompt }],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                steps: 30,
                samples: 1,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    Authorization: `Bearer ${STABILITY_API_KEY}`,
                },
            }
        );

        const base64Image = response.data.artifacts[0].base64;
        console.log("✅ SKETCH GENERATED SUCCESSFULLY");
        res.json({ imageUrl: `data:image/png;base64,${base64Image}` });

    } catch (error) {
        console.error("❌ STABILITY ERROR:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI Sketching failed" });
    }
});

// Force the server to listen on 127.0.0.1 specifically
app.listen(5000, "0.0.0.0", () => {
    console.log('🚀 Windows Evidence Server Active');
    console.log('🔗 API Endpoint: http://127.0.0.1:5000/generate');
});