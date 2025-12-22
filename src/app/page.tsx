"use client";
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Mail, Layout, Check, X, Clock, Eye, ChevronRight, ChevronLeft, EyeOff, Share2, Users, Sparkles, UserPlus, Settings } from 'lucide-react';

// Firebase imports - Make sure to install: npm install firebase
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

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
    console.log('✅ Firestore connected');
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

  const handleSignup = async (email, password, companyName, firstName) => {
    const newUser = {
      id: Date.now().toString(),
      email,
      password,
      companyName,
      firstName,
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
    await saveContent(content.map(c => 
      c.id === contentId ? { ...c, status: action, feedback, reviewedAt: new Date().toISOString() } : c
    ));
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
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async () => {
      setError('');
      if (isSignup) {
        if (!companyName.trim() || !firstName.trim()) {
          setError('All fields required');
          return;
        }
        await handleSignup(email, password, companyName, firstName);
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
      industry: '', targetAudience: '', goals: '', brandVoice: '', competitors: ''
    });

    const industries = ['E-commerce', 'SaaS', 'Healthcare', 'Finance', 'Real Estate', 'Education', 'Food & Beverage', 'Technology', 'Consulting', 'Other'];
    const audiences = ['Young Professionals', 'Small Business Owners', 'Students', 'Parents', 'Seniors', 'Millennials', 'Gen Z', 'Entrepreneurs', 'Other'];
    const goalOptions = ['Increase Brand Awareness', 'Generate Leads', 'Drive Sales', 'Build Community', 'Improve Engagement', 'Launch Product', 'Other'];
    const voiceOptions = ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'];

    const questions = [
      { type: 'buttons', key: 'industry', label: 'What industry are you in?', options: industries },
      { type: 'buttons', key: 'targetAudience', label: 'Who is your target audience?', options: audiences },
      { type: 'buttons', key: 'goals', label: 'What are your main marketing goals?', options: goalOptions },
      { type: 'buttons', key: 'brandVoice', label: 'How would you describe your brand voice?', options: voiceOptions },
      { type: 'text', key: 'competitors', label: 'Who are your main competitors?', placeholder: 'e.g., Company A, Company B' }
    ];

    const currentQuestion = questions[currentStep];

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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              {currentQuestion.options.map(opt => (
                <button key={opt} onClick={() => setAnswers({ ...answers, [currentQuestion.key]: opt })} className={`px-4 py-3 rounded-lg border-2 transition ${answers[currentQuestion.key] === opt ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button onClick={() => setCurrentStep(currentStep - 1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />Back
              </button>
            )}
            <button onClick={() => {
              if (answers[currentQuestion.key].trim()) {
                if (currentStep < questions.length - 1) setCurrentStep(currentStep + 1);
                else handleOnboarding(answers);
              }
            }} disabled={!answers[currentQuestion.key].trim()} className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center justify-center gap-2">
              {currentStep < questions.length - 1 ? <><span>Next</span><ChevronRight className="w-5 h-5" /></> : 'Complete Setup'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function DashboardView() {
    const clientContent = content.filter(c => c.clientId === currentUser.id);
    const [selectedContent, setSelectedContent] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [activePage, setActivePage] = useState('content');
    const [teamEmail, setTeamEmail] = useState('');
    const [teamPass, setTeamPass] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [editedAnswers, setEditedAnswers] = useState(currentUser.onboardingAnswers || {});
    const [socialLogins, setSocialLogins] = useState(currentUser.socialLogins || {
      instagram: '', facebook: '', youtube: '', x: '', linkedin: '', crm: ''
    });
    const [videoLink, setVideoLink] = useState('');
    const [videoDescription, setVideoDescription] = useState('');

    const navItems = [
      { id: 'social', label: 'Social Media', icon: Share2 },
      { id: 'crm', label: 'CRM', icon: Users },
      { id: 'ai-generator', label: 'AI Content Generator', icon: Sparkles },
      { id: 'ai', label: 'AI Optimization', icon: Sparkles },
      { id: 'team', label: 'Team Members', icon: UserPlus },
      { id: 'settings', label: 'Settings', icon: Settings }
    ];

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{currentUser.companyName}</h1>
              <p className="text-sm text-gray-600">Content Review Portal</p>
            </div>
            <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-600 hover:text-gray-800">Logout</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 mb-8 text-white">
            <h2 className="text-3xl font-bold mb-2">Let's Get Started, {currentUser.firstName}! 👋</h2>
            <p className="text-blue-100">Review your marketing materials and provide feedback</p>
          </div>

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
                <button key={item.id} onClick={() => setActivePage(item.id)} className={`p-3 rounded-lg transition ${activePage === item.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${activePage === item.id ? 'text-white' : 'text-gray-600'}`} />
                  <p className="text-xs font-medium text-center">{item.label}</p>
                </button>
              );
            })}
          </div>

          {activePage === 'content' && (
            <>
              {clientContent.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No content yet</h3>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {clientContent.map(item => (
                    <div key={item.id} className="bg-white rounded-lg shadow p-6">
                      <div className="flex justify-between mb-4">
                        <h3 className="font-semibold">{item.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                      <button onClick={() => setSelectedContent(item)} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                <p className="text-sm text-gray-600 mb-4">Upload your raw footage and we'll handle the editing</p>
                <div className="space-y-4">
                  <input type="text" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} placeholder="Google Drive or Dropbox link to your video" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  <textarea value={videoDescription} onChange={(e) => setVideoDescription(e.target.value)} placeholder="Brief description or notes about the video" className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows="3" />
                  <button onClick={async () => {
                    if (videoLink.trim()) {
                      const newVideo = {
                        id: Date.now().toString(),
                        clientId: currentUser.id,
                        videoLink,
                        description: videoDescription,
                        status: 'pending',
                        submittedAt: new Date().toISOString()
                      };
                      try {
                        if (!db) {
                          alert('⚠️ Cloud storage not configured. Video not saved.');
                          console.error('❌ Firestore not available');
                          return;
                        }

                        // Save video to Firestore
                        console.log('💾 Submitting video to Firestore...');
                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);
                        console.log('✅ Video submitted successfully:', newVideo.id);
                        setVideoLink('');
                        setVideoDescription('');
                        alert('Video submitted successfully!');
                      } catch (error) {
                        console.error('❌ Error submitting video:', error);
                        console.error('Error details:', error.message);
                        alert('Error submitting video. Please try again.');
                      }
                    }
                  }} disabled={!videoLink.trim()} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
                    Submit Video
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Approved Social Content</h3>
                {clientContent.filter(c => c.status === 'approved' && c.type === 'social').length === 0 ? (
                  <div className="text-center py-8">
                    <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No approved social content yet</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {clientContent.filter(c => c.status === 'approved' && c.type === 'social').map(item => (
                      <div key={item.id} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-800 mb-2">{item.title}</h4>
                        <p className="text-gray-600 text-sm mb-3">{item.content}</p>
                        {item.fileLink && (
                          <a href={item.fileLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" />View Attachment
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activePage === 'crm' && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Users className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">CRM</h3>
              <p className="text-gray-600">Approved emails will appear here</p>
            </div>
          )}

          {activePage === 'ai-generator' && <AIContentAssistant />}

          {activePage === 'ai' && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">AI Optimization</h3>
              <p className="text-gray-600">Coming soon - optimized content for your campaigns</p>
            </div>
          )}

          {activePage === 'team' && (
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-semibold mb-6">Team Members</h3>
              <p className="text-gray-600 mb-6">Add team members to collaborate on your marketing</p>
              
              <div className="space-y-4 max-w-md mb-8">
                <input type="email" value={teamEmail} onChange={(e) => setTeamEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2" />
                <input type="password" value={teamPass} onChange={(e) => setTeamPass(e.target.value)} placeholder="Password" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2" />
                <button onClick={async () => {
                  if (teamEmail.trim() && teamPass.trim()) {
                    await saveUsers([...users, {
                      id: Date.now().toString(),
                      email: teamEmail,
                      password: teamPass,
                      companyName: currentUser.companyName,
                      firstName: 'Team Member',
                      onboarded: true,
                      parentClientId: currentUser.id,
                      createdAt: new Date().toISOString()
                    }]);
                    setTeamEmail('');
                    setTeamPass('');
                  }
                }} disabled={!teamEmail.trim() || !teamPass.trim()} className="w-full bg-orange-600 text-white py-3 rounded hover:bg-orange-700 disabled:bg-gray-300">Add Team Member</button>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold text-gray-800 mb-4">Current Team Members</h4>
                <div className="space-y-2">
                  {users.filter(u => u.parentClientId === currentUser.id).map(member => (
                    <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="text-gray-700">{member.email}</span>
                        <span className="text-xs text-gray-500 ml-3">Added {new Date(member.createdAt).toLocaleDateString()}</span>
                      </div>
                      <button onClick={async () => {
                        try {
                          if (!db) {
                            console.error('❌ Firestore not available');
                            alert('⚠️ Cloud storage not configured. Cannot remove team member.');
                            return;
                          }

                          console.log(`🗑️ Removing team member: ${member.email}`);
                          // Delete user from Firestore
                          await deleteDoc(doc(db, 'users', member.id));
                          console.log('✅ Team member deleted from Firestore');

                          // Update local state
                          await saveUsers(users.filter(u => u.id !== member.id));
                        } catch (e) {
                          console.error('❌ Error removing team member:', e);
                          console.error('Error details:', e.message);
                        }
                      }} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                    </div>
                  ))}
                  {users.filter(u => u.parentClientId === currentUser.id).length === 0 && (
                    <p className="text-gray-500 text-sm">No team members added yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-semibold mb-6">Settings</h3>
              <div className="space-y-3 mb-8">
                {['industry', 'targetAudience', 'goals', 'brandVoice', 'competitors'].map(key => (
                  <div key={key} className="border rounded">
                    <button onClick={() => setExpanded(expanded === key ? null : key)} className="w-full px-4 py-3 flex justify-between hover:bg-gray-50">
                      <span className="font-medium capitalize">{key}</span>
                      <ChevronRight className={`w-5 h-5 transition ${expanded === key ? 'rotate-90' : ''}`} />
                    </button>
                    {expanded === key && (
                      <div className="px-4 pb-4">
                        <textarea value={editedAnswers[key] || ''} onChange={(e) => setEditedAnswers({ ...editedAnswers, [key]: e.target.value })} className="w-full px-4 py-3 border rounded mb-3" rows="3" />
                        <button onClick={async () => {
                          const updated = { ...currentUser, onboardingAnswers: editedAnswers };
                          setCurrentUser(updated);
                          await saveUsers(users.map(u => u.id === currentUser.id ? updated : u));
                          setExpanded(null);
                        }} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Save</button>
                      </div>
                    )}
                  </div>
                ))}
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
              }} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">Save Social Logins</button>
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
      </div>
    );
  }

  function AIContentAssistant() {
    const [step, setStep] = useState(0);
    const [topic, setTopic] = useState('');
    const [contentType, setContentType] = useState('');
    const [audience, setAudience] = useState('');
    const [tone, setTone] = useState('');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const contentTypes = ['Blog Post', 'Email Campaign', 'Social Media Post', 'Landing Page', 'Product Description', 'Ad Copy', 'Newsletter', 'Video Script'];
    const audiences = ['Small Business Owners', 'Millennials', 'Gen Z', 'Baby Boomers', 'Professionals', 'Students', 'Parents', 'Entrepreneurs', 'Other'];
    const tones = ['Professional', 'Casual', 'Friendly', 'Inspiring', 'Authoritative', 'Humorous', 'Empathetic', 'Enthusiastic', 'Educational'];

    const questions = [
      { type: 'text', label: 'What is the topic of your content?', value: topic, setValue: setTopic, placeholder: 'e.g., Social media marketing tips for small businesses' },
      { type: 'select', label: 'What type of content do you need?', value: contentType, setValue: setContentType, options: contentTypes },
      { type: 'buttons', label: 'Who is your target audience?', value: audience, setValue: setAudience, options: audiences },
      { type: 'buttons', label: 'What tone should the content have?', value: tone, setValue: setTone, options: tones }
    ];

    const generateContent = async () => {
      setIsGenerating(true);
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: `Create a ${contentType} about ${topic} for ${audience}. The tone should be ${tone}. Please write compelling, engaging content that resonates with this audience.` }]
          })
        });
        const data = await response.json();
        const content = data.content.map(item => item.text || '').join('\n');
        setGeneratedContent(content);
        setStep(4);
      } catch (error) {
        setGeneratedContent('Sorry, there was an error generating content. Please try again.');
        setStep(4);
      }
      setIsGenerating(false);
    };

    const resetForm = () => {
      setStep(0);
      setTopic('');
      setContentType('');
      setAudience('');
      setTone('');
      setGeneratedContent('');
    };

    if (step === 4) {
      return (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <h3 className="text-2xl font-semibold">Generated Content</h3>
          </div>
          <div className="bg-purple-50 p-6 rounded-lg mb-6">
            <p className="whitespace-pre-wrap text-gray-800">{generatedContent}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 bg-purple-600 text-white py-3 rounded hover:bg-purple-700">Create New Content</button>
            <button onClick={() => navigator.clipboard.writeText(generatedContent)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded hover:bg-gray-300">Copy to Clipboard</button>
          </div>
        </div>
      );
    }

    const currentQ = questions[step];
    return (
      <div className="bg-white rounded-lg shadow p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <h3 className="text-2xl font-semibold">AI Content Assistant</h3>
        </div>
        <div className="flex gap-2 mb-8">
          {questions.map((_, idx) => (
            <div key={idx} className={`h-2 flex-1 rounded-full transition ${idx <= step ? 'bg-purple-600' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="mb-2 text-sm text-purple-600 font-medium">Question {step + 1} of {questions.length}</div>
        <label className="block text-xl font-semibold text-gray-800 mb-4">{currentQ.label}</label>
        
        {currentQ.type === 'text' && (
          <input type="text" value={currentQ.value} onChange={(e) => currentQ.setValue(e.target.value)} placeholder={currentQ.placeholder} className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none mb-6" />
        )}
        {currentQ.type === 'select' && (
          <select value={currentQ.value} onChange={(e) => currentQ.setValue(e.target.value)} className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none mb-6">
            <option value="">Select an option...</option>
            {currentQ.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        )}
        {currentQ.type === 'buttons' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {currentQ.options.map(opt => (
              <button key={opt} onClick={() => currentQ.setValue(opt)} className={`px-4 py-3 rounded-lg border-2 transition ${currentQ.value === opt ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>{opt}</button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" />Back
            </button>
          )}
          <button onClick={() => {
            if (currentQ.value.trim()) {
              if (step < 3) setStep(step + 1);
              else generateContent();
            }
          }} disabled={!currentQ.value.trim() || isGenerating} className="flex-1 bg-purple-600 text-white py-3 rounded hover:bg-purple-700 disabled:bg-gray-300 flex items-center justify-center gap-2">
            {isGenerating ? 'Generating...' : step < 3 ? <><span>Next</span><ChevronRight className="w-5 h-5" /></> : 'Generate Content'}
          </button>
        </div>
      </div>
    );
  }

  function AdminView() {
    const [showForm, setShowForm] = useState(false);
    const [newContent, setNewContent] = useState({
      clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: ''
    });
    const [videos, setVideos] = useState([]);
    const [activeTab, setActiveTab] = useState('clients');

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
      const updated = videos.map(v => 
        v.id === videoId ? { ...v, status, completedLink, completedAt: new Date().toISOString() } : v
      );
      await saveVideos(updated);
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-300 hover:text-white">Logout</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between">
            <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 flex items-center gap-2">
              <Upload className="w-5 h-5" />Upload Content
            </button>
          </div>

          <div className="flex gap-4 mb-8">
            <button onClick={() => setActiveTab('clients')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'clients' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Clients & Content
            </button>
            <button onClick={() => setActiveTab('videos')} className={`px-6 py-3 rounded-lg font-medium ${activeTab === 'videos' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}>
              Video Production Queue
            </button>
          </div>

          {activeTab === 'clients' && (
            <div>
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {users.filter(u => !u.parentClientId).map(user => {
                  const userContent = content.filter(c => c.clientId === user.id);
                  const teamMembers = users.filter(u => u.parentClientId === user.id);
                  return (
                    <div key={user.id} className="bg-white rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold">{user.companyName}</h3>
                      <p className="text-sm text-gray-600">{user.firstName} • {user.email}</p>
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
                    </div>
                  );
                })}
              </div>

              {content.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">All Content</h3>
                  <div className="space-y-3">
                    {content.map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      return (
                        <div key={item.id} className="p-4 bg-gray-50 rounded">
                          <div className="flex justify-between mb-2">
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className="text-sm text-gray-600">{client?.companyName} • {item.type}</p>
                            </div>
                            <span className={`px-3 py-1 rounded text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
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
                  {videos.map(video => {
                    const client = users.find(u => u.id === video.clientId);
                    return (
                      <div key={video.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold text-gray-800">{client?.companyName}</p>
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
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-6">Upload Content</h2>
              <div className="space-y-4">
                <select value={newContent.clientId} onChange={(e) => setNewContent({ ...newContent, clientId: e.target.value })} className="w-full px-4 py-2 border rounded">
                  <option value="">Select Client</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.companyName}</option>)}
                </select>
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
                  if (newContent.clientId && newContent.title && newContent.content) {
                    await saveContent([...content, { id: Date.now().toString(), ...newContent, status: 'pending', createdAt: new Date().toISOString() }]);
                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setShowForm(false);
                  }
                }} className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700">Upload</button>
                <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 py-3 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
};

export default ClientPortal;
