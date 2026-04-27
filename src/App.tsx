/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  setDoc,
  where,
  updateDoc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { Family, FamilyMember, AppUser, PublicNotice } from './types';
import { MARATHI_LABELS, RELATIONSHIPS, BLOOD_GROUPS } from './constants';
import { 
  Plus, Trash2, Search, Users, Home, Phone, MapPin, 
  Save, ArrowLeft, LogIn, Award, 
  CheckCircle, Clock, XCircle, LogOut,
  FileText, Shield, ShieldCheck, Lock, Unlock, RefreshCw, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types & Helpers ---
enum View {
  LANDING,
  LOGIN,
  DASHBOARD,
  FORM,
  NOTICES,
  USERS
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [view, setView] = useState<View>(View.LANDING);
  const [families, setFamilies] = useState<Family[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Form States
  const [formData, setFormData] = useState<Partial<Family>>({
    status: 'PENDING',
    members: [],
    agriculture: { landAcres: '', crops: '' }
  });
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [newMember, setNewMember] = useState<Partial<FamilyMember>>({
    relation: RELATIONSHIPS[0],
    gender: 'पुरुष',
    bloodGroup: BLOOD_GROUPS[0]
  });

  // Mock Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // User Management State
  const [newUser, setNewUser] = useState<Partial<AppUser>>({ role: 'STAFF' });
  const [staffPass, setStaffPass] = useState('');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    // Families listener
    const qF = query(collection(db, 'families'), orderBy('registeredAt', 'desc'));
    const unsubF = onSnapshot(qF, (snapshot) => {
      setFamilies(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Family)));
      setLoading(false);
    });

    // Notices listener
    const qN = query(collection(db, 'notices'), where('isActive', '==', true), orderBy('date', 'desc'));
    const unsubN = onSnapshot(qN, (snapshot) => {
      setNotices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PublicNotice)));
    });

    // Users listener (only for Admins)
    let unsubU = () => {};
    let unsubL = () => {};
    if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') {
      const qU = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubU = onSnapshot(qU, (snapshot) => {
        setAppUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)));
      });

      if (currentUser?.role === 'SUPER_ADMIN') {
        const qL = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
        unsubL = onSnapshot(qL, (snapshot) => {
          setActivityLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
      }
    }

    return () => { unsubF(); unsubN(); unsubU(); unsubL(); };
  }, [currentUser]);

  // --- Handlers ---
  const handleLogin = async () => {
    // Hardcoded Master Admin for initial setup
    if (loginEmail === 'admin' && loginPass === 'admin123') {
      const masterAdmin: AppUser = {
        uid: 'master-admin',
        email: 'admin',
        fullName: 'मुख्य प्रशासक (Super Admin)',
        role: 'SUPER_ADMIN',
        createdAt: Date.now()
      };
      setCurrentUser(masterAdmin);
      setView(View.DASHBOARD);
      return;
    }

    try {
      const userRef = collection(db, 'users');
      const q = query(userRef, where('email', '==', loginEmail));
      const res = await getDocs(q);
      
      if (res.empty) {
        alert('युजर सापडला नाही!');
        return;
      }

      const userData = res.docs[0].data() as any;
      
      if (userData.isLocked) {
        alert('तुमचे खाते लॉक केले आहे. कृपया मुख्य प्रशासकाशी संपर्क साधा.');
        return;
      }

      if (userData.password === loginPass) {
        const user = { uid: res.docs[0].id, ...userData } as AppUser;
        if (user.forceReset) {
          const newPass = prompt('सुरक्षेसाठी तुमचा पासवर्ड बदला:');
          if (newPass) {
            await updateDoc(doc(db, 'users', user.uid), { 
              password: newPass, 
              forceReset: false 
            });
            alert('पासवर्ड यशस्वीरित्या बदलला. कृपया नवीन पासवर्डने पुन्हा लॉगिन करा.');
            return;
          }
        }
        setCurrentUser(user);
        setView(View.DASHBOARD);
      } else {
        alert('चुकीचा पासवर्ड!');
      }
    } catch (e) {
      console.error(e);
      alert('लॉगिन करताना त्रुटी आली.');
    }
  };

  const registerStaff = async () => {
    if (!newUser.fullName || !newUser.email || !staffPass) {
      alert('कृपया सर्व माहिती भरा!');
      return;
    }

    try {
      // Manual creation in 'users' collection
      const userDocRef = doc(collection(db, 'users'));
      await setDoc(userDocRef, {
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role || 'STAFF',
        password: staffPass, // Note: In production, never store plain text passwords
        createdAt: Date.now()
      });
      alert('स्टाफ नोंदणी यशस्वी!');
      setNewUser({ role: 'STAFF' });
      setStaffPass('');
    } catch (e) {
      console.error(e);
      alert('नोंदणी करताना त्रुटी आली.');
    }
  };

  const logActivity = async (action: string, target: string, details?: string) => {
    try {
      await addDoc(collection(db, 'logs'), {
        action,
        performedBy: currentUser?.fullName || 'Master Admin',
        performedByUid: currentUser?.uid || 'master-admin',
        targetUser: target,
        timestamp: Date.now(),
        details
      });
    } catch (e) {
      console.error('Log error:', e);
    }
  };

  const updateUserInfo = async (uid: string, data: Partial<AppUser>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
      await logActivity('USER_UPDATE', uid, JSON.stringify(data));
      alert('बदल यशस्वीरित्या जतन केले!');
      setEditingUser(null);
      setNewPassword('');
    } catch (e) {
      console.error(e);
      alert('अपडेट करताना त्रुटी आली.');
    }
  };

  const deleteUser = async (uid: string) => {
    if(!confirm('हा युजर हटवायचा आहे का?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      await logActivity('USER_DELETE', uid);
    } catch (e) {
      console.error(e);
      alert('युजर हटवताना त्रुटी आली.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSearchTerm('');
    setView(View.LANDING);
  };

  const saveFamily = async () => {
    if (!formData.headName || !formData.mobile) {
      alert('कृपया कुटुंब प्रमुखाचे नाव आणि मोबाईल नंबर भरा!');
      return;
    }

    try {
      const data = {
        ...formData,
        registeredBy: currentUser?.uid || 'guest',
        registeredAt: Date.now(),
        updatedAt: Date.now(),
        status: 'PENDING'
      };
      await addDoc(collection(db, 'families'), data);
      alert(MARATHI_LABELS.SUCCESS_MSG);
      setView(currentUser ? View.DASHBOARD : View.LANDING);
      setFormData({ status: 'PENDING', members: [], agriculture: { landAcres: '', crops: '' } });
    } catch (e) {
      console.error(e);
    }
  };

  const approveFamily = async (id: string) => {
    await updateDocStatus(id, 'APPROVED');
  };

  const rejectFamily = async (id: string) => {
    await updateDocStatus(id, 'REJECTED');
  };

  const updateDocStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const docRef = doc(db, 'families', id);
      await setDoc(docRef, { status, updatedAt: Date.now() }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteFamily = async (id: string) => {
    if(!confirm('नोंदणी हटवायची आहे का?')) return;
    try {
      await deleteDoc(doc(db, 'families', id));
    } catch (e) { console.error(e); }
  };

  // --- Render Helpers ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold"><CheckCircle size={14}/> {MARATHI_LABELS.STATUS_APPROVED}</span>;
      case 'REJECTED': return <span className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-bold"><XCircle size={14}/> {MARATHI_LABELS.STATUS_REJECTED}</span>;
      default: return <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-bold"><Clock size={14}/> {MARATHI_LABELS.STATUS_PENDING}</span>;
    }
  };

  // --- Main Render ---
  
  if (view === View.LANDING) {
    return (
      <div className="min-h-screen phule-gradient flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl bg-white/95 backdrop-blur-md rounded-[48px] p-10 shadow-2xl border-4 border-white"
        >
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/e/e0/Mahatma_Jyotirao_Phule.jpg" 
            alt="Mahatma Phule"
            className="w-40 h-40 mx-auto rounded-full border-8 border-primary object-cover mb-8 shadow-xl"
          />
          <h1 className="text-4xl font-extrabold text-secondary mb-4">
            {MARATHI_LABELS.APP_TITLE}
          </h1>
          <p className="text-slate-600 italic mb-8 text-lg font-medium leading-relaxed px-4">
            "{MARATHI_LABELS.PHULE_QUOTE}"
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setView(View.LOGIN)}
              className="green-btn flex items-center justify-center gap-2 py-4 px-10 text-lg"
            >
              <LogIn size={22} /> {MARATHI_LABELS.LOGIN}
            </button>
            <button 
              onClick={() => setView(View.FORM)}
              className="yellow-btn flex items-center justify-center gap-2 py-4 px-10 text-lg"
            >
              <Plus size={22} /> {MARATHI_LABELS.REGISTER_FAMILY}
            </button>
          </div>
        </motion.div>
        
        {notices.length > 0 && (
          <div className="mt-12 w-full max-w-xl">
             <div className="bg-white/20 p-6 rounded-3xl backdrop-blur-sm border border-white/30 text-white text-left">
                <h3 className="flex items-center gap-2 font-bold mb-3"><Award size={20}/> नवीन घोषणा</h3>
                <div className="space-y-2">
                  {notices.map(n => (
                    <div key={n.id} className="text-sm bg-white/10 p-3 rounded-xl">
                      <strong>{n.title}</strong>
                      <p className="opacity-80">{n.content}</p>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  if (view === View.LOGIN) {
    return (
      <div className="min-h-screen phule-gradient flex items-center justify-center p-6">
        <motion.div className="w-full max-w-md bg-white rounded-[40px] p-12 text-center shadow-2xl">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award size={40} className="text-secondary" />
          </div>
          <h2 className="text-3xl font-black text-secondary mb-8">{MARATHI_LABELS.LOGIN}</h2>
          <div className="space-y-4">
            <div className="text-left space-y-1">
              <label className="text-xs font-bold text-slate-400 ml-4 uppercase">युजर आयडी</label>
              <input 
                type="text" placeholder="उदा. admin" 
                className="w-full border-none bg-slate-100 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="text-left space-y-1">
              <label className="text-xs font-bold text-slate-400 ml-4 uppercase">पासवर्ड</label>
              <input 
                type="password" placeholder="••••••••" 
                className="w-full border-none bg-slate-100 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                value={loginPass} onChange={e => setLoginPass(e.target.value)}
              />
            </div>
            <button 
              onClick={handleLogin}
              className="w-full green-btn py-4 text-xl mt-6"
            >
              प्रवेश करा
            </button>
            <button 
              onClick={() => setView(View.LANDING)}
              className="text-slate-400 font-bold hover:text-secondary mt-6 flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft size={18}/> मागे जा
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDF8]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b-4 border-primary px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView(View.LANDING)}>
          <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
            म
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-secondary tracking-tight">
              {MARATHI_LABELS.APP_TITLE}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {currentUser && (
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase mb-1">
                {currentUser.role}
              </span>
              <span className="text-sm font-black text-slate-800">{currentUser.fullName}</span>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        <AnimatePresence mode="wait">
          {view === View.DASHBOARD && (
            <motion.div initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} key="dashboard" className="space-y-10">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="card-rounded p-8 bg-secondary text-white transform hover:scale-105 transition-transform">
                  <p className="text-xs font-bold opacity-70 uppercase mb-2">एकूण कुटुंबे</p>
                  <p className="text-5xl font-black">{families.length}</p>
                </div>
                <div className="card-rounded p-8 bg-white border-b-8 border-green-500 shadow-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">मंजूर</p>
                  <p className="text-5xl font-black text-green-600">
                    {families.filter(f => f.status === 'APPROVED').length}
                  </p>
                </div>
                <div className="card-rounded p-8 bg-white border-b-8 border-amber-500 shadow-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">प्रलंबित</p>
                  <p className="text-5xl font-black text-amber-600">
                    {families.filter(f => f.status === 'PENDING').length}
                  </p>
                </div>
                <button 
                  onClick={() => setView(View.FORM)}
                  className="yellow-btn h-full flex flex-col items-center justify-center gap-2 p-8 shadow-2xl"
                >
                  <Plus size={40} />
                  <span className="text-lg">{MARATHI_LABELS.REGISTER_FAMILY}</span>
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="flex-1 bg-white card-rounded px-8 py-5 flex items-center gap-4 w-full shadow-md border-2 border-slate-50">
                  <Search className="text-slate-300" size={24}/>
                  <input 
                    placeholder={MARATHI_LABELS.SEARCH}
                    className="flex-1 outline-none text-slate-700 bg-transparent text-lg"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                  {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`flex-1 md:flex-none px-6 py-4 rounded-3xl text-sm font-black transition-all whitespace-nowrap ${
                        filterStatus === s ? 'bg-secondary text-white shadow-lg' : 'bg-white text-slate-400 border-2 border-slate-50 shadow-sm'
                      }`}
                    >
                      {s === 'ALL' ? 'सर्व' : s}
                    </button>
                  ))}
                  {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') && (
                    <button 
                      onClick={() => setView(View.USERS)}
                      className="flex-1 md:flex-none px-6 py-4 rounded-3xl text-sm font-black bg-primary text-secondary shadow-lg whitespace-nowrap"
                    >
                      युजर मॅनेजमेंट
                    </button>
                  )}
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {families
                  .filter(f => filterStatus === 'ALL' || f.status === filterStatus)
                  .filter(f => f.headName.toLowerCase().includes(searchTerm.toLowerCase()) || f.mobile.includes(searchTerm))
                  .map(family => (
                    <div key={family.id} className="card-rounded overflow-hidden group hover:shadow-2xl transition-all border-2 border-white">
                      <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                          <h3 className="text-xl font-black text-slate-900 border-l-8 border-primary pl-4 leading-tight">{family.headName}</h3>
                          {getStatusBadge(family.status)}
                        </div>
                        <div className="space-y-4 text-sm text-slate-500 font-bold">
                          <p className="flex items-center gap-3 text-slate-800"><Home size={18} className="text-primary"/> {family.village}, {family.taluka}</p>
                          <p className="flex items-center gap-3"><Phone size={18} className="text-primary"/> {family.mobile}</p>
                          <p className="flex items-center gap-3"><Users size={18} className="text-primary"/> {family.members.length + 1} सदस्य</p>
                          {family.agriculture?.landAcres && (
                            <div className="bg-green-50 p-3 rounded-2xl flex items-center gap-3 text-secondary border border-green-100">
                               <FileText size={20}/>
                               <span>{family.agriculture.landAcres} एकर • {family.agriculture.crops}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex border-t-2 border-slate-50">
                        { (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') && family.status === 'PENDING' ? (
                          <>
                            <button 
                              onClick={() => approveFamily(family.id)}
                              className="flex-1 py-5 bg-green-50 text-green-600 font-black hover:bg-green-100 transition-colors"
                            >
                              मंजूर करा
                            </button>
                            <button 
                              onClick={() => rejectFamily(family.id)}
                              className="flex-1 py-5 bg-red-50 text-red-600 font-black hover:bg-red-100 transition-colors"
                            >
                              फेटाळा
                            </button>
                          </>
                        ) : (
                          <div className="flex w-full">
                            <button className="flex-1 py-5 bg-slate-50 text-secondary font-black hover:bg-slate-100 transition-colors">तपशील पहा</button>
                            {(currentUser?.role === 'SUPER_ADMIN') && (
                              <button onClick={()=>deleteFamily(family.id)} className="px-6 py-5 bg-red-50 text-red-400 hover:text-red-600 border-l border-slate-100"><Trash2 size={20}/></button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                ))}
              </div>
              
              {families.length === 0 && (
                <div className="text-center py-20 card-rounded bg-white">
                  <Users size={64} className="mx-auto text-slate-200 mb-6" />
                  <p className="text-xl font-bold text-slate-400">{MARATHI_LABELS.NO_FAMILIES}</p>
                </div>
              )}
            </motion.div>
          )}

          {view === View.USERS && (
            <motion.div initial={{opacity:0, scale: 0.95}} animate={{opacity:1, scale: 1}} key="users" className="space-y-10">
               <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 card-rounded border-b-8 border-primary shadow-xl">
                 <div>
                   <h2 className="text-3xl font-black text-secondary">प्रशासकीय नियंत्रण केंद्र (Admin Control)</h2>
                   <p className="text-slate-400 font-bold mt-1">स्टाफ व्यवस्थापन, पासवर्ड आणि सुरक्षितता नियंत्रण.</p>
                 </div>
                 <div className="flex gap-2 mt-4 md:mt-0">
                   {currentUser?.role === 'SUPER_ADMIN' && (
                     <button 
                       onClick={() => setShowLogs(!showLogs)}
                       className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${showLogs ? 'bg-secondary text-white' : 'bg-slate-100 text-slate-600'}`}
                     >
                       <History size={20}/> {showLogs ? 'युजर लिस्ट पहा' : 'ऍक्टिव्हिटी लॉग'}
                     </button>
                   )}
                   <button onClick={() => setView(View.DASHBOARD)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><XCircle size={40}/></button>
                 </div>
               </div>

               {showLogs ? (
                 <div className="bg-white p-10 card-rounded shadow-xl">
                   <h3 className="text-xl font-black text-secondary mb-6 flex items-center gap-3">
                     <History className="text-primary"/> ऍक्टिव्हिटी लॉग (सुरक्षा ऑडिट)
                   </h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                       <thead>
                         <tr className="text-xs font-black text-slate-400 uppercase border-b-2 border-slate-50">
                           <th className="pb-4">वेळ</th>
                           <th className="pb-4">ऍक्शन</th>
                           <th className="pb-4">प्रशासक</th>
                           <th className="pb-4">Target User</th>
                           <th className="pb-4">तपशील</th>
                         </tr>
                       </thead>
                       <tbody className="text-sm font-bold text-slate-600">
                         {activityLogs.map(log => (
                           <tr key={log.id} className="border-b border-slate-50">
                             <td className="py-4 opacity-50">{new Date(log.timestamp).toLocaleString()}</td>
                             <td className="py-4"><span className="px-2 py-1 bg-slate-100 rounded-lg text-xs">{log.action}</span></td>
                             <td className="py-4">{log.performedBy}</td>
                             <td className="py-4 font-mono text-[10px]">{log.targetUser}</td>
                             <td className="py-4 text-xs italic">{log.details}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                       <div className="card-rounded p-10 bg-white shadow-xl space-y-6">
                          <h3 className="text-xl font-black text-secondary border-l-8 border-primary pl-4 uppercase">नवीन स्टाफ जोडा</h3>
                          <div className="space-y-4">
                             <input 
                               placeholder="पूर्ण नाव" 
                               className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none"
                               value={newUser.fullName || ''} onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                             />
                             <input 
                               placeholder="युजर आयडी (Email/Mobile)" 
                               className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none"
                               value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})}
                             />
                             <input 
                               type="password"
                               placeholder="पासवर्ड" 
                               className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none"
                               value={staffPass} onChange={e => setStaffPass(e.target.value)}
                             />
                             <select 
                               className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none appearance-none"
                               value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                             >
                                <option value="STAFF">Staff (नोंदणी कर्मचारी)</option>
                                <option value="ADMIN">Admin (प्रशासक)</option>
                             </select>
                             <button 
                               onClick={registerStaff}
                               className="w-full green-btn py-4 shadow-xl"
                             >
                               नोंदणी करा
                             </button>
                          </div>
                       </div>
                    </div>

                    <div className="lg:col-span-8">
                       <div className="card-rounded p-10 bg-white shadow-xl space-y-6">
                          <h3 className="text-xl font-black text-secondary border-l-8 border-primary pl-4 uppercase">नोंदणीकृत स्टाफ</h3>
                          <div className="grid grid-cols-1 gap-4">
                             {appUsers.map(u => (
                               <div key={u.uid} className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-slate-50 rounded-3xl border border-white gap-4">
                                  <div>
                                     <div className="flex items-center gap-2">
                                       <p className="font-black text-slate-900">{u.fullName}</p>
                                       {u.isLocked && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-full">LOCKED</span>}
                                     </div>
                                     <p className="text-xs font-bold text-slate-400">{u.email} • {u.role}</p>
                                  </div>
                                  <div className="flex gap-2">
                                     <button 
                                       onClick={() => setEditingUser(u)}
                                       className="p-3 bg-white text-slate-400 hover:text-primary rounded-2xl shadow-sm transition-colors"
                                       title="Edit Credentials"
                                     >
                                        <Shield size={20}/>
                                     </button>
                                     <button 
                                       onClick={() => deleteUser(u.uid)}
                                       className="p-3 bg-white text-red-100 hover:text-red-500 rounded-2xl shadow-sm transition-colors"
                                       title="Delete"
                                     >
                                        <Trash2 size={20}/>
                                     </button>
                                  </div>
                               </div>
                             ))}
                             {appUsers.length === 0 && <p className="text-center text-slate-300 py-10">युजर डेटा उपलब्ध नाही.</p>}
                          </div>
                       </div>
                    </div>
                 </div>
               )}
            </motion.div>
          )}

          {editingUser && (
            <div className="fixed inset-0 bg-secondary/80 z-[110] flex items-center justify-center p-6 backdrop-blur-md">
              <motion.div initial={{y: 20, opacity:0}} animate={{y:0, opacity:1}} className="bg-white w-full max-w-md rounded-[48px] p-10 shadow-2xl space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-2xl font-black text-secondary">युजर कंट्रोल</h4>
                    <p className="text-slate-400 font-bold">{editingUser.fullName}</p>
                  </div>
                  <button onClick={() => setEditingUser(null)}><XCircle size={32} className="text-slate-200"/></button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">नवीन पासवर्ड (कोरा ठेवा जर बदलायचा नसेल)</label>
                    <input 
                      type="password"
                      className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => updateUserInfo(editingUser.uid, { isLocked: !editingUser.isLocked })}
                      className={`flex flex-col items-center gap-2 p-4 rounded-[32px] font-black transition-all ${editingUser.isLocked ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}
                    >
                      {editingUser.isLocked ? <Unlock size={24}/> : <Lock size={24}/>}
                      <span className="text-xs">{editingUser.isLocked ? 'अनलिंक करा' : 'खाते लॉक करा'}</span>
                    </button>

                    <button 
                      onClick={() => updateUserInfo(editingUser.uid, { forceReset: true })}
                      className="flex flex-col items-center gap-2 p-4 bg-amber-50 text-amber-600 rounded-[32px] font-black"
                    >
                      <RefreshCw size={24}/>
                      <span className="text-xs">पासवर्ड रिसेट</span>
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      if(newPassword) updateUserInfo(editingUser.uid, { password: newPassword });
                      else alert('कृपया पासवर्ड भरा!');
                    }}
                    className="w-full py-4 bg-secondary text-white rounded-[32px] font-black shadow-xl"
                  >
                    पासवर्ड जतन करा
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {view === View.FORM && (
            <motion.div initial={{opacity:0, scale: 0.95}} animate={{opacity:1, scale: 1}} key="form" className="max-w-4xl mx-auto space-y-10 pb-32">
              <div className="flex justify-between items-center bg-white p-8 card-rounded border-b-8 border-primary shadow-xl">
                <div>
                  <h2 className="text-3xl font-black text-secondary">{MARATHI_LABELS.REGISTER_FAMILY}</h2>
                  <p className="text-slate-400 font-bold mt-1">सर्व समाविष्ट माहिती समाजाच्या हितासाठी वापरली जाईल.</p>
                </div>
                <button onClick={() => setView(currentUser ? View.DASHBOARD : View.LANDING)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><XCircle size={40}/></button>
              </div>

              <div className="space-y-8">
                {/* Section 1: Head */}
                <div className="card-rounded p-10 bg-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-secondary"><Home size={24} className="text-primary"/> १. कुटुंब प्रमुख माहिती</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 ml-4 uppercase tracking-widest">{MARATHI_LABELS.HEAD_NAME}</label>
                      <input 
                        className="w-full bg-slate-50 border-none rounded-2xl p-5 font-bold focus:ring-4 focus:ring-primary/20 outline-none transition-shadow"
                        value={formData.headName || ''} onChange={e => setFormData({...formData, headName: e.target.value})}
                        placeholder="उदा. विजय रामचंद्र माळी"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-400 ml-4 uppercase tracking-widest">{MARATHI_LABELS.CONTACT}</label>
                      <input 
                        type="tel"
                        className="w-full bg-slate-50 border-none rounded-2xl p-5 font-bold focus:ring-4 focus:ring-primary/20 outline-none transition-shadow"
                        value={formData.mobile || ''} onChange={e => setFormData({...formData, mobile: e.target.value})}
                        placeholder="+91 9XXXX XXXXX"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Village & Location */}
                <div className="card-rounded p-10 bg-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary"></div>
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-secondary"><MapPin size={24} className="text-primary"/> २. गाव आणि पत्ता</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <input placeholder={MARATHI_LABELS.VILLAGE} className="bg-slate-50 rounded-2xl p-5 font-bold outline-none border-2 border-transparent focus:border-primary" value={formData.village || ''} onChange={e => setFormData({...formData, village: e.target.value})}/>
                    <input placeholder={MARATHI_LABELS.TALUKA} className="bg-slate-50 rounded-2xl p-5 font-bold outline-none border-2 border-transparent focus:border-primary" value={formData.taluka || ''} onChange={e => setFormData({...formData, taluka: e.target.value})}/>
                    <input placeholder={MARATHI_LABELS.DISTRICT} className="bg-slate-50 rounded-2xl p-5 font-bold outline-none border-2 border-transparent focus:border-primary" value={formData.district || ''} onChange={e => setFormData({...formData, district: e.target.value})}/>
                    <div className="md:col-span-3">
                      <textarea placeholder={MARATHI_LABELS.ADDRESS} className="w-full bg-slate-50 rounded-2xl p-5 font-bold outline-none h-32 border-2 border-transparent focus:border-primary" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})}/>
                    </div>
                  </div>
                </div>

                {/* Section 3: Agriculture */}
                <div className="card-rounded p-10 bg-green-50 border-2 border-green-200 shadow-xl border-dashed">
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-green-700"><Award size={24}/> ३. शेती माहिती</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-green-400 ml-4 uppercase tracking-widest">{MARATHI_LABELS.AGRI_LAND}</label>
                      <input placeholder="उदा. २.५" className="w-full bg-white rounded-2xl p-5 font-bold outline-none shadow-sm" value={formData.agriculture?.landAcres || ''} onChange={e => setFormData({...formData, agriculture: {...formData.agriculture!, landAcres: e.target.value}})}/>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-black text-green-400 ml-4 uppercase tracking-widest">{MARATHI_LABELS.AGRI_CROPS}</label>
                      <input placeholder="उदा. ऊस, सोयाबीन, कांदा" className="w-full bg-white rounded-2xl p-5 font-bold outline-none shadow-sm" value={formData.agriculture?.crops || ''} onChange={e => setFormData({...formData, agriculture: {...formData.agriculture!, crops: e.target.value}})}/>
                    </div>
                  </div>
                </div>

                {/* Section 4: Members */}
                <div className="card-rounded p-10 bg-amber-50/20 border-2 border-slate-100 shadow-xl">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black flex items-center gap-3 text-secondary"><Users size={24} className="text-primary"/> ४. इतर सदस्य माहिती</h3>
                    <button onClick={() => setShowMemberForm(true)} className="yellow-btn px-6 py-3 flex items-center gap-2"><Plus size={18}/> सदस्य जोडा</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formData.members?.map((m, idx) => (
                      <div key={idx} className="bg-white p-6 rounded-[28px] border-2 border-white shadow-md flex justify-between items-center group transform hover:-translate-y-1 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary font-black">{idx + 1}</div>
                           <div>
                              <p className="font-black text-slate-900">{m.firstName} {m.lastName}</p>
                              <p className="text-xs font-bold text-slate-400 mt-0.5">{m.relation} • {m.age} वर्ष • {m.education}</p>
                           </div>
                        </div>
                        <button onClick={() => setFormData({...formData, members: formData.members?.filter((_, i) => i !== idx)})} className="p-3 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                           <Trash2 size={20}/>
                        </button>
                      </div>
                    ))}
                    {formData.members?.length === 0 && (
                      <div className="md:col-span-2 text-center py-10 border-4 border-dashed border-slate-100 rounded-[32px] text-slate-300 font-bold italic">
                        अद्याप एकही सदस्य जोडलेला नाही.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submitting Actions */}
              <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md p-6 border-t shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex justify-center gap-6 z-[50]">
                <button 
                  onClick={() => setView(currentUser ? View.DASHBOARD : View.LANDING)} 
                  className="px-10 py-5 font-black text-slate-400 hover:text-slate-600 transition-colors"
                >
                  रद्द करा
                </button>
                <button 
                  onClick={saveFamily} 
                  className="green-btn px-20 py-5 text-xl shadow-2xl flex items-center gap-3"
                >
                  <Save size={24}/> नोंदणी पूर्ण करा
                </button>
              </div>

              {/* Member Modal */}
              {showMemberForm && (
                <div className="fixed inset-0 bg-secondary/80 flex items-center justify-center p-6 z-[100] backdrop-blur-md">
                  <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white rounded-[48px] p-12 max-w-lg w-full space-y-8 shadow-2xl relative">
                    <h4 className="text-2xl font-black text-secondary border-l-8 border-primary pl-4 tracking-tight">सदस्याची नवीन नोंदणी</h4>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">पहिले नाव</label>
                        <input className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary" value={newMember.firstName || ''} onChange={e => setNewMember({...newMember, firstName: e.target.value})}/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">आडनाव</label>
                        <input className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary" value={newMember.lastName || ''} onChange={e => setNewMember({...newMember, lastName: e.target.value})}/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">वय</label>
                        <input type="number" className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary" value={newMember.age || ''} onChange={e => setNewMember({...newMember, age: parseInt(e.target.value)})}/>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">नाते</label>
                        <select className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary appearance-none" value={newMember.relation} onChange={e => setNewMember({...newMember, relation: e.target.value})}>
                          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 space-y-1">
                         <label className="text-[10px] font-black text-slate-300 ml-4 uppercase">शिक्षण</label>
                         <input className="w-full bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-primary" value={newMember.education || ''} onChange={e => setNewMember({...newMember, education: e.target.value})}/>
                      </div>
                    </div>
                    
                    <div className="flex gap-4 pt-4">
                      <button 
                        className="flex-1 green-btn py-5 text-lg" 
                        onClick={() => {
                          if(!newMember.firstName || !newMember.lastName || !newMember.age) { alert('कृपया माहिती भरा!'); return; }
                          setFormData({...formData, members: [...formData.members!, {...newMember, id: Date.now().toString()} as FamilyMember]});
                          setShowMemberForm(false);
                          setNewMember({ relation: RELATIONSHIPS[0], gender: 'पुरुष', bloodGroup: BLOOD_GROUPS[0] });
                        }}
                      >
                        जतन करा
                      </button>
                      <button className="flex-1 bg-slate-100 rounded-full font-black text-slate-600 hover:bg-slate-200 transition-colors" onClick={() => setShowMemberForm(false)}>रद्द</button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
