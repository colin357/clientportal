"use client";
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Mail, Layout, Check, X, Clock, Eye, ChevronRight, ChevronLeft, EyeOff, Share2, Users, Sparkles, UserPlus, Settings, Calendar, Video, Download, Wand2 } from 'lucide-react';

// Firebase imports - Make sure to install: npm install firebase
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Firebase configuration - Replace with your Firebase project credentials
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check if Firebase is properly configured
const isFirebaseConfigured = () => {
  const isConfigured = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your-api-key' &&
    firebaseConfig.projectId !== 'your-project-id'
  );

  if (!isConfigured) {
    console.error('❌ Firebase is not properly configured!');
    console.error('Please set up your Firebase environment variables in Vercel:');
    console.error('- NEXT_PUBLIC_FIREBASE_API_KEY');
    console.error('- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
    console.error('- NEXT_PUBLIC_FIREBASE_PROJECT_ID');
    console.error('- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
    console.error('- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
    console.error('- NEXT_PUBLIC_FIREBASE_APP_ID');
  } else {
    console.log('✅ Firebase configuration detected');
    console.log('Project ID:', firebaseConfig.projectId);
  }

  return isConfigured;
};

// Initialize Firebase (only if not already initialized)
let app;
let db;
let storage;

try {
  if (isFirebaseConfigured()) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized successfully');
    } else {
      app = getApps()[0];
      console.log('✅ Using existing Firebase app');
    }
    db = getFirestore(app);
    storage = getStorage(app);
    console.log('✅ Firestore and Storage connected');
  } else {
    console.warn('⚠️ Firebase not configured - app will not save data to cloud');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
}

const ClientPortal = () => {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    loadData();
    restoreSession();
  }, []);

  const restoreSession = () => {
    try {
      const savedSession = localStorage.getItem('userSession');
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        setCurrentUser(sessionData.user);
        setView(sessionData.view);
        console.log('✅ Session restored for:', sessionData.user.email || sessionData.user.role);
      }
    } catch (error) {
      console.error('❌ Error restoring session:', error);
      localStorage.removeItem('userSession');
    }
  };

  const saveSession = (user, viewName) => {
    try {
      localStorage.setItem('userSession', JSON.stringify({ user, view: viewName }));
      console.log('💾 Session saved');
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
  };

  const clearSession = () => {
    localStorage.removeItem('userSession');
    console.log('🗑️ Session cleared');
  };

  const loadData = async () => {
    if (!db) {
      console.warn('⚠️ Firestore not available - skipping data load');
      return;
    }

    try {
      console.log('📥 Loading data from Firestore...');

      // Load users from Firestore
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log(`✅ Loaded ${usersData.length} users from Firestore`);
      setUsers(usersData);

      // Load content from Firestore
      const contentSnapshot = await getDocs(collection(db, 'content'));
      const contentData = contentSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log(`✅ Loaded ${contentData.length} content items from Firestore`);
      setContent(contentData);

      // Load calendar events from Firestore
      const eventsSnapshot = await getDocs(collection(db, 'calendarEvents'));
      const eventsData = eventsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log(`✅ Loaded ${eventsData.length} calendar events from Firestore`);
      setCalendarEvents(eventsData);

      // Load groups from Firestore
      const groupsSnapshot = await getDocs(collection(db, 'groups'));
      const groupsData = groupsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log(`✅ Loaded ${groupsData.length} groups from Firestore`);
      setGroups(groupsData);
    } catch (e) {
      console.error('❌ Error loading data from cloud:', e);
      console.error('Error details:', e.message);
    }
  };

  const saveUsers = async (u) => {
    setUsers(u);

    if (!db) {
      console.warn('⚠️ Firestore not available - users not saved to cloud');
      return;
    }

    try {
      console.log(`💾 Saving ${u.length} users to Firestore...`);
      // Save each user to Firestore
      for (const user of u) {
        await setDoc(doc(db, 'users', user.id), user);
        console.log(`✅ Saved user: ${user.email} (ID: ${user.id})`);
      }
      console.log('✅ All users saved successfully');
    } catch (e) {
      console.error('❌ Error saving users to cloud:', e);
      console.error('Error details:', e.message);
    }
  };

  const saveContent = async (c) => {
    setContent(c);

    if (!db) {
      console.warn('⚠️ Firestore not available - content not saved to cloud');
      return;
    }

    try {
      console.log(`💾 Saving ${c.length} content items to Firestore...`);
      // Save each content item to Firestore
      for (const item of c) {
        await setDoc(doc(db, 'content', item.id), item);
        console.log(`✅ Saved content: ${item.title} (ID: ${item.id})`);
      }
      console.log('✅ All content saved successfully');
    } catch (e) {
      console.error('❌ Error saving content to cloud:', e);
      console.error('Error details:', e.message);
    }
  };

  const saveCalendarEvents = async (events) => {
    setCalendarEvents(events);

    if (!db) {
      console.warn('⚠️ Firestore not available - calendar events not saved to cloud');
      return;
    }

    try {
      console.log(`💾 Saving ${events.length} calendar events to Firestore...`);
      for (const event of events) {
        await setDoc(doc(db, 'calendarEvents', event.id), event);
        console.log(`✅ Saved event: ${event.title} (ID: ${event.id})`);
      }
      console.log('✅ All calendar events saved successfully');
    } catch (e) {
      console.error('❌ Error saving calendar events to cloud:', e);
      console.error('Error details:', e.message);
    }
  };

  const saveGroups = async (g) => {
    setGroups(g);

    if (!db) {
      console.warn('⚠️ Firestore not available - groups not saved to cloud');
      return;
    }

    try {
      console.log(`💾 Saving ${g.length} groups to Firestore...`);
      for (const group of g) {
        await setDoc(doc(db, 'groups', group.id), group);
        console.log(`✅ Saved group: ${group.name} (ID: ${group.id})`);
      }
      console.log('✅ All groups saved successfully');
    } catch (e) {
      console.error('❌ Error saving groups to cloud:', e);
      console.error('Error details:', e.message);
    }
  };

  const handleLogin = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      const targetView = user.onboarded ? 'dashboard' : 'onboarding';
      setCurrentUser(user);
      setView(targetView);
      saveSession(user, targetView);
      return true;
    }
    return false;
  };

  const handleSignup = async (email, password, companyName, firstName, lastName, phoneNumber) => {
    const newUser = {
      id: Date.now().toString(),
      email,
      password,
      companyName,
      firstName,
      lastName,
      phoneNumber: formatPhoneE164(phoneNumber),
      onboarded: false,
      createdAt: new Date().toISOString()
    };
    setCurrentUser(newUser);
    setView('onboarding');
    saveSession(newUser, 'onboarding');
    await saveUsers([...users, newUser]);
  };

  const handleOnboarding = async (answers) => {
    const updatedUser = { ...currentUser, onboarded: true, onboardingAnswers: answers };
    setCurrentUser(updatedUser);
    setView('dashboard');
    saveSession(updatedUser, 'dashboard');
    await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const handleContentAction = async (contentId, action, feedback = '') => {
    const updatedContent = content.map(c =>
      c.id === contentId ? { ...c, status: action, feedback, reviewedAt: new Date().toISOString() } : c
    );

    // Find the updated item for logging
    const updatedItem = updatedContent.find(c => c.id === contentId);
    console.log(`📝 Content ${action}:`, updatedItem?.title, 'Status:', updatedItem?.status);

    await saveContent(updatedContent);

    // Also update individual document in Firestore to ensure it's saved
    if (db && updatedItem) {
      try {
        await setDoc(doc(db, 'content', contentId), updatedItem);
        console.log('✅ Content status updated in Firestore:', contentId);
      } catch (error) {
        console.error('❌ Error updating content in Firestore:', error);
      }
    }

    // Send SMS notification to admin when content is approved or denied
    if (updatedItem && (action === 'approved' || action === 'rejected')) {
      const client = users.find(u => u.id === updatedItem.clientId);
      const actionText = action === 'approved' ? 'approved' : 'denied';
      const emoji = action === 'approved' ? '✅' : '❌';
      await sendSMS(
        '+17867882699',
        `${emoji} ${client?.companyName || 'Client'} ${actionText} content: "${updatedItem.title}" (${updatedItem.type})`
      );
    }
  };

  const formatPhoneE164 = (phone) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it's already 11 digits starting with 1, format it
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // If it's 10 digits, add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If it already starts with +1, return as is
    if (phone.startsWith('+1')) {
      return phone;
    }

    // Default: assume 10 digits and add +1
    return `+1${digits.slice(-10)}`;
  };

  // Helper to parse date string (YYYY-MM-DD) as local date, not UTC
  const parseDateLocal = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // SMS notification helper function
  const sendSMS = async (phoneNumber, message) => {
    try {
      console.log('📱 Sending SMS to:', phoneNumber);
      // Add signature to all SMS messages
      const messageWithSignature = `${message}\n\n- The Team at Own It Social\nportal.ownitsocial.com`;
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phoneNumber, message: messageWithSignature })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ SMS failed:', result.error);
        console.error('Check Twilio credentials in environment variables');
      } else {
        console.log('✅ SMS sent successfully:', result.messageSid);
      }
    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
    }
  };

  // File upload helper function
  const uploadFileToStorage = async (file, path, onProgress) => {
    if (!storage) {
      throw new Error('Firebase Storage is not configured');
    }

    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleVideoUpload = async (contentId, file) => {
    await saveContent(content.map(c =>
      c.id === contentId ? { ...c, videoUploaded: true, videoName: file.name, uploadedAt: new Date().toISOString() } : c
    ));
  };

  if (view === 'login') return <LoginView />;
  if (view === 'admin-login') return <AdminLoginView />;
  if (view === 'onboarding') return <OnboardingView />;
  if (view === 'dashboard') return <DashboardView />;
  if (view === 'admin') return <AdminView />;

  function LoginView() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async () => {
      setError('');
      if (isSignup) {
        if (!companyName.trim() || !firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
          setError('All fields required');
          return;
        }
        await handleSignup(email, password, companyName, firstName, lastName, phoneNumber);
      } else {
        if (!handleLogin(email, password)) setError('Invalid credentials');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Client Portal</h1>
          <p className="text-gray-600 mb-6">Streamline your marketing content review</p>
          
          <div className="space-y-4">
            {isSignup && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1234567890" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleSubmit} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">{isSignup ? 'Sign Up' : 'Log In'}</button>
          </div>
          
          <button onClick={() => setIsSignup(!isSignup)} className="w-full mt-4 text-blue-600 hover:underline">
            {isSignup ? 'Already have an account? Log in' : 'New client? Sign up'}
          </button>

          <div className="mt-6 pt-6 border-t">
            <button onClick={() => setView('admin-login')} className="w-full text-gray-600 hover:text-gray-800 text-sm">Admin Access →</button>
          </div>
        </div>
      </div>
    );
  }

  function AdminLoginView() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = () => {
      if (password === 'admin123') {
        const adminUser = { id: 'admin', email: 'admin', role: 'admin' };
        setCurrentUser(adminUser);
        setView('admin');
        saveSession(adminUser, 'admin');
      } else {
        setError('Invalid admin password');
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Login</h1>
          <p className="text-gray-600 mb-6">Access your client management dashboard</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleSubmit} className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition">Access Admin Panel</button>
          </div>
          
          <button onClick={() => setView('login')} className="w-full mt-4 text-gray-600 hover:underline">← Back to Client Login</button>
        </div>
      </div>
    );
  }

  function OnboardingView() {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({
      industry: [], targetAudience: [], goals: [], brandVoice: [], competitors: '',
      differentiators: '', primaryMarkets: '', pricePoint: '', styleInspirations: '', successMetrics: '', agencyExperience: ''
    });
    const [otherInputs, setOtherInputs] = useState({
      industry: '', targetAudience: '', goals: '', brandVoice: ''
    });

    const industries = ['Realtor', 'Loan Officer'];
    const audiences = ['Young Professionals', 'Small Business Owners', 'Students', 'Parents', 'Seniors', 'Millennials', 'Gen Z', 'Entrepreneurs'];
    const goalOptions = ['Increase Brand Awareness', 'Generate Leads', 'Drive Sales', 'Build Community', 'Improve Engagement', 'Launch Product'];
    const voiceOptions = ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'];

    const questions = [
      { type: 'buttons', key: 'industry', label: 'What do you do?', options: industries },
      { type: 'buttons', key: 'targetAudience', label: 'Who is your target audience? (Select all that apply)', options: audiences },
      { type: 'buttons', key: 'goals', label: 'What are your main marketing goals? (Select all that apply)', options: goalOptions },
      { type: 'buttons', key: 'brandVoice', label: 'How would you describe your brand voice? (Select all that apply)', options: voiceOptions },
      { type: 'text', key: 'competitors', label: 'Who are your main competitors?', placeholder: 'e.g., Company A, Company B' },
      { type: 'text', key: 'differentiators', label: 'What separates you from your competitors?', placeholder: 'Describe what makes you unique...' },
      { type: 'text', key: 'primaryMarkets', label: 'What are your primary markets? (locations)', placeholder: 'e.g., Los Angeles, Orange County, San Diego' },
      { type: 'text', key: 'pricePoint', label: 'Average price point or loan size', placeholder: 'e.g., $500K-$1M, $300K loans' },
      { type: 'text', key: 'styleInspirations', label: 'Are there creators or competitors whose style you like?', placeholder: 'List any accounts or brands you admire...' },
      { type: 'text', key: 'successMetrics', label: 'What does success look like in the next 30, 60, and 90 days?', placeholder: 'Describe your goals for each timeframe...' },
      { type: 'text', key: 'agencyExperience', label: 'Have you worked with a marketing agency before? What did you like or dislike?', placeholder: 'Share your experience...' }
    ];

    const currentQuestion = questions[currentStep];

    const toggleOption = (key, option) => {
      const current = answers[key] || [];
      if (current.includes(option)) {
        setAnswers({ ...answers, [key]: current.filter(item => item !== option) });
      } else {
        setAnswers({ ...answers, [key]: [...current, option] });
      }
    };

    const isAnswerValid = () => {
      if (currentQuestion.type === 'text') {
        return answers[currentQuestion.key]?.trim();
      } else {
        const hasSelection = answers[currentQuestion.key]?.length > 0;
        const hasOtherText = answers[currentQuestion.key]?.includes('Other') ? otherInputs[currentQuestion.key]?.trim() : true;
        return hasSelection && hasOtherText;
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4 flex items-center justify-center">
        <div className="max-w-3xl w-full bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome, {currentUser.firstName}! 👋</h1>
          <p className="text-gray-600 mb-8">Let's get to know your business</p>
          
          <div className="flex gap-2 mb-8">
            {questions.map((_, idx) => (
              <div key={idx} className={`h-2 flex-1 rounded-full transition ${idx <= currentStep ? 'bg-purple-600' : 'bg-gray-200'}`} />
            ))}
          </div>

          <div className="mb-2 text-sm text-purple-600 font-medium">Question {currentStep + 1} of {questions.length}</div>
          <label className="block text-xl font-semibold text-gray-800 mb-4">{currentQuestion.label}</label>

          {currentQuestion.type === 'text' ? (
            <textarea value={answers[currentQuestion.key]} onChange={(e) => setAnswers({ ...answers, [currentQuestion.key]: e.target.value })} placeholder={currentQuestion.placeholder} className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none mb-6" rows="4" />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {currentQuestion.options.map(opt => (
                  <button key={opt} onClick={() => toggleOption(currentQuestion.key, opt)} className={`px-4 py-3 rounded-lg border-2 transition ${(answers[currentQuestion.key] || []).includes(opt) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                    {opt}
                  </button>
                ))}
                <button onClick={() => toggleOption(currentQuestion.key, 'Other')} className={`px-4 py-3 rounded-lg border-2 transition ${(answers[currentQuestion.key] || []).includes('Other') ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                  Other
                </button>
              </div>
              {(answers[currentQuestion.key] || []).includes('Other') && (
                <input type="text" value={otherInputs[currentQuestion.key] || ''} onChange={(e) => setOtherInputs({ ...otherInputs, [currentQuestion.key]: e.target.value })} placeholder="Please specify..." className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none mb-6" />
              )}
            </>
          )}

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button onClick={() => setCurrentStep(currentStep - 1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />Back
              </button>
            )}
            <button onClick={() => {
              if (currentStep < questions.length - 1) {
                setCurrentStep(currentStep + 1);
              } else {
                const finalAnswers = { ...answers, otherInputs };
                handleOnboarding(finalAnswers);
              }
            }} className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">
              Skip
            </button>
            <button onClick={() => {
              if (isAnswerValid()) {
                if (currentStep < questions.length - 1) {
                  setCurrentStep(currentStep + 1);
                } else {
                  const finalAnswers = { ...answers, otherInputs };
                  handleOnboarding(finalAnswers);
                }
              }
            }} disabled={!isAnswerValid()} className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center justify-center gap-2">
              {currentStep < questions.length - 1 ? <><span>Next</span><ChevronRight className="w-5 h-5" /></> : 'Complete Setup'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function DashboardView() {
    // Team members should see content for their parent client
    const effectiveClientId = currentUser.parentClientId || currentUser.id;
    const clientContent = content.filter(c => c.clientId === effectiveClientId);
    const [selectedContent, setSelectedContent] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [activePage, setActivePage] = useState('content');
    const [teamEmail, setTeamEmail] = useState('');
    const [teamPass, setTeamPass] = useState('');
    const [teamName, setTeamName] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [expandedContentType, setExpandedContentType] = useState(null); // For content review sections
    const [editedAnswers, setEditedAnswers] = useState(currentUser.onboardingAnswers || {});
    const [showTutorial, setShowTutorial] = useState(!currentUser.tutorialCompleted);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
    const [isGeneratingInitialContent, setIsGeneratingInitialContent] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [socialLogins, setSocialLogins] = useState(currentUser.socialLogins || {
      instagram: '', facebook: '', youtube: '', x: '', linkedin: '', tiktok: '', crm: ''
    });
    const [headshot, setHeadshot] = useState(currentUser.headshot || '');
    const [companyLogo, setCompanyLogo] = useState(currentUser.companyLogo || '');
    const [videoLink, setVideoLink] = useState('');
    const [videoDescription, setVideoDescription] = useState('');
    const [userVideos, setUserVideos] = useState([]);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [selectedVideoFile, setSelectedVideoFile] = useState(null);
    const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
    const [headshotProgress, setHeadshotProgress] = useState(0);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoProgress, setLogoProgress] = useState(0);
    const [contentVideoUploads, setContentVideoUploads] = useState({}); // Track uploads per content item
    const [contentVideoFiles, setContentVideoFiles] = useState({}); // Track selected files per content item
    const [contentVideoLinks, setContentVideoLinks] = useState({}); // Track video links per content item
    const [aiContentType, setAiContentType] = useState('social');
    const [aiPurpose, setAiPurpose] = useState('');
    const [aiAudience, setAiAudience] = useState('');
    const [aiTopic, setAiTopic] = useState('');
    const [generatedIdea, setGeneratedIdea] = useState(null);
    const [generatingIdea, setGeneratingIdea] = useState(false);
    const [ideaFeedback, setIdeaFeedback] = useState('');

    useEffect(() => {
      loadUserVideos();
      generatePersonalizedContent();
    }, []);

    const generatePersonalizedContent = async () => {
      // Only generate content if this is the first time (account creation)
      const lastGenerated = currentUser.lastContentGeneration;

      if (lastGenerated) {
        console.log('⏭️ Skipping content generation - already generated on:', lastGenerated);
        return;
      }

      if (!currentUser.onboardingAnswers) {
        console.log('⏭️ Skipping content generation - no onboarding answers');
        return;
      }

      try {
        setIsGeneratingInitialContent(true);
        console.log('🤖 Generating initial personalized content (15 total: 5 social, 5 blog, 5 email)...');

        // Get content history for this user
        const userHistory = content
          .filter(c => c.clientId === effectiveClientId)
          .map(c => ({ title: c.title, description: c.description }));

        const response = await fetch('/api/generate-personalized-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: currentUser,
            onboardingAnswers: currentUser.onboardingAnswers,
            contentHistory: userHistory,
            adminNotes: currentUser.adminNotes || ''
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate content');
        }

        const data = await response.json();

        // IMPORTANT: Limit to EXACTLY 5 of each type (15 total pieces)
        // Even if API returns more, we only take 5 of each
        const socialPosts = data.contentPieces.filter(p => p.type === 'social').slice(0, 5);
        const blogPosts = data.contentPieces.filter(p => p.type === 'blog').slice(0, 5);
        const emailCampaigns = data.contentPieces.filter(p => p.type === 'email').slice(0, 5);
        const limitedPieces = [...socialPosts, ...blogPosts, ...emailCampaigns];

        console.log(`📊 Content breakdown: ${socialPosts.length} social, ${blogPosts.length} blog, ${emailCampaigns.length} email = ${limitedPieces.length} total`);

        const nowTimestamp = new Date().toISOString();
        const newContent = limitedPieces.map(piece => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          clientId: effectiveClientId,
          type: piece.type || 'content-idea',
          title: piece.title || 'Generated Content',
          description: piece.description || 'AI-generated personalized content',
          content: piece.content || '',
          status: 'pending',
          createdAt: nowTimestamp,
          firstNotificationSentAt: nowTimestamp, // Track when first notification was sent (content creation)
          reminders: [] // Initialize empty reminders array
        }));

        // Save the new content
        await saveContent([...content, ...newContent]);

        // Mark that content has been generated - this prevents future auto-generation
        const todayString = new Date().toISOString();
        const updatedUser = { ...currentUser, lastContentGeneration: todayString };
        setCurrentUser(updatedUser);
        await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
        saveSession(updatedUser, 'dashboard');

        console.log(`✅ Generated ${newContent.length} personalized content pieces (${socialPosts.length} social, ${blogPosts.length} blog, ${emailCampaigns.length} email)`);
      } catch (error) {
        console.error('❌ Error generating personalized content:', error);
      } finally {
        setIsGeneratingInitialContent(false);
      }
    };

    const loadUserVideos = async () => {
      if (!db) {
        console.warn('⚠️ Firestore not available - skipping videos load');
        setUserVideos([]);
        return;
      }

      try {
        console.log('📥 Loading user videos from Firestore...');
        const videosSnapshot = await getDocs(collection(db, 'videos'));
        const videosData = videosSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // Team members should see videos for their parent client
        const clientVideos = videosData.filter(v => v.clientId === effectiveClientId);
        console.log(`✅ Loaded ${clientVideos.length} videos for current user`);
        setUserVideos(clientVideos);
      } catch (e) {
        console.error('❌ Error loading videos from cloud:', e);
        console.error('Error details:', e.message);
        setUserVideos([]);
      }
    };

    const navItems = [
      { id: 'social', label: 'Social Media', icon: Share2 },
      { id: 'calendar', label: 'Content Calendar', icon: Calendar },
      { id: 'crm', label: 'CRM', icon: Users },
      { id: 'ai', label: 'AI Optimization', icon: Sparkles },
      { id: 'ai-generator', label: 'AI Content Generator', icon: Wand2 },
      { id: 'settings', label: 'Settings', icon: Settings }
    ];

    // Calendar helper functions
    const formatDateLocal = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getDaysInMonth = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
      }
      return days;
    };

    const getEventsForDate = (date) => {
      if (!date) return [];
      const dateStr = formatDateLocal(date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return calendarEvents.filter(event => {
        const eventDate = parseDateLocal(event.date);
        return event.date === dateStr &&
               event.clientId === effectiveClientId &&
               eventDate >= thirtyDaysAgo;
      });
    };

    const isToday = (date) => {
      if (!date) return false;
      const today = new Date();
      return date.toDateString() === today.toDateString();
    };

    // Show loading screen while generating initial content
    if (isGeneratingInitialContent) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl p-12 max-w-2xl w-full text-center">
            <div className="mb-8">
              <Sparkles className="w-20 h-20 text-purple-600 mx-auto mb-4 animate-pulse" />
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Creating Your Personalized Content</h2>
              <p className="text-lg text-gray-600 mb-6">
                Our AI is crafting custom content ideas tailored specifically for your business...
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">1</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Analyzing Your Business</p>
                  <p className="text-sm text-gray-600">Understanding your industry and target audience</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">2</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Generating Content Ideas</p>
                  <p className="text-sm text-gray-600">Creating social posts, blogs, and email campaigns</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">3</span>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Personalizing Your Portal</p>
                  <p className="text-sm text-gray-600">Setting up your customized dashboard</p>
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-4">
              <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
            </div>

            <p className="text-sm text-gray-500">This usually takes 1-2 minutes. Please don't close this window.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentUser.companyLogo && (
                <img src={currentUser.companyLogo} alt="Company Logo" className="h-12 w-auto object-contain" onError={(e) => e.target.style.display = 'none'} />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{currentUser.companyName}</h1>
                <p className="text-sm text-gray-600">Content Review Portal</p>
              </div>
            </div>
            <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-600 hover:text-gray-800">Logout</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 mb-8 text-white">
            <h2 className="text-3xl font-bold mb-2">Let's Get Started, {currentUser.firstName}! 👋</h2>
            <p className="text-blue-100">Review your marketing materials and provide feedback</p>
          </div>

          {/* Client Scorecard / Progress Bar */}
          {(() => {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // Filter content for current month
            const thisMonthContent = clientContent.filter(c => {
              const createdDate = new Date(c.createdAt);
              return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
            });

            // Calculate metrics (social + blog posts only)
            const contentIdeasTotal = thisMonthContent.filter(c => c.type === 'social' || c.type === 'blog').length;
            const contentIdeasApproved = thisMonthContent.filter(c => (c.type === 'social' || c.type === 'blog') && c.status === 'approved').length;

            const videosTotal = userVideos.filter(v => {
              const uploadedDate = new Date(v.uploadedAt);
              return uploadedDate.getMonth() === currentMonth && uploadedDate.getFullYear() === currentYear;
            }).length;
            const videosCompleted = userVideos.filter(v => {
              const uploadedDate = new Date(v.uploadedAt);
              return uploadedDate.getMonth() === currentMonth && uploadedDate.getFullYear() === currentYear && v.status === 'completed';
            }).length;

            const emailsTotal = thisMonthContent.filter(c => c.type === 'email').length;
            const emailsApproved = thisMonthContent.filter(c => c.type === 'email' && c.status === 'approved').length;

            return (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border-2 border-blue-100">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xl font-bold text-gray-800">This Month's Progress</h3>
                  <span className="text-sm text-gray-500">({now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})</span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Content Ideas */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Content Ideas</span>
                      <span className="text-sm font-bold text-blue-600">{contentIdeasApproved} of {contentIdeasTotal}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${contentIdeasTotal > 0 ? (contentIdeasApproved / contentIdeasTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500">{contentIdeasApproved} approved</p>
                  </div>

                  {/* Videos */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Videos Uploaded</span>
                      <span className="text-sm font-bold text-purple-600">{videosTotal} total</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${videosTotal > 0 ? (videosCompleted / videosTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500">{videosCompleted} completed</p>
                  </div>

                  {/* Emails */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Emails Approved</span>
                      <span className="text-sm font-bold text-green-600">{emailsApproved} of {emailsTotal}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${emailsTotal > 0 ? (emailsApproved / emailsTotal) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500">{emailsApproved} approved</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mb-8">
            <button onClick={() => setActivePage('content')} className={`w-full p-6 rounded-lg transition shadow-lg flex items-center justify-between ${activePage === 'content' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                <FileText className={`w-8 h-8 ${activePage === 'content' ? 'text-white' : 'text-blue-600'}`} />
                <div className="text-left">
                  <h3 className="text-xl font-semibold">Content Review</h3>
                  <p className={`text-sm ${activePage === 'content' ? 'text-blue-100' : 'text-gray-600'}`}>Review and approve your marketing materials</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActivePage(item.id)}
                  className={`p-3 rounded-lg transition ${
                    activePage === item.id ? 'bg-blue-600 text-white shadow-lg' :
                    'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${activePage === item.id ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-xs font-medium text-center">{item.label}</p>
                </button>
              );
            })}
          </div>

          {activePage === 'content' && (
            <>
              {(() => {
                // Filter to only pending content and sort by newest first
                const pendingContent = clientContent
                  .filter(c => c.status === 'pending')
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                const contentTypes = [
                  {
                    type: 'social',
                    label: 'Social Media Posts',
                    icon: Share2,
                    color: 'blue',
                    items: pendingContent.filter(c => c.type === 'social')
                  },
                  {
                    type: 'email',
                    label: 'Email Campaigns',
                    icon: Mail,
                    color: 'green',
                    items: pendingContent.filter(c => c.type === 'email')
                  },
                  {
                    type: 'blog',
                    label: 'Blog Posts',
                    icon: FileText,
                    color: 'purple',
                    items: pendingContent.filter(c => c.type === 'blog')
                  },
                  {
                    type: 'landing-page',
                    label: 'Landing Pages',
                    icon: Layout,
                    color: 'indigo',
                    items: pendingContent.filter(c => c.type === 'landing-page')
                  }
                ];

                if (pendingContent.length === 0) {
                  return (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                      <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">No pending content</h3>
                      <p className="text-gray-600">All content has been reviewed!</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {contentTypes.map(({ type, label, icon: Icon, color, items }) => {
                      if (items.length === 0) return null;

                      const isExpanded = expandedContentType === type;

                      // Define color classes explicitly for Tailwind
                      const colorClasses = {
                        blue: {
                          icon: 'text-blue-600',
                          badge: 'bg-blue-100 text-blue-800',
                          border: 'border-blue-200',
                          button: 'bg-blue-600 hover:bg-blue-700'
                        },
                        green: {
                          icon: 'text-green-600',
                          badge: 'bg-green-100 text-green-800',
                          border: 'border-green-200',
                          button: 'bg-green-600 hover:bg-green-700'
                        },
                        purple: {
                          icon: 'text-purple-600',
                          badge: 'bg-purple-100 text-purple-800',
                          border: 'border-purple-200',
                          button: 'bg-purple-600 hover:bg-purple-700'
                        },
                        indigo: {
                          icon: 'text-indigo-600',
                          badge: 'bg-indigo-100 text-indigo-800',
                          border: 'border-indigo-200',
                          button: 'bg-indigo-600 hover:bg-indigo-700'
                        }
                      };

                      const classes = colorClasses[color];

                      return (
                        <div key={type} className="bg-white rounded-lg shadow overflow-hidden">
                          <button
                            onClick={() => setExpandedContentType(isExpanded ? null : type)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-6 h-6 ${classes.icon}`} />
                              <h3 className="text-xl font-bold text-gray-800">{label}</h3>
                              <span className={`${classes.badge} px-3 py-1 rounded-full text-sm font-medium`}>
                                {items.length} pending
                              </span>
                            </div>
                            <ChevronRight className={`w-6 h-6 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="px-6 pb-6">
                              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {items.map(item => (
                                  <div key={item.id} className={`bg-white rounded-lg border-2 ${classes.border} p-6 hover:shadow-md transition`}>
                                    <div className="flex justify-between mb-3">
                                      <h4 className="font-semibold text-gray-800 flex-1 pr-2">{item.title}</h4>
                                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                                        Pending
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                                    {item.createdAt && (
                                      <p className="text-xs text-gray-500 mb-3">
                                        Created {new Date(item.createdAt).toLocaleDateString()}
                                      </p>
                                    )}
                                    <button
                                      onClick={() => setSelectedContent(item)}
                                      className={`w-full ${classes.button} text-white py-2 rounded flex items-center justify-center gap-2`}
                                    >
                                      <Eye className="w-4 h-4" />
                                      Review
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {activePage === 'social' && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Social Media</h2>
                <p className="text-gray-600">Manage your approved social content and video production</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Submit Video for Editing</h3>
                <p className="text-sm text-gray-600 mb-4">Upload your video file directly or provide a link to Google Drive/Dropbox</p>
                <div className="space-y-4">
                  {/* File Upload Option */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Video File</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => setSelectedVideoFile(e.target.files[0])}
                        className="w-full"
                      />
                      {selectedVideoFile && (
                        <p className="text-sm text-gray-600 mt-2">
                          Selected: {selectedVideoFile.name} ({(selectedVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-gray-500 text-sm">OR</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* Link Option */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Link</label>
                    <input
                      type="text"
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Google Drive or Dropbox link to your video"
                      className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <textarea value={videoDescription} onChange={(e) => setVideoDescription(e.target.value)} placeholder="Brief description or notes about the video" className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows="3" />

                  {uploadingVideo && (
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-blue-600 h-4 transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                        style={{ width: `${uploadProgress}%` }}
                      >
                        {uploadProgress > 5 && `${Math.round(uploadProgress)}%`}
                      </div>
                    </div>
                  )}

                  <button onClick={async () => {
                    if (!selectedVideoFile && !videoLink.trim()) {
                      alert('Please upload a video file or provide a link');
                      return;
                    }

                    setUploadingVideo(true);
                    setUploadProgress(0);

                    try {
                      let finalVideoLink = videoLink;

                      // If a file is selected, upload it to Firebase Storage
                      if (selectedVideoFile) {
                        if (!storage) {
                          alert('❌ Firebase Storage is not configured. Please contact support or use a link instead.');
                          setUploadingVideo(false);
                          return;
                        }

                        console.log('📤 Uploading video file to storage...');
                        console.log('File name:', selectedVideoFile.name);
                        console.log('File size:', selectedVideoFile.size, 'bytes');

                        try {
                          finalVideoLink = await uploadFileToStorage(
                            selectedVideoFile,
                            'videos',
                            (progress) => setUploadProgress(progress)
                          );
                          console.log('✅ Video uploaded successfully:', finalVideoLink);
                        } catch (uploadError) {
                          console.error('❌ Upload error:', uploadError);
                          throw new Error(`Upload failed: ${uploadError.message}`);
                        }
                      }

                    if (finalVideoLink && finalVideoLink.trim()) {
                      const newVideo = {
                        id: Date.now().toString(),
                        clientId: effectiveClientId,
                        videoLink: finalVideoLink,
                        description: videoDescription,
                        status: 'pending',
                        submittedAt: new Date().toISOString(),
                        fileName: selectedVideoFile ? selectedVideoFile.name : null
                      };

                      if (!db) {
                        alert('⚠️ Cloud storage not configured. Video not saved.');
                        console.error('❌ Firestore not available');
                        setUploadingVideo(false);
                        return;
                      }

                      // Save video to Firestore
                      console.log('💾 Submitting video to Firestore...');
                      await setDoc(doc(db, 'videos', newVideo.id), newVideo);
                      console.log('✅ Video submitted successfully:', newVideo.id);

                      // Send SMS notification to admin
                      await sendSMS(
                        '+17867882699',
                        `📹 New video submitted by ${currentUser.companyName}. Check the admin portal to review!`
                      );

                      setVideoLink('');
                      setVideoDescription('');
                      setSelectedVideoFile(null);
                      await loadUserVideos();
                      alert('Video submitted successfully!');
                    }
                    } catch (error) {
                      console.error('❌ Error submitting video:', error);
                      console.error('Error details:', error.message);
                      alert('Error submitting video. Please try again.');
                    } finally {
                      setUploadingVideo(false);
                      setUploadProgress(0);
                    }
                  }} disabled={(!selectedVideoFile && !videoLink.trim()) || uploadingVideo} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                    {uploadingVideo ? 'Uploading...' : 'Submit Video'}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Video Submissions</h3>
                {userVideos.length === 0 ? (
                  <div className="text-center py-8">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No videos submitted yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userVideos.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).map(video => (
                      <div key={video.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-800">
                                {video.description || 'Video Submission'}
                              </h4>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                video.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                video.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {video.status === 'in-progress' ? 'In Progress' : video.status.charAt(0).toUpperCase() + video.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Submitted {new Date(video.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <a href={video.videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4" />Raw Video File
                            </a>
                          </div>

                          {video.status === 'completed' && video.completedLink && (
                            <div className="mt-2 p-3 bg-green-50 rounded">
                              <p className="text-sm font-medium text-green-800 mb-1">Completed!</p>
                              <a href={video.completedLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" />Download Edited Video
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Approved Social Content</h3>
                {clientContent.filter(c => c.status === 'approved' && c.type === 'social').length === 0 ? (
                  <div className="text-center py-8">
                    <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No approved social content yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clientContent
                      .filter(c => c.status === 'approved' && c.type === 'social')
                      .sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt))
                      .map(item => {
                      const linkedVideo = userVideos.find(v => v.contentId === item.id);
                      const isUploading = contentVideoUploads[item.id]?.uploading || false;
                      const uploadProgress = contentVideoUploads[item.id]?.progress || 0;

                      return (
                        <div key={item.id} className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-5 border-2 border-blue-200 shadow-sm">
                          <div className="mb-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-gray-800">{item.title}</h4>
                              {item.reviewedAt && (
                                <span className="text-xs text-gray-500">
                                  Approved {new Date(item.reviewedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap">{item.content}</p>
                            {item.fileLink && (
                              <a href={item.fileLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                                <FileText className="w-4 h-4" />View Attachment
                              </a>
                            )}
                          </div>

                          {/* Video Upload Section */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-2 mb-3">
                              <Video className="w-5 h-5 text-purple-600" />
                              <h5 className="font-medium text-gray-800">Upload Video for This Content</h5>
                            </div>

                            {linkedVideo ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800 mb-1">Video Submitted</p>
                                    <p className="text-xs text-green-600 mb-2">{linkedVideo.description}</p>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        linkedVideo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        linkedVideo.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                      }`}>
                                        {linkedVideo.status === 'pending' ? 'Pending Review' :
                                         linkedVideo.status === 'in-progress' ? 'Being Edited' :
                                         'Completed'}
                                      </span>
                                      {linkedVideo.completedLink && (
                                        <a href={linkedVideo.completedLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                          <Download className="w-3 h-3" />View Final Video
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {/* File Upload */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Upload Video File</label>
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      setContentVideoFiles(prev => ({ ...prev, [item.id]: file }));
                                    }}
                                    className="w-full text-sm"
                                    disabled={isUploading}
                                  />
                                  {contentVideoFiles[item.id] && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      {contentVideoFiles[item.id].name} ({(contentVideoFiles[item.id].size / 1024 / 1024).toFixed(2)} MB)
                                    </p>
                                  )}
                                </div>

                                {/* OR divider */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 border-t border-gray-300"></div>
                                  <span className="text-gray-500 text-xs">OR</span>
                                  <div className="flex-1 border-t border-gray-300"></div>
                                </div>

                                {/* Link Input */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Video Link</label>
                                  <input
                                    type="text"
                                    value={contentVideoLinks[item.id] || ''}
                                    onChange={(e) => setContentVideoLinks(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder="Google Drive or Dropbox link"
                                    className="w-full px-3 py-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isUploading}
                                  />
                                </div>

                                {/* Progress Bar */}
                                {isUploading && (
                                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-3 transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                                      style={{ width: `${uploadProgress}%` }}
                                    >
                                      {uploadProgress > 5 && `${Math.round(uploadProgress)}%`}
                                    </div>
                                  </div>
                                )}

                                {/* Submit Button */}
                                <button
                                  onClick={async () => {
                                    const file = contentVideoFiles[item.id];
                                    const link = contentVideoLinks[item.id];

                                    if (!file && !link?.trim()) {
                                      alert('Please upload a video file or provide a link');
                                      return;
                                    }

                                    setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: true, progress: 0 } }));

                                    try {
                                      let finalVideoLink = link;

                                      // Upload file if selected
                                      if (file) {
                                        if (!storage) {
                                          alert('❌ Firebase Storage is not configured. Please use a link instead.');
                                          setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                          return;
                                        }

                                        finalVideoLink = await uploadFileToStorage(
                                          file,
                                          'videos',
                                          (progress) => setContentVideoUploads(prev => ({
                                            ...prev,
                                            [item.id]: { uploading: true, progress }
                                          }))
                                        );
                                      }

                                      if (finalVideoLink && finalVideoLink.trim()) {
                                        const newVideo = {
                                          id: Date.now().toString(),
                                          clientId: effectiveClientId,
                                          contentId: item.id, // Link to the content item
                                          contentTitle: item.title, // Store content title for reference
                                          videoLink: finalVideoLink,
                                          description: `Video for: ${item.title}`,
                                          status: 'pending',
                                          submittedAt: new Date().toISOString(),
                                          fileName: file ? file.name : null
                                        };

                                        if (!db) {
                                          alert('⚠️ Cloud storage not configured. Video not saved.');
                                          setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                          return;
                                        }

                                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                                        // Send SMS notification
                                        await sendSMS(
                                          '+17867882699',
                                          `📹 New video submitted by ${currentUser.companyName} for "${item.title}". Check the admin portal!`
                                        );

                                        // Clear form
                                        setContentVideoFiles(prev => ({ ...prev, [item.id]: null }));
                                        setContentVideoLinks(prev => ({ ...prev, [item.id]: '' }));
                                        await loadUserVideos();
                                        alert('Video submitted successfully!');
                                      }
                                    } catch (error) {
                                      console.error('❌ Error submitting video:', error);
                                      alert('Error submitting video. Please try again.');
                                    } finally {
                                      setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                    }
                                  }}
                                  disabled={(!contentVideoFiles[item.id] && !contentVideoLinks[item.id]?.trim()) || isUploading}
                                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  <Upload className="w-4 h-4" />
                                  {isUploading ? 'Uploading...' : 'Submit Video for Editing'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activePage === 'crm' && (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-6">
                <Mail className="w-8 h-8 text-green-600" />
                <h3 className="text-2xl font-bold text-gray-800">CRM - Email Campaigns</h3>
              </div>
              {clientContent.filter(c => c.type === 'email' && c.status === 'approved').length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No approved email campaigns yet</p>
                  <p className="text-gray-500 text-sm mt-2">Approve emails in the Content Review tab to see them here</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {clientContent
                    .filter(c => c.type === 'email' && c.status === 'approved')
                    .sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt))
                    .map(item => (
                    <div key={item.id} className="bg-gradient-to-br from-green-50 to-white rounded-lg p-6 border-2 border-green-200 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-gray-800">{item.title}</h4>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">Approved</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                      <div className="bg-white rounded p-4 mb-4 max-h-60 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                      </div>
                      {item.reviewedAt && (
                        <p className="text-xs text-gray-500">Approved on {new Date(item.reviewedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activePage === 'ai' && (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-purple-600" />
                <h3 className="text-2xl font-bold text-gray-800">AI Optimization - Blog Posts</h3>
              </div>
              {clientContent.filter(c => c.type === 'blog' && c.status === 'approved').length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No approved blog posts yet</p>
                  <p className="text-gray-500 text-sm mt-2">Approve blog posts in the Content Review tab to see them here</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {clientContent
                    .filter(c => c.type === 'blog' && c.status === 'approved')
                    .sort((a, b) => new Date(b.reviewedAt || b.createdAt) - new Date(a.reviewedAt || a.createdAt))
                    .map(item => (
                    <div key={item.id} className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-6 border-2 border-purple-200 shadow-sm hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-gray-800">{item.title}</h4>
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">Approved</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                      <div className="bg-white rounded p-4 mb-4 max-h-60 overflow-y-auto">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                      </div>
                      {item.reviewedAt && (
                        <p className="text-xs text-gray-500">Approved on {new Date(item.reviewedAt).toLocaleDateString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activePage === 'ai-generator' && (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-6">
                <Wand2 className="w-8 h-8 text-purple-600" />
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">AI Content Generator</h3>
                  <p className="text-gray-600">Create custom content ideas tailored to your needs</p>
                </div>
              </div>

              {!generatedIdea ? (
                <div className="max-w-2xl">
                  <div className="space-y-6">
                    {/* Content Type Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">What type of content do you want to create?</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'social', label: 'Social Media Post', icon: Share2 },
                          { value: 'blog', label: 'Blog Post', icon: FileText },
                          { value: 'email', label: 'Email Campaign', icon: Mail }
                        ].map(type => (
                          <button
                            key={type.value}
                            onClick={() => setAiContentType(type.value)}
                            className={`p-4 border-2 rounded-lg transition-all flex flex-col items-center gap-2 ${
                              aiContentType === type.value
                                ? 'border-purple-600 bg-purple-50 text-purple-700'
                                : 'border-gray-200 hover:border-purple-300 text-gray-700'
                            }`}
                          >
                            <type.icon className="w-6 h-6" />
                            <span className="text-sm font-medium">{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Topic */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">What topic or subject?</label>
                      <input
                        type="text"
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        placeholder="e.g., First-time home buying tips, Mortgage rates explained..."
                        className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Purpose */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">What's the purpose of this content?</label>
                      <input
                        type="text"
                        value={aiPurpose}
                        onChange={(e) => setAiPurpose(e.target.value)}
                        placeholder="e.g., Educate clients, Generate leads, Build trust..."
                        className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Audience */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Who is this for? (Optional)</label>
                      <input
                        type="text"
                        value={aiAudience}
                        onChange={(e) => setAiAudience(e.target.value)}
                        placeholder="Leave blank to use your default target audience"
                        className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your default: {currentUser.onboardingAnswers?.targetAudience
                          ? (Array.isArray(currentUser.onboardingAnswers.targetAudience)
                              ? currentUser.onboardingAnswers.targetAudience.join(', ')
                              : currentUser.onboardingAnswers.targetAudience)
                          : 'Not set'}
                      </p>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={async () => {
                        if (!aiTopic.trim() || !aiPurpose.trim()) {
                          alert('Please fill in the topic and purpose fields');
                          return;
                        }

                        setGeneratingIdea(true);
                        try {
                          const response = await fetch('/api/generate-ai-content-idea', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              contentType: aiContentType,
                              topic: aiTopic,
                              purpose: aiPurpose,
                              audience: aiAudience || null,
                              user: currentUser,
                              onboardingAnswers: currentUser.onboardingAnswers
                            })
                          });

                          const data = await response.json();
                          if (response.ok) {
                            setGeneratedIdea(data.idea);
                          } else {
                            alert('Error generating idea: ' + data.error);
                          }
                        } catch (error) {
                          console.error('Error:', error);
                          alert('Failed to generate content idea. Please try again.');
                        } finally {
                          setGeneratingIdea(false);
                        }
                      }}
                      disabled={!aiTopic.trim() || !aiPurpose.trim() || generatingIdea}
                      className="w-full bg-purple-600 text-white py-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
                    >
                      <Wand2 className="w-5 h-5" />
                      {generatingIdea ? 'Generating Your Content Idea...' : 'Generate Content Idea'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl">
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 mb-6 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                      <h4 className="font-bold text-lg text-gray-800">AI Generated Content Idea</h4>
                    </div>
                    <div className="bg-white rounded-lg p-5 mb-4">
                      <h5 className="font-semibold text-gray-800 mb-2">{generatedIdea.title}</h5>
                      <p className="text-gray-700 whitespace-pre-wrap">{generatedIdea.content}</p>
                    </div>
                    {generatedIdea.description && (
                      <p className="text-sm text-gray-600 italic">{generatedIdea.description}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <textarea
                      value={ideaFeedback}
                      onChange={(e) => setIdeaFeedback(e.target.value)}
                      placeholder="Want changes? Describe what you'd like to improve or adjust..."
                      className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows="3"
                    />

                    <div className="flex gap-3">
                      <button
                        onClick={async () => {
                          if (!ideaFeedback.trim()) {
                            alert('Please provide feedback on what to change');
                            return;
                          }

                          setGeneratingIdea(true);
                          try {
                            const response = await fetch('/api/generate-ai-content-idea', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                contentType: aiContentType,
                                topic: aiTopic,
                                purpose: aiPurpose,
                                audience: aiAudience || null,
                                user: currentUser,
                                onboardingAnswers: currentUser.onboardingAnswers,
                                previousIdea: generatedIdea,
                                feedback: ideaFeedback
                              })
                            });

                            const data = await response.json();
                            if (response.ok) {
                              setGeneratedIdea(data.idea);
                              setIdeaFeedback('');
                            } else {
                              alert('Error regenerating idea: ' + data.error);
                            }
                          } catch (error) {
                            console.error('Error:', error);
                            alert('Failed to regenerate content idea. Please try again.');
                          } finally {
                            setGeneratingIdea(false);
                          }
                        }}
                        disabled={!ideaFeedback.trim() || generatingIdea}
                        className="flex-1 bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        {generatingIdea ? 'Regenerating...' : 'Regenerate with Feedback'}
                      </button>

                      <button
                        onClick={async () => {
                          // Save the approved idea as content
                          const newContent = {
                            id: Date.now().toString(),
                            clientId: effectiveClientId,
                            type: aiContentType,
                            title: generatedIdea.title,
                            content: generatedIdea.content,
                            description: generatedIdea.description || '',
                            status: 'approved',
                            createdAt: new Date().toISOString(),
                            reviewedAt: new Date().toISOString(),
                            source: 'ai-generator'
                          };

                          try {
                            if (db) {
                              await setDoc(doc(db, 'content', newContent.id), newContent);
                            }
                            await saveContent([...content, newContent]);
                            alert('✅ Content idea approved and added to your library!');

                            // Reset form
                            setGeneratedIdea(null);
                            setIdeaFeedback('');
                            setAiTopic('');
                            setAiPurpose('');
                            setAiAudience('');
                          } catch (error) {
                            console.error('Error saving content:', error);
                            alert('Failed to save content. Please try again.');
                          }
                        }}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                      >
                        <Check className="w-5 h-5" />
                        Approve & Save
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setGeneratedIdea(null);
                        setIdeaFeedback('');
                        setAiTopic('');
                        setAiPurpose('');
                        setAiAudience('');
                      }}
                      className="w-full text-gray-600 hover:text-gray-800 py-2 text-sm"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activePage === 'calendar' && (
            <div id="calendar-section" className="bg-white rounded-lg shadow p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold">Content Calendar</h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-semibold min-w-[200px] text-center">
                    {currentCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1))}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {getDaysInMonth(currentCalendarMonth).map((date, idx) => {
                  const dayEvents = date ? getEventsForDate(date) : [];
                  const isPast = date && date < new Date().setHours(0, 0, 0, 0);
                  const todayClass = isToday(date) ? 'bg-blue-50 border-blue-300' : '';

                  return (
                    <div
                      key={idx}
                      className={`min-h-[100px] border rounded p-1 ${
                        !date ? 'bg-gray-100' :
                        isPast ? 'bg-gray-50 hover:bg-gray-100' :
                        'bg-white hover:bg-gray-50'
                      } ${todayClass}`}
                    >
                      {date && (
                        <>
                          <div className={`text-sm font-medium mb-1 ${
                            isToday(date) ? 'text-blue-600' :
                            isPast ? 'text-gray-400' :
                            'text-gray-700'
                          }`}>
                            {date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map(event => (
                              <div
                                key={event.id}
                                className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${
                                  event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                                  event.type === 'email' ? 'bg-green-100 text-green-800' :
                                  event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}
                                title={`${event.title} - ${event.description}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvent(event);
                                  setShowEventModal(true);
                                }}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div
                                className="text-xs text-gray-500 pl-1 cursor-pointer hover:text-gray-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Show first event beyond the 2 displayed
                                  setSelectedEvent(dayEvents[2]);
                                  setShowEventModal(true);
                                }}
                              >
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex gap-4 justify-center flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-100 rounded"></div>
                  <span className="text-sm text-gray-600">Social Media</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-100 rounded"></div>
                  <span className="text-sm text-gray-600">Blog Post</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 rounded"></div>
                  <span className="text-sm text-gray-600">Email</span>
                </div>
              </div>
            </div>
          )}

          {/* Event Details Modal */}
          {showEventModal && selectedEvent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowEventModal(false)}>
              <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-gray-800">{selectedEvent.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedEvent.type === 'social' ? 'bg-blue-100 text-blue-800' :
                      selectedEvent.type === 'email' ? 'bg-green-100 text-green-800' :
                      selectedEvent.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedEvent.type}
                    </span>
                  </div>
                  <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Scheduled Date</p>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedEvent.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Description</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>

                  {selectedEvent.contentId && (
                    <div className="mt-6 pt-6 border-t">
                      <button
                        onClick={() => {
                          setShowEventModal(false);
                          setActivePage('content');
                          // Scroll to content item if needed
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        View Full Content Details
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-semibold mb-6">Settings</h3>
              <div className="space-y-3 mb-8">
                {(() => {
                  const fieldOptions = {
                    industry: ['Realtor', 'Loan Officer'],
                    targetAudience: ['Young Professionals', 'Small Business Owners', 'Students', 'Parents', 'Seniors', 'Millennials', 'Gen Z', 'Entrepreneurs'],
                    goals: ['Increase Brand Awareness', 'Generate Leads', 'Drive Sales', 'Build Community', 'Improve Engagement', 'Launch Product'],
                    brandVoice: ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'],
                    competitors: null // Text field
                  };

                  return Object.keys(fieldOptions).map(key => {
                    const value = editedAnswers[key];
                    const displayValue = Array.isArray(value) ? value.join(', ') : (value || '');
                    const options = fieldOptions[key];
                    const isDropdown = options !== null;

                    return (
                      <div key={key} className="border rounded">
                        <button onClick={() => setExpanded(expanded === key ? null : key)} className="w-full px-4 py-3 flex justify-between hover:bg-gray-50">
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <ChevronRight className={`w-5 h-5 transition ${expanded === key ? 'rotate-90' : ''}`} />
                        </button>
                        {expanded === key && (
                          <div className="px-4 pb-4">
                            <div className="text-sm text-gray-600 mb-2">Current: {displayValue || 'Not set'}</div>

                            {isDropdown ? (
                              <div className="mb-3">
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {(Array.isArray(value) ? value : []).map((selectedOption, idx) => (
                                    <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                      {selectedOption}
                                      <button
                                        onClick={() => {
                                          const newValue = (Array.isArray(value) ? value : []).filter((_, i) => i !== idx);
                                          setEditedAnswers({ ...editedAnswers, [key]: newValue });
                                        }}
                                        className="hover:text-blue-900"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const currentValues = Array.isArray(value) ? value : [];
                                      if (!currentValues.includes(e.target.value)) {
                                        setEditedAnswers({ ...editedAnswers, [key]: [...currentValues, e.target.value] });
                                      }
                                      e.target.value = '';
                                    }
                                  }}
                                  className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                  defaultValue=""
                                >
                                  <option value="">Select to add...</option>
                                  {options.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <textarea
                                value={displayValue}
                                onChange={(e) => setEditedAnswers({ ...editedAnswers, [key]: e.target.value })}
                                placeholder="Enter text..."
                                className="w-full px-4 py-3 border rounded mb-3"
                                rows="3"
                              />
                            )}

                            <button onClick={async () => {
                              const updated = { ...currentUser, onboardingAnswers: editedAnswers };
                              setCurrentUser(updated);
                              await saveUsers(users.map(u => u.id === currentUser.id ? updated : u));
                              saveSession(updated, 'dashboard');
                              setExpanded(null);
                            }} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Save</button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <h4 className="font-semibold mb-4">Social Media Logins</h4>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                {Object.keys(socialLogins).map(key => (
                  <input key={key} type="text" value={socialLogins[key]} onChange={(e) => setSocialLogins({ ...socialLogins, [key]: e.target.value })} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} className="px-4 py-2 border rounded outline-none focus:ring-2" />
                ))}
              </div>
              <button onClick={async () => {
                const updated = { ...currentUser, socialLogins };
                setCurrentUser(updated);
                await saveUsers(users.map(u => u.id === currentUser.id ? updated : u));
              }} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 mb-8">Save Social Logins</button>

              <h4 className="font-semibold mb-4">Profile & Branding</h4>
              <p className="text-sm text-gray-600 mb-4">Upload your headshot and company logo directly or enter an image URL</p>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Headshot</label>

                  {/* File Upload */}
                  <div className="mb-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (!storage) {
                              alert('❌ Storage not configured. Please use URL instead.');
                              return;
                            }

                            setUploadingHeadshot(true);
                            setHeadshotProgress(0);

                            try {
                              const url = await uploadFileToStorage(
                                file,
                                'headshots',
                                (progress) => setHeadshotProgress(progress)
                              );
                              setHeadshot(url);
                              alert('✅ Headshot uploaded successfully!');
                            } catch (error) {
                              console.error('Upload error:', error);
                              alert('❌ Upload failed: ' + error.message);
                            } finally {
                              setUploadingHeadshot(false);
                              setHeadshotProgress(0);
                            }
                          }
                        }}
                        className="text-sm"
                        disabled={uploadingHeadshot}
                      />
                    </div>
                    {uploadingHeadshot && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${headshotProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-gray-400 text-xs">OR</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* URL Input */}
                  <input
                    type="text"
                    value={headshot}
                    onChange={(e) => setHeadshot(e.target.value)}
                    placeholder="https://example.com/your-photo.jpg"
                    className="w-full px-4 py-2 border rounded outline-none focus:ring-2 mb-3"
                  />

                  {headshot && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-600 mb-2">Preview:</p>
                      <img src={headshot} alt="Headshot" className="w-32 h-32 object-cover rounded-full mx-auto" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>

                  {/* File Upload */}
                  <div className="mb-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (!storage) {
                              alert('❌ Storage not configured. Please use URL instead.');
                              return;
                            }

                            setUploadingLogo(true);
                            setLogoProgress(0);

                            try {
                              const url = await uploadFileToStorage(
                                file,
                                'logos',
                                (progress) => setLogoProgress(progress)
                              );
                              setCompanyLogo(url);
                              alert('✅ Logo uploaded successfully!');
                            } catch (error) {
                              console.error('Upload error:', error);
                              alert('❌ Upload failed: ' + error.message);
                            } finally {
                              setUploadingLogo(false);
                              setLogoProgress(0);
                            }
                          }
                        }}
                        className="text-sm"
                        disabled={uploadingLogo}
                      />
                    </div>
                    {uploadingLogo && (
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${logoProgress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* OR divider */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-gray-400 text-xs">OR</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* URL Input */}
                  <input
                    type="text"
                    value={companyLogo}
                    onChange={(e) => setCompanyLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2 border rounded outline-none focus:ring-2 mb-3"
                  />

                  {companyLogo && (
                    <div className="border rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-gray-600 mb-2">Preview:</p>
                      <img src={companyLogo} alt="Company Logo" className="w-32 h-32 object-contain mx-auto" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                </div>
              </div>

              <button onClick={async () => {
                const updated = { ...currentUser, headshot, companyLogo };
                setCurrentUser(updated);
                await saveUsers(users.map(u => u.id === currentUser.id ? updated : u));
                saveSession(updated, 'dashboard');
              }} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 mb-8">Save Profile & Branding</button>

              {/* Team Members Section */}
              <div className="border-t pt-8 mt-8">
                <h3 className="text-xl font-semibold mb-4">Team Members</h3>
                <p className="text-gray-600 mb-6">Add team members to collaborate on your marketing</p>

                <div className="space-y-4 max-w-md mb-8">
                  <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2" />
                  <input type="email" value={teamEmail} onChange={(e) => setTeamEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2" />
                  <input type="password" value={teamPass} onChange={(e) => setTeamPass(e.target.value)} placeholder="Password" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2" />
                  <button onClick={async () => {
                    if (teamName.trim() && teamEmail.trim() && teamPass.trim()) {
                      await saveUsers([...users, {
                        id: Date.now().toString(),
                        email: teamEmail,
                        password: teamPass,
                        companyName: currentUser.companyName,
                        firstName: teamName,
                        onboarded: true,
                        parentClientId: effectiveClientId,
                        createdAt: new Date().toISOString()
                      }]);
                      setTeamName('');
                      setTeamEmail('');
                      setTeamPass('');
                    }
                  }} disabled={!teamName.trim() || !teamEmail.trim() || !teamPass.trim()} className="w-full bg-orange-600 text-white py-3 rounded hover:bg-orange-700 disabled:bg-gray-300">Add Team Member</button>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold text-gray-800 mb-4">Current Team Members</h4>
                  <div className="space-y-2">
                    {users.filter(u => u.parentClientId === effectiveClientId).map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-gray-700 font-medium">{member.firstName}</div>
                          <div className="text-sm text-gray-600">{member.email}</div>
                          <span className="text-xs text-gray-500">Added {new Date(member.createdAt).toLocaleDateString()}</span>
                        </div>
                        <button onClick={async () => {
                          try {
                            if (!db) {
                              console.error('❌ Firestore not available');
                              alert('⚠️ Cloud storage not configured. Cannot remove team member.');
                              return;
                            }

                            console.log(`🗑️ Removing team member: ${member.email}`);
                            await deleteDoc(doc(db, 'users', member.id));
                            console.log('✅ Team member deleted from Firestore');
                            await saveUsers(users.filter(u => u.id !== member.id));
                          } catch (e) {
                            console.error('❌ Error removing team member:', e);
                            console.error('Error details:', e.message);
                          }
                        }} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                      </div>
                    ))}
                    {users.filter(u => u.parentClientId === effectiveClientId).length === 0 && (
                      <p className="text-gray-500 text-sm">No team members added yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedContent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between mb-4">
                <h2 className="text-2xl font-bold">{selectedContent.title}</h2>
                <button onClick={() => { setSelectedContent(null); setFeedback(''); }} className="text-gray-500"><X className="w-6 h-6" /></button>
              </div>
              <div className="bg-gray-50 p-4 rounded mb-6">
                <p className="whitespace-pre-wrap">{selectedContent.content}</p>
                {selectedContent.fileLink && (
                  <a href={selectedContent.fileLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 mt-4"><FileText className="w-4 h-4" />View File</a>
                )}
              </div>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Feedback (optional)" className="w-full px-4 py-3 border rounded mb-4" rows="4" />
              <div className="flex gap-3">
                <button onClick={async () => {
                  await handleContentAction(selectedContent.id, 'approved', feedback);
                  setSelectedContent(null);
                  setFeedback('');
                }} className="flex-1 bg-green-600 text-white py-3 rounded hover:bg-green-700 flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />Approve
                </button>
                <button onClick={async () => {
                  await handleContentAction(selectedContent.id, 'rejected', feedback);
                  setSelectedContent(null);
                  setFeedback('');
                }} className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 flex items-center justify-center gap-2">
                  <X className="w-5 h-5" />Request Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tutorial Overlay */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-8 relative">
                <button
                  onClick={async () => {
                    setShowTutorial(false);
                    const updatedUser = { ...currentUser, tutorialCompleted: true };
                    setCurrentUser(updatedUser);
                    await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
                    saveSession(updatedUser, 'dashboard');
                  }}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>

              {tutorialStep === 0 && (
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to Your Client Portal!</h2>
                  <p className="text-gray-600 mb-6">
                    Let's take a quick tour of the key features to help you get started. This will only take a minute!
                  </p>
                  <div className="flex justify-between">
                    <button
                      onClick={async () => {
                        setShowTutorial(false);
                        const updatedUser = { ...currentUser, tutorialCompleted: true };
                        setCurrentUser(updatedUser);
                        await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
                        saveSession(updatedUser, 'dashboard');
                      }}
                      className="text-gray-600 hover:underline"
                    >
                      Skip Tutorial
                    </button>
                    <button
                      onClick={() => setTutorialStep(1)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      Get Started
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {tutorialStep === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">📊 Review Your Content</h2>
                  <p className="text-gray-600 mb-4">
                    Your main dashboard shows all the content we've created for you. You'll find:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
                    <li><strong>Social Media Posts</strong> - Ready-to-publish content for your social channels</li>
                    <li><strong>Blog Posts</strong> - Long-form content to drive traffic to your site</li>
                    <li><strong>Email Campaigns</strong> - Engaging emails to nurture your audience</li>
                  </ul>
                  <p className="text-gray-600 mb-6">
                    Click on any content item to review it in detail, approve it, or request changes.
                  </p>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTutorialStep(0)}
                      className="text-gray-600 hover:underline flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    <button
                      onClick={() => setTutorialStep(2)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {tutorialStep === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">✅ Approve or Request Changes</h2>
                  <p className="text-gray-600 mb-4">
                    For each piece of content, you have three options:
                  </p>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <Check className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-green-800">Approve</p>
                        <p className="text-sm text-green-700">Content is ready to publish!</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <X className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-red-800">Request Changes</p>
                        <p className="text-sm text-red-700">Provide feedback and we'll revise it for you</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-6 h-6 text-gray-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-gray-800">Review Later</p>
                        <p className="text-sm text-gray-700">Content stays in pending status</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTutorialStep(1)}
                      className="text-gray-600 hover:underline flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    <button
                      onClick={() => setTutorialStep(3)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {tutorialStep === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🗓️ Content Calendar</h2>
                  <p className="text-gray-600 mb-6">
                    Navigate to the <strong>Content Calendar</strong> tab to see when your approved content is scheduled to be published.
                    This helps you visualize your entire content strategy at a glance.
                  </p>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTutorialStep(2)}
                      className="text-gray-600 hover:underline flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    <button
                      onClick={() => setTutorialStep(4)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {tutorialStep === 4 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">⚙️ Manage Your Settings</h2>
                  <p className="text-gray-600 mb-4">
                    In the <strong>Settings</strong> tab, you can:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
                    <li>Update your business information and preferences</li>
                    <li>Connect your social media accounts</li>
                    <li>Upload your headshot and company logo</li>
                    <li>Add team members to collaborate on content</li>
                  </ul>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTutorialStep(3)}
                      className="text-gray-600 hover:underline flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    <button
                      onClick={() => setTutorialStep(5)}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {tutorialStep === 5 && (
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🚀 You're All Set!</h2>
                  <p className="text-gray-600 mb-6">
                    You now know the basics of your client portal. Remember:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
                    <li>Review content regularly to keep your marketing on track</li>
                    <li>Provide detailed feedback when requesting changes</li>
                    <li>Check the calendar to stay organized</li>
                    <li>Update your settings to get the most personalized content</li>
                  </ul>
                  <p className="text-gray-600 mb-6">
                    Have questions? Don't hesitate to reach out to your account manager!
                  </p>
                  <div className="flex justify-between">
                    <button
                      onClick={() => setTutorialStep(4)}
                      className="text-gray-600 hover:underline flex items-center gap-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                    <button
                      onClick={async () => {
                        setShowTutorial(false);
                        const updatedUser = { ...currentUser, tutorialCompleted: true };
                        setCurrentUser(updatedUser);
                        await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
                        saveSession(updatedUser, 'dashboard');
                      }}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Complete Tutorial
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2 mt-6">
                {[0, 1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      step === tutorialStep ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function AdminView() {
    const [showForm, setShowForm] = useState(false);
    const [newContent, setNewContent] = useState({
      clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: ''
    });
    const [publishMode, setPublishMode] = useState('single'); // 'single', 'all-realtors', 'all-loan-officers'
    const [videos, setVideos] = useState([]);
    const [activeTab, setActiveTab] = useState('clients');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiGenerationResult, setAiGenerationResult] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [contentTypeFilter, setContentTypeFilter] = useState('all'); // 'all', 'social', 'blog', 'email', 'landing-page'
    const [selectedContent, setSelectedContent] = useState(null);
    const [groupFilter, setGroupFilter] = useState('all'); // 'all' or group id

    // SMS state variables
    const [smsSelectedClients, setSmsSelectedClients] = useState([]);
    const [smsTemplate, setSmsTemplate] = useState('');
    const [smsCustomMessage, setSmsCustomMessage] = useState('');
    const [smsSending, setSmsSending] = useState(false);

    // SMS Templates
    const smsTemplates = {
      'video-editing': {
        name: 'Video Being Edited',
        message: '🎬 Great news! We\'re currently editing your video and it\'s looking fantastic! We\'ll have it ready for you soon. Check your portal for updates!\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'video-ready': {
        name: 'Video Ready',
        message: '🎥 Your video is ready! Check your portal to view and download it. We can\'t wait to see you share it!\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'content-posted': {
        name: 'Content Posted to Calendar',
        message: '📅 New content has been added to your calendar! Log in to your portal to review your upcoming posts and schedule.\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'content-pending': {
        name: 'Content Pending Review',
        message: '📝 You have new content waiting for your review in the portal. Please take a moment to approve or provide feedback!\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'content-approved': {
        name: 'Content Approved - Thank You',
        message: '✅ Thank you for approving your content! We\'re working on getting everything scheduled and published for you.\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'general-reminder': {
        name: 'General Portal Reminder',
        message: '👋 Just a friendly reminder to check your Own It Social portal for updates on your marketing content and videos!\n\n- The Team at Own It Social\nportal.ownitsocial.com'
      },
      'custom': {
        name: 'Custom Message',
        message: ''
      }
    };

    useEffect(() => {
      loadVideos();
    }, []);

    const loadVideos = async () => {
      if (!db) {
        console.warn('⚠️ Firestore not available - skipping videos load');
        setVideos([]);
        return;
      }

      try {
        console.log('📥 Loading videos from Firestore...');
        // Load videos from Firestore
        const videosSnapshot = await getDocs(collection(db, 'videos'));
        const videosData = videosSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        console.log(`✅ Loaded ${videosData.length} videos from Firestore`);
        setVideos(videosData);
      } catch (e) {
        console.error('❌ Error loading videos from cloud:', e);
        console.error('Error details:', e.message);
        setVideos([]);
      }
    };

    const saveVideos = async (v) => {
      setVideos(v);

      if (!db) {
        console.warn('⚠️ Firestore not available - videos not saved to cloud');
        return;
      }

      try {
        console.log(`💾 Saving ${v.length} videos to Firestore...`);
        // Save each video to Firestore
        for (const video of v) {
          await setDoc(doc(db, 'videos', video.id), video);
          console.log(`✅ Saved video: ${video.id}`);
        }
        console.log('✅ All videos saved successfully');
      } catch (e) {
        console.error('❌ Error saving videos to cloud:', e);
        console.error('Error details:', e.message);
      }
    };

    const updateVideoStatus = async (videoId, status, completedLink = '') => {
      const video = videos.find(v => v.id === videoId);
      const updated = videos.map(v =>
        v.id === videoId ? { ...v, status, completedLink, completedAt: new Date().toISOString() } : v
      );
      await saveVideos(updated);

      // Automatic client notifications are disabled - use manual SMS from admin portal
      if (status === 'completed' && video) {
        console.log(`✅ Video marked as completed (SMS notifications to client disabled)`);
      }
    };

    const handleSendManualSMS = async () => {
      if (smsSelectedClients.length === 0) {
        alert('⚠️ Please select at least one client to send SMS');
        return;
      }

      const message = smsTemplate === 'custom' ? smsCustomMessage : (smsTemplates[smsTemplate]?.message || '');
      if (!message.trim()) {
        alert('⚠️ Please enter a message or select a template');
        return;
      }

      if (!confirm(`Send SMS to ${smsSelectedClients.length} client${smsSelectedClients.length > 1 ? 's' : ''}?`)) {
        return;
      }

      setSmsSending(true);
      let successCount = 0;
      let errorCount = 0;

      try {
        for (const clientId of smsSelectedClients) {
          const client = users.find(u => u.id === clientId);
          if (client?.phoneNumber) {
            try {
              await sendSMS(client.phoneNumber, message);
              successCount++;
              console.log(`✅ SMS sent to ${client.companyName}`);
            } catch (error) {
              console.error(`❌ Failed to send SMS to ${client.companyName}:`, error);
              errorCount++;
            }
          }
        }

        alert(`✅ SMS sent successfully to ${successCount} client${successCount > 1 ? 's' : ''}!${errorCount > 0 ? `\n⚠️ Failed to send to ${errorCount} client${errorCount > 1 ? 's' : ''}` : ''}`);

        // Reset form
        setSmsSelectedClients([]);
        setSmsTemplate('');
        setSmsCustomMessage('');
      } catch (error) {
        console.error('❌ Error sending SMS:', error);
        alert('❌ Error sending SMS. Please try again.');
      } finally {
        setSmsSending(false);
      }
    };

    const handleAIGenerateContent = async () => {
      if (!confirm('Generate AI content for all users? This will create 15 pieces of content for each client and send them SMS notifications.')) {
        return;
      }

      setIsGeneratingAI(true);
      setAiGenerationResult(null);

      try {
        console.log('🤖 Starting AI content generation for all users...');

        // Build content history for each user
        const contentHistoryMap = {};
        users.filter(u => !u.parentClientId).forEach(user => {
          contentHistoryMap[user.id] = content
            .filter(c => c.clientId === user.id)
            .map(c => ({ title: c.title, description: c.description }));
        });

        // Call the admin API to generate content
        const response = await fetch('/api/admin-generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            users: users.filter(u => !u.parentClientId), // Only generate for primary clients, not team members
            contentHistory: contentHistoryMap
          })
        });

        if (!response.ok) {
          throw new Error('Failed to generate content');
        }

        const result = await response.json();
        console.log('✅ AI generation complete:', result);

        // Save all generated content to Firestore
        const allNewContent = [];
        const nowTimestamp = new Date().toISOString();
        for (const userResult of result.results) {
          const userContent = userResult.contentPieces.map(piece => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            clientId: userResult.userId,
            type: piece.type || 'content-idea',
            title: piece.title || 'Generated Content',
            description: piece.description || 'AI-generated personalized content',
            content: piece.content || '',
            status: 'pending',
            createdAt: nowTimestamp,
            firstNotificationSentAt: nowTimestamp, // Track when first notification was sent (SMS sent via admin-generate-content)
            reminders: [] // Initialize empty reminders array
          }));
          allNewContent.push(...userContent);
        }

        // Save all content at once
        await saveContent([...content, ...allNewContent]);

        setAiGenerationResult(result);
        alert(`✅ Successfully generated content for ${result.generated} users!\n\nTotal pieces: ${allNewContent.length}\nFailed: ${result.failed}`);
      } catch (error) {
        console.error('❌ Error generating AI content:', error);
        alert('Failed to generate AI content. Please check console for details.');
      } finally {
        setIsGeneratingAI(false);
      }
    };

    // Calendar helper functions
    // Helper to format date to YYYY-MM-DD in local timezone (not UTC)
    const formatDateLocal = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getDaysInMonth = (date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      // Add empty slots for days before the month starts
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      // Add actual days of the month
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
      }
      return days;
    };

    const getEventsForDate = (date) => {
      if (!date) return [];
      const dateStr = formatDateLocal(date);
      return calendarEvents.filter(event => event.date === dateStr);
    };

    const isToday = (date) => {
      if (!date) return false;
      const today = new Date();
      return date.toDateString() === today.toDateString();
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentUser.companyLogo && (
                <img src={currentUser.companyLogo} alt="Logo" className="h-12 w-auto object-contain" onError={(e) => e.target.style.display = 'none'} />
              )}
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
            <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-300 hover:text-white">Logout</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!confirm('Check for pending content and send reminder texts to clients who need them?')) {
                    return;
                  }

                  try {
                    console.log('📲 Checking reminders...');
                    const response = await fetch('/api/check-reminders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ users, content })
                    });

                    const result = await response.json();
                    if (response.ok) {
                      alert(`✅ Reminders sent: ${result.remindersSent}\n\nDetails:\n${result.details.map(d => `- ${d.companyName}: ${d.reminderType} reminder for "${d.contentTitle}"`).join('\n')}`);

                      // Update content with reminder tracking
                      const updatedContent = [...content];
                      result.details.forEach(detail => {
                        const contentIndex = updatedContent.findIndex(c => c.id === detail.contentId);
                        if (contentIndex !== -1) {
                          if (!updatedContent[contentIndex].reminders) {
                            updatedContent[contentIndex].reminders = [];
                          }
                          updatedContent[contentIndex].reminders.push({
                            type: detail.reminderType,
                            sentAt: detail.sentAt
                          });
                        }
                      });
                      await saveContent(updatedContent);
                    } else {
                      alert(`❌ Error: ${result.error}`);
                    }
                  } catch (error) {
                    console.error('❌ Error checking reminders:', error);
                    alert('Failed to check reminders. See console for details.');
                  }
                }}
                className="bg-orange-600 text-white px-6 py-3 rounded hover:bg-orange-700 flex items-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Send Reminders
              </button>
              <button
                onClick={handleAIGenerateContent}
                disabled={isGeneratingAI}
                className="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-5 h-5" />
                {isGeneratingAI ? 'Generating AI Content...' : 'AI Generate Content'}
              </button>
              <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 flex items-center gap-2">
                <Upload className="w-5 h-5" />Upload Content
              </button>
            </div>
          </div>

          {/* Today's Scheduled Content */}
          {(() => {
            const today = formatDateLocal(new Date());
            const todaysEvents = calendarEvents.filter(event => event.date === today);

            if (todaysEvents.length > 0) {
              return (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-semibold text-gray-800">Today's Scheduled Content</h3>
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{todaysEvents.length}</span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todaysEvents.map(event => {
                      const client = users.find(u => u.id === event.clientId);
                      return (
                        <div key={event.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-gray-800 text-sm">{event.title}</h4>
                            <span className={`inline-block px-2 py-1 rounded text-xs ${
                              event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                              event.type === 'email' ? 'bg-green-100 text-green-800' :
                              event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>{event.type}</span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{client?.companyName || 'Unknown Client'}</p>
                          {event.description && (
                            <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex gap-4 mb-8">
            <button onClick={() => setActiveTab('clients')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'clients' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Clients & Content
            </button>
            <button onClick={() => setActiveTab('calendar')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Content Calendar
            </button>
            <button onClick={() => setActiveTab('videos')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'videos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Video Production Queue
            </button>
            <button onClick={() => setActiveTab('groups')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'groups' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Groups
            </button>
            <button onClick={() => setActiveTab('sms')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'sms' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              📱 Send SMS
            </button>
          </div>

          {activeTab === 'clients' && (
            <div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Group</label>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">All Clients</option>
                  <option value="ungrouped">Ungrouped</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {users.filter(u => {
                  if (u.parentClientId) return false; // Skip team members
                  if (groupFilter === 'all') return true;
                  if (groupFilter === 'ungrouped') return !u.groupId;
                  return u.groupId === groupFilter;
                }).map(user => {
                  const userContent = content.filter(c => c.clientId === user.id);
                  const teamMembers = users.filter(u => u.parentClientId === user.id);
                  const userGroup = groups.find(g => g.id === user.groupId);
                  return (
                    <div key={user.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{user.firstName} {user.lastName || ''} - {user.companyName}</h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        {userGroup && (
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                            {userGroup.name}
                          </span>
                        )}
                      </div>
                      {teamMembers.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{teamMembers.length} team member{teamMembers.length > 1 ? 's' : ''}</p>
                      )}
                      <div className="flex gap-4 mt-4">
                        <div className="flex-1 bg-yellow-50 p-3 rounded">
                          <p className="text-2xl font-bold text-yellow-700">{userContent.filter(c => c.status === 'pending').length}</p>
                          <p className="text-xs text-yellow-600">Pending</p>
                        </div>
                        <div className="flex-1 bg-green-50 p-3 rounded">
                          <p className="text-2xl font-bold text-green-700">{userContent.filter(c => c.status === 'approved').length}</p>
                          <p className="text-xs text-green-600">Approved</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUser(user)} className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />View Details
                      </button>
                    </div>
                  );
                })}
              </div>

              {content.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">All Content</h3>
                    <select
                      value={contentTypeFilter}
                      onChange={(e) => setContentTypeFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="all">All Types</option>
                      <option value="social">Social Media</option>
                      <option value="blog">Blog Posts</option>
                      <option value="email">Email Campaigns</option>
                      <option value="landing-page">Landing Pages</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    {content.filter(item => contentTypeFilter === 'all' || item.type === contentTypeFilter).map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      return (
                        <div key={item.id} className="p-4 bg-gray-50 rounded">
                          <div className="flex justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{item.title}</p>
                              <p className="text-sm text-gray-600">{client?.companyName} • {item.type}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                                    const updatedContent = content.filter(c => c.id !== item.id);
                                    await saveContent(updatedContent);
                                    if (db) {
                                      await deleteDoc(doc(db, 'content', item.id));
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 p-2"
                                title="Delete content"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {item.feedback && <div className="mt-2 p-3 bg-blue-50 rounded"><p className="text-xs text-blue-700">Feedback: {item.feedback}</p></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Visual Calendar */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Content Calendar</h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-gray-800 min-w-[150px] text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {getDaysInMonth(currentMonth).map((date, idx) => {
                    const events = getEventsForDate(date);
                    const todayClass = isToday(date) ? 'bg-blue-50 border-blue-300' : '';

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] border rounded p-1 ${date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-100'} ${todayClass}`}
                        onClick={() => {
                          if (date) {
                            setSelectedDate(date);
                            setShowScheduleModal(true);
                          }
                        }}
                      >
                        {date && (
                          <>
                            <div className="text-sm font-medium text-gray-700 mb-1">
                              {date.getDate()}
                            </div>
                            <div className="space-y-1">
                              {events.slice(0, 2).map(event => (
                                <div
                                  key={event.id}
                                  className={`text-xs p-1 rounded truncate ${
                                    event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                                    event.type === 'email' ? 'bg-green-100 text-green-800' :
                                    event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                  title={event.title}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {events.length > 2 && (
                                <div className="text-xs text-gray-500 pl-1">
                                  +{events.length - 2} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Approved Content Sidebar */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Approved Content</h3>
                <p className="text-sm text-gray-600 mb-4">Click on content to schedule it on the calendar</p>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {content.filter(item => item.status === 'approved').length === 0 ? (
                    <div className="text-center py-8">
                      <Check className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No approved content yet</p>
                    </div>
                  ) : (
                    content.filter(item => item.status === 'approved').map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      return (
                        <div
                          key={item.id}
                          className="border rounded p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          onClick={() => {
                            setSelectedContent(item);
                            setShowScheduleModal(true);
                          }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-medium text-sm text-gray-800 truncate flex-1">{item.title}</h4>
                            <span className={`inline-block px-2 py-1 rounded text-xs ml-2 ${
                              item.type === 'social' ? 'bg-blue-100 text-blue-800' :
                              item.type === 'email' ? 'bg-green-100 text-green-800' :
                              item.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>{item.type}</span>
                          </div>
                          <p className="text-xs text-gray-600">{client?.companyName}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Video Production Queue</h3>
              {videos.length === 0 ? (
                <div className="text-center py-12">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No videos submitted yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {videos
                    .sort((a, b) => {
                      const statusOrder = { 'pending': 1, 'in-progress': 2, 'completed': 3 };
                      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                    })
                    .map(video => {
                    const client = users.find(u => u.id === video.clientId);
                    return (
                      <div key={video.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-800">{client?.companyName}</p>
                            {video.contentTitle && (
                              <p className="text-sm text-purple-600 font-medium">📝 For Content: {video.contentTitle}</p>
                            )}
                            <p className="text-sm text-gray-600">Submitted {new Date(video.submittedAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-3 py-1 rounded text-xs font-medium ${
                            video.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            video.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                          }`}>{video.status}</span>
                        </div>

                        {video.description && (
                          <p className="text-sm text-gray-700 mb-3">{video.description}</p>
                        )}
                        
                        <a href={video.videoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4" />View Raw Video
                        </a>

                        <div className="flex gap-2 mt-3">
                          <button onClick={() => updateVideoStatus(video.id, 'in-progress')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Mark In Progress
                          </button>
                          <button onClick={() => {
                            const link = prompt('Enter completed video link:');
                            if (link) updateVideoStatus(video.id, 'completed', link);
                          }} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                            Mark Complete
                          </button>
                        </div>

                        {video.completedLink && (
                          <div className="mt-3 p-3 bg-green-50 rounded">
                            <p className="text-sm font-medium text-green-800 mb-1">Completed Video:</p>
                            <a href={video.completedLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-sm">
                              {video.completedLink}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Group Management</h3>
                  <button
                    onClick={async () => {
                      const groupName = prompt('Enter group name:');
                      if (groupName && groupName.trim()) {
                        const newGroup = {
                          id: Date.now().toString(),
                          name: groupName.trim(),
                          createdAt: new Date().toISOString()
                        };
                        await saveGroups([...groups, newGroup]);
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Create Group
                  </button>
                </div>

                {groups.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No groups created yet</p>
                    <p className="text-sm text-gray-500 mt-2">Create a group to organize your clients</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {groups.map(group => {
                      const groupUsers = users.filter(u => u.groupId === group.id && !u.parentClientId);
                      return (
                        <div key={group.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800">{group.name}</h4>
                              <p className="text-sm text-gray-600">{groupUsers.length} client{groupUsers.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  const newName = prompt('Enter new group name:', group.name);
                                  if (newName && newName.trim() && newName !== group.name) {
                                    const updatedGroups = groups.map(g =>
                                      g.id === group.id ? { ...g, name: newName.trim() } : g
                                    );
                                    await saveGroups(updatedGroups);
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800 px-3 py-1 text-sm"
                              >
                                Rename
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete group "${group.name}"? Users in this group will be ungrouped.`)) {
                                    // Remove group from all users
                                    const updatedUsers = users.map(u =>
                                      u.groupId === group.id ? { ...u, groupId: null } : u
                                    );
                                    await saveUsers(updatedUsers);
                                    // Delete group
                                    const updatedGroups = groups.filter(g => g.id !== group.id);
                                    await saveGroups(updatedGroups);
                                    if (db) {
                                      await deleteDoc(doc(db, 'groups', group.id));
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 px-3 py-1 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {groupUsers.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-700 mb-2">Clients in this group:</p>
                              {groupUsers.map(user => (
                                <div key={user.id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                  <div>
                                    <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-gray-600">{user.companyName}</p>
                                  </div>
                                  <button
                                    onClick={async () => {
                                      const updatedUsers = users.map(u =>
                                        u.id === user.id ? { ...u, groupId: null } : u
                                      );
                                      await saveUsers(updatedUsers);
                                    }}
                                    className="text-red-600 hover:text-red-800 text-xs"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Assign Clients to Groups</h3>
                {users.filter(u => !u.parentClientId).length === 0 ? (
                  <p className="text-gray-600 text-center py-8">No clients available</p>
                ) : (
                  <div className="space-y-3">
                    {users.filter(u => !u.parentClientId).map(user => {
                      const userGroup = groups.find(g => g.id === user.groupId);
                      return (
                        <div key={user.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{user.firstName} {user.lastName} - {user.companyName}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {userGroup && (
                              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                                {userGroup.name}
                              </span>
                            )}
                            <select
                              value={user.groupId || ''}
                              onChange={async (e) => {
                                const newGroupId = e.target.value || null;
                                const updatedUsers = users.map(u =>
                                  u.id === user.id ? { ...u, groupId: newGroupId } : u
                                );
                                await saveUsers(updatedUsers);
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                              <option value="">No Group</option>
                              {groups.map(group => (
                                <option key={group.id} value={group.id}>{group.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sms' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">📱 Send Manual SMS Notifications</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Select clients and choose a template or write a custom message to send SMS notifications.
                  Automatic notifications have been disabled - all texts must be sent manually.
                </p>

                {/* Client Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Clients ({smsSelectedClients.length} selected)
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                    <label className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsSelectedClients.length === users.filter(u => !u.parentClientId).length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSmsSelectedClients(users.filter(u => !u.parentClientId).map(u => u.id));
                          } else {
                            setSmsSelectedClients([]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="font-semibold text-gray-900">Select All Clients</span>
                    </label>
                    <div className="border-t pt-2 mt-2">
                      {users.filter(u => !u.parentClientId).map(user => (
                        <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={smsSelectedClients.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSmsSelectedClients([...smsSelectedClients, user.id]);
                              } else {
                                setSmsSelectedClients(smsSelectedClients.filter(id => id !== user.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{user.companyName}</p>
                            <p className="text-xs text-gray-600">{user.firstName} {user.lastName} - {user.phoneNumber}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Template Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Message Template</label>
                  <select
                    value={smsTemplate}
                    onChange={(e) => {
                      setSmsTemplate(e.target.value);
                      if (e.target.value !== 'custom') {
                        setSmsCustomMessage('');
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Select a template --</option>
                    {Object.entries(smsTemplates).map(([key, template]) => (
                      <option key={key} value={key}>{template.name}</option>
                    ))}
                  </select>
                </div>

                {/* Message Preview or Custom Message */}
                {smsTemplate && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      {smsTemplate === 'custom' ? 'Custom Message' : 'Message Preview'}
                    </label>
                    {smsTemplate === 'custom' ? (
                      <textarea
                        value={smsCustomMessage}
                        onChange={(e) => setSmsCustomMessage(e.target.value)}
                        placeholder="Enter your custom message here..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        rows="6"
                      />
                    ) : (
                      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{smsTemplates[smsTemplate]?.message}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Character count: {(smsTemplate === 'custom' ? smsCustomMessage : smsTemplates[smsTemplate]?.message || '').length} / 160 (1 SMS)
                    </p>
                  </div>
                )}

                {/* Send Button */}
                <div className="flex gap-4">
                  <button
                    onClick={handleSendManualSMS}
                    disabled={smsSending || smsSelectedClients.length === 0 || !smsTemplate}
                    className={`flex-1 px-6 py-3 rounded-lg font-medium ${
                      smsSending || smsSelectedClients.length === 0 || !smsTemplate
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {smsSending ? '📤 Sending...' : `📱 Send SMS to ${smsSelectedClients.length} Client${smsSelectedClients.length !== 1 ? 's' : ''}`}
                  </button>
                  <button
                    onClick={() => {
                      setSmsSelectedClients([]);
                      setSmsTemplate('');
                      setSmsCustomMessage('');
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* SMS Templates Reference */}
              <div className="bg-blue-50 rounded-lg p-6">
                <h4 className="font-semibold text-blue-900 mb-3">📋 Available Templates</h4>
                <div className="space-y-3">
                  {Object.entries(smsTemplates).filter(([key]) => key !== 'custom').map(([key, template]) => (
                    <div key={key} className="bg-white rounded-lg p-3 border border-blue-200">
                      <p className="font-medium text-sm text-blue-900 mb-1">{template.name}</p>
                      <p className="text-xs text-gray-600 italic">{template.message.substring(0, 100)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-6">Upload Content</h2>
              <div className="space-y-4">
                {/* Publish Mode Selection */}
                <div className="border rounded p-4 bg-gray-50">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Publish To:</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="publishMode"
                        value="single"
                        checked={publishMode === 'single'}
                        onChange={(e) => setPublishMode(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">Single Client</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="publishMode"
                        value="all-realtors"
                        checked={publishMode === 'all-realtors'}
                        onChange={(e) => setPublishMode(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">All Realtors</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="publishMode"
                        value="all-loan-officers"
                        checked={publishMode === 'all-loan-officers'}
                        onChange={(e) => setPublishMode(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">All Loan Officers</span>
                    </label>
                  </div>
                </div>

                {/* Client Selection - Only show for single mode */}
                {publishMode === 'single' && (
                  <select value={newContent.clientId} onChange={(e) => setNewContent({ ...newContent, clientId: e.target.value })} className="w-full px-4 py-2 border rounded">
                    <option value="">Select Client</option>
                    {users.filter(u => !u.parentClientId).map(u => <option key={u.id} value={u.id}>{u.companyName} - {u.firstName} {u.lastName || ''}</option>)}
                  </select>
                )}

                <select value={newContent.type} onChange={(e) => setNewContent({ ...newContent, type: e.target.value })} className="w-full px-4 py-2 border rounded">
                  <option value="content-idea">Content Idea</option>
                  <option value="email">Email</option>
                  <option value="landing-page">Landing Page</option>
                  <option value="blog">Blog</option>
                  <option value="social">Social Media</option>
                </select>
                <input type="text" value={newContent.title} onChange={(e) => setNewContent({ ...newContent, title: e.target.value })} placeholder="Title" className="w-full px-4 py-2 border rounded" />
                <input type="text" value={newContent.description} onChange={(e) => setNewContent({ ...newContent, description: e.target.value })} placeholder="Description" className="w-full px-4 py-2 border rounded" />
                <textarea value={newContent.content} onChange={(e) => setNewContent({ ...newContent, content: e.target.value })} placeholder="Content" className="w-full px-4 py-3 border rounded" rows="6" />
                <input type="text" value={newContent.fileLink} onChange={(e) => setNewContent({ ...newContent, fileLink: e.target.value })} placeholder="File Link (optional)" className="w-full px-4 py-2 border rounded" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={async () => {
                  // Validation based on publish mode
                  if (publishMode === 'single' && (!newContent.clientId || !newContent.title || !newContent.content)) {
                    alert('Please fill in all required fields');
                    return;
                  }
                  if (publishMode !== 'single' && (!newContent.title || !newContent.content)) {
                    alert('Please fill in title and content');
                    return;
                  }

                  // Bulk publish mode
                  if (publishMode === 'all-realtors' || publishMode === 'all-loan-officers') {
                    const targetIndustry = publishMode === 'all-realtors' ? 'Realtor' : 'Loan Officer';

                    // Filter users by industry
                    const targetUsers = users.filter(u => {
                      if (u.parentClientId) return false; // Skip team members
                      if (!u.onboardingAnswers?.industry) return false;
                      const industries = Array.isArray(u.onboardingAnswers.industry)
                        ? u.onboardingAnswers.industry
                        : [u.onboardingAnswers.industry];
                      return industries.includes(targetIndustry);
                    });

                    if (targetUsers.length === 0) {
                      alert(`No ${targetIndustry}s found to publish to`);
                      return;
                    }

                    const confirmMsg = `Publish this content to ${targetUsers.length} ${targetIndustry}${targetUsers.length > 1 ? 's' : ''}?\n\n${targetUsers.map(u => u.companyName).join(', ')}`;
                    if (!confirm(confirmMsg)) return;

                    // Create content for each target user
                    const newContentPieces = targetUsers.map(user => ({
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                      clientId: user.id,
                      type: newContent.type,
                      title: newContent.title,
                      description: newContent.description,
                      content: newContent.content,
                      fileLink: newContent.fileLink,
                      status: 'pending',
                      createdAt: new Date().toISOString()
                    }));

                    await saveContent([...content, ...newContentPieces]);

                    // Automatic client notifications are disabled - use manual SMS from admin portal
                    console.log(`✅ Published to ${targetUsers.length} ${targetIndustry}${targetUsers.length > 1 ? 's' : ''} (SMS notifications disabled)`);

                    alert(`✅ Successfully published to ${targetUsers.length} ${targetIndustry}${targetUsers.length > 1 ? 's' : ''}!`);
                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setPublishMode('single');
                    setShowForm(false);
                  }
                  // Single client mode
                  else {
                    await saveContent([...content, { id: Date.now().toString(), ...newContent, status: 'pending', createdAt: new Date().toISOString() }]);

                    // Automatic client notifications are disabled - use manual SMS from admin portal
                    console.log(`✅ Content published to client (SMS notifications disabled)`);

                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setShowForm(false);
                  }
                }} className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700">
                  {publishMode === 'single' ? 'Upload' : `Publish to All ${publishMode === 'all-realtors' ? 'Realtors' : 'Loan Officers'}`}
                </button>
                <button onClick={() => {
                  setShowForm(false);
                  setPublishMode('single');
                }} className="flex-1 bg-gray-200 py-3 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Content Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h2 className="text-2xl font-bold mb-6">Schedule Content</h2>

              {selectedContent ? (
                <div className="space-y-4">
                  <div className="border rounded p-4 bg-gray-50">
                    <h3 className="font-semibold text-gray-800 mb-2">{selectedContent.title}</h3>
                    <p className="text-sm text-gray-600 mb-1">{selectedContent.description}</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      selectedContent.type === 'social' ? 'bg-blue-100 text-blue-800' :
                      selectedContent.type === 'email' ? 'bg-green-100 text-green-800' :
                      selectedContent.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{selectedContent.type}</span>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Schedule Date</label>
                    <input
                      type="date"
                      value={selectedDate ? formatDateLocal(selectedDate) : ''}
                      onChange={(e) => {
                        const [year, month, day] = e.target.value.split('-').map(Number);
                        setSelectedDate(new Date(year, month - 1, day));
                      }}
                      className="w-full px-4 py-2 border rounded"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={async () => {
                        if (!selectedDate) {
                          alert('Please select a date');
                          return;
                        }

                        await saveCalendarEvents([...calendarEvents, {
                          id: Date.now().toString(),
                          clientId: selectedContent.clientId,
                          title: selectedContent.title,
                          description: selectedContent.description,
                          date: formatDateLocal(selectedDate),
                          type: selectedContent.type,
                          contentId: selectedContent.id,
                          createdAt: new Date().toISOString()
                        }]);

                        setShowScheduleModal(false);
                        setSelectedContent(null);
                        setSelectedDate(null);
                        alert('Content scheduled successfully!');
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setSelectedContent(null);
                        setSelectedDate(null);
                      }}
                      className="flex-1 bg-gray-200 py-3 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selectedDate ? (
                <div className="space-y-4">
                  <p className="text-gray-600 mb-4">
                    Select content to schedule for <strong>{selectedDate.toLocaleDateString()}</strong>
                  </p>

                  <div className="max-h-[400px] overflow-y-auto space-y-2">
                    {content.filter(item => item.status === 'approved').length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No approved content available to schedule</p>
                      </div>
                    ) : (
                      content.filter(item => item.status === 'approved').map(item => {
                        const client = users.find(u => u.id === item.clientId);
                        return (
                          <div
                            key={item.id}
                            className="border rounded p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                            onClick={() => setSelectedContent(item)}
                          >
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="font-medium text-sm text-gray-800">{item.title}</h4>
                              <span className={`inline-block px-2 py-1 rounded text-xs ml-2 ${
                                item.type === 'social' ? 'bg-blue-100 text-blue-800' :
                                item.type === 'email' ? 'bg-green-100 text-green-800' :
                                item.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>{item.type}</span>
                            </div>
                            <p className="text-xs text-gray-600">{client?.companyName}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setSelectedDate(null);
                      }}
                      className="flex-1 bg-gray-200 py-3 rounded hover:bg-gray-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Please select a date or content to schedule</p>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="mt-4 bg-gray-200 px-6 py-2 rounded hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{selectedUser.companyName}</h2>
                  <p className="text-gray-600">{selectedUser.firstName} {selectedUser.lastName || ''}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Basic Information
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">First Name:</span>
                      <span className="ml-2 font-medium">{selectedUser.firstName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Name:</span>
                      <span className="ml-2 font-medium">{selectedUser.lastName || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{selectedUser.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Company:</span>
                      <span className="ml-2 font-medium">{selectedUser.companyName}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Joined:</span>
                      <span className="ml-2 font-medium">{new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Onboarded:</span>
                      <span className="ml-2 font-medium">{selectedUser.onboarded ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                {/* Onboarding Answers */}
                {selectedUser.onboardingAnswers && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Onboarding Answers
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-gray-600 font-medium">Industry:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.industry)
                            ? selectedUser.onboardingAnswers.industry.join(', ')
                            : selectedUser.onboardingAnswers.industry || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Target Audience:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.targetAudience)
                            ? selectedUser.onboardingAnswers.targetAudience.join(', ')
                            : selectedUser.onboardingAnswers.targetAudience || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Goals:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.goals)
                            ? selectedUser.onboardingAnswers.goals.join(', ')
                            : selectedUser.onboardingAnswers.goals || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Brand Voice:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.brandVoice)
                            ? selectedUser.onboardingAnswers.brandVoice.join(', ')
                            : selectedUser.onboardingAnswers.brandVoice || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Competitors:</span>
                        <p className="text-gray-800 mt-1">{selectedUser.onboardingAnswers.competitors || 'Not provided'}</p>
                      </div>
                      {selectedUser.onboardingAnswers.otherInputs && Object.keys(selectedUser.onboardingAnswers.otherInputs).some(k => selectedUser.onboardingAnswers.otherInputs[k]) && (
                        <div>
                          <span className="text-gray-600 font-medium">Additional Details:</span>
                          {Object.entries(selectedUser.onboardingAnswers.otherInputs).map(([key, value]) =>
                            value ? (
                              <p key={key} className="text-gray-800 mt-1">
                                <span className="capitalize">{key}:</span> {value}
                              </p>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Social Media Logins */}
                {selectedUser.socialLogins && Object.keys(selectedUser.socialLogins).some(k => selectedUser.socialLogins[k]) && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      Social Media Logins
                    </h3>
                    <div className="grid md:grid-cols-2 gap-3 text-sm">
                      {Object.entries(selectedUser.socialLogins).map(([platform, login]) =>
                        login ? (
                          <div key={platform}>
                            <span className="text-gray-600 capitalize">{platform}:</span>
                            <span className="ml-2 font-medium">{login}</span>
                          </div>
                        ) : null
                      )}
                      {!Object.values(selectedUser.socialLogins).some(v => v) && (
                        <p className="text-gray-600 col-span-2">No social media logins provided</p>
                      )}
                    </div>
                  </div>
                )}

                {!selectedUser.socialLogins && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Share2 className="w-5 h-5" />
                      Social Media Logins
                    </h3>
                    <p className="text-gray-600 text-sm">No social media logins provided</p>
                  </div>
                )}
                {/* Admin Notes for ChatGPT */}
                <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-600" />
                    Admin Notes for ChatGPT
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Add notes about this client's preferences, feedback, or special requirements. ChatGPT will use these notes when generating future content to avoid recycled ideas and better match their expectations.
                  </p>
                  <textarea
                    className="w-full px-4 py-3 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 outline-none text-sm"
                    rows="6"
                    placeholder="e.g., 'Client prefers casual tone, avoid real estate jargon. They loved the storytelling approach in previous posts. Focus more on first-time homebuyers.'"
                    defaultValue={selectedUser.adminNotes || ''}
                    onBlur={async (e) => {
                      const updatedNotes = e.target.value;
                      const updatedUser = { ...selectedUser, adminNotes: updatedNotes };
                      setSelectedUser(updatedUser);
                      await saveUsers(users.map(u => u.id === selectedUser.id ? updatedUser : u));
                      console.log('✅ Admin notes saved for', selectedUser.companyName);
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: These notes help ChatGPT remember what works and what doesn't for this client
                  </p>
                </div>

                {/* Client Assets */}
                {(selectedUser.headshot || selectedUser.companyLogo) && (
                  <div className="bg-indigo-50 rounded-lg p-4 border-2 border-indigo-200">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      Client Assets
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {selectedUser.headshot && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Headshot</p>
                          <img
                            src={selectedUser.headshot}
                            alt="Client Headshot"
                            className="w-full h-48 object-cover rounded-lg border-2 border-indigo-300"
                          />
                        </div>
                      )}
                      {selectedUser.companyLogo && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Company Logo</p>
                          <img
                            src={selectedUser.companyLogo}
                            alt="Company Logo"
                            className="w-full h-48 object-contain rounded-lg border-2 border-indigo-300 bg-white p-4"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setCurrentUser(selectedUser);
                    setView('dashboard');
                    saveSession(selectedUser, 'dashboard');
                    setSelectedUser(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  View as User
                </button>
                <button onClick={() => setSelectedUser(null)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default ClientPortal;
