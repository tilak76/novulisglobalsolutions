const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { parseGuidelines } = require('../scripts/ingest');
const { extractUIState } = require('../scripts/extract');
const { compareUIToRules } = require('../scripts/compare');
const { askAgent } = require('../scripts/agent');
const ComplianceScan = require('../models/ComplianceScan');

router.post('/run-pipeline', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        const publicScreenshotsDir = path.join(__dirname, '..', '..', 'public', 'screenshots');
        
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
        const pdfPath = path.join(dataDir, 'guidelines.pdf');
        const rulesPath = path.join(dataDir, 'rules.json');
        const uiDataPath = path.join(dataDir, 'extracted_ui.json');
        const discrepanciesPath = path.join(dataDir, 'discrepancies.json');

        if (!process.env.GEMINI_API_KEY) {
            return res.status(400).json({ error: "GEMINI_API_KEY is not set in backend .env" });
        }

        console.log("--- Starting Pipeline ---");

        // 1. Ingest
        await parseGuidelines(pdfPath, rulesPath);

        // 2. Extract
        await extractUIState(uiDataPath, publicScreenshotsDir);

        // 3. Compare
        const discrepancies = await compareUIToRules(rulesPath, uiDataPath, discrepanciesPath);

        const coveragePath = path.join(dataDir, 'coverage.json');
        let coverage = {};
        if (fs.existsSync(coveragePath)) {
            coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        }

        // Calculate Score
        let score = 100;
        let issuesFound = discrepancies.length;
        score = Math.max(0, 100 - (issuesFound * 5)); // basic formula: each issue reduces score by 5

        let pagesScanned = coverage.total_routes_discovered || 1;
        
        // Find previous scan to calculate trend
        const lastScan = await ComplianceScan.findOne().sort({ createdAt: -1 });
        let trend = 0;
        if (lastScan) {
            trend = score - lastScan.score;
        }

        const newScan = new ComplianceScan({
            score,
            trend,
            pagesScanned,
            issuesFound,
            status: 'Completed'
        });
        await newScan.save();

        console.log("--- Pipeline Complete ---");
        res.json({ success: true, discrepancies, coverage, scanId: newScan._id });

    } catch (error) {
        console.error("Pipeline Error:", error);
        res.status(500).json({ error: "Pipeline failed", details: error.message });
    }
});

router.get('/results', (req, res) => {
    const discrepanciesPath = path.join(__dirname, '..', 'data', 'discrepancies.json');
    if (fs.existsSync(discrepanciesPath)) {
        const data = JSON.parse(fs.readFileSync(discrepanciesPath, 'utf8'));
        res.json(data);
    } else {
        res.json([]);
    }
});

router.get('/analytics', async (req, res) => {
    try {
        let scans = await ComplianceScan.find().sort({ createdAt: -1 }).limit(10);
        
        if (scans.length === 0) {
            // Seed with some mock data so it's not empty initially if user hasn't run pipeline
            const mockScans = [
                { score: 92, trend: 5, pagesScanned: 12, issuesFound: 3, status: 'Completed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
                { score: 87, trend: -2, pagesScanned: 12, issuesFound: 7, status: 'Completed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24) },
                { score: 89, trend: 0, pagesScanned: 12, issuesFound: 15, status: 'Failed', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48) }
            ];
            await ComplianceScan.insertMany(mockScans);
            scans = await ComplianceScan.find().sort({ createdAt: -1 }).limit(10);
        }

        const latestScan = scans[0];

        res.json({ 
            success: true, 
            healthScore: latestScan.score,
            trend: latestScan.trend,
            recentScans: scans 
        });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "Question is required." });
        }

        const dataDir = path.join(__dirname, '..', 'data');
        const answer = await askAgent(question, dataDir);
        
        res.json({ success: true, answer });
    } catch (error) {
        console.error("Chat Agent Error:", error);
        res.status(500).json({ error: "Failed to process chat query" });
    }
});

module.exports = router;
