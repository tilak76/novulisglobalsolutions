import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, secondaryApp, auth } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', phone: '', password: '' });

  useEffect(() => { 
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchData();
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      const qUsers = query(
        collection(db, 'users'), 
        where('role', '==', 'User'),
        where('createdBy', '==', currentUser.uid)
      );
      const userSnap = await getDocs(qUsers);
      setUsers(userSnap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (err) { setError("Permission error or connection issue."); }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!formData.id;

    try {
      if (isEdit) {
        const userRef = doc(db, 'users', formData.id);
        const dataToUpdate = { name: formData.name, email: formData.email, phone: formData.phone, role: 'User' };
        await updateDoc(userRef, dataToUpdate);
      } else {
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        secondaryAuth.signOut();
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: 'User',
          createdBy: auth.currentUser.uid,
          createdAt: new Date().toISOString()
        });
      }
      
      setFormData({ id: '', name: '', email: '', phone: '', password: '' });
      setShowForm(false);
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user? (Only profile data will be removed)')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const editItem = (item) => {
    setFormData({ id: item._id, name: item.name, email: item.email, phone: item.phone, password: '' });
    setShowForm(true);
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.phone?.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-950 font-sans p-8 relative overflow-hidden text-slate-200">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-teal-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Navbar */}
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 tracking-tight">AdminPanel</h1>
              <p className="text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Workspace Management</p>
            </div>
          </div>
          <button onClick={handleLogout} className="px-6 py-2.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl font-bold text-slate-300 transition-all flex items-center gap-2">
            Secure Logout
          </button>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium backdrop-blur-sm">{error}</div>
        )}

        {/* Dynamic Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 backdrop-blur-md relative overflow-hidden group hover:border-emerald-500/30 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <svg className="w-32 h-32 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <p className="text-emerald-400 font-bold uppercase text-xs tracking-widest mb-2 relative z-10">Users Managed By You</p>
            <h2 className="text-6xl font-black text-white relative z-10">{users.length}</h2>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20 flex flex-col justify-center items-center text-center cursor-pointer hover:from-emerald-500 hover:to-teal-500 transition-all" onClick={() => {setShowForm(true); setFormData({ id: '', name: '', email: '', phone: '', password: '' })}}>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </div>
            <p className="font-bold text-xl">Onboard New User</p>
            <p className="text-emerald-100 text-sm mt-1">Create a standard user account</p>
          </div>
        </div>

        {/* Global Search */}
        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 backdrop-blur-md mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search users dynamically by name or contact..." 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-white placeholder-slate-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Onboarding Form */}
        {showForm && (
          <div className="bg-slate-900/60 rounded-3xl p-8 mb-10 border border-slate-700/50 backdrop-blur-xl animate-fade-in shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </div>
              {formData.id ? 'Modify User Profile' : 'Link New User Account'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Identity</label>
                <input required className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. Rahul Kumar" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Record</label>
                <input required type="email" className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="user@domain.com" disabled={!!formData.id} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verified Contact</label>
                <input required className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="+91 000-000-0000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Access Key</label>
                <input required={!formData.id} type="password" className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-white font-medium placeholder-slate-500" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} placeholder={formData.id ? "•••••••• (Keep blank to skip)" : "••••••••"} />
              </div>
              <div className="md:col-span-2 flex gap-4 pt-4">
                <button type="submit" className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition-all">
                  {formData.id ? 'Apply Updates' : 'Authorize User Now'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold rounded-xl transition-all">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Main Listing */}
        <div className="bg-slate-900/40 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden backdrop-blur-md">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <h3 className="font-bold text-white text-lg">Connected User Directory</h3>
            <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold shadow-sm uppercase tracking-widest">{filteredUsers.length} Active</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-widest bg-slate-900">
                  <th className="px-8 py-6 font-semibold">Basic Info</th>
                  <th className="px-8 py-6 font-semibold">Communication</th>
                  <th className="px-8 py-6 font-semibold text-right">Settings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                   <tr><td colSpan="3" className="p-12 text-center text-emerald-400 font-bold animate-pulse tracking-widest uppercase">Fetching Vault Data...</td></tr>
                ) : filteredUsers.length === 0 ? (
                   <tr><td colSpan="3" className="p-12 text-center text-slate-500 font-medium italic">No users matching your dynamic search or ownership.</td></tr>
                ) : filteredUsers.map(item => (
                  <tr key={item._id} className="hover:bg-slate-800/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">{item.name}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-slate-300 font-medium tracking-tight">{item.email}</div>
                      <div className="text-slate-500 text-xs mt-1 font-mono bg-slate-950 py-1 px-2 rounded inline-block">{item.phone}</div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        <button onClick={() => editItem(item)} className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500 hover:text-white border border-emerald-500/20 hover:border-emerald-500 transition-all shadow-sm">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>
                        <button onClick={() => handleDelete(item._id)} className="p-3 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 transition-all shadow-sm">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
