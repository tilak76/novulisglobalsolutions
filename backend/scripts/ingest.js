const fs = require('fs');
const pdf = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

async function parseGuidelines(pdfPath, outputPath) {
    if (!fs.existsSync(pdfPath)) {
        console.warn(`Warning: ${pdfPath} does not exist. Using mock rules for demonstration.`);
        return generateMockRules(outputPath);
    }

    console.log(`Extracting text from ${pdfPath}...`);
    const dataBuffer = fs.readFileSync(pdfPath);
    
    let rawText = "";
    try {
        const data = await pdf(dataBuffer);
        rawText = data.text;
    } catch (e) {
        console.error("Error parsing PDF:", e);
        return null;
    }

    if (!rawText.trim()) {
        console.error("Error: No text extracted from PDF.");
        return null;
    }

    console.log("Sending text to LLM for structuring...");
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
    You are an expert QA and Compliance engineer. Your task is to extract UI and functional guidelines from the provided text and convert them into a structured JSON array of rules.
    
    Each rule should have:
    - guideline_reference: The section or title the rule belongs to (e.g., "Section 2: Login")
    - expected_text_content: The exact text that should appear on the screen, if specified. (Empty string if not text-based)
    - component_type: What kind of component this is (e.g., "button", "text_block", "navigation_item", "input_field").
    - description: A brief description of the requirement.
    - page_url_hint: A hint for which page this rule applies to (e.g., "/login", "/dashboard", "all").
    
    Here is the raw text from the official guidelines PDF:
    ---
    ${rawText}
    ---
    
    Return ONLY a valid JSON array of these rules.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        
        const rules = JSON.parse(response.text);
        fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2));
        console.log(`Successfully extracted ${rules.length} rules to ${outputPath}`);
        return rules;
    } catch (e) {
        console.error("Error generating rules from LLM. Falling back to mock rules.", e);
        return generateMockRules(outputPath);
    }
}

function generateMockRules(outputPath) {
    const rules = [
        {
            "guideline_reference": "Section 2: Login",
            "expected_text_content": "Sign In",
            "component_type": "button",
            "description": "The login page must have a primary Sign In button.",
            "page_url_hint": "/login"
        },
        {
            "guideline_reference": "Section 4: Dashboard Overview",
            "expected_text_content": "My Applications",
            "component_type": "text_block",
            "description": "The dashboard must explicitly state My Applications in the header.",
            "page_url_hint": "/dashboard"
        }
    ];
    fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2));
    console.log(`Fallback: Generated ${rules.length} mock rules to ${outputPath}`);
    return rules;
}

module.exports = { parseGuidelines };
