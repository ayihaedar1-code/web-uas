import React, { useState, useEffect, useMemo } from 'react';
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
  where, 
  serverTimestamp,
  orderBy 
} from 'firebase/firestore';
import { 
  BookOpen, 
  Users, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  LogOut, 
  ChevronRight, 
  FileText, 
  Award,
  Printer,
  Lock,
  ArrowLeft
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
// --- Firebase Configuration & Initialization ---
// --- Firebase Configuration & Initialization ---
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

// Kita hapus appId dinamis, ganti string biasa untuk nama koleksi
// Ganti logika fetch collection di seluruh kode:
// DARI: collection(db, 'artifacts', appId, 'public', 'data', 'subjects')
// JADI: collection(db, 'subjects')

// --- Main Application Component ---
export default function CBTSystem() {
  // --- State Management ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, student-login, exam, result, admin-login, admin-dashboard
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [subjects, setSubjects] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  
  // Interaction States
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [studentData, setStudentData] = useState({ name: '', nim: '' });
  const [examAnswers, setExamAnswers] = useState({});
  const [currentScore, setCurrentScore] = useState(0);
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTab, setActiveTab] = useState('subjects'); // subjects, questions, results
  
  // Form States for Admin
  const [newSubject, setNewSubject] = useState({ name: '', code: '', isActive: true });
  const [editingQuestion, setEditingQuestion] = useState(null); // null means adding mode
  const [questionForm, setQuestionForm] = useState({
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0
  });

  // --- Authentication & Setup ---
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

  // --- Data Fetching Functions ---
  const fetchSubjects = async () => {
    if (!user) return;
    const q = collection(db,'subjects');
    const snapshot = await getDocs(q);
    setSubjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchQuestions = async (subjectId) => {
    if (!user || !subjectId) return;
    const q = collection(db,'questions'); // Fetch all then filter client side due to limitations
    const snapshot = await getDocs(q);
    // Simple client-side filter for the demo rule adherence
    const allQ = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setQuestions(allQ.filter(q => q.subjectId === subjectId));
  };

  const fetchResults = async () => {
    if (!user) return;
    const q = collection(db,'results');
    const snapshot = await getDocs(q);
    const resData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort client side
    resData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    setResults(resData);
  };

  // --- Effects ---
  useEffect(() => {
    if (user) {
      fetchSubjects();
    }
  }, [user]);

  useEffect(() => {
    if (view === 'admin-dashboard' && activeTab === 'results') {
      fetchResults();
    }
  }, [view, activeTab]);

  // --- Student Actions ---
  const handleStudentLogin = async (e) => {
    e.preventDefault();
    if (!studentData.name || !studentData.nim || !selectedSubject) return;

    // Check if already taken
    const q = collection(db,'results');
    const snapshot = await getDocs(q);
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

  const submitExam = async () => {
    if (!questions.length) return;

    let correctCount = 0;
    questions.forEach(q => {
      if (examAnswers[q.id] === q.correctIndex) correctCount++;
    });

    const finalScore = Math.round((correctCount / questions.length) * 100);
    setCurrentScore(finalScore);

    // Save Result
    try {
      await addDoc(collection(db,'results'), {
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        studentName: studentData.name,
        studentNIM: studentData.nim,
        score: finalScore,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
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
    await addDoc(collection(db,'subjects'), newSubject);
    setNewSubject({ name: '', code: '', isActive: true });
    fetchSubjects();
  };

  const deleteSubject = async (id) => {
    if (confirm('Hapus mata kuliah ini? Semua soal terkait akan tetap ada namun tidak terhubung.')) {
      await deleteDoc(doc(db,'subjects', id));
      fetchSubjects();
    }
  };

  const saveQuestion = async () => {
    if (!selectedSubject || !questionForm.text) return;

    const payload = {
      ...questionForm,
      subjectId: selectedSubject.id
    };

    if (editingQuestion) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', editingQuestion.id), payload);
    } else {
      await addDoc(collection(db, 'questions'), payload);
    }

    setEditingQuestion(null);
    setQuestionForm({ text: '', options: ['', '', '', ''], correctIndex: 0 });
    fetchQuestions(selectedSubject.id);
  };

  const deleteQuestion = async (id) => {
    if (confirm('Hapus soal ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'questions', id));
      fetchQuestions(selectedSubject.id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- Rendering Helpers ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-purple-50 text-purple-600">Memuat Sistem Ujian...</div>;

  // --- VIEW: HOME ---
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex flex-col items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <button onClick={() => setView('admin-login')} className="flex items-center gap-2 text-purple-700 font-medium hover:text-purple-900 transition">
            <Lock size={16} /> Akses Dosen
          </button>
        </div>

        <div className="text-center mb-12 animate-fade-in-up">
          <div className="bg-purple-100 p-4 rounded-full inline-block mb-4">
            <BookOpen size={48} className="text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">CBT System Online</h1>
          <p className="text-gray-500">Platform Ujian Berbasis Komputer Modern & Aman</p>
        </div>

        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          {subjects.filter(s => s.isActive).length === 0 ? (
            <div className="col-span-full text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-400">Belum ada ujian yang tersedia saat ini.</p>
            </div>
          ) : (
            subjects.filter(s => s.isActive).map(subject => (
              <div key={subject.id} className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 hover:shadow-md hover:border-purple-300 transition cursor-pointer group"
                   onClick={() => { setSelectedSubject(subject); setView('student-login'); }}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded mb-2 inline-block">
                      {subject.code}
                    </span>
                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-purple-700 transition">{subject.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">Klik untuk mulai ujian</p>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-purple-500" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- VIEW: STUDENT LOGIN ---
  if (view === 'student-login') {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-purple-100">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">
            <ArrowLeft size={16} /> Kembali
          </button>
          
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Identitas Peserta</h2>
            <p className="text-purple-600 font-medium">{selectedSubject?.name}</p>
          </div>

          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
              <input 
                required
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Masukkan nama lengkap"
                value={studentData.name}
                onChange={e => setStudentData({...studentData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Induk Mahasiswa (NIM)</label>
              <input 
                required
                type="text" 
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Contoh: 12345678"
                value={studentData.nim}
                onChange={e => setStudentData({...studentData, nim: e.target.value})}
              />
            </div>
            <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg flex items-start gap-2">
              <div className="mt-0.5"><Users size={14} /></div>
              <p>Pastikan data benar. Anda hanya memiliki 1x kesempatan untuk mengerjakan ujian mata kuliah ini.</p>
            </div>
            <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-200 transition transform active:scale-95">
              Mulai Ujian
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
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-800">{selectedSubject?.name}</h2>
              <div className="text-xs text-gray-500 flex gap-3">
                <span>{studentData.name}</span>
                <span>•</span>
                <span>{studentData.nim}</span>
              </div>
            </div>
            <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
              Soal: {Object.keys(examAnswers).length} / {questions.length}
            </div>
          </div>
        </header>

        {/* Question Area */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 pb-20">
          {questions.length === 0 ? (
             <div className="text-center text-gray-500 mt-20">Soal belum tersedia. Hubungi Dosen.</div>
          ) : (
            <div className="space-y-8">
              {questions.map((q, idx) => (
                <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-medium text-lg mb-4">{q.text}</p>
                      <div className="space-y-3">
                        {q.options.map((opt, optIdx) => (
                          <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            examAnswers[q.id] === optIdx 
                            ? 'border-purple-500 bg-purple-50' 
                            : 'border-gray-200 hover:border-purple-300'
                          }`}>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              examAnswers[q.id] === optIdx ? 'border-purple-600' : 'border-gray-300'
                            }`}>
                              {examAnswers[q.id] === optIdx && <div className="w-2.5 h-2.5 bg-purple-600 rounded-full" />}
                            </div>
                            <input 
                              type="radio" 
                              name={`question-${q.id}`} 
                              className="hidden"
                              onChange={() => setExamAnswers({...examAnswers, [q.id]: optIdx})}
                            />
                            <span className="text-gray-700">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t p-4 sticky bottom-0">
          <div className="max-w-4xl mx-auto flex justify-end">
            <button 
              onClick={submitExam}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-purple-200 transition"
            >
              KIRIM JAWABAN
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // --- VIEW: RESULT ---
  if (view === 'result') {
    return (
      <div className="min-h-screen bg-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-center relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-400 to-pink-500"></div>
          
          <div className="p-8 pb-4">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Award size={40} className="text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">Hasil Ujian</h2>
            <p className="text-gray-500">{selectedSubject?.name}</p>
          </div>

          <div className="px-8 py-6">
            <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-purple-600 to-pink-600 mb-2">
              {currentScore}
            </div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Skor Akhir</p>
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-100 grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-xs text-gray-400">Nama Mahasiswa</p>
              <p className="font-bold text-gray-800">{studentData.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">NIM</p>
              <p className="font-bold text-gray-800">{studentData.nim}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Soal</p>
              <p className="font-bold text-gray-800">{questions.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Waktu Submit</p>
              <p className="font-bold text-gray-800">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="p-6">
            <button 
              onClick={() => {
                setStudentData({name: '', nim: ''});
                setExamAnswers({});
                setView('home');
              }}
              className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition"
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
        <div className="bg-white p-8 rounded-2xl w-full max-w-sm">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
            <Lock size={20} className="text-purple-600" /> Panel Dosen
          </h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input 
              type="password" 
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
              placeholder="Masukkan Kode Akses"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setView('home')} className="flex-1 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Batal</button>
              <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Masuk</button>
            </div>
          </form>
          <p className="text-xs text-center text-gray-400 mt-4">Default: admin123</p>
        </div>
      </div>
    );
  }

  // --- VIEW: ADMIN DASHBOARD ---
  // A print-specific stylesheet to hide UI elements during printing
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
      }
      .print-only { display: none; }
    `}</style>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PrintStyles />
      
      {/* Admin Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 no-print">
        <div className="flex items-center gap-2 font-bold text-gray-800">
          <div className="bg-purple-600 text-white p-1 rounded">CBT</div>
          <span>Panel Dosen</span>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {['subjects', 'questions', 'results'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                activeTab === tab ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'subjects' ? 'Mata Kuliah' : tab === 'questions' ? 'Bank Soal' : 'Rekap Nilai'}
            </button>
          ))}
        </div>
        <button onClick={() => setView('home')} className="text-gray-400 hover:text-red-500">
          <LogOut size={20} />
        </button>
      </nav>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full no-print">
        
        {/* TAB: SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Create Subject */}
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 sticky top-24">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-purple-600" /> Tambah Matkul
                </h3>
                <div className="space-y-3">
                  <input 
                    className="w-full p-2 border rounded-lg text-sm" 
                    placeholder="Kode (mis: IS101)" 
                    value={newSubject.code}
                    onChange={e => setNewSubject({...newSubject, code: e.target.value})}
                  />
                  <input 
                    className="w-full p-2 border rounded-lg text-sm" 
                    placeholder="Nama Mata Kuliah"
                    value={newSubject.name}
                    onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
                  />
                  <button onClick={addSubject} className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                    Simpan
                  </button>
                </div>
              </div>
            </div>
            
            {/* List Subjects */}
            <div className="md:col-span-2 space-y-4">
              {subjects.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{s.code}</span>
                      <h4 className="font-bold text-gray-800">{s.name}</h4>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">ID: {s.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                         setSelectedSubject(s);
                         fetchQuestions(s.id);
                         setActiveTab('questions');
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                    >
                      Kelola Soal
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="text-gray-400 hover:text-red-500">
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
            {/* Subject Selector Header */}
            <div className="mb-6 flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
              <span className="text-sm text-gray-500">Edit Soal Untuk:</span>
              <select 
                className="p-2 border rounded-lg bg-gray-50 font-bold text-gray-800 flex-1 outline-none"
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
                {/* Form */}
                <div className="bg-white p-6 rounded-2xl shadow-sm h-fit">
                  <h3 className="font-bold text-gray-800 mb-4">{editingQuestion ? 'Edit Soal' : 'Buat Soal Baru'}</h3>
                  <textarea 
                    className="w-full p-3 border rounded-lg mb-4 text-sm" 
                    rows="3"
                    placeholder="Pertanyaan..."
                    value={questionForm.text}
                    onChange={e => setQuestionForm({...questionForm, text: e.target.value})}
                  ></textarea>
                  
                  <div className="space-y-2 mb-4">
                    {questionForm.options.map((opt, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="radio" 
                          name="correct-opt"
                          checked={questionForm.correctIndex === idx}
                          onChange={() => setQuestionForm({...questionForm, correctIndex: idx})}
                        />
                        <input 
                          className="flex-1 p-2 border rounded text-sm"
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
                  <div className="flex gap-2">
                    {editingQuestion && (
                      <button onClick={() => { setEditingQuestion(null); setQuestionForm({text:'', options:['','','',''], correctIndex:0}); }} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg">Batal</button>
                    )}
                    <button onClick={saveQuestion} className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Simpan Soal</button>
                  </div>
                </div>

                {/* List */}
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                   <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-gray-700">Daftar Soal ({questions.length})</span>
                   </div>
                   {questions.map((q, idx) => (
                     <div key={q.id} className="bg-white p-4 rounded-xl border hover:border-purple-300 transition group relative">
                       <div className="flex justify-between items-start mb-2">
                         <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded flex items-center justify-center text-xs font-bold">{idx+1}</span>
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                            <button onClick={() => { setEditingQuestion(q); setQuestionForm({text: q.text, options: q.options, correctIndex: q.correctIndex}); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={16}/></button>
                            <button onClick={() => deleteQuestion(q.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                         </div>
                       </div>
                       <p className="text-gray-800 text-sm mb-2">{q.text}</p>
                       <p className="text-xs text-green-600 font-medium">Jawaban: {q.options[q.correctIndex]}</p>
                     </div>
                   ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-2xl border-dashed border-2 border-gray-200">
                <p className="text-gray-400">Pilih mata kuliah di atas untuk mengelola soal.</p>
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
                     // Just filtering the display, real apps might query again
                     const val = e.target.value;
                     if (val === 'all') fetchResults();
                     else {
                        // Assuming fetchResults gets all, we filter local state for view
                        // Ideally we query filtered data, but for simplicity:
                        fetchResults().then(() => {
                           setResults(prev => prev.filter(r => r.subjectId === val));
                        });
                     }
                   }}
                 >
                   <option value="all">Semua Mata Kuliah</option>
                   {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900">
                   <Printer size={16} /> Cetak PDF
                 </button>
               </div>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-gray-600">
                 <thead className="bg-gray-50 text-gray-700 uppercase font-bold text-xs">
                   <tr>
                     <th className="px-6 py-3">Tanggal</th>
                     <th className="px-6 py-3">NIM</th>
                     <th className="px-6 py-3">Nama Mahasiswa</th>
                     <th className="px-6 py-3">Mata Kuliah</th>
                     <th className="px-6 py-3 text-center">Benar</th>
                     <th className="px-6 py-3 text-right">Skor Akhir</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {results.map(r => (
                     <tr key={r.id} className="hover:bg-purple-50 transition">
                       <td className="px-6 py-3">{r.timestamp ? new Date(r.timestamp.seconds * 1000).toLocaleDateString() : '-'}</td>
                       <td className="px-6 py-3 font-mono text-xs">{r.studentNIM}</td>
                       <td className="px-6 py-3 font-bold text-gray-800">{r.studentName}</td>
                       <td className="px-6 py-3"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">{r.subjectName}</span></td>
                       <td className="px-6 py-3 text-center">{r.correctAnswers} / {r.totalQuestions}</td>
                       <td className="px-6 py-3 text-right font-bold text-purple-600 text-lg">{r.score}</td>
                     </tr>
                   ))}
                   {results.length === 0 && (
                     <tr><td colSpan="6" className="text-center py-8 text-gray-400">Belum ada data nilai.</td></tr>
                   )}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>

      {/* PRINT VIEW (Hidden by default, visible on print) */}
      <div className="print-only p-8">
        <div className="mb-6 border-b pb-4 text-center">
           <h1 className="text-2xl font-bold uppercase mb-2">Laporan Hasil Ujian</h1>
           <p className="text-sm text-gray-600">Dicetak pada: {new Date().toLocaleString()}</p>
        </div>
        <table className="w-full border-collapse border border-gray-300 text-sm">
           <thead>
             <tr className="bg-gray-100">
               <th className="border p-2">No</th>
               <th className="border p-2">NIM</th>
               <th className="border p-2">Nama Mahasiswa</th>
               <th className="border p-2">Mata Kuliah</th>
               <th className="border p-2">Skor</th>
             </tr>
           </thead>
           <tbody>
             {results.map((r, idx) => (
               <tr key={r.id}>
                 <td className="border p-2 text-center">{idx + 1}</td>
                 <td className="border p-2">{r.studentNIM}</td>
                 <td className="border p-2">{r.studentName}</td>
                 <td className="border p-2">{r.subjectName}</td>
                 <td className="border p-2 text-center font-bold">{r.score}</td>
               </tr>
             ))}
           </tbody>
        </table>
        <div className="mt-8 text-right">
           <p className="mb-16">Mengetahui, Dosen Pengampu</p>
           <p className="font-bold underline">(.......................................)</p>
        </div>
      </div>

    </div>
  );
}