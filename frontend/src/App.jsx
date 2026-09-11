import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, ShieldAlert, Mail, Copy, CheckCircle, WifiOff, Moon, Sun, Camera, Mic, MicOff, User, X } from 'lucide-react';
import { openDB } from 'idb';

// Initialize IndexedDB for offline queue
const initDB = async () => {
  return openDB('CivicShieldDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    try {
      const db = await initDB();
      const tx = db.transaction('offlineQueue', 'readwrite');
      const store = tx.objectStore('offlineQueue');
      const items = await store.getAll();
      
      for (const item of items) {
        const formData = new FormData();
        formData.append('image', item.file);
        formData.append('latitude', item.lat);
        formData.append('longitude', item.lng);
        if (item.description) formData.append('description', item.description);
        if (item.userProfile) {
          formData.append('user_name', item.userProfile.name);
          formData.append('user_email', item.userProfile.email);
          formData.append('user_phone', item.userProfile.phone);
          formData.append('user_address', item.userProfile.address);
        }

        await fetch('/api/report', { method: 'POST', body: formData });
        await store.delete(item.id);
      }
      if (items.length > 0) {
        alert("Offline reports have been synced successfully!");
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
    if (description) formData.append('description', description);
    
    // Add user details for petition signature
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
    } catch (err) {
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRTI = () => {
    if (!reportData) return;
    const rtiText = reportData.rti_questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
    navigator.clipboard.writeText(rtiText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const renderDashboard = () => {
    if (!reportData) return null;

    const dangerColor = reportData.danger_score >= 8 ? 'bg-civic-alert text-white' : 'bg-orange-500 text-white';
    
    // Construct target email and proper Gmail Web Intent URL
    const targetEmail = `contact@${reportData.responsible_authority.toLowerCase().replace(/[^a-z0-9]/g, '')}.gov.in`;
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${targetEmail}&su=${encodeURIComponent(reportData.formal_petition.subject)}&body=${encodeURIComponent(reportData.formal_petition.body)}`;

    return (
      <div className="mt-10 space-y-8 animate-fade-in" aria-live="polite">
        <h2 className="text-3xl font-bold text-civic-primary dark:text-blue-400 border-b-2 border-gray-200 dark:border-gray-700 pb-3" tabIndex="0">Triage Dashboard</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`card flex flex-col items-center justify-center text-center rounded-xl p-8 shadow-lg border-2 ${reportData.danger_score >= 8 ? 'border-civic-alert' : 'border-orange-500'}`} tabIndex="0" aria-label={`Danger Score: ${reportData.danger_score} out of 10`}>
            <ShieldAlert size={48} className={`mb-3 ${reportData.danger_score >= 8 ? 'text-civic-alert' : 'text-orange-500'}`} />
            <h3 className="text-lg font-semibold uppercase tracking-wider">Danger Score</h3>
            <div className={`mt-3 text-5xl font-black rounded-full w-24 h-24 flex items-center justify-center ${dangerColor}`}>
              {reportData.danger_score}
            </div>
            <p className="text-civic-text-muted dark:text-civic-text-muted-dark mt-2 text-sm font-medium">Out of 10</p>
          </div>

          <div className="card md:col-span-2 flex flex-col justify-center" tabIndex="0">
            <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400 mb-3">Hazard Summary</h3>
            <p className="text-lg leading-relaxed">{reportData.hazard_summary}</p>
            <div className="mt-6 inline-flex items-center bg-civic-surface dark:bg-gray-700 rounded-full px-4 py-2 w-fit border border-gray-200 dark:border-gray-600">
              <span className="font-semibold text-civic-text-muted dark:text-civic-text-main-dark mr-2">Responsible Authority:</span>
              <span className="font-bold text-civic-primary dark:text-blue-300">{reportData.responsible_authority}</span>
            </div>
          </div>
        </div>

        <div className="card" tabIndex="0">
          <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400 mb-4">Citizen Legal Rights</h3>
          <ul className="list-disc list-inside space-y-2">
            {reportData.citizen_legal_rights.map((right, idx) => (
              <li key={idx} className="leading-relaxed">{right}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card flex flex-col h-full" tabIndex="0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400">Formal Petition</h3>
              <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2 text-sm bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700" aria-label="Open in Gmail">
                <Mail size={18} /> Send via Gmail
              </a>
            </div>
            <div className="bg-civic-surface dark:bg-gray-900 p-5 rounded-lg flex-grow border border-gray-200 dark:border-gray-700">
              <p className="font-bold mb-3 border-b border-gray-300 dark:border-gray-700 pb-2">Subject: <span className="font-normal">{reportData.formal_petition.subject}</span></p>
              <p className="whitespace-pre-wrap">{reportData.formal_petition.body}</p>
            </div>
          </div>

          <div className="card flex flex-col h-full" tabIndex="0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-civic-primary dark:text-blue-400">Targeted RTI Queries</h3>
              <button onClick={handleCopyRTI} className="btn-secondary flex items-center gap-2 text-sm" aria-label="Copy RTI Draft to clipboard">
                {copied ? <CheckCircle size={18} className="text-green-600 dark:text-green-400" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy RTI Draft'}
              </button>
            </div>
            <div className="bg-civic-surface dark:bg-gray-900 p-5 rounded-lg flex-grow border border-gray-200 dark:border-gray-700">
              <ol className="list-decimal list-inside space-y-3">
                {reportData.rti_questions.map((q, idx) => (
                  <li key={idx} className="pl-2">{q.question}</li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      
      {/* Top Bar / Theme & Profile Toggles */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setShowProfileModal(true)}
          className="flex items-center gap-2 p-2 px-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium text-sm"
          aria-label="Edit Profile Details"
        >
          <User size={18} /> {userProfile.name ? 'Profile Saved' : 'Setup Profile'}
        </button>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          aria-label="Toggle Dark Mode"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <header className="text-center mb-12" tabIndex="0">
        <h1 className="text-5xl font-bold text-civic-primary dark:text-blue-400 tracking-tight mb-4">CivicShield</h1>
        <p className="text-xl text-civic-text-muted dark:text-civic-text-muted-dark max-w-2xl mx-auto">Transforming infrastructure hazards into actionable, legally-grounded municipal petitions.</p>
        
        {isOffline && (
          <div className="mt-4 inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-full text-sm font-semibold border border-yellow-200 dark:border-yellow-800" role="alert">
            <WifiOff size={16} /> You are offline. Reports will be saved locally.
          </div>
        )}
      </header>

      <main>
        <section className="card max-w-2xl mx-auto border-civic-surface dark:border-gray-700" aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="sr-only">Report Hazard</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-civic-primary dark:hover:border-blue-400 hover:bg-civic-surface dark:hover:bg-gray-800 transition-colors cursor-pointer bg-white dark:bg-gray-900 flex flex-col justify-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="sr-only" 
                />
                <UploadCloud size={48} className="mx-auto text-civic-text-muted dark:text-gray-500 mb-3" />
                <p className="text-sm font-semibold text-civic-primary dark:text-blue-300">Upload Photo</p>
              </div>

              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-civic-primary dark:hover:border-blue-400 hover:bg-civic-surface dark:hover:bg-gray-800 transition-colors cursor-pointer bg-white dark:bg-gray-900 flex flex-col justify-center"
                onClick={() => cameraInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={cameraInputRef}
                  onChange={handleFileChange} 
                  accept="image/*" 
                  capture="environment"
                  className="sr-only" 
                />
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
                <label htmlFor="description" className="block text-sm font-medium text-civic-text-main dark:text-gray-300">
                  Additional Details (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                    isListening 
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 animate-pulse' 
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  {isListening ? 'Listening...' : 'Dictate'}
                </button>
              </div>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the hazard (e.g., 'Deep pothole causing accidents near the school gate')"
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-civic-text-main dark:text-gray-200 focus:ring-2 focus:ring-civic-primary dark:focus:ring-blue-500 outline-none transition-all resize-y min-h-[100px]"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-civic-alert dark:text-red-400 p-4 rounded-md border border-red-200 dark:border-red-800 font-medium" role="alert">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="w-full btn-primary text-lg h-14 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Analyzing Hazard...
                </span>
              ) : 'Submit Hazard Report'}
            </button>
          </form>
        </section>

        {renderDashboard()}
      </main>

      {/* Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-civic-primary dark:text-white">Profile Details</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={saveProfile} className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                These details will be securely saved on your device and automatically injected into the legal petitions you generate.
              </p>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Full Name</label>
                <input 
                  type="text" 
                  value={userProfile.name} 
                  onChange={e => setUserProfile({...userProfile, name: e.target.value})}
                  className="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Gmail Address</label>
                <input 
                  type="email" 
                  value={userProfile.email} 
                  onChange={e => setUserProfile({...userProfile, email: e.target.value})}
                  className="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  placeholder="john.doe@gmail.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Phone Number</label>
                <input 
                  type="tel" 
                  value={userProfile.phone} 
                  onChange={e => setUserProfile({...userProfile, phone: e.target.value})}
                  className="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Residential Address</label>
                <textarea 
                  value={userProfile.address} 
                  onChange={e => setUserProfile({...userProfile, address: e.target.value})}
                  className="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-600 dark:text-white h-20"
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
