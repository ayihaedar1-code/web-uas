import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  serverTimestamp,
} from 'firebase/firestore';
import { 
  BookOpen, 
  Users, 
  CheckCircle, 
  Trash2, 
  Edit, 
  LogOut, 
  ChevronRight, 
  Award,
  Printer,
  Lock,
  ArrowLeft,
  Plus,
  FileText,
  List,
  CalendarCheck,
  Calendar,
  Filter,
  CheckSquare,
  Send,
  GraduationCap
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDtwuaeeq648pNwo3n3faCY72AQu3UlBCA",
  authDomain: "web-uas-fd2ac.firebaseapp.com",
  projectId: "web-uas-fd2ac",
  storageBucket: "web-uas-fd2ac.firebasestorage.app",
  messagingSenderId: "685674947216",
  appId: "Web-uas"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Database Path Helper ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const getCollection = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocument = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

// --- Main Component ---
export default function CBTSystem() {
  // --- State Management ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  
  // Interaction States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [studentData, setStudentData] = useState({ name: '', nim: '' });
  const [attendanceSubjectId, setAttendanceSubjectId] = useState(''); // New: For Home Page Dropdown
  
  const [examAnswers, setExamAnswers] = useState({}); 
  const [currentScore, setCurrentScore] = useState(0);
  const [essayAnsweredCount, setEssayAnsweredCount] = useState(0);
  
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('subjects'); 
  
  // Attendance Features
  const [attendanceView, setAttendanceView] = useState('daily'); 
  const [filterDate, setFilterDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  // Form States for Admin
  const [newSubject, setNewSubject] = useState({ name: '', code: '', isActive: true });
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    text: '',
    type: 'choice', 
    options: ['', '', '', ''],
    correctIndex: 0
  });

  // --- Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  const fetchSubjects = async () => {
    if (!user) return;
    try {
        const snapshot = await getDocs(getCollection('subjects'));
        setSubjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Error fetching subjects:", e); }
  };

  const fetchQuestions = async (subjectId) => {
    if (!user || !subjectId) return;
    try {
        const snapshot = await getDocs(getCollection('questions'));
        const allQ = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setQuestions(allQ.filter(q => q.subjectId === subjectId));
    } catch (e) { console.error("Error fetching questions:", e); }
  };

  const fetchResults = async () => {
    if (!user) return;
    try {
        const snapshot = await getDocs(getCollection('results'));
        const resData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        resData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setResults(resData);
    } catch (e) { console.error("Error fetching results:", e); }
  };

  const fetchAttendance = async () => {
    if (!user) return;
    try {
        const snapshot = await getDocs(getCollection('attendance'));
        const attData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        attData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setAttendanceList(attData);
    } catch (e) { console.error("Error fetching attendance:", e); }
  };

  // --- Effects ---
  useEffect(() => {
    if (user) fetchSubjects();
  }, [user]);

  useEffect(() => {
    if (view === 'admin-dashboard') {
      if (activeTab === 'results') fetchResults();
      if (activeTab === 'attendance') fetchAttendance();
    }
  }, [view, activeTab]);

  // --- Helper for Weekly Attendance ---
  const getWeeklyAttendance = () => {
    const groups = {};
    attendanceList.forEach(att => {
        if (!att.timestamp) return;
        const date = new Date(att.timestamp.seconds * 1000);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(date);
        monday.setDate(diff);
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        const weekKey = `Minggu: ${monday.toLocaleDateString('id-ID', options)}`;
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(att);
    });
    return groups;
  };

  // --- Student Logic Handler ---

  // 1. QUICK ATTENDANCE (On Home Page)
  const handleQuickAttendance = async (e) => {
    e.preventDefault();
    if (!studentData.name || !studentData.nim || !attendanceSubjectId) {
        alert("Mohon lengkapi Nama, NIM, dan Mata Kuliah untuk absensi.");
        return;
    }

    const subject = subjects.find(s => s.id === attendanceSubjectId);
    if (!subject) return;

    try {
      await addDoc(getCollection('attendance'), {
        studentName: studentData.name,
        studentNIM: studentData.nim,
        subjectId: subject.id,
        subjectName: subject.name,
        timestamp: serverTimestamp(),
        status: 'Hadir'
      });
      alert(`✅ Absensi BERHASIL tercatat untuk mata kuliah: ${subject.name}`);
      setAttendanceSubjectId(''); // Reset subject selection only, keep name/nim for convenience
    } catch (err) {
      console.error("Gagal mencatat absensi", err);
      alert("Gagal mencatat absensi. Coba lagi.");
    }
  };

  // 2. Submit EXAM LOGIN (Start Exam)
  const handleExamStart = async (e) => {
    e.preventDefault();
    if (!studentData.name || !studentData.nim || !selectedSubject) return;

    const snapshot = await getDocs(getCollection('results'));
    const existing = snapshot.docs.find(d => {
      const data = d.data();
      return data.studentNIM === studentData.nim && data.subjectId === selectedSubject.id;
    });

    if (existing) {
      alert("Anda sudah mengerjakan ujian mata kuliah ini sebelumnya.");
      return;
    }

    await fetchQuestions(selectedSubject.id);
    setView('exam');
  };

  // 3. Submit EXAM ANSWERS
  const submitExam = async () => {
    if (!questions.length) return;

    let correctCount = 0;
    let essayCount = 0;

    questions.forEach(q => {
      if (q.type === 'essay') {
        essayCount++;
      } else {
        if (examAnswers[q.id] === q.correctIndex) correctCount++;
      }
    });

    const totalMcq = questions.length - essayCount;
    const mcqScore = totalMcq > 0 ? Math.round((correctCount / totalMcq) * 100) : 0;
    
    setCurrentScore(mcqScore);
    setEssayAnsweredCount(essayCount);

    try {
      await addDoc(getCollection('results'), {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        studentName: studentData.name,
        studentNIM: studentData.nim,
        mcqScore: mcqScore,
        totalQuestions: questions.length,
        mcqCorrect: correctCount,
        essayCount: essayCount,
        essayAnswers: examAnswers,
        timestamp: serverTimestamp()
      });
      setView('result');
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Gagal menyimpan jawaban. Silakan coba lagi.");
    }
  };

  // --- Admin Actions ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setView('admin-dashboard');
      fetchSubjects();
    } else {
      alert("Password salah!");
    }
  };

  const addSubject = async () => {
    if (!newSubject.name || !newSubject.code) return;
    await addDoc(getCollection('subjects'), newSubject);
    setNewSubject({ name: '', code: '', isActive: true });
    fetchSubjects();
  };

  const deleteSubject = async (id) => {
    if (confirm('Hapus mata kuliah ini?')) {
      await deleteDoc(getDocument('subjects', id));
      fetchSubjects();
    }
  };

  const saveQuestion = async () => {
    if (!selectedSubject || !questionForm.text) return;

    const payload = {
      ...questionForm,
      subjectId: selectedSubject.id
    };

    if (payload.type === 'essay') {
        payload.options = [];
        payload.correctIndex = -1;
    }

    if (editingQuestion) {
      await updateDoc(getDocument('questions', editingQuestion.id), payload);
    } else {
      await addDoc(getCollection('questions'), payload);
    }

    setEditingQuestion(null);
    setQuestionForm({ text: '', type: 'choice', options: ['', '', '', ''], correctIndex: 0 });
    fetchQuestions(selectedSubject.id);
  };

  const deleteQuestion = async (id) => {
    if (confirm('Hapus soal ini?')) {
      await deleteDoc(getDocument('questions', id));
      fetchQuestions(selectedSubject.id);
    }
  };

  // --- Rendering Helpers ---
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4ff] text-[#0E21A0]">
        Memuat Sistem...
    </div>
  );

  // --- THEME & STYLES ---
  // Using more distinct hover/active classes
  const THEME = {
    primary: 'bg-[#0E21A0]',
    // Darker on hover for better visibility
    primaryHover: 'hover:bg-[#08156e]', 
    // Button Base classes including transition and active state
    btnBase: 'transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg',
    textPrimary: 'text-[#0E21A0]',
    lightBg: 'bg-[#eef2ff]',
    border: 'border-[#0E21A0]',
  };

  // --- VIEW: HOME ---
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navigation / Header */}
        <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
            <div className="max-w-6xl mx-auto w-full px-4 py-4 flex justify-between items-center">
                {/* LOGO AREA - UPDATED TO IMG TAG */}
                <div className="flex items-center gap-3">
                    <img 
                      src="asset/logopoltek.png" 
                      alt="Logo Politeknik" 
                      className="w-12 h-12 object-contain"
                      // Fallback jika gambar error
                      onError={(e) => {e.target.onerror = null; e.target.src = "https://via.placeholder.com/50?text=Logo"}}
                    />
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold text-[#0E21A0] leading-none uppercase tracking-wide">Politeknik Haji Anwar Sanusi</h1>
                        <span className="text-xs text-gray-500 font-medium">Sistem Akademik Terpadu</span>
                    </div>
                </div>

                <button 
                    onClick={() => setView('admin-login')} 
                    className={`flex items-center gap-2 text-gray-500 text-sm font-medium hover:text-[#0E21A0] transition-colors`}
                >
                    <Lock size={16} /> <span className="hidden sm:inline">Portal Dosen</span>
                </button>
            </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-12 gap-6 md:gap-8">
                
                {/* LEFT COLUMN: QUICK ATTENDANCE FORM */}
                <div className="lg:col-span-4 order-2 lg:order-1">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-[#0E21A0] sticky top-24">
                        <div className="flex items-center gap-2 mb-6 pb-4 border-b">
                            <CalendarCheck size={20} className="text-[#0E21A0]" />
                            <h2 className="font-bold text-gray-800 text-lg">Absensi Harian</h2>
                        </div>
                        
                        <form onSubmit={handleQuickAttendance} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Pilih Mata Kuliah</label>
                                <select 
                                    required
                                    className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] transition text-sm font-medium text-gray-700"
                                    value={attendanceSubjectId}
                                    onChange={e => setAttendanceSubjectId(e.target.value)}
                                >
                                    <option value="">-- Pilih Mata Kuliah --</option>
                                    {subjects.filter(s => s.isActive).map(s => (
                                        <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Nama Mahasiswa</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] transition text-sm"
                                    placeholder="Nama Lengkap"
                                    value={studentData.name}
                                    onChange={e => setStudentData({...studentData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">NIM</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] transition text-sm"
                                    placeholder="Nomor Induk Mahasiswa"
                                    value={studentData.nim}
                                    onChange={e => setStudentData({...studentData, nim: e.target.value})}
                                />
                            </div>
                            <button type="submit" className={`w-full py-3.5 ${THEME.primary} ${THEME.primaryHover} ${THEME.btnBase} text-blue font-bold rounded-xl flex items-center justify-center gap-2 mt-2`}>
                                <Send size={18} /> Kirim Kehadiran
                            </button>
                        </form>
                        
                        <div className="mt-6 bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex gap-2 leading-relaxed">
                            <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                            <p>Kehadiran dicatat secara real-time. Pastikan data diri sesuai sebelum mengirim.</p>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: EXAM LIST */}
                <div className="lg:col-span-8 order-1 lg:order-2">
                    <div className="flex items-center gap-3 mb-6 bg-[#eef2ff] p-4 rounded-xl border border-blue-100">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                            <CheckSquare size={20} className="text-[#0E21A0]" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800 text-lg">Jadwal Ujian Aktif</h2>
                            <p className="text-xs text-gray-500">Silakan pilih mata kuliah untuk memulai ujian.</p>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                        {subjects.filter(s => s.isActive).length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Belum ada jadwal ujian yang aktif saat ini.</p>
                            </div>
                        ) : (
                            subjects.filter(s => s.isActive).map(subject => (
                            <div key={subject.id} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-300 transition-all duration-300 flex flex-col justify-between h-full group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                                
                                <div className="relative z-10 mb-6">
                                    <span className={`text-[10px] font-bold text-white bg-[#0E21A0] px-2.5 py-1 rounded-full mb-3 inline-block tracking-wider`}>
                                    {subject.code}
                                    </span>
                                    <h3 className="text-lg md:text-xl font-bold text-gray-800 group-hover:text-[#0E21A0] transition-colors leading-snug">{subject.name}</h3>
                                </div>
                                
                                <button 
                                    onClick={() => { 
                                        setSelectedSubject(subject); 
                                        setView('student-login'); 
                                    }}
                                    className={`relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-[#0E21A0] text-blue font-bold text-sm hover:bg-[#0E21A0] hover:text-black ${THEME.btnBase}`}
                                >
                                    Mulai Ujian <ChevronRight size={16} />
                                </button>
                            </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </main>
      </div>
    );
  }

  // --- VIEW: STUDENT LOGIN (Exam Only) ---
  if (view === 'student-login') {
    return (
      <div className="min-h-screen bg-[#eef2ff] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-white/50 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#0E21A0]"></div>
          
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 text-sm font-medium transition">
            <ArrowLeft size={16} /> Kembali
          </button>
          
          <div className="text-center mb-8">
            <div className={`w-14 h-14 rounded-2xl bg-blue-50 text-[#0E21A0] flex items-center justify-center mx-auto mb-4 shadow-sm`}>
                <CheckSquare size={28}/>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Login Ujian</h2>
            <p className="text-blue-600 font-medium mt-1">{selectedSubject?.name}</p>
          </div>

          <form onSubmit={handleExamStart} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">Nama Lengkap</label>
              <input 
                required
                type="text" 
                className="w-full p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] transition text-gray-800"
                placeholder="Masukkan nama lengkap"
                value={studentData.name}
                onChange={e => setStudentData({...studentData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">NIM</label>
              <input 
                required
                type="text" 
                className="w-full p-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] transition text-gray-800"
                placeholder="Contoh: 12345678"
                value={studentData.nim}
                onChange={e => setStudentData({...studentData, nim: e.target.value})}
              />
            </div>
            
            <div className="bg-amber-50 text-amber-800 text-xs p-4 rounded-xl flex items-start gap-3 border border-amber-100">
              <div className="mt-0.5"><Users size={16} /></div>
              <p className="leading-relaxed">Halaman ini khusus untuk masuk ke sesi ujian. Pastikan Anda sudah mengisi absensi di halaman utama.</p>
            </div>

            <button type="submit" className={`w-full py-3.5 ${THEME.primary} ${THEME.primaryHover} ${THEME.btnBase} text-black font-bold rounded-xl mt-2`}>
              Masuk & Mulai Mengerjakan
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: EXAM ---
  if (view === 'exam') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-10 border-t-4 border-[#0E21A0]">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-800 text-lg md:text-xl">{selectedSubject?.name}</h2>
              <div className="text-xs text-gray-500 flex gap-3 mt-1 font-medium">
                <span>{studentData.name}</span>
                <span className="text-gray-300">•</span>
                <span>{studentData.nim}</span>
              </div>
            </div>
            <div className={`bg-blue-50 text-[#0E21A0] px-4 py-2 rounded-lg text-sm font-bold border border-blue-100`}>
              {Object.keys(examAnswers).length} / {questions.length} <span className="text-gray-400 text-xs font-normal ml-1">Terjawab</span>
            </div>
          </div>
        </header>

        {/* Question Area */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
          {questions.length === 0 ? (
             <div className="text-center text-gray-500 mt-20 bg-white p-8 rounded-2xl shadow-sm">Soal belum tersedia. Hubungi Dosen.</div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex gap-5">
                    <div className={`flex-shrink-0 w-10 h-10 ${THEME.primary} text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-gray-800 font-medium text-lg mb-6 whitespace-pre-wrap leading-relaxed">{q.text}</p>
                      
                      {q.type === 'essay' ? (
                        <div className="mt-2">
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Jawaban Esai:</label>
                            <textarea
                                className="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0E21A0] bg-gray-50 text-sm transition-all focus:bg-white"
                                rows="5"
                                placeholder="Ketik jawaban Anda di sini..."
                                value={examAnswers[q.id] || ''}
                                onChange={(e) => setExamAnswers({...examAnswers, [q.id]: e.target.value})}
                            />
                        </div>
                      ) : (
                        <div className="space-y-3">
                            {q.options.map((opt, optIdx) => (
                            <label key={optIdx} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                                examAnswers[q.id] === optIdx 
                                ? 'border-[#0E21A0] bg-[#eef2ff] ring-1 ring-[#0E21A0]' 
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                examAnswers[q.id] === optIdx ? 'border-[#0E21A0]' : 'border-gray-300'
                                }`}>
                                {examAnswers[q.id] === optIdx && <div className={`w-3 h-3 ${THEME.primary} rounded-full`} />}
                                </div>
                                <input 
                                type="radio" 
                                name={`question-${q.id}`} 
                                className="hidden"
                                onChange={() => setExamAnswers({...examAnswers, [q.id]: optIdx})}
                                />
                                <span className={`text-base ${examAnswers[q.id] === optIdx ? 'text-[#0E21A0] font-medium' : 'text-gray-700'}`}>{opt}</span>
                            </label>
                            ))}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className="bg-white border-t p-4 md:p-6 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">Pastikan semua jawaban terisi</span>
            <button 
              onClick={submitExam}
              className={`${THEME.primary} ${THEME.primaryHover} ${THEME.btnBase} text-blue px-8 py-3.5 rounded-xl font-bold flex items-center gap-2`}
            >
              KIRIM JAWABAN <Send size={18} />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // --- VIEW: RESULT ---
  if (view === 'result') {
    return (
      <div className={`min-h-screen ${THEME.primary} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-center relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-[#0E21A0]"></div>
          
          <div className="p-8 pb-4">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Award size={40} className="text-[#0E21A0]" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Ujian Selesai</h2>
            <p className="text-gray-500">{selectedSubject?.name}</p>
          </div>

          <div className="px-8 py-6">
            <div className={`text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[#0E21A0] to-blue-500 mb-2`}>
              {currentScore}
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Skor Pilihan Ganda</p>
            {essayAnsweredCount > 0 && (
                <p className="text-xs text-orange-600 font-bold mt-3 bg-orange-50 border border-orange-100 inline-block px-3 py-1.5 rounded-lg">
                    + {essayAnsweredCount} Jawaban Esai (Menunggu Review)
                </p>
            )}
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-100 grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">Nama</p>
              <p className="font-bold text-gray-800 text-sm">{studentData.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">NIM</p>
              <p className="font-bold text-gray-800 text-sm">{studentData.nim}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">Total Soal</p>
              <p className="font-bold text-gray-800 text-sm">{questions.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase font-bold mb-1">Status</p>
              <p className="font-bold text-green-600 text-sm flex items-center gap-1"><CheckCircle size={14}/> Terkirim</p>
            </div>
          </div>

          <div className="p-6">
            <button 
              onClick={() => {
                setStudentData({name: '', nim: ''});
                setExamAnswers({});
                setView('home');
              }}
              className={`w-full py-3.5 bg-gray-900 text-blue font-bold rounded-xl hover:bg-gray-800 ${THEME.btnBase}`}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: ADMIN LOGIN ---
  if (view === 'admin-login') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl">
          <h2 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-3 border-b pb-4">
            <div className="bg-blue-100 p-2 rounded-lg"><Lock size={20} className="text-[#0E21A0]" /></div>
             Panel Dosen
          </h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Kode Akses</label>
                <input 
                type="password" 
                className="w-full p-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0E21A0] focus:border-[#0E21A0] outline-none transition" 
                placeholder="Masukkan Password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setView('home')} className="flex-1 py-3 text-gray-500 hover:bg-gray-100 rounded-xl font-bold transition">Batal</button>
              <button type="submit" className={`flex-1 py-3 ${THEME.primary} text-black rounded-xl ${THEME.primaryHover} font-bold shadow-lg`}>Masuk</button>
            </div>
          </form>
          <p className="text-xs text-center text-gray-400 mt-6">Gunakan password default: <strong>admin123</strong></p>
        </div>
      </div>
    );
  }

  // --- VIEW: ADMIN DASHBOARD ---
  const PrintStyles = () => (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        body { background: white; color: black; }
        .print-container { padding: 0; margin: 0; width: 100%; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f3f4f6; -webkit-print-color-adjust: exact; }
        * { -webkit-print-color-adjust: exact !important;   print-color-adjust: exact !important; }
      }
      .print-only { display: none; }
    `}</style>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PrintStyles />
      
      {/* Admin Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 no-print shadow-sm">
        <div className="flex items-center gap-3 font-bold text-gray-800">
          <div className={`${THEME.primary} text-white p-1.5 rounded-lg`}>CBT</div>
          <span className="text-lg">Panel Dosen</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1.5 rounded-xl">
          {[
              { id: 'subjects', label: 'Mata Kuliah', icon: BookOpen },
              { id: 'questions', label: 'Bank Soal', icon: List },
              { id: 'results', label: 'Rekap Nilai', icon: Award },
              { id: 'attendance', label: 'Data Absensi', icon: CalendarCheck } 
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setView('home')} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition">
          <LogOut size={20} />
        </button>
      </nav>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full no-print">
        
        {/* TAB: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 sticky top-24">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-[#0E21A0]" /> Tambah Matkul
                </h3>
                <div className="space-y-3">
                  <input 
                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0E21A0]" 
                    placeholder="Kode (mis: IS101)" 
                    value={newSubject.code}
                    onChange={e => setNewSubject({...newSubject, code: e.target.value})}
                  />
                  <input 
                    className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#0E21A0]" 
                    placeholder="Nama Mata Kuliah"
                    value={newSubject.name}
                    onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
                  />
                  <button onClick={addSubject} className={`w-full py-3 ${THEME.primary} text-blue rounded-xl ${THEME.primaryHover} text-sm font-bold shadow-md`}>
                    Simpan
                  </button>
                </div>
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-4">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-blue-200 transition">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-white bg-gray-400 px-2 py-1 rounded">{s.code}</span>
                      <h4 className="font-bold text-gray-800 text-lg">{s.name}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                         setSelectedSubject(s);
                         fetchQuestions(s.id);
                         setActiveTab('questions');
                      }}
                      className="px-4 py-2 text-xs font-bold bg-blue-50 text-[#0E21A0] rounded-lg hover:bg-blue-100 transition"
                    >
                      Kelola Soal
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: QUESTIONS */}
        {activeTab === 'questions' && (
          <div className="flex flex-col h-full">
            <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <span className="text-sm font-bold text-gray-500">Edit Soal Untuk:</span>
              <select 
                className="p-2.5 border rounded-lg bg-gray-50 font-bold text-gray-800 flex-1 outline-none focus:ring-2 focus:ring-[#0E21A0]"
                value={selectedSubject?.id || ''}
                onChange={(e) => {
                  const sub = subjects.find(s => s.id === e.target.value);
                  setSelectedSubject(sub);
                  if(sub) fetchQuestions(sub.id);
                }}
              >
                <option value="">-- Pilih Mata Kuliah --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {selectedSubject ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Form Input Soal */}
                <div className="bg-white p-6 rounded-2xl shadow-sm h-fit border border-blue-50">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Edit size={18} className="text-[#0E21A0]" /> 
                    {editingQuestion ? 'Edit Soal' : 'Buat Soal Baru'}
                  </h3>
                  
                  {/* Selector Tipe Soal */}
                  <div className="mb-4 bg-gray-100 p-1 rounded-lg flex">
                      <button 
                        onClick={() => setQuestionForm({...questionForm, type: 'choice'})}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${questionForm.type === 'choice' ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500'}`}
                      >
                        Pilihan Ganda
                      </button>
                      <button 
                        onClick={() => setQuestionForm({...questionForm, type: 'essay'})}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${questionForm.type === 'essay' ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500'}`}
                      >
                        Esai
                      </button>
                  </div>

                  <textarea 
                    className="w-full p-3 border rounded-xl mb-4 text-sm outline-none focus:ring-2 focus:ring-[#0E21A0]" 
                    rows="4"
                    placeholder="Tulis pertanyaan disini..."
                    value={questionForm.text}
                    onChange={e => setQuestionForm({...questionForm, text: e.target.value})}
                  ></textarea>
                  
                  {/* Kondisi render input opsi jika Pilihan Ganda */}
                  {questionForm.type === 'choice' && (
                    <div className="space-y-2 mb-6">
                        {questionForm.options.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <input 
                            type="radio" 
                            name="correct-opt"
                            checked={questionForm.correctIndex === idx}
                            onChange={() => setQuestionForm({...questionForm, correctIndex: idx})}
                            className="cursor-pointer"
                            />
                            <input 
                            className="flex-1 p-2.5 border rounded-lg text-sm outline-none focus:border-[#0E21A0]"
                            placeholder={`Pilihan ${idx + 1}`}
                            value={opt}
                            onChange={e => {
                                const newOpts = [...questionForm.options];
                                newOpts[idx] = e.target.value;
                                setQuestionForm({...questionForm, options: newOpts});
                            }}
                            />
                        </div>
                        ))}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {editingQuestion && (
                      <button onClick={() => { setEditingQuestion(null); setQuestionForm({text:'', type:'choice', options:['','','',''], correctIndex:0}); }} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">Batal</button>
                    )}
                    <button onClick={saveQuestion} className={`flex-1 py-2.5 ${THEME.primary} text-blue rounded-xl ${THEME.primaryHover} font-bold shadow-md`}>Simpan Soal</button>
                  </div>
                </div>

                {/* List Questions */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex justify-between items-center mb-2 px-1">
                      <span className="font-bold text-gray-700">Daftar Soal ({questions.length})</span>
                    </div>
                    {questions.map((q, idx) => (
                      <div key={q.id} className="bg-white p-5 rounded-2xl border border-gray-100 hover:border-blue-300 transition group relative shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-blue-50 text-[#0E21A0] w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold">{idx+1}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${q.type === 'essay' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                            {q.type === 'essay' ? 'ESAI' : 'PG'}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition absolute right-3 top-3 bg-white shadow-sm p-1 rounded-lg border">
                             <button onClick={() => { setEditingQuestion(q); setQuestionForm({text: q.text, type: q.type || 'choice', options: q.options || ['','','',''], correctIndex: q.correctIndex || 0}); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit size={14}/></button>
                             <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={14}/></button>
                          </div>
                        </div>
                        <p className="text-gray-800 text-sm mb-3 whitespace-pre-wrap leading-relaxed">{q.text}</p>
                        {q.type === 'choice' ? (
                            <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg font-medium">Kunci: {q.options[q.correctIndex]}</p>
                        ) : (
                            <p className="text-xs text-orange-700 bg-orange-50 px-3 py-2 rounded-lg italic">Jawaban berupa teks (dinilai manual)</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border-dashed border-2 border-gray-200">
                <BookOpen className="mx-auto text-gray-300 mb-3" size={40} />
                <p className="text-gray-400 font-medium">Pilih mata kuliah di atas untuk mengelola soal.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: ATTENDANCE (ABSENSI) */}
        {activeTab === 'attendance' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="font-bold text-gray-800">Data Absensi Mahasiswa</h3>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button 
                                onClick={() => setAttendanceView('daily')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${attendanceView === 'daily' ? 'bg-white shadow-sm text-[#0E21A0]' : 'text-gray-500'}`}
                            >
                                Harian
                            </button>
                            <button 
                                onClick={() => setAttendanceView('weekly')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${attendanceView === 'weekly' ? 'bg-white shadow-sm text-[#0E21A0]' : 'text-gray-500'}`}
                            >
                                Rekap Mingguan
                            </button>
                        </div>

                        {attendanceView === 'daily' && (
                            <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-2 py-1">
                                <Calendar size={14} className="text-gray-500"/>
                                <input 
                                    type="date" 
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="bg-transparent text-sm text-gray-700 outline-none"
                                />
                            </div>
                        )}

                        <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 font-bold shadow-md">
                            <Printer size={16} /> <span className="hidden md:inline">Cetak</span>
                        </button>
                    </div>
                </div>

                {/* VIEW: HARIAN (DAILY) */}
                {attendanceView === 'daily' && (
                    <div className="overflow-x-auto">
                        <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 font-medium">
                            Menampilkan data tanggal: {new Date(filterDate).toLocaleDateString('id-ID', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
                        </div>
                        <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                            <tr>
                            <th className="px-6 py-3">Waktu Masuk</th>
                            <th className="px-6 py-3">NIM</th>
                            <th className="px-6 py-3">Nama</th>
                            <th className="px-6 py-3">Mata Kuliah</th>
                            <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {attendanceList.filter(att => {
                                if(!att.timestamp) return false;
                                const dateObj = new Date(att.timestamp.seconds * 1000);
                                const y = dateObj.getFullYear();
                                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const d = String(dateObj.getDate()).padStart(2, '0');
                                const attDate = `${y}-${m}-${d}`;
                                return attDate === filterDate;
                            }).map(att => (
                            <tr key={att.id} className="hover:bg-blue-50 transition">
                                <td className="px-6 py-3">{att.timestamp ? new Date(att.timestamp.seconds * 1000).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                                <td className="px-6 py-3 font-mono text-xs">{att.studentNIM}</td>
                                <td className="px-6 py-3 font-bold text-gray-800">{att.studentName}</td>
                                <td className="px-6 py-3">{att.subjectName}</td>
                                <td className="px-6 py-3">
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit">
                                        <CheckCircle size={10}/> {att.status}
                                    </span>
                                </td>
                            </tr>
                            ))}
                            {attendanceList.filter(att => {
                                if(!att.timestamp) return false;
                                const dateObj = new Date(att.timestamp.seconds * 1000);
                                const y = dateObj.getFullYear();
                                const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const d = String(dateObj.getDate()).padStart(2, '0');
                                const attDate = `${y}-${m}-${d}`;
                                return attDate === filterDate;
                            }).length === 0 && (
                            <tr><td colSpan="5" className="text-center py-12 text-gray-400 italic">Tidak ada data absensi pada tanggal ini.</td></tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                )}

                {/* VIEW: REKAP MINGGUAN (WEEKLY) */}
                {attendanceView === 'weekly' && (
                    <div className="p-6 bg-gray-50 min-h-[300px]">
                        {Object.entries(getWeeklyAttendance()).length === 0 ? (
                             <div className="text-center py-12 text-gray-400 italic">Belum ada data absensi untuk direkap.</div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(getWeeklyAttendance()).map(([weekTitle, records]) => (
                                    <div key={weekTitle} className="bg-white border rounded-xl shadow-sm overflow-hidden">
                                        <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
                                            <h4 className="font-bold text-gray-700 text-sm">{weekTitle}</h4>
                                            <span className="text-xs bg-white border px-2 py-1 rounded text-gray-500 font-medium">Total: {records.length} Hadir</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="text-xs text-gray-500 border-b">
                                                    <tr>
                                                        <th className="px-4 py-2 font-medium">Hari/Tgl</th>
                                                        <th className="px-4 py-2 font-medium">NIM</th>
                                                        <th className="px-4 py-2 font-medium">Nama Mahasiswa</th>
                                                        <th className="px-4 py-2 font-medium">Mata Kuliah</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {records.map(rec => (
                                                        <tr key={rec.id} className="border-b last:border-0 hover:bg-gray-50">
                                                            <td className="px-4 py-2 text-gray-500">
                                                                {new Date(rec.timestamp.seconds * 1000).toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short'})}
                                                            </td>
                                                            <td className="px-4 py-2 font-mono text-xs">{rec.studentNIM}</td>
                                                            <td className="px-4 py-2 font-medium text-gray-800">{rec.studentName}</td>
                                                            <td className="px-4 py-2 text-xs text-gray-600">{rec.subjectName}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

        {/* TAB: RESULTS */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="p-6 border-b flex justify-between items-center">
               <h3 className="font-bold text-gray-800">Rekapitulasi Nilai</h3>
               
               <div className="flex gap-4">
                 <select 
                   className="p-2 border rounded-lg text-sm bg-gray-50"
                   onChange={(e) => {
                     const val = e.target.value;
                     if (val === 'all') fetchResults();
                     else {
                        fetchResults().then(() => {
                           setResults(prev => prev.filter(r => r.subjectId === val));
                        });
                     }
                   }}
                 >
                   <option value="all">Semua Mata Kuliah</option>
                   {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 font-bold shadow-md">
                   <Printer size={16} /> Cetak
                 </button>
               </div>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-gray-600">
                 <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                   <tr>
                     <th className="px-6 py-3">Tanggal</th>
                     <th className="px-6 py-3">NIM</th>
                     <th className="px-6 py-3">Nama</th>
                     <th className="px-6 py-3">Matkul</th>
                     <th className="px-6 py-3 text-center">Benar (PG)</th>
                     <th className="px-6 py-3 text-center">Esai</th>
                     <th className="px-6 py-3 text-right">Skor (PG)</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {results.map(r => (
                     <tr key={r.id} className="hover:bg-blue-50 transition">
                       <td className="px-6 py-3">{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : '-'}</td>
                       <td className="px-6 py-3 font-mono text-xs">{r.studentNIM}</td>
                       <td className="px-6 py-3 font-bold text-gray-800">{r.studentName}</td>
                       <td className="px-6 py-3"><span className="bg-blue-100 text-[#0E21A0] px-2 py-1 rounded text-xs">{r.subjectName}</span></td>
                       <td className="px-6 py-3 text-center">{r.mcqCorrect} / {r.totalQuestions - (r.essayCount || 0)}</td>
                       <td className="px-6 py-3 text-center">
                        {r.essayCount > 0 ? (
                            <span className="text-orange-600 bg-orange-100 px-2 py-0.5 rounded text-xs">Butuh Review ({r.essayCount})</span>
                        ) : '-'}
                       </td>
                       <td className="px-6 py-3 text-right font-bold text-[#0E21A0] text-lg">{r.mcqScore}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>

      {/* PRINT VIEW (Hidden by default, visible on print) */}
      <div className="print-only p-8">
        <div className="mb-6 border-b pb-4 text-center">
           <div className="flex items-center justify-center gap-4 mb-4">
             {/* PRINT LOGO - UPDATED TO IMG TAG */}
             <img 
               src="asset/logopoltek.png" 
               alt="Logo Politeknik" 
               className="w-20 h-20 object-contain"
               onError={(e) => {e.target.onerror = null; e.target.src = "https://via.placeholder.com/100?text=Logo"}}
             />
             <div className="text-left">
                <h2 className="text-2xl font-bold uppercase leading-none">Politeknik Haji Anwar Sanusi</h2>
                <p className="text-sm uppercase">Laporan Akademik</p>
             </div>
           </div>
           <h1 className="text-xl font-bold uppercase mb-2">Laporan Hasil Ujian & Absensi</h1>
           <p className="text-sm text-gray-600">Dicetak pada: {new Date().toLocaleString()}</p>
        </div>
        
        {activeTab === 'results' && (
            <>
                <h3 className="font-bold mb-2">Rekap Nilai</h3>
                <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2">No</th>
                        <th className="border p-2">NIM</th>
                        <th className="border p-2">Nama</th>
                        <th className="border p-2">Mata Kuliah</th>
                        <th className="border p-2">Skor PG</th>
                    </tr>
                    </thead>
                    <tbody>
                    {results.map((r, idx) => (
                        <tr key={r.id}>
                        <td className="border p-2 text-center">{idx + 1}</td>
                        <td className="border p-2">{r.studentNIM}</td>
                        <td className="border p-2">{r.studentName}</td>
                        <td className="border p-2">{r.subjectName}</td>
                        <td className="border p-2 text-center font-bold">{r.mcqScore}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </>
        )}

        {activeTab === 'attendance' && (
             <>
             <h3 className="font-bold mb-2">
                 Data Absensi {attendanceView === 'daily' ? `Harian (${filterDate})` : 'Mingguan'}
             </h3>
             <table className="w-full border-collapse border border-gray-300 text-sm">
                 <thead>
                 <tr className="bg-gray-100">
                     <th className="border p-2">No</th>
                     <th className="border p-2">Waktu</th>
                     <th className="border p-2">NIM</th>
                     <th className="border p-2">Nama</th>
                     <th className="border p-2">Mata Kuliah</th>
                 </tr>
                 </thead>
                 <tbody>
                 {attendanceList.filter(att => {
                     if (attendanceView === 'daily' && att.timestamp) {
                        const dateObj = new Date(att.timestamp.seconds * 1000);
                        const y = dateObj.getFullYear();
                        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const d = String(dateObj.getDate()).padStart(2, '0');
                        const attDate = `${y}-${m}-${d}`;
                         return attDate === filterDate;
                     }
                     return true; 
                 }).map((r, idx) => (
                     <tr key={r.id}>
                     <td className="border p-2 text-center">{idx + 1}</td>
                     <td className="border p-2">{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleString() : '-'}</td>
                     <td className="border p-2">{r.studentNIM}</td>
                     <td className="border p-2">{r.studentName}</td>
                     <td className="border p-2">{r.subjectName}</td>
                     </tr>
                 ))}
                 </tbody>
             </table>
         </>
        )}

        <div className="mt-8 text-right">
           <p className="mb-16">Mengetahui, Dosen Pengampu</p>
           <p className="font-bold underline">(.......................................)</p>
        </div>
      </div>

    </div>
  );
}