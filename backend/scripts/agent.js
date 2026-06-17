const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

async function askAgent(question, dataDir) {
    console.log("Processing agent query:", question);

    const rulesPath = path.join(dataDir, 'rules.json');
    const uiDataPath = path.join(dataDir, 'extracted_ui.json');
    const discrepanciesPath = path.join(dataDir, 'discrepancies.json');

    // Default mock response if API key is missing or files are missing
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
        console.warn("Using mock RAG response because GEMINI_API_KEY is missing.");
        return `[Automated Agent] Based on the mock analysis, the live landing page does have discrepancies. Specifically, the header text 'Waiver Portal' does not match the expected 'WaiverPro Official Dashboard' as required by Section 4 of the guidelines. Disclaimer: This is an automated AI compliance check, not a manual QA replacement.`;
    }

    let contextData = {};
    try {
        if (fs.existsSync(rulesPath)) contextData.rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        if (fs.existsSync(uiDataPath)) contextData.ui = JSON.parse(fs.readFileSync(uiDataPath, 'utf8'));
        if (fs.existsSync(discrepanciesPath)) contextData.discrepancies = JSON.parse(fs.readFileSync(discrepanciesPath, 'utf8'));
    } catch (e) {
        console.error("Failed to load context data:", e);
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
    You are an expert UI Compliance Verification Agent.
    Your task is to answer user questions regarding the compliance of a live web application against official guidelines.

    Here is the context data extracted from the system:
    ---
    Extracted UI States:
    ${JSON.stringify(contextData.ui || [], null, 2)}
    
    Official Guidelines Rules:
    ${JSON.stringify(contextData.rules || [], null, 2)}
    
    Detected Discrepancies:
    ${JSON.stringify(contextData.discrepancies || [], null, 2)}
    ---

    User Question: "${question}"

    Rules for your response:
    1. Base your answer strictly on the provided context (RAG approach). Do not hallucinate.
    2. Whenever you make a claim about a requirement, you MUST include a specific guideline reference (e.g., "According to Section 2...").
    3. If asked why an element is flagged, clearly explain the expected vs actual state.
    4. You MUST end your response with this exact disclaimer:
       "*Disclaimer: This is an automated compliance check, not a manual QA replacement.*"
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.2,
            }
        });
        
        return response.text;
    } catch (e) {
        console.error("Agent LLM Error:", e);
        return `I encountered an error while processing your request: ${e.message}. \n\n*Disclaimer: This is an automated compliance check, not a manual QA replacement.*`;
    }
}

module.exports = { askAgent };
