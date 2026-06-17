import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, secondaryApp, auth } from '../firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

const ShieldIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>;

export default function SuperAdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', phone: '', password: '', type: 'Admin' });

  useEffect(() => { 
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchData();
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const qAdmins = query(collection(db, 'users'), where('role', '==', 'Admin'));
      const qUsers = query(collection(db, 'users'), where('role', '==', 'User'));
      
      const [adminSnap, userSnap] = await Promise.all([getDocs(qAdmins), getDocs(qUsers)]);
      
      setAdmins(adminSnap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
      setUsers(userSnap.docs.map(doc => ({ _id: doc.id, ...doc.data() })));
    } catch (err) { 
      setError("Failed to fetch records. Please ensure Firebase Firestore is accessible.");
    }
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
        const dataToUpdate = { name: formData.name, email: formData.email, phone: formData.phone, role: formData.type };
        await updateDoc(userRef, dataToUpdate);
      } else {
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        secondaryAuth.signOut();
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.type,
          createdAt: new Date().toISOString()
        });
      }
      
      setFormData({ id: '', name: '', email: '', phone: '', password: '', type: 'Admin' });
      setShowForm(false);
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id, type) => {
    if (!confirm(`Delete this ${type}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const editItem = (item, type) => {
    setFormData({ id: item._id, name: item.name, email: item.email, phone: item.phone, password: '', type });
    setShowForm(true);
  };

  const renderTable = (data, type) => {
    const filteredData = data.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.phone?.includes(searchTerm)
    );

    return (
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
          <h3 className="font-bold text-white text-lg flex items-center gap-3">
            {type === 'Admin' ? <span className="w-3 h-3 rounded-full bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.8)]"></span> : <span className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"></span>}
            {type}s Directory
          </h3>
          <span className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-full text-xs font-bold border border-slate-700 uppercase tracking-widest">{filteredData.length} Total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-5 font-semibold">User Details</th>
                <th className="p-5 font-semibold">Contact</th>
                <th className="p-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredData.length === 0 ? (
                 <tr><td colSpan="3" className="p-8 text-center text-slate-500 italic font-medium">No records found</td></tr>
              ) : filteredData.map((item) => (
                <tr key={item._id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:scale-110 transition-transform ${type === 'Admin' ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'}`}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-200 group-hover:text-white transition-colors">{item.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-mono">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          ID: {item._id.substring(0,6)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="text-slate-300 font-medium">{item.email}</div>
                    <div className="text-xs text-slate-500 mt-1 bg-slate-950 py-1 px-2 rounded inline-block font-mono">{item.phone}</div>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <button onClick={() => editItem(item, type)} className={`p-2 rounded-lg transition-colors shadow-sm ${type === 'Admin' ? 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-white border border-fuchsia-500/20' : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white border border-cyan-500/20'}`} title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button onClick={() => handleDelete(item._id, type)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500 hover:text-white border border-rose-500/20 transition-colors shadow-sm" title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans p-8 relative overflow-hidden text-slate-200">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl opacity-30 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/40 blur-[150px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Navbar */}
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <ShieldIcon />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tracking-tight">SuperAdmin</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Control Center</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-blue-400 rounded-full text-xs font-bold uppercase tracking-wider shadow-inner">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse"></span> System Online
            </div>
            <button onClick={handleLogout} className="px-6 py-2.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-xl font-bold text-slate-300 shadow-md transition-all">
              Secure Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shadow-sm flex items-center gap-3 font-medium backdrop-blur-sm">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 backdrop-blur-md relative overflow-hidden group hover:border-fuchsia-500/30 transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl group-hover:bg-fuchsia-500/20 transition-all"></div>
            <p className="text-fuchsia-400 font-bold uppercase text-xs tracking-widest mb-2 relative z-10">Total Admins</p>
            <h2 className="text-6xl font-black text-white relative z-10">{admins.length}</h2>
          </div>
          <div className="bg-slate-900/40 rounded-3xl p-8 border border-slate-800 backdrop-blur-md relative overflow-hidden group hover:border-cyan-500/30 transition-all">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <p className="text-cyan-400 font-bold uppercase text-xs tracking-widest mb-2 relative z-10">Total Users</p>
            <h2 className="text-6xl font-black text-white relative z-10">{users.length}</h2>
          </div>
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-500/20 flex flex-col justify-center items-center text-center cursor-pointer hover:from-blue-500 hover:to-indigo-500 transition-all group" onClick={() => {setShowForm(true); setFormData({ id: '', name: '', email: '', phone: '', password: '', type: 'Admin' })}}>
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform backdrop-blur-md">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </div>
            <p className="font-bold text-xl">Assign New Role</p>
            <p className="text-blue-200 text-sm mt-1">Create Admin or User</p>
          </div>
        </div>

        {/* Global Search */}
        <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 backdrop-blur-md mb-8">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search across all records..." 
              className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white font-medium placeholder-slate-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-slate-900/60 rounded-3xl p-8 mb-10 border border-slate-700/50 backdrop-blur-xl animate-fade-in shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                {formData.id ? 'Edit Profile' : 'Onboard New Member'}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors border border-slate-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {!formData.id && (
                <div className="md:col-span-2 mb-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assign Role Segment</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.type === 'Admin' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}>
                      <input type="radio" name="type" className="sr-only" value="Admin" checked={formData.type === 'Admin'} onChange={(e) => setFormData({...formData, type: e.target.value})} />
                      <span className="w-5 h-5 rounded-full border-2 border-current flex-shrink-0 flex items-center justify-center">{formData.type === 'Admin' && <span className="w-2.5 h-2.5 bg-current rounded-full"></span>}</span>
                      <span className="font-bold text-lg">Administrator</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.type === 'User' ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}>
                      <input type="radio" name="type" className="sr-only" value="User" checked={formData.type === 'User'} onChange={(e) => setFormData({...formData, type: e.target.value})} />
                      <span className="w-5 h-5 rounded-full border-2 border-current flex-shrink-0 flex items-center justify-center">{formData.type === 'User' && <span className="w-2.5 h-2.5 bg-current rounded-full"></span>}</span>
                      <span className="font-bold text-lg">Standard User</span>
                    </label>
                  </div>
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input required className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white font-medium transition-all" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="e.g. Acme Corp Worker" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <input required type="email" className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white font-medium transition-all" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} placeholder="email@company.com" disabled={!!formData.id} />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                <input required className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white font-medium transition-all" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="+1 (555) 000-0000" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Security Password</label>
                <input required={!formData.id} type="password" className="w-full p-4 bg-slate-800/50 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-white font-medium placeholder-slate-500 transition-all" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} placeholder={formData.id ? "Leave blank to keep unchanged" : "Secure password"} />
              </div>
              
              <div className="md:col-span-2 pt-6 flex gap-4 border-t border-slate-800 mt-2">
                <button type="submit" className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all">
                  {formData.id ? 'Save Changes' : `Deploy ${formData.type} Account`}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-bold transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tables */}
        <div className="flex flex-col gap-8">
          {loading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-64 bg-slate-900/40 rounded-3xl border border-slate-800"></div>
              <div className="h-64 bg-slate-900/40 rounded-3xl border border-slate-800"></div>
            </div>
          ) : (
            <>
              {renderTable(admins, 'Admin')}
              {renderTable(users, 'User')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
