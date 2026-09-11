import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, ShieldAlert, Mail, Copy, CheckCircle, WifiOff, Moon, Sun, Camera, Mic, MicOff, User, X, Menu, Home, Clock, MapPin, Globe } from 'lucide-react';
import { openDB } from 'idb';
import Logo from './components/Logo';

// Initialize IndexedDB for offline queue & history
const initDB = async () => {
  return openDB('CivicShieldDB', 2, {
    upgrade(db, oldVersion) {
      // v1 → create offlineQueue
      if (oldVersion < 1) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
      // v1 → v2: add reportHistory store for returning users
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('reportHistory')) {
          db.createObjectStore('reportHistory', { keyPath: 'id', autoIncrement: true });
        }
      }
    },
  });
};

function App() {
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [location, setLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Navigation & Menus
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState('home'); // 'home', 'history', 'nearby'
  const [historyList, setHistoryList] = useState([]);

  // Multilingual State
  const languages = [
    { name: 'English', code: 'en-IN' },
    { name: 'Hindi', code: 'hi-IN' },
    { name: 'Kannada', code: 'kn-IN' },
    { name: 'Tamil', code: 'ta-IN' },
    { name: 'Telugu', code: 'te-IN' },
    { name: 'Marathi', code: 'mr-IN' }
  ];
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0]);

  // Profile Settings State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('civicProfile');
      if (saved) return JSON.parse(saved);
    }
    return { name: '', email: '', phone: '', address: '' };
  });

  // Dark Mode State
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Geolocation failed, using default.", err)
      );
    }

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    loadHistory();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadHistory = async () => {
    try {
      const db = await initDB();
      const allHistory = await db.getAll('reportHistory');
      setHistoryList(allHistory.reverse());
    } catch(e) { console.error(e); }
  };

  const syncOfflineQueue = async () => {
    try {
      const db = await initDB();
      const items = await db.getAll('offlineQueue');
      
      for (const item of items) {
        const formData = new FormData();
        formData.append('image', item.file);
        formData.append('latitude', item.lat);
        formData.append('longitude', item.lng);
        formData.append('language', item.language || 'English');
        if (item.description) formData.append('description', item.description);
        if (item.userProfile) {
          if (item.userProfile.name) formData.append('user_name', item.userProfile.name);
          if (item.userProfile.email) formData.append('user_email', item.userProfile.email);
          if (item.userProfile.phone) formData.append('user_phone', item.userProfile.phone);
          if (item.userProfile.address) formData.append('user_address', item.userProfile.address);
        }

        try {
          const res = await fetch('/api/report', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            await db.add('reportHistory', { ...data, timestamp: new Date().toISOString() });
          }
        } catch (fetchErr) {
          console.error('Failed to sync item, will retry later:', fetchErr);
          continue;
        }
        // Delete only after successful fetch, using a fresh transaction
        await db.delete('offlineQueue', item.id);
      }
      if (items.length > 0) {
        alert("Offline reports have been synced successfully!");
        loadHistory();
      }
    } catch (e) {
      console.error("Failed to sync offline items", e);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = selectedLanguage.code;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech error", event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const saveProfile = (e) => {
    e.preventDefault();
    localStorage.setItem('civicProfile', JSON.stringify(userProfile));
    setShowProfileModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please upload or take an image.');
    
    setError('');
    
    if (isOffline) {
      try {
        const db = await initDB();
        await db.add('offlineQueue', {
          file: file,
          description: description,
          userProfile: userProfile,
          language: selectedLanguage.name,
          lat: location.lat,
          lng: location.lng,
          timestamp: new Date().toISOString()
        });
        alert('You are offline. The report has been saved locally and will be synced when you regain connection.');
        setFile(null);
        setDescription('');
      } catch (err) {
        setError('Failed to save offline report.');
      }
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('latitude', location.lat);
    formData.append('longitude', location.lng);
    formData.append('language', selectedLanguage.name);
    if (description) formData.append('description', description);
    
    if (userProfile.name) formData.append('user_name', userProfile.name);
    if (userProfile.email) formData.append('user_email', userProfile.email);
    if (userProfile.phone) formData.append('user_phone', userProfile.phone);
    if (userProfile.address) formData.append('user_address', userProfile.address);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Failed to analyze hazard.');
      }
      const data = await res.json();
      setReportData(data);
      
      // Save to history
      const db = await initDB();
      await db.add('reportHistory', { ...data, timestamp: new Date().toISOString() });
      loadHistory();
      
    } catch (err) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRTI = (questions) => {
    if (!questions) return;
    const rtiText = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
    navigator.clipboard.writeText(rtiText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Mock Nearby Data
  const mockNearbyHazards = [
    { id: 1, type: "Deep Pothole", location: "0.2 km away (MG Road)", score: 8, dept: "BBMP", status: "Reported 2 hrs ago" },
    { id: 2, type: "Fallen Streetlamp", location: "0.5 km away (Brigade Rd)", score: 9, dept: "BESCOM", status: "Reported 1 day ago" },
    { id: 3, type: "Open Manhole", location: "1.2 km away (Indiranagar)", score: 10, dept: "BWSSB", status: "Reported 5 mins ago" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 min-h-screen relative overflow-hidden">
      
      {/* Overlay for Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Hamburger Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-civic-surface dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <Logo showText={false} className="h-8 w-8" />
            <h2 className="text-2xl font-bold text-civic-primary dark:text-blue-400">CivicShield</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        <nav className="p-4 space-y-2 font-medium">
          <button 
            onClick={() => {setCurrentView('home'); setIsSidebarOpen(false);}} 
            className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors ${currentView === 'home' ? 'bg-civic-primary text-white dark:bg-blue-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Home size={20} /> Submit New Report
          </button>
          <button 
            onClick={() => {setCurrentView('history'); setIsSidebarOpen(false);}} 
            className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors ${currentView === 'history' ? 'bg-civic-primary text-white dark:bg-blue-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Clock size={20} /> My Past Reports
          </button>
          <button 
            onClick={() => {setCurrentView('nearby'); setIsSidebarOpen(false);}} 
            className={`w-full flex items-center gap-3 p-4 rounded-lg transition-colors ${currentView === 'nearby' ? 'bg-civic-primary text-white dark:bg-blue-600' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <MapPin size={20} /> Nearby Hazards <span className="ml-auto bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 text-xs px-2 py-1 rounded-full">3 Live</span>
          </button>
          <hr className="my-4 border-gray-200 dark:border-gray-700" />
          <button 
            onClick={() => {setShowProfileModal(true); setIsSidebarOpen(false);}} 
            className="w-full flex items-center gap-3 p-4 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <User size={20} /> Profile Settings
          </button>
        </nav>
      </div>

      {/* Top Navigation Bar */}
      <div className="flex justify-between items-center mb-10">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open Menu"
        >
          <Menu size={28} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1 shadow-sm">
            <Globe size={16} className="text-gray-500" />
            <select 
              value={selectedLanguage.code}
              onChange={(e) => setSelectedLanguage(languages.find(l => l.code === e.target.value))}
              className="bg-transparent text-sm font-medium text-gray-800 dark:text-gray-200 outline-none cursor-pointer p-1"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code} className="text-gray-900 dark:text-gray-900">{lang.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 p-2 px-4 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm font-medium text-sm"
          >
            <User size={16} /> {userProfile.name ? userProfile.name.split(' ')[0] : 'Setup Profile'}
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
            aria-label="Toggle Dark Mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* VIEW: HOME (New Report) */}
      {currentView === 'home' && (
        <div className="animate-fade-in">
          <header className="text-center mb-10">
            <Logo className="w-full max-w-[500px] mx-auto mb-4" />
            
            {isOffline && (
              <div className="mt-4 inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-full text-sm font-semibold border border-yellow-200 dark:border-yellow-800">
                <WifiOff size={16} /> You are offline. Reports will be saved locally.
              </div>
            )}
          </header>

          <main>
            <section className="card max-w-2xl mx-auto border-civic-surface dark:border-gray-700">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div 
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-civic-primary dark:hover:border-blue-400 hover:bg-civic-surface dark:hover:bg-gray-800 transition-colors cursor-pointer bg-white dark:bg-gray-900 flex flex-col justify-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="sr-only" />
                    <UploadCloud size={48} className="mx-auto text-civic-text-muted dark:text-gray-500 mb-3" />
                    <p className="text-sm font-semibold text-civic-primary dark:text-blue-300">Upload Photo</p>
                  </div>

                  <div 
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-civic-primary dark:hover:border-blue-400 hover:bg-civic-surface dark:hover:bg-gray-800 transition-colors cursor-pointer bg-white dark:bg-gray-900 flex flex-col justify-center"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="sr-only" />
                    <Camera size={48} className="mx-auto text-civic-text-muted dark:text-gray-500 mb-3" />
                    <p className="text-sm font-semibold text-civic-primary dark:text-blue-300">Take Live Photo</p>
                  </div>
                </div>

                {file && (
                  <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-3 rounded-md border border-green-200 dark:border-green-800 font-medium text-center text-sm">
                    Selected: {file.name}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="block text-sm font-medium text-civic-text-main dark:text-gray-300">Additional Details</label>
                    <button
                      type="button"
                      onClick={handleVoiceInput}
                      className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                        isListening ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 animate-pulse' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                      {isListening ? 'Listening...' : 'Dictate'}
                    </button>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the hazard (e.g., 'Deep pothole causing accidents near the school gate')"
                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-civic-text-main dark:text-gray-200 focus:ring-2 focus:ring-civic-primary dark:focus:ring-blue-500 outline-none min-h-[100px]"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-civic-alert dark:text-red-400 p-4 rounded-md border border-red-200 dark:border-red-800 font-medium">{error}</div>
                )}

                <button type="submit" className="w-full btn-primary text-lg h-14 flex items-center justify-center disabled:opacity-70" disabled={loading}>
                  {loading ? 'Analyzing Hazard...' : 'Submit Hazard Report'}
                </button>
              </form>
            </section>

            {/* Dashboard Results inline */}
            {reportData && (
              <div className="mt-10 space-y-8 animate-fade-in">
                <h2 className="text-3xl font-bold text-civic-primary dark:text-blue-400 border-b-2 border-gray-200 dark:border-gray-700 pb-3">Triage Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`card flex flex-col items-center justify-center text-center rounded-xl p-8 shadow-lg border-2 ${reportData.danger_score >= 8 ? 'border-civic-alert' : 'border-orange-500'}`}>
                    <ShieldAlert size={48} className={`mb-3 ${reportData.danger_score >= 8 ? 'text-civic-alert' : 'text-orange-500'}`} />
                    <h3 className="text-lg font-semibold uppercase">Danger Score</h3>
                    <div className={`mt-3 text-5xl font-black rounded-full w-24 h-24 flex items-center justify-center ${reportData.danger_score >= 8 ? 'bg-civic-alert text-white' : 'bg-orange-500 text-white'}`}>{reportData.danger_score}</div>
                  </div>
                  <div className="card md:col-span-2 flex flex-col justify-center">
                    <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400 mb-3">Hazard Summary</h3>
                    <p className="text-lg leading-relaxed">{reportData.hazard_summary}</p>
                    <div className="mt-6 inline-flex items-center bg-civic-surface dark:bg-gray-700 rounded-full px-4 py-2 w-fit border border-gray-200 dark:border-gray-600">
                      <span className="font-semibold text-civic-text-muted dark:text-civic-text-main-dark mr-2">Authority:</span>
                      <span className="font-bold text-civic-primary dark:text-blue-300">{reportData.responsible_authority}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400">Formal Petition</h3>
                      <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=contact@${reportData.responsible_authority.toLowerCase().replace(/[^a-z0-9]/g, '')}.gov.in&su=${encodeURIComponent(reportData.formal_petition.subject)}&body=${encodeURIComponent(reportData.formal_petition.body)}`} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700">
                        <Mail size={18} /> Send via Gmail
                      </a>
                    </div>
                    <div className="bg-civic-surface dark:bg-gray-900 p-5 rounded-lg flex-grow border border-gray-200 dark:border-gray-700">
                      <p className="font-bold mb-3 border-b border-gray-300 dark:border-gray-700 pb-2">Subject: <span className="font-normal">{reportData.formal_petition.subject}</span></p>
                      <p className="whitespace-pre-wrap text-sm">{reportData.formal_petition.body}</p>
                    </div>
                  </div>

                  <div className="card flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400">RTI Queries</h3>
                      <button onClick={() => handleCopyRTI(reportData.rti_questions)} className="btn-secondary flex items-center gap-2 text-sm">
                        {copied ? <CheckCircle size={18} className="text-green-600 dark:text-green-400" /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy RTI Draft'}
                      </button>
                    </div>
                    <div className="bg-civic-surface dark:bg-gray-900 p-5 rounded-lg flex-grow border border-gray-200 dark:border-gray-700">
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        {reportData.rti_questions.map((q, idx) => (<li key={idx}>{q.question}</li>))}
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* VIEW: HISTORY */}
      {currentView === 'history' && (
        <div className="animate-fade-in max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-civic-primary dark:text-blue-400 mb-6 flex items-center gap-3">
            <Clock /> My Past Reports
          </h2>
          
          {historyList.length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No past reports found.</p>
              <button onClick={() => setCurrentView('home')} className="mt-4 text-civic-primary dark:text-blue-400 hover:underline">Submit your first report</button>
            </div>
          ) : (
            <div className="space-y-4">
              {historyList.map(report => (
                <div key={report.id} className="card hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{report.hazard_summary.substring(0, 50)}...</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${report.danger_score >= 8 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400'}`}>
                      Score: {report.danger_score}/10
                    </span>
                  </div>
                  <p className="text-sm text-civic-text-muted dark:text-gray-400 mb-4">
                    Reported to {report.responsible_authority} on {new Date(report.timestamp).toLocaleDateString()}
                  </p>
                  <button onClick={() => {setReportData(report); setCurrentView('home');}} className="text-sm text-civic-primary dark:text-blue-400 font-semibold hover:underline">
                    View Full Petition Dashboard &rarr;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: NEARBY */}
      {currentView === 'nearby' && (
        <div className="animate-fade-in max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-civic-primary dark:text-blue-400 mb-6 flex items-center gap-3">
            <MapPin /> Nearby Hazards
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">These hazards were recently reported by other citizens near your location.</p>
          
          <div className="space-y-4">
            {mockNearbyHazards.map(hazard => (
              <div key={hazard.id} className="card relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-2 h-full ${hazard.score >= 9 ? 'bg-red-500' : 'bg-orange-500'}`} />
                <div className="pl-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg">{hazard.type}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{hazard.location}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm mt-3">
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300 font-medium">Dept: {hazard.dept}</span>
                    <span className="text-civic-text-muted dark:text-gray-500">{hazard.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-civic-primary dark:text-white flex items-center gap-2"><User /> Profile Details</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={saveProfile} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Saved securely on your device. Used to auto-sign your official petitions.
              </p>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Full Name</label>
                <input 
                  type="text" 
                  value={userProfile.name} 
                  onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-civic-primary"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Gmail Address</label>
                <input 
                  type="email" 
                  value={userProfile.email} 
                  onChange={e => setUserProfile({...userProfile, email: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-civic-primary"
                  placeholder="john.doe@gmail.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Phone Number</label>
                <input 
                  type="tel" 
                  value={userProfile.phone} 
                  onChange={e => setUserProfile({...userProfile, phone: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-civic-primary"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Residential Address</label>
                <textarea 
                  value={userProfile.address} 
                  onChange={e => setUserProfile({...userProfile, address: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-gray-900 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-civic-primary h-20 resize-none"
                  placeholder="House No, Street, Ward..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium">Cancel</button>
                <button type="submit" className="bg-civic-primary hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-6 py-2 rounded-md font-semibold transition-colors">
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
