import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ComplianceDashboard() {
  const [loading, setLoading] = useState(false);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [error, setError] = useState(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchResults = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/verify/results');
      setDiscrepancies(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const runVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('http://localhost:5000/api/verify/run-pipeline');
      if (res.data.success) {
        setDiscrepancies(res.data.discrepancies);
        setCoverage(res.data.coverage);
      } else {
        setError("Pipeline returned an error.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to run verification");
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatLog(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/verify/chat', { question: userMessage.content });
      setChatLog(prev => [...prev, { role: 'agent', content: res.data.answer }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'agent', content: "Error: Could not connect to the Agent. " + (err.response?.data?.error || err.message) }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end border-b pb-4 border-gray-200">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">UI Compliance Verification</h1>
            <p className="text-gray-500 mt-2">Automated system to verify live web application against official guidelines.</p>
          </div>
          <button 
            onClick={runVerification} 
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all shadow-md ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
          >
            {loading ? 'Running Analysis...' : 'Run Verification Pipeline'}
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-r-lg">
            <h3 className="text-red-800 font-bold">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 p-6 mb-8 rounded-xl shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Architecture & Tool Justification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-indigo-700 mb-2">Libraries & Tools Used</h4>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold text-gray-900 w-28 shrink-0">Playwright:</span>
                  <span>Used for extracting dynamic UI states. Chosen over Cheerio/Puppeteer because it easily handles complex React hydration, authentication states, and auto-waits for elements, ensuring we capture the exact UI a user sees.</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-gray-900 w-28 shrink-0">@google/genai:</span>
                  <span>Powers the comparison agent. Selected for its massive context window and superior JSON-schema adherence, which prevents hallucinations when comparing hundreds of UI nodes to complex PDF rules.</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-gray-900 w-28 shrink-0">pdf-parse:</span>
                  <span>Used to ingest the raw guideline PDF text. A lightweight Node.js solution that seamlessly feeds into the LLM prompt for structured rule extraction.</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold text-gray-900 w-28 shrink-0">Express & React:</span>
                  <span>A full-stack Node approach was selected to provide a seamless user interface. Playwright requires a server environment, so Express orchestrates the agentic loop while React handles visualization.</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <h4 className="font-semibold text-indigo-700 mb-2">Key Functions & Trade-offs</h4>
              <ul className="space-y-2 text-sm text-gray-700">
                <li><strong>Retry Logic:</strong> Navigations are wrapped in explicit retry blocks to catch Azure static app cold starts or timeouts.</li>
                <li><strong>DOM Filtering (Trade-off):</strong> Instead of sending the raw HTML tree to the LLM (which exceeds context and adds noise), a JS evaluator extracts only visible, semantic nodes (headings, buttons, links, non-empty divs) using <code>getBoundingClientRect()</code>.</li>
                <li><strong>Two-Step AI Agent:</strong> Instead of doing everything at once, the pipeline splits into <em>Ingestion</em> (PDF to canonical JSON rules) and <em>Comparison</em> (UI JSON vs Rule JSON). This minimizes hallucination and allows caching rules.</li>
              </ul>
            </div>
          </div>
        </div>

        {coverage && (
          <div className="bg-slate-50 border border-slate-200 p-6 mb-8 rounded-xl shadow-sm">
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
              Extraction Coverage Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-medium text-slate-500 uppercase">Routes Discovered</p>
                <p className="text-3xl font-extrabold text-slate-800">{coverage.total_routes_discovered}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-medium text-emerald-600 uppercase">Successful</p>
                <p className="text-3xl font-extrabold text-emerald-600">{coverage.successful_routes.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-medium text-amber-500 uppercase">Retries Triggered</p>
                <p className="text-3xl font-extrabold text-amber-500">{coverage.retries}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm text-center">
                <p className="text-sm font-medium text-red-500 uppercase">Failed Routes</p>
                <p className="text-3xl font-extrabold text-red-500">{coverage.failed_routes.length}</p>
              </div>
            </div>
            
            {coverage.missed_data && coverage.missed_data.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <h4 className="font-semibold text-amber-800 mb-2">Missed Data / Warnings</h4>
                <ul className="list-disc pl-5 text-sm text-amber-700 space-y-1">
                  {coverage.missed_data.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            Discrepancies Found <span className="ml-2 px-3 py-1 bg-red-100 text-red-800 text-sm rounded-full">{discrepancies.length}</span>
          </h2>
        </div>

        {discrepancies.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-gray-100">
            <div className="text-green-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900">All Clear!</h3>
            <p className="text-gray-500 mt-2">No discrepancies found, or pipeline hasn't been run yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {discrepancies.map((disc, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      {disc.page_url}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {disc.component_type}
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2" title={disc.guideline_reference}>
                    {disc.guideline_reference}
                  </h3>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Reason</p>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{disc.discrepancy_reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected</p>
                      <p className="text-sm text-gray-800 break-words">{disc.expected_text_content || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Actual</p>
                      <p className="text-sm text-gray-800 break-words">{disc.actual_text_content || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-400 mb-4 font-mono truncate">
                    Selector: {disc.component_selector}
                  </div>
                </div>
                
                {disc.screenshot_path && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Visual Evidence</p>
                    <a href={`http://localhost:5000/screenshots/${disc.screenshot_path}`} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-lg border border-gray-200">
                      <img 
                        src={`http://localhost:5000/screenshots/${disc.screenshot_path}`} 
                        alt="Screenshot" 
                        className="w-full h-48 object-cover object-top group-hover:opacity-75 transition-opacity"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black bg-opacity-10 transition-opacity">
                        <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow-lg">View Full Image</span>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* --- AI Agent Chat Interface --- */}
        <div className="mt-12 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="bg-indigo-600 p-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <div>
              <h3 className="font-bold text-white">Compliance QA Agent</h3>
              <p className="text-indigo-100 text-xs">Ask anything about the UI guidelines or discrepancies</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
            {chatLog.length === 0 ? (
              <div className="text-center text-slate-400 mt-10">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <p>Try asking: <em>"List all UI discrepancies found on the dashboard"</em></p>
              </div>
            ) : (
              chatLog.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm flex gap-2 items-center">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 bg-white border-t border-slate-200 flex gap-3">
            <input 
              type="text" 
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
              placeholder="Ask the compliance agent..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button 
              type="submit" 
              disabled={chatLoading || !chatInput.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              Send
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
