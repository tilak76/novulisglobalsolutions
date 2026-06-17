import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState('analytics'); // 'notes' | 'compliance' | 'analytics' | 'team'
  const navigate = useNavigate();

  // --- Notes State ---
  const [notes, setNotes] = useState([]);
  const [notesError, setNotesError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', title: '', content: '' });

  // --- Compliance State ---
  const [compLoading, setCompLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [compError, setCompError] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [analyticsData, setAnalyticsData] = useState({ healthScore: 0, trend: 0, recentScans: [] });

  // --- Chat State ---
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // --- Notification & Invite State ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // --- Team Activity State (Firebase Original Data) ---
  const [teamMembers, setTeamMembers] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);

  // --- Initialization ---
  useEffect(() => { 
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchNotes();
    });
    fetchComplianceResults();
    fetchTeamData();
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // --- MongoDB Team Logic ---
  const fetchTeamData = async () => {
    try {
      // Fetch Real Users from MongoDB (Assuming we bypass token auth for demo, or we can use a token if we migrate login later)
      const userRes = await axios.get('http://localhost:5001/api/team');
      const colors = ['from-blue-500 to-cyan-500', 'from-fuchsia-500 to-pink-500', 'from-amber-500 to-orange-500', 'from-emerald-500 to-teal-500', 'from-indigo-500 to-purple-500'];
      
      const members = [];
      if (userRes.data && userRes.data.data) {
        userRes.data.data.forEach((user) => {
          members.push({
            id: user._id,
            name: user.name,
            role: user.role || 'Member',
            status: 'Online',
            avatar: user.name.substring(0, 2).toUpperCase(),
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        });
      }
      setTeamMembers(members);

      // Fetch Real Activities from MongoDB 'activities' route
      const actRes = await axios.get('http://localhost:5001/api/activities');
      const activities = actRes.data?.data || [];
      
      if (activities.length > 0) {
        setActivityFeed(activities);
      } else {
        // Fallback default activity if collection is empty
        setActivityFeed([
          { user: 'System', action: 'initialized the project workspace on MongoDB', target: 'Version 1.0', time: 'Just now', icon: 'M5 13l4 4L19 7' }
        ]);
      }
    } catch (err) {
      console.error("Failed to fetch team data from MongoDB:", err);
    }
  };

  // --- Notes Logic ---
  const fetchNotes = async () => {
    try {
      if (!auth.currentUser) return;
      const q = query(collection(db, 'notes'), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
      setNotes(data || []);
    } catch (err) { setNotesError(err.message); }
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    try {
      if (formData.id) {
        await updateDoc(doc(db, 'notes', formData.id), { title: formData.title, content: formData.content });
      } else {
        await addDoc(collection(db, 'notes'), {
          title: formData.title,
          content: formData.content,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      setFormData({ id: '', title: '', content: '' });
      setShowForm(false);
      fetchNotes();
    } catch (err) { setNotesError(err.message); }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteDoc(doc(db, 'notes', id));
      fetchNotes();
    } catch (err) { setNotesError(err.message); }
  };

  const editNoteItem = (item) => {
    setFormData({ id: item._id, title: item.title, content: item.content });
    setShowForm(true);
  };

  // --- Compliance Logic ---
  const fetchComplianceResults = async () => {
    try {
      const res = await axios.get('http://localhost:5001/api/verify/results');
      setDiscrepancies(res.data || []);
    } catch (err) { console.error(err); }

    try {
      const anRes = await axios.get('http://localhost:5001/api/verify/analytics');
      if (anRes.data.success) {
        setAnalyticsData({
          healthScore: anRes.data.healthScore,
          trend: anRes.data.trend,
          recentScans: anRes.data.recentScans
        });
      }
    } catch (err) { console.error("Could not fetch analytics", err); }
  };

  useEffect(() => {
    let interval;
    if (compLoading) {
      setPipelineStep(1); // Booting
      let step = 1;
      interval = setInterval(() => {
        step++;
        if (step <= 3) setPipelineStep(step);
      }, 3000); // advance every 3 seconds
    } else if (coverage) {
      setPipelineStep(4); // Done
    } else {
      setPipelineStep(0);
    }
    return () => clearInterval(interval);
  }, [compLoading]);

  const runVerification = async () => {
    setCompLoading(true);
    setCompError(null);
    setDiscrepancies([]);
    setCoverage(null);
    try {
      const res = await axios.post('http://localhost:5001/api/verify/run-pipeline');
      
      // Log activity to Firebase
      try {
        await addDoc(collection(db, 'activities'), {
          user: auth.currentUser?.email || 'Admin User',
          action: 'triggered a Pipeline Check for',
          target: 'WaiverPro Live URL',
          time: new Date().toLocaleTimeString(),
          icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z'
        });
        fetchTeamData(); // Refresh activity feed
      } catch (e) { console.error("Could not log activity", e); }

      if (res.data.success) {
        setDiscrepancies(res.data.discrepancies);
        setCoverage(res.data.coverage);
        fetchComplianceResults(); // Refresh analytics after a scan
      } else {
        setCompError("Pipeline returned an error.");
      }
    } catch (err) {
      setCompError(err.response?.data?.error || err.message || "Failed to run verification");
    } finally {
      setCompLoading(false);
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
      const res = await axios.post('http://localhost:5001/api/verify/chat', { question: userMessage.content });
      setChatLog(prev => [...prev, { role: 'agent', content: res.data.answer }]);
    } catch (err) {
      setChatLog(prev => [...prev, { role: 'agent', content: "Error: " + (err.response?.data?.error || err.message) }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSuccess(true);
    setTimeout(() => {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteSuccess(false);
    }, 2000);
  };

  const filteredDiscrepancies = filterSeverity === 'All' 
    ? discrepancies 
    : discrepancies.filter(d => d.severity === filterSeverity);

  return (
    <div className="min-h-screen bg-slate-950 font-sans p-8 relative overflow-hidden text-slate-200">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-6 pb-6 border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">My Workspace</h1>
              <p className="text-slate-400 text-sm font-medium mt-1">Integrated Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                {activityFeed.length > 0 && (
                  <>
                    <span className="absolute top-1 right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                    <span className="absolute top-1 right-2 w-2 h-2 bg-rose-500 rounded-full"></span>
                  </>
                )}
              </button>
              
              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white">Notifications</h3>
                    <span className="text-xs text-indigo-400 cursor-pointer hover:underline" onClick={() => setShowNotifications(false)}>Close</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {activityFeed.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">No new notifications</div>
                    ) : (
                      activityFeed.slice(0, 5).map((notif, idx) => (
                        <div key={idx} className="p-4 border-b border-slate-800 hover:bg-slate-800/50 transition-colors flex gap-3 cursor-pointer">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={notif.icon || "M13 10V3L4 14h7v7l9-11h-7z"}></path></svg>
                          </div>
                          <div>
                            <p className="text-sm text-slate-300 leading-snug"><span className="font-bold text-white">{notif.user}</span> {notif.action} <span className="text-indigo-300">{notif.target}</span></p>
                            <p className="text-xs text-slate-500 mt-1">{notif.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 text-center border-t border-slate-800 bg-slate-900/50">
                    <button onClick={() => {setShowNotifications(false); setActiveTab('team');}} className="text-sm font-bold text-indigo-400 hover:text-indigo-300">View all activities</button>
                  </div>
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-slate-700 mx-2"></div>
            <button onClick={handleLogout} className="px-6 py-2.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl font-bold text-slate-300 transition-all flex items-center gap-2">
              Sign Out
            </button>
          </div>
        </header>

        {/* --- Tab Navigation --- */}
        <div className="flex gap-6 mb-8 border-b border-slate-800">
          <button onClick={() => setActiveTab('analytics')} className={`pb-4 px-2 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'analytics' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            Analytics Hub
          </button>
          <button onClick={() => setActiveTab('compliance')} className={`pb-4 px-2 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'compliance' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            Compliance Center
          </button>
          <button onClick={() => setActiveTab('team')} className={`pb-4 px-2 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'team' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Team Activity
          </button>
          <button onClick={() => setActiveTab('notes')} className={`pb-4 px-2 font-bold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'notes' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
            My Notes
          </button>
        </div>

        {/* --- TAB: ANALYTICS HUB --- */}
        {activeTab === 'analytics' && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-md flex flex-col justify-center items-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
                <h3 className="text-slate-400 font-bold mb-2">Compliance Health Score</h3>
                <div className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 my-4">{analyticsData.healthScore}%</div>
                <p className={`text-sm font-bold flex items-center gap-1 ${analyticsData.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {analyticsData.trend >= 0 ? 
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path> :
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"></path>
                    }
                  </svg> 
                  {analyticsData.trend >= 0 ? '+' : ''}{analyticsData.trend}% from last scan
                </p>
              </div>
              <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-md col-span-2 relative overflow-hidden">
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-500/10 rounded-full blur-3xl"></div>
                <h3 className="text-slate-400 font-bold mb-6">Discrepancy Severity Distribution</h3>
                <div className="flex gap-4 items-end h-32">
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-rose-500/20 rounded-t-lg relative group">
                      <div className="absolute bottom-0 w-full bg-rose-500 rounded-t-lg transition-all duration-1000 h-[20%] group-hover:bg-rose-400"></div>
                    </div>
                    <span className="text-xs font-bold text-rose-400 uppercase">Critical (2)</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-amber-500/20 rounded-t-lg relative group">
                      <div className="absolute bottom-0 w-full bg-amber-500 rounded-t-lg transition-all duration-1000 h-[60%] group-hover:bg-amber-400"></div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 uppercase">Warning (8)</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full bg-cyan-500/20 rounded-t-lg relative group">
                      <div className="absolute bottom-0 w-full bg-cyan-500 rounded-t-lg transition-all duration-1000 h-[40%] group-hover:bg-cyan-400"></div>
                    </div>
                    <span className="text-xs font-bold text-cyan-400 uppercase">Minor (5)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
              <h3 className="text-white font-bold mb-6 text-xl">Recent Compliance Scans</h3>
              <div className="space-y-4">
                {analyticsData.recentScans.length === 0 ? (
                  <div className="text-center text-slate-500 py-4">No recent scans.</div>
                ) : analyticsData.recentScans.map((scan, i) => {
                  const date = new Date(scan.createdAt).toLocaleString();
                  const color = scan.status === 'Completed' ? 'text-emerald-400' : scan.status === 'Failed' ? 'text-rose-400' : 'text-amber-400';
                  return (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-800 rounded-lg"><svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg></div>
                        <div>
                          <p className="font-bold text-white">{date}</p>
                          <p className="text-xs text-slate-400">{scan.pagesScanned} Pages Scanned</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${color}`}>{scan.issuesFound} Issues Found</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{scan.status}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB: TEAM ACTIVITY (REAL MONGODB DATA) --- */}
        {activeTab === 'team' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900/40 p-8 rounded-3xl border border-slate-800 backdrop-blur-md">
              <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">Live Activity Feed (MongoDB) <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span></h3>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
                {activityFeed.length === 0 ? (
                  <div className="text-center text-slate-500 py-10">Waiting for MongoDB connection...</div>
                ) : activityFeed.map((feed, i) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-900 text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={feed.icon || "M13 10V3L4 14h7v7l9-11h-7z"}></path></svg>
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm transition-transform hover:-translate-y-1">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-white">{feed.user}</div>
                        <time className="text-xs font-medium text-indigo-400">{feed.time}</time>
                      </div>
                      <div className="text-sm text-slate-400">{feed.action} <span className="text-fuchsia-400 font-bold">{feed.target}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-bold text-white">Team Directory</h3>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-bold shadow-sm">{teamMembers.length} Members</span>
              </div>
              {teamMembers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm border border-slate-800 rounded-2xl bg-slate-900/30">
                  <p className="font-bold text-rose-400 mb-2">MongoDB Disconnected</p>
                  Check Database Credentials
                </div>
              ) : teamMembers.map((member, i) => (
                <div key={i} className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md flex items-center gap-4 hover:border-slate-600 transition-colors group cursor-pointer">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform relative`}>
                    {member.avatar}
                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${member.status === 'Online' ? 'bg-emerald-500' : member.status === 'Offline' ? 'bg-slate-500' : 'bg-amber-500'}`}></div>
                  </div>
                  <div>
                    <h4 className="text-white font-bold group-hover:text-indigo-400 transition-colors">{member.name}</h4>
                    <p className="text-xs text-slate-400">{member.role}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">{member.status}</p>
                  </div>
                </div>
              ))}
              <button onClick={() => setShowInviteModal(true)} className="w-full py-4 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-bold transition-colors flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg> Invite Member
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: COMPLIANCE SYSTEM --- */}
        {activeTab === 'compliance' && (
          <div className="animate-fade-in space-y-8">
            <div className="flex justify-between items-center bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse"></div>
                  Compliance Engine
                </h2>
                <p className="text-slate-400 mt-1">Automated AI compliance checks against official guidelines</p>
              </div>
              <button 
                onClick={runVerification} 
                disabled={compLoading} 
                className={`px-8 py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-3 ${compLoading ? 'bg-indigo-900 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 shadow-indigo-500/25 active:scale-[0.98]'}`}
              >
                {compLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                )}
                {compLoading ? 'Running Analysis...' : 'Run Pipeline Check'}
              </button>
            </div>

            {/* Live Pipeline Stepper */}
            {(compLoading || pipelineStep > 0) && (
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl transition-all duration-500">
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 -z-10"></div>
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500 -z-10 transition-all duration-1000 ease-in-out`} style={{width: `${(pipelineStep - 1) * 33.33}%`}}></div>
                  
                  {['Initializing AI Agent', 'Extracting Live UI (Playwright)', 'Gemini LLM Verification', 'Finalizing Report'].map((text, idx) => {
                    const stepNum = idx + 1;
                    const isActive = pipelineStep === stepNum;
                    const isDone = pipelineStep > stepNum;
                    return (
                      <div key={idx} className="flex flex-col items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${isDone ? 'bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]' : isActive ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                          {isDone ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> : stepNum}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-indigo-300' : isDone ? 'text-fuchsia-300' : 'text-slate-600'}`}>{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {compError && <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium">{compError}</div>}

            {coverage && pipelineStep === 4 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                <div className="lg:col-span-1 bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-xl h-full flex flex-col justify-center">
                  <h3 className="text-xl font-bold text-white mb-6 text-center">Coverage Pulse</h3>
                  <div className="flex justify-center mb-6">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-emerald-500" strokeDasharray={`${(coverage.successful_routes.length / coverage.total_routes_discovered) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-extrabold text-white">{Math.round((coverage.successful_routes.length / coverage.total_routes_discovered) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Total Extracted</span><span className="font-bold text-white">{coverage.total_routes_discovered}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Success</span><span className="font-bold text-emerald-400">{coverage.successful_routes.length}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-slate-400">Retries Needed</span><span className="font-bold text-amber-400">{coverage.retries}</span></div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                      Detected Discrepancies
                      <span className="px-3 py-1 bg-slate-800 text-white text-sm rounded-full border border-slate-700 shadow-sm">{discrepancies.length}</span>
                    </h3>
                    <div className="flex bg-slate-900/50 p-1 rounded-xl border border-slate-800">
                      {['All', 'Critical', 'Warning', 'Minor'].map(sev => (
                        <button 
                          key={sev} 
                          onClick={() => setFilterSeverity(sev)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterSeverity === sev ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                        >
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredDiscrepancies.length === 0 ? (
                      <div className="col-span-full py-10 text-center text-slate-500">No {filterSeverity !== 'All' ? filterSeverity.toLowerCase() : ''} discrepancies found.</div>
                    ) : (
                      filteredDiscrepancies.map((disc, idx) => {
                        const severityColors = {
                          'Critical': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                          'Warning': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                          'Minor': 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                        };
                        const sevColor = severityColors[disc.severity] || 'bg-slate-800 text-slate-400 border-slate-700';

                        return (
                          <div key={idx} className="bg-slate-900/60 rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden backdrop-blur-lg flex flex-col">
                            <div className="p-6 flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">{disc.page_url}</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sevColor}`}>{disc.severity || 'Unknown'}</span>
                              </div>
                              <h4 className="text-lg font-bold text-white mb-2 leading-tight">{disc.guideline_reference}</h4>
                              <p className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-4">{disc.discrepancy_reason}</p>
                              
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Expected Guideline</p>
                                  <p className="text-xs text-slate-300">{disc.expected_text_content || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Actual Live State</p>
                                  <p className="text-xs text-slate-300">{disc.actual_text_content || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                            {disc.screenshot_path && (
                              <div className="border-t border-slate-800 bg-slate-950 p-4 relative group">
                                <img src={`http://localhost:5001/screenshots/${disc.screenshot_path}`} alt="Screenshot" className="w-full h-32 object-cover object-top rounded-lg border border-slate-800 opacity-70 group-hover:opacity-100 transition-opacity" onError={(e) => { e.target.style.display = 'none'; }} />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <span className="bg-black/80 text-white text-xs px-3 py-1.5 rounded-full font-bold backdrop-blur-sm">View Evidence</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* RAG QA Agent Chatbot */}
            <div className="mt-8 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px] backdrop-blur-xl">
              <div className="bg-indigo-600/20 border-b border-indigo-500/30 p-5 flex items-center gap-4">
                <div className="p-3 bg-indigo-500/20 rounded-xl">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Compliance QA Agent</h3>
                  <p className="text-indigo-300 text-xs mt-1">RAG-powered conversational engine referencing official guidelines</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatLog.length === 0 ? (
                  <div className="text-center text-slate-500 mt-10 text-sm flex flex-col items-center gap-4">
                    <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    Ask me anything about the guidelines or the generated report.
                  </div>
                ) : (
                  chatLog.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'}`}>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-indigo-400 text-sm px-6 py-4 rounded-2xl rounded-bl-none border border-slate-700 flex gap-2 items-center w-24">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="p-5 bg-slate-900 border-t border-slate-800 flex gap-3">
                <input type="text" className="flex-1 px-5 py-4 bg-slate-800 border border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-white placeholder-slate-500 transition-all shadow-inner" placeholder="Ask the QA agent..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={chatLoading} />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95">Send</button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB 4: NOTES --- */}
        {activeTab === 'notes' && (
          <div className="animate-fade-in">
            {notesError && <div className="p-4 mb-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium backdrop-blur-sm">{notesError}</div>}
            
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-white">Your Notes</h2>
              <button onClick={() => setShowForm(!showForm)} className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all">
                {showForm ? "Close Editor" : "+ Create Note"}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleNoteSubmit} className="bg-slate-900/50 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-slate-700/50 mb-10 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1">Note Title</label>
                  <input required placeholder="Give your note a title..." className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1">Content</label>
                  <textarea required rows={5} placeholder="Write your thoughts here..." className="w-full px-4 py-3.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}></textarea>
                </div>
                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-700/50">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700">Cancel</button>
                  <button type="submit" className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold shadow-lg shadow-emerald-500/20">Save Note</button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.length === 0 && !showForm && (
                <div className="col-span-full py-20 text-center text-slate-500">No notes yet. Click 'Create Note' to add one.</div>
              )}
              {notes.map(note => (
                <div key={note._id} className="group bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/60 hover:-translate-y-1 transition-all flex flex-col h-full">
                  <h3 className="text-xl font-bold text-white mb-3">{note.title}</h3>
                  <p className="text-slate-400 mb-6 flex-grow whitespace-pre-wrap">{note.content}</p>
                  <div className="flex justify-between items-center pt-4 border-t border-slate-700/50">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      {new Date(note.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => editNoteItem(note)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg">Edit</button>
                      <button onClick={() => handleDeleteNote(note._id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg">Del</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-fade-in">
            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <h3 className="text-2xl font-bold text-white mb-2">Invite Team Member</h3>
            <p className="text-slate-400 text-sm mb-6">Send an invitation to join your workspace and collaborate.</p>
            
            {inviteSuccess ? (
              <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl text-center font-bold">
                Invitation sent successfully!
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    required 
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-white transition-all"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]">
                  Send Invitation
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
