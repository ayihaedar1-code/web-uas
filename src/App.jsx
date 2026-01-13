import React, { useState, useEffect, useRef } from 'react';
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
  onSnapshot
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
  List,
  CalendarCheck,
  Calendar,
  CheckSquare,
  Send,
  GraduationCap,
  X,
  Eye,
  AlertCircle,
  Clock, // Icon Baru
  Sun,   // Icon Baru
  Moon,  // Icon Baru
  Timer  // Icon Baru
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
const getCollection = (colName) => collection(db, colName);
const getDocument = (colName, docId) => doc(db, colName, docId);

// --- Main Component ---
export default function CBTSystem() {
  // --- State Management ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  
  // Theme State
  const [darkMode, setDarkMode] = useState(false);

  // Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedResultDetail, setSelectedResultDetail] = useState(null); 

  // Data States
  const [subjects, setSubjects] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  
  // Interaction States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [studentData, setStudentData] = useState({ name: '', nim: '' });
  const [attendanceSubjectId, setAttendanceSubjectId] = useState(''); 
  
  const [examAnswers, setExamAnswers] = useState({}); 
  const [currentScore, setCurrentScore] = useState(0);
  const [essayAnsweredCount, setEssayAnsweredCount] = useState(0);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  
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

  // Form States for Admin (UPDATED with deadline & duration)
  const [newSubject, setNewSubject] = useState({ 
    name: '', 
    code: '', 
    isActive: true, 
    deadline: '', // Format YYYY-MM-DD
    duration: 60  // Menit
  });
  
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

  // --- REAL-TIME DATA FETCHING ---
  useEffect(() => {
    if (!user) return;

    const unsubSubjects = onSnapshot(getCollection('subjects'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubjects(data);
    });

    const unsubQuestions = onSnapshot(getCollection('questions'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllQuestions(data);
    });

    const unsubResults = onSnapshot(getCollection('results'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setResults(data);
    });

    const unsubAttendance = onSnapshot(getCollection('attendance'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setAttendanceList(data);
    });

    return () => {
      unsubSubjects(); unsubQuestions(); unsubResults(); unsubAttendance();
    };
  }, [user]);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (view === 'exam' && timeLeft > 0) {
      const timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerId);
    } else if (view === 'exam' && timeLeft === 0) {
      // Auto submit when time runs out
      submitExam(); 
    }
  }, [view, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getFilteredQuestions = (subjectId) => {
    if (!subjectId) return [];
    return allQuestions.filter(q => q.subjectId === subjectId);
  };

  const getWeeklyAttendance = () => {
    const groups = {};
    attendanceList.forEach(att => {
        if (!att.timestamp) return;
        const date = new Date(att.timestamp.seconds * 1000);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(date);
        monday.setDate(diff);
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const weekKey = `Minggu: ${monday.toLocaleDateString('id-ID', options)}`;
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(att);
    });
    return groups;
  };

  // --- Handlers ---
  const handleQuickAttendance = async (e) => {
    e.preventDefault();
    if (!studentData.name || !studentData.nim || !attendanceSubjectId) {
        alert("Mohon lengkapi Nama, NIM, dan Mata Kuliah untuk absensi.");
        return;
    }
    const subject = subjects.find(s => s.id === attendanceSubjectId);
    if (!subject) return;

    // Check Deadline for Attendance as well? Optionally yes, but usually strictly for Exam.
    // Here strictly checking daily duplicate
    const today = new Date().toDateString();
    const alreadyPresent = attendanceList.find(att => {
        if (!att.timestamp) return false;
        const recordDate = new Date(att.timestamp.seconds * 1000).toDateString();
        return (
            att.studentNIM === studentData.nim && 
            att.subjectId === attendanceSubjectId && 
            recordDate === today
        );
    });

    if (alreadyPresent) {
        alert(`Anda sudah mengisi absen untuk mata kuliah ${subject.name} hari ini.`);
        return;
    }

    try {
      await addDoc(getCollection('attendance'), {
        studentName: studentData.name,
        studentNIM: studentData.nim,
        subjectId: subject.id,
        subjectName: subject.name,
        timestamp: serverTimestamp(),
        status: 'Hadir'
      });
      setShowSuccessModal(true); 
      setAttendanceSubjectId(''); 
    } catch (err) {
      console.error("Gagal mencatat absensi", err);
      alert("Gagal mencatat absensi. Coba lagi.");
    }
  };

  const handleExamStart = async (e) => {
    e.preventDefault();
    if (!studentData.name || !studentData.nim || !selectedSubject) return;
    
    // VALIDASI TENGGAT WAKTU (DEADLINE)
    if (selectedSubject.deadline) {
        const today = new Date();
        // Set waktu today ke 00:00:00 agar perbandingan tanggal adil
        today.setHours(0,0,0,0);
        const deadlineDate = new Date(selectedSubject.deadline);
        
        if (today > deadlineDate) {
            alert(`Maaf, batas waktu ujian untuk mata kuliah ini sudah habis pada tanggal ${deadlineDate.toLocaleDateString('id-ID')}.`);
            return;
        }
    }

    const existing = results.find(d => 
      d.studentNIM === studentData.nim && d.subjectId === selectedSubject.id
    );

    if (existing) {
      alert("Anda sudah mengerjakan ujian mata kuliah ini sebelumnya.");
      return;
    }

    // Set Timer based on duration (minutes to seconds)
    // Default 60 minutes if not set
    const durationMinutes = selectedSubject.duration ? parseInt(selectedSubject.duration) : 60;
    setTimeLeft(durationMinutes * 60);

    setView('exam');
  };

  const submitExam = async () => {
    const subjectQuestions = getFilteredQuestions(selectedSubject.id);
    // If auto-submit happens and no questions loaded yet
    if (!subjectQuestions.length && view !== 'exam') return; 

    let correctCount = 0;
    let essayCount = 0;

    subjectQuestions.forEach(q => {
      if (q.type === 'essay') {
        essayCount++;
      } else {
        if (examAnswers[q.id] === q.correctIndex) correctCount++;
      }
    });

    const totalMcq = subjectQuestions.length - essayCount;
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
        totalQuestions: subjectQuestions.length,
        mcqCorrect: correctCount,
        essayCount: essayCount,
        essayAnswers: examAnswers, 
        timestamp: serverTimestamp()
      });
      setView('result');
    } catch (error) {
      console.error("Error saving result:", error);
      alert("Gagal menyimpan jawaban (atau ujian sudah disubmit otomatis).");
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPassword === 'admin123') {
      setShowAdminModal(false); 
      setView('admin-dashboard');
      setAdminPassword('');
    } else {
      alert("Password salah!");
    }
  };

  const addSubject = async () => {
    if (!newSubject.name || !newSubject.code) return;
    await addDoc(getCollection('subjects'), newSubject);
    setNewSubject({ name: '', code: '', isActive: true, deadline: '', duration: 60 });
  };

  const deleteSubject = async (id) => {
    if (confirm('Hapus mata kuliah ini?')) {
      await deleteDoc(getDocument('subjects', id));
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
  };

  const deleteQuestion = async (id) => {
    if (confirm('Hapus soal ini?')) {
      await deleteDoc(getDocument('questions', id));
    }
  };

  // --- Theme Utilities ---
  const toggleDarkMode = () => setDarkMode(!darkMode);

  // Colors & Styles based on Dark Mode
  // Deep Blue #0E21A0 is kept for buttons/branding text even in dark mode for contrast
  const THEME_CLASSES = {
    bgMain: darkMode ? 'bg-gray-900' : 'bg-gray-50',
    bgCard: darkMode ? 'bg-gray-800' : 'bg-white',
    textMain: darkMode ? 'text-white' : 'text-gray-800',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-500',
    border: darkMode ? 'border-gray-700' : 'border-gray-200',
    input: darkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-[#0E21A0]' : 'bg-white text-[#0E21A0] border-gray-200 focus:ring-[#0E21A0]',
    // Accent colors remain similar to maintain branding
    deepBlueText: darkMode ? 'text-blue-400' : 'text-[#0E21A0]', // Light blue in dark mode for readability
    header: darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
  };

  const BUTTON_STYLE = `bg-white border-2 border-[#0E21A0] text-[#0E21A0] font-bold hover:bg-blue-50 hover:text-[#0E21A0] transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg`;
  const PRIMARY_BUTTON_STYLE = `bg-white border-2 border-[#0E21A0] text-[#0E21A0] font-bold hover:bg-blue-50 transition-all duration-200 active:scale-95 shadow-md`;

  const LogoDisplay = ({ size = "w-12 h-12", iconSize = 24 }) => {
    if (imgError) {
      return (
        <div className={`${size} bg-[#0E21A0] rounded-lg flex items-center justify-center shadow-md`}>
            <GraduationCap size={iconSize} className="text-white" />
        </div>
      );
    }
    return (
      <img 
        src="/asset/logopoltek.png" 
        alt="Logo Politeknik" 
        className={`${size} object-contain`}
        onError={() => setImgError(true)}
      />
    );
  };

  // --- Styles Helper for Printing ---
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f0f4ff] text-[#0E21A0]">Memuat Sistem...</div>;

  // --- MODALS ---
  const AdminLoginModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
        <div className={`${THEME_CLASSES.bgCard} p-8 rounded-3xl w-full max-w-sm shadow-2xl relative border ${THEME_CLASSES.border}`}>
            <button onClick={() => setShowAdminModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition"><X size={20}/></button>
            <h2 className={`text-xl font-bold mb-6 ${THEME_CLASSES.deepBlueText} flex items-center gap-3 border-b ${THEME_CLASSES.border} pb-4`}>
                <LogoDisplay size="w-8 h-8" iconSize={20} /> 
                Panel Dosen
            </h2>
            <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                    <label className={`text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1 block`}>Kode Akses</label>
                    <input type="password" className={`w-full p-3.5 border rounded-xl outline-none ${THEME_CLASSES.input}`} placeholder="Masukkan Password"
                    value={adminPassword} onChange={e => setAdminPassword(e.target.value)} autoFocus />
                </div>
                <button type="submit" className={`w-full py-3 rounded-xl ${PRIMARY_BUTTON_STYLE}`}>Masuk</button>
            </form>
        </div>
    </div>
  );

  const AttendanceSuccessModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
        <div className={`${THEME_CLASSES.bgCard} p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center relative border border-green-100`}>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className={`text-2xl font-bold ${THEME_CLASSES.deepBlueText} mb-2`}>Absensi Berhasil!</h2>
            <p className={`${THEME_CLASSES.textMuted} mb-6 text-sm`}>
                Terima kasih <strong>{studentData.name}</strong>.<br/>Kehadiran Anda pada tanggal {new Date().toLocaleDateString('id-ID')} telah tercatat.
            </p>
            <button 
                onClick={() => { setShowSuccessModal(false); setStudentData({name: '', nim: ''}); }}
                className={`w-full py-3 rounded-xl ${PRIMARY_BUTTON_STYLE}`}
            >
                Tutup
            </button>
        </div>
    </div>
  );

  const ResultDetailModal = () => {
    if (!selectedResultDetail) return null;
    const relatedQuestions = allQuestions.filter(q => q.subjectId === selectedResultDetail.subjectId);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className={`${THEME_CLASSES.bgCard} rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]`}>
                <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-t-2xl ${THEME_CLASSES.border}`}>
                    <div>
                        <h3 className={`font-bold ${THEME_CLASSES.deepBlueText} text-lg`}>{selectedResultDetail.studentName} ({selectedResultDetail.studentNIM})</h3>
                        <p className={`text-sm ${THEME_CLASSES.textMuted}`}>{selectedResultDetail.subjectName} • Skor: {selectedResultDetail.mcqScore}</p>
                    </div>
                    <button onClick={() => setSelectedResultDetail(null)} className="text-gray-400 hover:text-red-500"><X size={24}/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {relatedQuestions.length === 0 ? (
                        <p className={`text-center ${THEME_CLASSES.textMuted}`}>Data soal tidak ditemukan.</p>
                    ) : (
                        relatedQuestions.map((q, idx) => {
                            const studentAnswer = selectedResultDetail.essayAnswers?.[q.id];
                            let displayAnswer = '-';
                            let isCorrect = false;
                            
                            if (q.type === 'choice') {
                                displayAnswer = q.options[studentAnswer] || '(Tidak dijawab)';
                                isCorrect = studentAnswer === q.correctIndex;
                            } else {
                                displayAnswer = studentAnswer || '(Kosong)';
                            }

                            return (
                                <div key={q.id} className={`mb-6 border-b ${THEME_CLASSES.border} pb-4 last:border-0`}>
                                    <div className="flex gap-3">
                                        <span className={`font-bold ${THEME_CLASSES.deepBlueText}`}>{idx+1}.</span>
                                        <div className="flex-1">
                                            <p className={`${THEME_CLASSES.textMain} font-medium mb-2`}>{q.text}</p>
                                            <div className="grid grid-cols-1 gap-2 text-sm">
                                                <div className={`p-2 rounded border ${q.type === 'choice' ? (isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700') : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                                    <span className="font-bold block text-xs uppercase mb-1">Jawaban Mahasiswa:</span>
                                                    {displayAnswer}
                                                </div>
                                                {q.type === 'choice' && !isCorrect && (
                                                    <div className={`p-2 rounded border ${THEME_CLASSES.border} ${THEME_CLASSES.textMuted}`}>
                                                        <span className="font-bold block text-xs uppercase mb-1">Kunci Jawaban:</span>
                                                        {q.options[q.correctIndex]}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
  };

  // --- VIEW: HOME ---
  if (view === 'home') {
    return (
      <div className={`min-h-screen ${THEME_CLASSES.bgMain} flex flex-col relative transition-colors duration-300`}>
        {showAdminModal && <AdminLoginModal />}
        {showSuccessModal && <AttendanceSuccessModal />}

        <header className={`${THEME_CLASSES.header} border-b sticky top-0 z-30 shadow-sm transition-colors duration-300`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-start">
                    <LogoDisplay size="w-14 h-14 md:w-16 md:h-16" />
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                        <h4 className={`text-xl md:text-2xl font-bold ${THEME_CLASSES.deepBlueText} leading-tight uppercase tracking-wide`}>Politeknik Haji Anwar Sanusi</h4>
                        <span className={`text-sm ${THEME_CLASSES.textMuted} font-medium`}>Sistem Akademik Terpadu</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Dark Mode Toggle */}
                    <button 
                        onClick={toggleDarkMode} 
                        className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'} hover:opacity-80 transition`}
                        title={darkMode ? "Ganti ke Mode Terang" : "Ganti ke Mode Gelap"}
                    >
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button 
                        onClick={() => setShowAdminModal(true)} 
                        className={`flex items-center gap-2 ${THEME_CLASSES.deepBlueText} text-sm font-bold hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors`}
                    >
                        <Lock size={16} /> <span className="hidden sm:inline">Portal Dosen</span>
                    </button>
                </div>
            </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
            <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-12 gap-6 md:gap-8">
                
                {/* ABSENSI */}
                <div className="lg:col-span-4 order-2 lg:order-1">
                    <div className={`${THEME_CLASSES.bgCard} p-6 rounded-2xl shadow-lg border-t-4 border-[#0E21A0] sticky top-24 ${THEME_CLASSES.border}`}>
                        <div className={`flex items-center gap-2 mb-6 pb-4 border-b ${THEME_CLASSES.border}`}>
                            <CalendarCheck size={20} className={THEME_CLASSES.deepBlueText} />
                            <h2 className={`font-bold ${THEME_CLASSES.deepBlueText} text-lg`}>Absensi Harian</h2>
                        </div>
                        <form onSubmit={handleQuickAttendance} className="space-y-5">
                            <div>
                                <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1.5 ml-1`}>Pilih Mata Kuliah</label>
                                <select 
                                    required
                                    className={`w-full p-3.5 rounded-xl border font-medium outline-none text-sm ${THEME_CLASSES.input}`}
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
                                <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1.5 ml-1`}>Nama Mahasiswa</label>
                                <input 
                                    required type="text" className={`w-full p-3.5 rounded-xl border outline-none text-sm ${THEME_CLASSES.input}`}
                                    placeholder="Nama Lengkap" value={studentData.name} onChange={e => setStudentData({...studentData, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1.5 ml-1`}>NIM</label>
                                <input 
                                    required type="text" className={`w-full p-3.5 rounded-xl border outline-none text-sm ${THEME_CLASSES.input}`}
                                    placeholder="Nomor Induk Mahasiswa" value={studentData.nim} onChange={e => setStudentData({...studentData, nim: e.target.value})}
                                />
                            </div>
                            <button type="submit" className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2 ${PRIMARY_BUTTON_STYLE}`}>
                                <Send size={18} /> Kirim Kehadiran
                            </button>
                        </form>
                    </div>
                </div>

                {/* EXAM LIST */}
                <div className="lg:col-span-8 order-1 lg:order-2">
                    <div className={`flex items-center gap-3 mb-6 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-[#eef2ff] border-blue-100'} p-4 rounded-xl border`}>
                        <div className={`p-2 rounded-lg shadow-sm ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                            <CheckSquare size={20} className={THEME_CLASSES.deepBlueText} />
                        </div>
                        <div>
                            <h2 className={`font-bold ${THEME_CLASSES.textMain} text-lg`}>Jadwal Ujian Aktif</h2>
                            <p className={`text-xs ${THEME_CLASSES.textMuted}`}>Silakan pilih mata kuliah untuk memulai ujian.</p>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                        {subjects.filter(s => s.isActive).length === 0 ? (
                            <div className={`col-span-full text-center py-16 ${THEME_CLASSES.bgCard} rounded-2xl border-2 border-dashed ${THEME_CLASSES.border}`}>
                                <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
                                <p className={`${THEME_CLASSES.textMuted} font-medium`}>Belum ada jadwal ujian yang aktif saat ini.</p>
                            </div>
                        ) : (
                            subjects.filter(s => s.isActive).map(subject => {
                                // Deadline Logic
                                const isExpired = subject.deadline && new Date() > new Date(new Date(subject.deadline).setHours(23,59,59));
                                
                                return (
                                <div key={subject.id} className={`${THEME_CLASSES.bgCard} p-5 md:p-6 rounded-2xl shadow-sm border ${THEME_CLASSES.border} hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full group relative overflow-hidden`}>
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-10 -mt-10 opacity-20"></div>
                                    <div className="relative z-10 mb-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold text-white bg-[#0E21A0] px-2.5 py-1 rounded-full mb-3 inline-block tracking-wider`}>
                                            {subject.code}
                                            </span>
                                            {isExpired && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded">Berakhir</span>}
                                        </div>
                                        <h3 className={`text-lg md:text-xl font-bold ${THEME_CLASSES.deepBlueText} leading-snug mb-2`}>{subject.name}</h3>
                                        
                                        <div className={`text-xs ${THEME_CLASSES.textMuted} space-y-1`}>
                                            <div className="flex items-center gap-1">
                                                <Calendar size={12}/> Tenggat: {subject.deadline ? new Date(subject.deadline).toLocaleDateString('id-ID') : 'Tidak ada'}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock size={12}/> Durasi: {subject.duration || 60} Menit
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => { setSelectedSubject(subject); setView('student-login'); }}
                                        disabled={isExpired}
                                        className={`relative z-10 w-full flex items-center justify-center gap-2 py-3 rounded-xl 
                                            ${isExpired ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : BUTTON_STYLE}
                                        `}
                                    >
                                        {isExpired ? 'Waktu Habis' : 'Mulai Ujian'} { !isExpired && <ChevronRight size={16} /> }
                                    </button>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </main>
      </div>
    );
  }

  // --- VIEW: STUDENT LOGIN ---
  if (view === 'student-login') {
    return (
      <div className={`min-h-screen ${THEME_CLASSES.bgMain} flex items-center justify-center p-4`}>
        <div className={`${THEME_CLASSES.bgCard} p-8 rounded-3xl shadow-xl w-full max-w-md border border-white/50 relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-2 bg-[#0E21A0]"></div>
          <button onClick={() => setView('home')} className={`text-gray-400 hover:text-[#0E21A0] mb-6 flex items-center gap-1 text-sm font-medium transition`}>
            <ArrowLeft size={16} /> Kembali
          </button>
          
          <div className="text-center mb-8">
            <div className={`w-14 h-14 rounded-2xl bg-blue-50 text-[#0E21A0] flex items-center justify-center mx-auto mb-4 shadow-sm`}>
                <CheckSquare size={28}/>
            </div>
            <h2 className={`text-2xl font-bold ${THEME_CLASSES.textMain}`}>Login Ujian</h2>
            <p className={`${THEME_CLASSES.textMuted} font-medium mt-1`}>{selectedSubject?.name}</p>
          </div>

          <form onSubmit={handleExamStart} className="space-y-5">
            <div>
              <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1.5 ml-1`}>Nama Lengkap</label>
              <input required type="text" className={`w-full p-3.5 rounded-xl border outline-none ${THEME_CLASSES.input}`}
                placeholder="Masukkan nama lengkap" value={studentData.name} onChange={e => setStudentData({...studentData, name: e.target.value})} />
            </div>
            <div>
              <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} uppercase mb-1.5 ml-1`}>NIM</label>
              <input required type="text" className={`w-full p-3.5 rounded-xl border outline-none ${THEME_CLASSES.input}`}
                placeholder="Contoh: 12345678" value={studentData.nim} onChange={e => setStudentData({...studentData, nim: e.target.value})} />
            </div>
            <button type="submit" className={`w-full py-3.5 rounded-xl mt-2 ${PRIMARY_BUTTON_STYLE}`}>
              Masuk & Mulai Mengerjakan
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: EXAM ---
  if (view === 'exam') {
    const questionsToShow = getFilteredQuestions(selectedSubject?.id);
    return (
      <div className={`min-h-screen ${THEME_CLASSES.bgMain} flex flex-col`}>
        <header className={`${THEME_CLASSES.bgCard} shadow-sm sticky top-0 z-10 border-t-4 border-[#0E21A0]`}>
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h2 className={`font-bold ${THEME_CLASSES.deepBlueText} text-lg md:text-xl`}>{selectedSubject?.name}</h2>
              <div className={`text-xs ${THEME_CLASSES.textMuted} flex gap-3 mt-1 font-medium`}>
                <span>{studentData.name}</span><span>•</span><span>{studentData.nim}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 bg-blue-50 text-[#0E21A0] px-4 py-2 rounded-lg text-sm font-bold border border-blue-100 ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : ''}`}>
                    <Timer size={16}/> {formatTime(timeLeft)}
                </div>
                <div className={`hidden md:block bg-blue-50 text-[#0E21A0] px-4 py-2 rounded-lg text-sm font-bold border border-blue-100`}>
                    {Object.keys(examAnswers).length} / {questionsToShow.length}
                </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-24">
          {questionsToShow.length === 0 ? (
             <div className={`text-center ${THEME_CLASSES.textMuted} mt-20 ${THEME_CLASSES.bgCard} p-8 rounded-2xl shadow-sm`}>Soal belum tersedia. Hubungi Dosen.</div>
          ) : (
            <div className="space-y-6">
              {questionsToShow.map((q, idx) => (
                <div key={q.id} className={`${THEME_CLASSES.bgCard} p-6 md:p-8 rounded-2xl shadow-sm border ${THEME_CLASSES.border} hover:shadow-md transition-shadow`}>
                  <div className="flex gap-5">
                    <div className="flex-shrink-0 w-10 h-10 bg-[#0E21A0] text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">{idx + 1}</div>
                    <div className="flex-1 pt-1">
                      <p className={`${THEME_CLASSES.deepBlueText} font-medium text-lg mb-6 whitespace-pre-wrap leading-relaxed`}>{q.text}</p>
                      {q.type === 'essay' ? (
                        <div className="mt-2">
                            <label className={`block text-xs font-bold ${THEME_CLASSES.textMuted} mb-2 uppercase tracking-wide`}>Jawaban Esai:</label>
                            <textarea className={`w-full p-4 rounded-xl border outline-none ${THEME_CLASSES.input}`} rows="5"
                                placeholder="Ketik jawaban Anda di sini..." value={examAnswers[q.id] || ''} onChange={(e) => setExamAnswers({...examAnswers, [q.id]: e.target.value})} />
                        </div>
                      ) : (
                        <div className="space-y-3">
                            {q.options.map((opt, optIdx) => (
                            <label key={optIdx} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${examAnswers[q.id] === optIdx ? 'border-[#0E21A0] bg-[#eef2ff] ring-1 ring-[#0E21A0]' : `${THEME_CLASSES.border} hover:border-blue-300 hover:bg-gray-50`}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${examAnswers[q.id] === optIdx ? 'border-[#0E21A0]' : 'border-gray-300'}`}>
                                {examAnswers[q.id] === optIdx && <div className="w-3 h-3 bg-[#0E21A0] rounded-full" />}
                                </div>
                                <input type="radio" name={`question-${q.id}`} className="hidden" onChange={() => setExamAnswers({...examAnswers, [q.id]: optIdx})} />
                                <span className={`text-base ${examAnswers[q.id] === optIdx ? 'text-[#0E21A0] font-bold' : THEME_CLASSES.textMain}`}>{opt}</span>
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

        <footer className={`${THEME_CLASSES.bgCard} border-t ${THEME_CLASSES.border} p-4 md:p-6 sticky bottom-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]`}>
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <span className={`text-xs ${THEME_CLASSES.textMuted} font-medium hidden sm:inline`}>Sisa Waktu: {formatTime(timeLeft)}</span>
            <button onClick={submitExam} className={`px-8 py-3.5 rounded-xl flex items-center gap-2 ${PRIMARY_BUTTON_STYLE}`}>
              KIRIM JAWABAN <Send size={18} />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // --- VIEW: RESULT (Student) ---
  if (view === 'result') {
    return (
      <div className={`min-h-screen bg-[#0E21A0] flex items-center justify-center p-4`}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-center relative">
          <div className="p-8 pb-4">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Award size={40} className="text-[#0E21A0]" />
            </div>
            <h2 className="text-3xl font-bold text-[#0E21A0] mb-1">Ujian Selesai</h2>
            <p className="text-gray-500">{selectedSubject?.name}</p>
          </div>
          <div className="px-8 py-6">
            <div className="text-7xl font-bold text-[#0E21A0] mb-2">{currentScore}</div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Skor Pilihan Ganda</p>
            {essayAnsweredCount > 0 && <p className="text-xs text-orange-600 font-bold mt-3 bg-orange-50 border border-orange-100 inline-block px-3 py-1.5 rounded-lg">+ {essayAnsweredCount} Jawaban Esai (Menunggu Review)</p>}
          </div>
          <div className="p-6">
            <button onClick={() => { setStudentData({name: '', nim: ''}); setExamAnswers({}); setView('home'); }} className={`w-full py-3.5 rounded-xl ${PRIMARY_BUTTON_STYLE}`}>
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: ADMIN DASHBOARD ---
  const adminQuestionsToShow = getFilteredQuestions(selectedSubject?.id);

  return (
    <div className={`min-h-screen ${THEME_CLASSES.bgMain} flex flex-col relative`}>
      <PrintStyles />
      {/* Result Details Modal */}
      {selectedResultDetail && <ResultDetailModal />}

      <nav className={`bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 no-print shadow-sm`}>
        <div className="flex items-center gap-3 font-bold text-[#0E21A0]">
          <div className="bg-[#0E21A0] text-white p-1.5 rounded-lg">CBT</div>
          <span className="text-lg hidden md:inline">Panel Dosen</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1.5 rounded-xl overflow-x-auto">
          {[{ id: 'subjects', label: 'Mata Kuliah', icon: BookOpen }, { id: 'questions', label: 'Bank Soal', icon: List }, { id: 'results', label: 'Rekap Nilai', icon: Award }, { id: 'attendance', label: 'Data Absensi', icon: CalendarCheck }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <tab.icon size={16} /><span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => setView('home')} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition"><LogOut size={20} /></button>
      </nav>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full no-print">
        {activeTab === 'subjects' && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className={`${THEME_CLASSES.bgCard} p-6 rounded-2xl shadow-sm border border-blue-100 sticky top-24`}>
                <h3 className={`font-bold ${THEME_CLASSES.deepBlueText} mb-4 flex items-center gap-2`}><Plus size={18} /> Tambah Matkul</h3>
                <div className="space-y-3">
                  <input className={`w-full p-3 rounded-xl text-sm border outline-none ${THEME_CLASSES.input}`} placeholder="Kode (mis: IS101)" value={newSubject.code} onChange={e => setNewSubject({...newSubject, code: e.target.value})} />
                  <input className={`w-full p-3 rounded-xl text-sm border outline-none ${THEME_CLASSES.input}`} placeholder="Nama Mata Kuliah" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={`text-[10px] uppercase font-bold ${THEME_CLASSES.textMuted} ml-1`}>Tenggat</label>
                        <input type="date" className={`w-full p-2 rounded-lg text-xs border outline-none ${THEME_CLASSES.input}`} value={newSubject.deadline} onChange={e => setNewSubject({...newSubject, deadline: e.target.value})} />
                    </div>
                    <div>
                        <label className={`text-[10px] uppercase font-bold ${THEME_CLASSES.textMuted} ml-1`}>Durasi (Menit)</label>
                        <input type="number" className={`w-full p-2 rounded-lg text-xs border outline-none ${THEME_CLASSES.input}`} value={newSubject.duration} onChange={e => setNewSubject({...newSubject, duration: e.target.value})} />
                    </div>
                  </div>
                  <button onClick={addSubject} className={`w-full py-3 rounded-xl text-sm ${PRIMARY_BUTTON_STYLE}`}>Simpan</button>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              {subjects.map(s => (
                <div key={s.id} className={`${THEME_CLASSES.bgCard} p-5 rounded-2xl shadow-sm border ${THEME_CLASSES.border} flex justify-between items-center hover:border-blue-200 transition`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs font-bold text-white bg-gray-400 px-2 py-1 rounded">{s.code}</span>
                      <h4 className={`font-bold ${THEME_CLASSES.deepBlueText} text-lg`}>{s.name}</h4>
                    </div>
                    <p className={`text-xs ${THEME_CLASSES.textMuted}`}>
                        Deadline: {s.deadline || '-'} | Durasi: {s.duration || 60}m
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setSelectedSubject(s); setActiveTab('questions'); }} className={`px-4 py-2 text-xs rounded-lg ${PRIMARY_BUTTON_STYLE}`}>Kelola Soal</button>
                    <button onClick={() => deleteSubject(s.id)} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="flex flex-col h-full">
            <div className={`mb-6 flex items-center gap-4 ${THEME_CLASSES.bgCard} p-4 rounded-xl shadow-sm border ${THEME_CLASSES.border}`}>
              <span className={`text-sm font-bold ${THEME_CLASSES.textMuted}`}>Edit Soal Untuk:</span>
              <select className={`p-2.5 border rounded-lg font-bold flex-1 outline-none ${THEME_CLASSES.input}`}
                value={selectedSubject?.id || ''} onChange={(e) => { const sub = subjects.find(s => s.id === e.target.value); setSelectedSubject(sub); }}>
                <option value="">-- Pilih Mata Kuliah --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedSubject ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div className={`${THEME_CLASSES.bgCard} p-6 rounded-2xl shadow-sm h-fit border border-blue-50`}>
                  <h3 className={`font-bold ${THEME_CLASSES.deepBlueText} mb-4 flex items-center gap-2`}><Edit size={18} /> {editingQuestion ? 'Edit Soal' : 'Buat Soal Baru'}</h3>
                  <div className="mb-4 bg-gray-100 p-1 rounded-lg flex">
                      <button onClick={() => setQuestionForm({...questionForm, type: 'choice'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${questionForm.type === 'choice' ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500'}`}>Pilihan Ganda</button>
                      <button onClick={() => setQuestionForm({...questionForm, type: 'essay'})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${questionForm.type === 'essay' ? 'bg-white text-[#0E21A0] shadow-sm' : 'text-gray-500'}`}>Esai</button>
                  </div>
                  <textarea className={`w-full p-3 border rounded-xl mb-4 text-sm outline-none ${THEME_CLASSES.input}`} rows="4" placeholder="Tulis pertanyaan disini..." value={questionForm.text} onChange={e => setQuestionForm({...questionForm, text: e.target.value})}></textarea>
                  {questionForm.type === 'choice' && (
                    <div className="space-y-2 mb-6">
                        {questionForm.options.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <input type="radio" name="correct-opt" checked={questionForm.correctIndex === idx} onChange={() => setQuestionForm({...questionForm, correctIndex: idx})} className="cursor-pointer" />
                            <input className={`flex-1 p-2.5 border rounded-lg text-sm outline-none ${THEME_CLASSES.input}`} placeholder={`Pilihan ${idx + 1}`} value={opt} onChange={e => { const newOpts = [...questionForm.options]; newOpts[idx] = e.target.value; setQuestionForm({...questionForm, options: newOpts}); }} />
                        </div>
                        ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    {editingQuestion && <button onClick={() => { setEditingQuestion(null); setQuestionForm({text:'', type:'choice', options:['','','',''], correctIndex:0}); }} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">Batal</button>}
                    <button onClick={saveQuestion} className={`flex-1 py-2.5 rounded-xl ${PRIMARY_BUTTON_STYLE}`}>Simpan Soal</button>
                  </div>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {adminQuestionsToShow.map((q, idx) => (
                      <div key={q.id} className={`${THEME_CLASSES.bgCard} p-5 rounded-2xl border ${THEME_CLASSES.border} hover:border-blue-300 transition group relative shadow-sm`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-blue-50 text-[#0E21A0] w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold">{idx+1}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${q.type === 'essay' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{q.type === 'essay' ? 'ESAI' : 'PG'}</span>
                          <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition absolute right-3 top-3 ${THEME_CLASSES.bgCard} shadow-sm p-1 rounded-lg border`}>
                             <button onClick={() => { setEditingQuestion(q); setQuestionForm({text: q.text, type: q.type || 'choice', options: q.options || ['','','',''], correctIndex: q.correctIndex || 0}); }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit size={14}/></button>
                             <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={14}/></button>
                          </div>
                        </div>
                        <p className={`${THEME_CLASSES.deepBlueText} text-sm mb-3 whitespace-pre-wrap leading-relaxed`}>{q.text}</p>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className={`text-center py-20 ${THEME_CLASSES.bgCard} rounded-2xl border-dashed border-2 ${THEME_CLASSES.border}`}><p className={THEME_CLASSES.textMuted}>Pilih mata kuliah di atas untuk mengelola soal.</p></div>
            )}
          </div>
        )}

        {/* TAB: RESULTS (REKAP NILAI) */}
        {activeTab === 'results' && (
            <div className={`${THEME_CLASSES.bgCard} rounded-2xl shadow-sm border ${THEME_CLASSES.border} overflow-hidden`}>
                <div className={`p-6 border-b flex justify-between items-center ${THEME_CLASSES.border}`}><h3 className={`font-bold ${THEME_CLASSES.deepBlueText}`}>Rekapitulasi Nilai</h3><button onClick={() => window.print()} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${PRIMARY_BUTTON_STYLE}`}><Printer size={16} /> Cetak</button></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-3">Nama</th>
                                <th className="px-6 py-3">Mata Kuliah</th>
                                <th className="px-6 py-3 text-center">Skor (PG)</th>
                                <th className="px-6 py-3 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(r => (
                                <tr key={r.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => setSelectedResultDetail(r)}>
                                    <td className={`px-6 py-3 font-bold ${THEME_CLASSES.deepBlueText}`}>{r.studentName}</td>
                                    <td className={`px-6 py-3 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{r.subjectName}</td>
                                    <td className={`px-6 py-3 text-center font-bold ${THEME_CLASSES.deepBlueText}`}>{r.mcqScore}</td>
                                    <td className="px-6 py-3 text-center">
                                        <button className="text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1 w-full"><Eye size={16}/> Detail</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {/* TAB: ATTENDANCE (ABSENSI) */}
        {activeTab === 'attendance' && (
            <div className={`${THEME_CLASSES.bgCard} rounded-2xl shadow-sm border ${THEME_CLASSES.border} overflow-hidden`}>
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${THEME_CLASSES.border}`}>
                    <h3 className={`font-bold ${THEME_CLASSES.deepBlueText}`}>Data Absensi</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setAttendanceView('daily')} className={`px-3 py-1 text-xs font-bold rounded ${attendanceView==='daily' ? 'bg-[#0E21A0] text-white' : 'bg-gray-100 text-gray-600'}`}>Harian</button>
                        <button onClick={() => setAttendanceView('weekly')} className={`px-3 py-1 text-xs font-bold rounded ${attendanceView==='weekly' ? 'bg-[#0E21A0] text-white' : 'bg-gray-100 text-gray-600'}`}>Mingguan</button>
                        <button onClick={() => window.print()} className={`ml-2 flex items-center gap-2 px-3 py-1 rounded text-xs ${PRIMARY_BUTTON_STYLE}`}><Printer size={14} /> Cetak</button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    {attendanceView === 'daily' ? (
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs"><tr><th className="px-6 py-3">Waktu</th><th className="px-6 py-3">Nama</th><th className="px-6 py-3">Matkul</th></tr></thead>
                            <tbody>{attendanceList.map(r => <tr key={r.id} className="hover:bg-blue-50"><td className={`px-6 py-3 ${darkMode ? 'text-gray-300' : ''}`}>{new Date(r.timestamp?.seconds * 1000).toLocaleString()}</td><td className={`px-6 py-3 font-bold ${THEME_CLASSES.deepBlueText}`}>{r.studentName}</td><td className={`px-6 py-3 ${darkMode ? 'text-gray-300' : ''}`}>{r.subjectName}</td></tr>)}</tbody>
                        </table>
                    ) : (
                        <div className="p-4 space-y-4">
                            {Object.entries(getWeeklyAttendance()).map(([weekKey, records]) => (
                                <div key={weekKey} className={`border rounded-xl overflow-hidden ${THEME_CLASSES.border}`}>
                                    <div className="bg-gray-100 px-4 py-2 font-bold text-[#0E21A0] text-sm flex justify-between">
                                        <span>{weekKey}</span>
                                        <span className="bg-white px-2 rounded text-xs border border-gray-300 text-gray-600">Total: {records.length} Mhs</span>
                                    </div>
                                    <table className="w-full text-left text-sm text-gray-600">
                                        <tbody>
                                            {records.map(r => (
                                                <tr key={r.id} className={`border-b last:border-0 hover:bg-gray-50 ${THEME_CLASSES.border}`}>
                                                    <td className={`px-4 py-2 w-32 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(r.timestamp?.seconds * 1000).toLocaleDateString()}</td>
                                                    <td className={`px-4 py-2 font-bold ${THEME_CLASSES.deepBlueText}`}>{r.studentName}</td>
                                                    <td className={`px-4 py-2 text-xs ${darkMode ? 'text-gray-300' : ''}`}>{r.subjectName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* PRINT VIEW - UPDATED WITH NIM & TANGGAL */}
      <div className="print-only p-8">
        <div className="mb-6 border-b pb-4 text-center">
           <div className="flex items-center justify-center gap-4 mb-4"><LogoDisplay size="w-20 h-20" iconSize={40} /><div className="text-left"><h4 className="text-2xl font-bold uppercase leading-none">Politeknik Haji Anwar Sanusi</h4><p className="text-sm uppercase">Laporan Akademik</p></div></div>
           <h1 className="text-xl font-bold uppercase mb-2">Laporan Hasil Ujian & Absensi</h1>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
                <tr className="bg-gray-100">
                    <th className="border p-2">No</th>
                    <th className="border p-2">NIM</th>
                    <th className="border p-2">Nama</th>
                    <th className="border p-2">Tanggal Kehadiran</th>
                    <th className="border p-2">Keterangan</th>
                </tr>
            </thead>
            <tbody>
                {(activeTab === 'results' ? results : attendanceList).map((r, i) => (
                    <tr key={r.id}>
                        <td className="border p-2 text-center">{i+1}</td>
                        <td className="border p-2 text-center font-mono">{r.studentNIM}</td>
                        <td className="border p-2">{r.studentName}</td>
                        <td className="border p-2 text-center">
                            {r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}
                        </td>
                        <td className="border p-2 text-center font-bold">
                            {activeTab === 'results' ? `Skor: ${r.mcqScore}` : 'Hadir'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="mt-8 text-right"><p className="mb-16">Mengetahui, Dosen Pengampu</p><p className="font-bold underline">(.......................................)</p></div>
      </div>
    </div>
  );
}