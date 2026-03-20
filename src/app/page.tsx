"use client";
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Mail, Layout, Check, X, Clock, Eye, ChevronRight, ChevronLeft, EyeOff, Share2, Users, Sparkles, UserPlus, Settings, Calendar, Video, Download, Wand2, CheckSquare, Square, Plus, Trash2, ListTodo, MessageSquare, Repeat, Bell, BellOff, PlusCircle, LayoutDashboard, ChevronDown } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

// Firebase imports - Make sure to install: npm install firebase
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
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

// OnboardingView is defined outside ClientPortal to prevent state reset on parent re-renders
// (Firebase real-time listeners cause parent re-renders which would reset the form)
function OnboardingView({ currentUser, handleOnboarding }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({
    industry: [], targetAudience: [], brandVoice: [], specialties: [],
    primaryMarkets: '', pricePoint: '', clientPainPoints: '', topicsToAvoid: '', styleInspirations: '', successMetrics: '', agencyExperience: ''
  });
  const [otherInputs, setOtherInputs] = useState({
    industry: '', targetAudience: '', brandVoice: '', specialties: ''
  });

  const industries = ['Realtor', 'Loan Officer'];
  const audiences = ['Young Professionals', 'Small Business Owners', 'Students', 'Parents', 'Seniors', 'Millennials', 'Gen Z', 'Entrepreneurs'];
  const voiceOptions = ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'];
  const specialtyOptions = ['First-Time Buyers', 'Luxury Homes', 'Investment Properties', 'Commercial', 'VA Loans', 'FHA Loans', 'Refinancing', 'New Construction', 'Relocation', 'Downsizing'];

  const questions = [
    { type: 'buttons', key: 'industry', label: 'What do you do?', options: industries },
    { type: 'buttons', key: 'targetAudience', label: 'Who is your target audience? (Select all that apply)', options: audiences },
    { type: 'buttons', key: 'brandVoice', label: 'How would you describe your brand voice? (Select all that apply)', options: voiceOptions },
    { type: 'buttons', key: 'specialties', label: 'What are your specialties? (Select all that apply)', options: specialtyOptions },
    { type: 'text', key: 'primaryMarkets', label: 'What are your primary markets? (locations)', placeholder: 'e.g., Los Angeles, Orange County, San Diego' },
    { type: 'text', key: 'pricePoint', label: 'Average price point or loan size', placeholder: 'e.g., $500K-$1M, $300K loans' },
    { type: 'text', key: 'clientPainPoints', label: 'What are the biggest pain points or challenges your clients face?', placeholder: 'e.g., Saving for a down payment, understanding the loan process, finding the right neighborhood...' },
    { type: 'text', key: 'topicsToAvoid', label: 'Are there any topics you want to AVOID in your content?', placeholder: 'e.g., Political topics, specific competitors, certain neighborhoods...' },
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

const ClientPortal = () => {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [content, setContent] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [dailyTasks, setDailyTasks] = useState([]);
  const [dailyTaskCompletions, setDailyTaskCompletions] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminActivities, setAdminActivities] = useState([]);

  useEffect(() => {
    // Set up real-time listeners for data sync across devices/tabs
    const unsubscribers: (() => void)[] = [];

    if (db) {
      // Real-time listeners for data sync - minimal logging to reduce performance overhead
      const listen = (collectionName, setter) => {
        return onSnapshot(collection(db, collectionName), (snapshot) => {
          setter(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        }, (error) => {
          console.error(`Error syncing ${collectionName}:`, error);
        });
      };

      unsubscribers.push(listen('users', setUsers));
      unsubscribers.push(listen('content', setContent));
      unsubscribers.push(listen('calendarEvents', setCalendarEvents));
      unsubscribers.push(listen('groups', setGroups));
      unsubscribers.push(listen('dailyTasks', setDailyTasks));
      unsubscribers.push(listen('dailyTaskCompletions', setDailyTaskCompletions));
      unsubscribers.push(listen('adminUsers', setAdminUsers));
      unsubscribers.push(listen('adminActivities', setAdminActivities));
    } else {
      // Fallback to one-time load if db not available
      loadData();
    }

    restoreSession();

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  // Keep currentUser in sync when users data changes from another device/tab
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const updatedUser = users.find(u => u.id === currentUser.id);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        console.log('🔄 Updating current user session with latest data');
        setCurrentUser(updatedUser);
        saveSession(updatedUser, view);
      }
    }
  }, [users, currentUser?.id]);

  // Refresh session data when user returns to the tab (for browsers that don't maintain WebSocket connections)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        console.log('👁️ Tab became visible - checking for session updates');
        // The onSnapshot listeners will automatically sync data
        // But we also update the saved session with current user data
        const updatedUser = users.find(u => u.id === currentUser.id);
        if (updatedUser) {
          setCurrentUser(updatedUser);
          saveSession(updatedUser, view);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, users, view]);

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

  const saveUsers = async (u, changedIds?: string[]) => {
    // Don't update local state - let onSnapshot handle it to prevent race conditions
    if (!db) {
      setUsers(u);
      return;
    }

    try {
      // Only save changed users if specified, otherwise save all
      const usersToSave = changedIds
        ? u.filter(user => changedIds.includes(user.id))
        : u;

      const savePromises = usersToSave.map(user => setDoc(doc(db, 'users', user.id), user));
      await Promise.all(savePromises);
    } catch (e) {
      console.error('Error saving users:', e);
    }
  };

  // Helper function to save a single item with retry logic
  const saveContentItemWithRetry = async (item, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await setDoc(doc(db, 'content', item.id), item);
        return true;
      } catch (error) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    return false;
  };

  // Save only specific content items to Firestore (not all)
  // This is more efficient and avoids race conditions with real-time sync
  const saveContentItems = async (items, options = {}) => {
    const { showAlert = false, alertMessage = '' } = options;

    if (!db) {
      console.warn('⚠️ Firestore not available - content not saved to cloud');
      if (showAlert) {
        alert('⚠️ Cloud storage not configured. Content not saved.');
      }
      return false;
    }

    if (!items || items.length === 0) {
      console.warn('⚠️ No items to save');
      return false;
    }

    try {
      // Save items in parallel for better performance
      const savePromises = items.map(item => saveContentItemWithRetry(item));
      const results = await Promise.allSettled(savePromises);

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        if (showAlert) {
          alert(`Failed to save ${failures.length} content item(s). Please try again.`);
        }
        return false;
      }
      if (showAlert && alertMessage) {
        alert(alertMessage);
      }
      return true;
    } catch (e) {
      console.error('❌ Error saving content to cloud:', e);
      console.error('Error details:', e.message);
      if (showAlert) {
        alert('❌ Failed to save content. Please try again.');
      }
      return false;
    }
  };

  // Legacy function - saves all content (use sparingly, prefer saveContentItems)
  const saveContent = async (c) => {
    if (!db) {
      setContent(c);
      return;
    }

    try {
      const savePromises = c.map(item => saveContentItemWithRetry(item));
      await Promise.all(savePromises);
    } catch (e) {
      console.error('Error saving content:', e);
    }
  };

  const saveCalendarEvents = async (events) => {
    if (!db) {
      setCalendarEvents(events);
      return;
    }

    try {
      // Only save new/changed events by comparing with current state
      const currentIds = new Set(calendarEvents.map(e => e.id));
      const newEvents = events.filter(e => !currentIds.has(e.id));
      const existingEvents = events.filter(e => currentIds.has(e.id));

      // Save new events in parallel
      const savePromises = newEvents.map(event => setDoc(doc(db, 'calendarEvents', event.id), event));
      // Also save any modified existing events
      for (const event of existingEvents) {
        const existing = calendarEvents.find(e => e.id === event.id);
        if (JSON.stringify(existing) !== JSON.stringify(event)) {
          savePromises.push(setDoc(doc(db, 'calendarEvents', event.id), event));
        }
      }
      await Promise.all(savePromises);
    } catch (e) {
      console.error('Error saving calendar events:', e);
    }
  };

  const saveGroups = async (g) => {
    if (!db) {
      setGroups(g);
      return;
    }

    try {
      const savePromises = g.map(group => setDoc(doc(db, 'groups', group.id), group));
      await Promise.all(savePromises);
    } catch (e) {
      console.error('Error saving groups:', e);
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
    // Create the updated item
    const existingItem = content.find(c => c.id === contentId);
    if (!existingItem) {
      console.error(`❌ Content item not found: ${contentId}`);
      return;
    }

    const updatedItem = {
      ...existingItem,
      status: action,
      feedback,
      reviewedAt: new Date().toISOString()
    };

    console.log(`📝 Content ${action}:`, updatedItem.title, 'Status:', updatedItem.status);

    // Save only the updated item (not all content) - let real-time sync update state
    const saved = await saveContentItems([updatedItem]);
    if (!saved) {
      alert(`⚠️ ${currentUser?.firstName || 'User'}, failed to save content status. Please try again.`);
      return;
    }

    // Send SMS notification to admin when content is approved or denied
    if (action === 'approved' || action === 'rejected') {
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
    const existingItem = content.find(c => c.id === contentId);
    if (!existingItem) {
      console.error(`❌ Content item not found: ${contentId}`);
      return;
    }
    const updatedItem = {
      ...existingItem,
      videoUploaded: true,
      videoName: file.name,
      uploadedAt: new Date().toISOString()
    };
    await saveContentItems([updatedItem]);
  };

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
        if (!email.trim() || !password.trim() || !companyName.trim() || !firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
          setError('All fields required');
          return;
        }
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          setError('An account with this email already exists');
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
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [setupName, setSetupName] = useState('');
    const [setupEmail, setSetupEmail] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [setupCode, setSetupCode] = useState('');

    const handleSubmit = () => {
      // Find admin user by email
      const adminUser = adminUsers.find(
        (admin) => admin.email.toLowerCase() === email.toLowerCase() && admin.password === password
      );

      if (adminUser) {
        const userSession = {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: 'admin'
        };
        setCurrentUser(userSession);
        setView('admin');
        saveSession(userSession, 'admin');
        setError('');
      } else {
        setError('Invalid email or password');
      }
    };

    const handleSetup = async () => {
      // Setup code for creating first admin (use a simple setup code for security)
      if (setupCode !== 'SETUP2024') {
        setError('Invalid setup code');
        return;
      }

      if (!setupName.trim() || !setupEmail.trim() || !setupPassword.trim()) {
        setError('Please fill in all fields');
        return;
      }

      if (!db) {
        setError('Database not available');
        return;
      }

      try {
        const adminId = Date.now().toString();
        await setDoc(doc(db, 'adminUsers', adminId), {
          id: adminId,
          name: setupName.trim(),
          email: setupEmail.trim().toLowerCase(),
          password: setupPassword, // In production, this should be hashed
          createdAt: new Date().toISOString(),
          isOwner: adminUsers.length === 0 // First admin is the owner
        });

        // Auto-login after setup
        const userSession = {
          id: adminId,
          email: setupEmail.trim().toLowerCase(),
          name: setupName.trim(),
          role: 'admin'
        };
        setCurrentUser(userSession);
        setView('admin');
        saveSession(userSession, 'admin');
      } catch (e) {
        console.error('Error creating admin user:', e);
        setError('Failed to create admin user');
      }
    };

    // Show setup mode if no admin users exist, or if user clicks setup link
    const showSetup = adminUsers.length === 0 || isSetupMode;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          {showSetup ? (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {adminUsers.length === 0 ? 'Admin Setup' : 'Add Admin Account'}
              </h1>
              <p className="text-gray-600 mb-6">
                {adminUsers.length === 0
                  ? 'Create your first admin account to get started'
                  : 'Enter the setup code to create a new admin account'}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setup Code</label>
                  <input
                    type="text"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    placeholder="Enter setup code"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  onClick={handleSetup}
                  className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition"
                >
                  Create Admin Account
                </button>
              </div>

              {adminUsers.length > 0 && (
                <button
                  onClick={() => { setIsSetupMode(false); setError(''); }}
                  className="w-full mt-4 text-gray-600 hover:underline"
                >
                  ← Back to Login
                </button>
              )}
              <button onClick={() => setView('login')} className="w-full mt-2 text-gray-600 hover:underline">← Back to Client Login</button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Login</h1>
              <p className="text-gray-600 mb-6">Access your client management dashboard</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button onClick={handleSubmit} className="w-full bg-gray-800 text-white py-2 rounded-lg hover:bg-gray-900 transition">Sign In</button>
              </div>

              <button
                onClick={() => { setIsSetupMode(true); setError(''); }}
                className="w-full mt-4 text-sm text-blue-600 hover:underline"
              >
                Need to create an account? Enter setup code
              </button>
              <button onClick={() => setView('login')} className="w-full mt-2 text-gray-600 hover:underline">← Back to Client Login</button>
            </>
          )}
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
    // Check both Firestore data AND localStorage to prevent tutorial from showing multiple times
    // localStorage acts as a backup in case of race conditions with real-time sync
    const getTutorialCompleted = () => {
      if (currentUser.tutorialCompleted) return true;
      try {
        return localStorage.getItem(`tutorialCompleted_${currentUser.id}`) === 'true';
      } catch {
        return false;
      }
    };
    const [showTutorial, setShowTutorial] = useState(!getTutorialCompleted());
    const [tutorialStep, setTutorialStep] = useState(0);
    const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
    const [isGeneratingInitialContent, setIsGeneratingInitialContent] = useState(false);
    const [generationTakingLong, setGenerationTakingLong] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [socialLogins, setSocialLogins] = useState({
      instagram: '', facebook: '', youtube: '', x: '', linkedin: '', tiktok: '', crm: '',
      ...currentUser.socialLogins
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
    const [showHeaderVideoModal, setShowHeaderVideoModal] = useState(false);
    const [headerVideoAttachType, setHeaderVideoAttachType] = useState('standalone'); // 'standalone' or 'content'
    const [headerVideoContentId, setHeaderVideoContentId] = useState('');
    const [headerVideoFile, setHeaderVideoFile] = useState(null);
    const [headerVideoLink, setHeaderVideoLink] = useState('');
    const [headerVideoDescription, setHeaderVideoDescription] = useState('');
    const [headerVideoUploading, setHeaderVideoUploading] = useState(false);
    const [headerVideoProgress, setHeaderVideoProgress] = useState(0);

    // Onboarding tasks state - shown after tutorial is completed
    const getOnboardingTasksCompleted = () => {
      try {
        const stored = localStorage.getItem(`onboardingTasks_${currentUser.id}`);
        if (stored) return JSON.parse(stored);
        if (currentUser.onboardingTasksCompleted) return currentUser.onboardingTasksCompleted;
      } catch {}
      return {};
    };
    const [onboardingTasksCompleted, setOnboardingTasksCompleted] = useState(getOnboardingTasksCompleted());

    const onboardingTasks = [
      { id: 'logins', label: 'Add logins to the settings', action: () => setActivePage('settings') },
      { id: 'review', label: 'Review Content Ideas', action: () => setActivePage('content') },
      { id: 'video', label: 'Upload a video', action: () => setActivePage('settings') },
      { id: 'headshot', label: 'Add your headshot in settings', action: () => setActivePage('settings') },
    ];

    const toggleOnboardingTask = async (taskId: string) => {
      const newCompleted = { ...onboardingTasksCompleted, [taskId]: !onboardingTasksCompleted[taskId] };
      setOnboardingTasksCompleted(newCompleted);
      try { localStorage.setItem(`onboardingTasks_${currentUser.id}`, JSON.stringify(newCompleted)); } catch {}
      const updatedUser = { ...currentUser, onboardingTasksCompleted: newCompleted };
      setCurrentUser(updatedUser);
      await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));
    };

    const completedTasksCount = onboardingTasks.filter(t => onboardingTasksCompleted[t.id]).length;
    const allOnboardingTasksCompleted = completedTasksCount === onboardingTasks.length;

    useEffect(() => {
      generatePersonalizedContent();

      // Set up real-time listener for videos
      if (!db) {
        console.warn('⚠️ Firestore not available - skipping videos sync');
        setUserVideos([]);
        return;
      }

      const unsubVideos = onSnapshot(collection(db, 'videos'), (snapshot) => {
        const videosData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setUserVideos(videosData.filter(v => v.clientId === effectiveClientId));
      }, (error) => {
        console.error('Error syncing videos:', error);
        setUserVideos([]);
      });

      return () => unsubVideos();
    }, [effectiveClientId]);

    // Track when content generation is taking too long (show skip option after 90 seconds)
    useEffect(() => {
      if (!isGeneratingInitialContent) {
        setGenerationTakingLong(false);
        return;
      }

      const timeout = setTimeout(() => {
        setGenerationTakingLong(true);
      }, 90000); // 90 seconds

      return () => clearTimeout(timeout);
    }, [isGeneratingInitialContent]);

    const generatePersonalizedContent = async () => {
      // Only generate content if this is the first time (account creation)
      const lastGenerated = currentUser.lastContentGeneration;

      if (lastGenerated) {
        console.log('⏭️ Skipping content generation - already generated on:', lastGenerated);
        return;
      }

      // Check if user already has content (handles case where generation succeeded but user field wasn't updated)
      if (clientContent.length > 0) {
        console.log('⏭️ Skipping content generation - user already has', clientContent.length, 'content items');
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

        // Save only the new content items - let real-time sync update state
        const saved = await saveContentItems(newContent);
        if (!saved) {
          console.error('❌ Failed to save generated content');
          throw new Error('Failed to save generated content');
        }

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

            {generationTakingLong ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 font-medium">This is taking longer than expected...</p>
                <p className="text-sm text-gray-500">You can skip for now and we'll continue in the background, or wait a bit longer.</p>
                <button
                  onClick={() => setIsGeneratingInitialContent(false)}
                  className="mt-2 px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">This usually takes 1-2 minutes. Please don't close this window.</p>
            )}
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHeaderVideoModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <Video className="w-4 h-4" />
                Upload Video
              </button>
              <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-600 hover:text-gray-800">Logout</button>
            </div>
          </div>
        </nav>

        {/* Header Video Upload Modal */}
        {showHeaderVideoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-600" />
                  Upload Video
                </h2>
                <button onClick={() => {
                  setShowHeaderVideoModal(false);
                  setHeaderVideoAttachType('standalone');
                  setHeaderVideoContentId('');
                  setHeaderVideoFile(null);
                  setHeaderVideoLink('');
                  setHeaderVideoDescription('');
                }} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Is this video for a content idea?</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input type="radio" name="videoAttach" value="standalone" checked={headerVideoAttachType === 'standalone'} onChange={() => setHeaderVideoAttachType('standalone')} className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-800">Standalone Video</p>
                        <p className="text-xs text-gray-500">Not attached to any content idea</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input type="radio" name="videoAttach" value="content" checked={headerVideoAttachType === 'content'} onChange={() => setHeaderVideoAttachType('content')} className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-800">Attach to Content Idea</p>
                        <p className="text-xs text-gray-500">Link this video to a specific content piece</p>
                      </div>
                    </label>
                  </div>
                </div>

                {headerVideoAttachType === 'content' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Content Idea</label>
                    <select value={headerVideoContentId} onChange={(e) => setHeaderVideoContentId(e.target.value)} className="w-full px-4 py-2 border rounded-lg">
                      <option value="">-- Select content --</option>
                      {clientContent.filter(c => c.status === 'approved').map(c => (
                        <option key={c.id} value={c.id}>{c.title} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea value={headerVideoDescription} onChange={(e) => setHeaderVideoDescription(e.target.value)} placeholder="Describe the video..." rows={2} className="w-full px-4 py-2 border rounded-lg resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Method</label>
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                      <input type="file" accept="video/*" onChange={(e) => { if (e.target.files[0]) setHeaderVideoFile(e.target.files[0]); }} className="text-sm" />
                      {headerVideoFile && <p className="text-xs text-gray-500 mt-1">Selected: {headerVideoFile.name}</p>}
                    </div>
                    <div className="text-center text-sm text-gray-400">or</div>
                    <input type="text" value={headerVideoLink} onChange={(e) => setHeaderVideoLink(e.target.value)} placeholder="Paste video link (Google Drive, Dropbox, etc.)" className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                </div>

                {headerVideoUploading && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${headerVideoProgress}%` }}></div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    disabled={headerVideoUploading || (!headerVideoFile && !headerVideoLink)}
                    onClick={async () => {
                      if (headerVideoAttachType === 'content' && !headerVideoContentId) {
                        alert('Please select a content idea to attach this video to.');
                        return;
                      }

                      setHeaderVideoUploading(true);
                      try {
                        let videoUrl = headerVideoLink;
                        let fileName = '';

                        if (headerVideoFile) {
                          if (!storage) {
                            alert('Storage not configured. Please use a link instead.');
                            setHeaderVideoUploading(false);
                            return;
                          }
                          const storageRef = ref(storage, `videos/${effectiveClientId}/${Date.now()}_${headerVideoFile.name}`);
                          const uploadTask = uploadBytesResumable(storageRef, headerVideoFile);
                          videoUrl = await new Promise((resolve, reject) => {
                            uploadTask.on('state_changed',
                              (snapshot) => setHeaderVideoProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
                              reject,
                              async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
                            );
                          });
                          fileName = headerVideoFile.name;
                        }

                        const contentItem = headerVideoContentId ? clientContent.find(c => c.id === headerVideoContentId) : null;
                        const videoDoc = {
                          id: Date.now().toString(),
                          clientId: effectiveClientId,
                          contentId: headerVideoContentId || '',
                          contentTitle: contentItem?.title || '',
                          videoLink: videoUrl,
                          description: headerVideoDescription,
                          status: 'pending',
                          submittedAt: new Date().toISOString(),
                          uploadedAt: new Date().toISOString(),
                          fileName
                        };

                        if (db) await setDoc(doc(db, 'videos', videoDoc.id), videoDoc);

                        await sendSMS('+17867882699', `📹 New video submitted by ${currentUser.companyName}${contentItem ? ` for content: "${contentItem.title}"` : ''}`);

                        alert('Video uploaded successfully!');
                        setShowHeaderVideoModal(false);
                        setHeaderVideoAttachType('standalone');
                        setHeaderVideoContentId('');
                        setHeaderVideoFile(null);
                        setHeaderVideoLink('');
                        setHeaderVideoDescription('');
                      } catch (error) {
                        console.error('Error uploading video:', error);
                        alert('Failed to upload video. Please try again.');
                      } finally {
                        setHeaderVideoUploading(false);
                        setHeaderVideoProgress(0);
                      }
                    }}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    {headerVideoUploading ? `Uploading... ${headerVideoProgress}%` : 'Upload Video'}
                  </button>
                  <button onClick={() => {
                    setShowHeaderVideoModal(false);
                    setHeaderVideoAttachType('standalone');
                    setHeaderVideoContentId('');
                    setHeaderVideoFile(null);
                    setHeaderVideoLink('');
                    setHeaderVideoDescription('');
                  }} className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 mb-8 text-white">
            <h2 className="text-3xl font-bold mb-2">Let's Get Started, {currentUser.firstName}! 👋</h2>
            <p className="text-blue-100">Review your marketing materials and provide feedback</p>
          </div>

          {/* Getting Started To-Do List - shown after tutorial is completed */}
          {!showTutorial && !allOnboardingTasksCompleted && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500 rounded-full p-2">
                    <ListTodo className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Getting Started Checklist</h3>
                    <p className="text-sm text-gray-600">Complete these tasks to get the most out of your portal</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                    {completedTasksCount}/{onboardingTasks.length}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-amber-200 rounded-full h-2 mb-4">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(completedTasksCount / onboardingTasks.length) * 100}%` }}
                ></div>
              </div>

              <div className="space-y-3">
                {onboardingTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition cursor-pointer ${
                      onboardingTasksCompleted[task.id]
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleOnboardingTask(task.id)}
                      className="flex-shrink-0"
                    >
                      {onboardingTasksCompleted[task.id] ? (
                        <CheckSquare className="w-6 h-6 text-green-600" />
                      ) : (
                        <Square className="w-6 h-6 text-gray-400 hover:text-amber-500" />
                      )}
                    </button>
                    <span
                      className={`flex-grow font-medium ${
                        onboardingTasksCompleted[task.id] ? 'text-green-700 line-through' : 'text-gray-700'
                      }`}
                    >
                      {task.label}
                    </span>
                    {!onboardingTasksCompleted[task.id] && (
                      <button
                        onClick={task.action}
                        className="text-amber-600 hover:text-amber-700 text-sm font-medium flex items-center gap-1"
                      >
                        Go <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {completedTasksCount === onboardingTasks.length - 1 && (
                <p className="text-center text-amber-700 font-medium mt-4">
                  Almost there! Just one more task to go!
                </p>
              )}
            </div>
          )}

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
                            <div className="text-gray-600 text-sm mb-3">
                              <RichTextDisplay content={item.content} />
                            </div>
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
                                      alert(`${currentUser.firstName}, please upload a video file or provide a link`);
                                      return;
                                    }

                                    setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: true, progress: 0 } }));

                                    try {
                                      let finalVideoLink = link;

                                      // Upload file if selected
                                      if (file) {
                                        if (!storage) {
                                          alert(`❌ ${currentUser.firstName}, Firebase Storage is not configured. Please use a link instead.`);
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
                                          alert(`⚠️ ${currentUser.firstName}, cloud storage not configured. Video not saved.`);
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
                                        alert(`✅ ${currentUser.firstName}, your video was submitted successfully!`);
                                      }
                                    } catch (error) {
                                      console.error('❌ Error submitting video:', error);
                                      alert(`❌ ${currentUser.firstName}, there was an error submitting your video. Please try again.`);
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
                        <RichTextDisplay content={item.content} className="text-sm text-gray-700" />
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
                        <RichTextDisplay content={item.content} className="text-sm text-gray-700" />
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
                          alert(`${currentUser.firstName}, please fill in the topic and purpose fields`);
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
                            alert(`❌ ${currentUser.firstName}, error generating idea: ` + data.error);
                          }
                        } catch (error) {
                          console.error('Error:', error);
                          alert(`❌ ${currentUser.firstName}, failed to generate content idea. Please try again.`);
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
                            alert(`${currentUser.firstName}, please provide feedback on what to change`);
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
                              alert(`❌ ${currentUser.firstName}, error regenerating idea: ` + data.error);
                            }
                          } catch (error) {
                            console.error('Error:', error);
                            alert(`❌ ${currentUser.firstName}, failed to regenerate content idea. Please try again.`);
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

                          // Save only the new item - let real-time sync update state
                          const saved = await saveContentItems([newContent], {
                            showAlert: true,
                            alertMessage: '✅ Content idea approved and added to your library!'
                          });

                          if (saved) {
                            // Reset form
                            setGeneratedIdea(null);
                            setIdeaFeedback('');
                            setAiTopic('');
                            setAiPurpose('');
                            setAiAudience('');
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
                    brandVoice: ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'],
                    specialties: ['First-Time Buyers', 'Luxury Homes', 'Investment Properties', 'Commercial', 'VA Loans', 'FHA Loans', 'Refinancing', 'New Construction', 'Relocation', 'Downsizing'],
                    clientPainPoints: null, // Text field
                    topicsToAvoid: null // Text field
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
                  <div key={key} className="flex gap-2">
                    <input type="text" value={socialLogins[key]} onChange={(e) => setSocialLogins({ ...socialLogins, [key]: e.target.value })} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} className="flex-1 px-4 py-2 border rounded outline-none focus:ring-2" />
                    {!['instagram', 'facebook', 'youtube', 'x', 'linkedin', 'tiktok', 'crm'].includes(key) && (
                      <button
                        onClick={() => {
                          const { [key]: _, ...rest } = socialLogins;
                          setSocialLogins(rest);
                        }}
                        className="text-red-500 hover:text-red-700 px-2"
                        title="Remove field"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    const fieldName = prompt('Enter a name for the new login field (e.g., "Pinterest", "Threads", "Website"):');
                    if (fieldName && fieldName.trim()) {
                      const key = fieldName.trim().toLowerCase().replace(/\s+/g, '_');
                      if (socialLogins[key] !== undefined) {
                        alert('This field already exists.');
                        return;
                      }
                      setSocialLogins({ ...socialLogins, [key]: '' });
                    }
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 flex items-center gap-2 text-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add New Field
                </button>
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
                              alert(`❌ ${currentUser.firstName}, storage not configured. Please use URL instead.`);
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
                              alert(`✅ ${currentUser.firstName}, your headshot was uploaded successfully!`);
                            } catch (error) {
                              console.error('Upload error:', error);
                              alert(`❌ ${currentUser.firstName}, upload failed: ` + error.message);
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
                              alert(`❌ ${currentUser.firstName}, storage not configured. Please use URL instead.`);
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
                              alert(`✅ ${currentUser.firstName}, your logo was uploaded successfully!`);
                            } catch (error) {
                              console.error('Upload error:', error);
                              alert(`❌ ${currentUser.firstName}, upload failed: ` + error.message);
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

              {/* Video Upload Section */}
              <div className="border-t pt-8 mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <Video className="w-6 h-6 text-purple-600" />
                  <h4 className="font-semibold">Upload Videos</h4>
                </div>
                <p className="text-sm text-gray-600 mb-6">Upload videos for editing without attaching them to specific content</p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Video File</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-purple-400 transition-colors">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setSelectedVideoFile(file || null);
                        }}
                        className="text-sm"
                        disabled={uploadingVideo}
                      />
                    </div>
                    {selectedVideoFile && (
                      <p className="text-xs text-gray-600 mt-2">
                        {selectedVideoFile.name} ({(selectedVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}

                    {/* OR divider */}
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <span className="text-gray-400 text-xs">OR</span>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>

                    <input
                      type="text"
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      placeholder="Google Drive or Dropbox link"
                      className="w-full px-4 py-2 border rounded outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={uploadingVideo}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Description</label>
                    <textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Describe your video or what you'd like done with it..."
                      className="w-full px-4 py-2 border rounded outline-none focus:ring-2 focus:ring-purple-500 h-32"
                      disabled={uploadingVideo}
                    />
                  </div>
                </div>

                {/* Progress Bar */}
                {uploadingVideo && (
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-4">
                    <div
                      className="bg-purple-600 h-3 transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {uploadProgress > 5 && `${Math.round(uploadProgress)}%`}
                    </div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!selectedVideoFile && !videoLink?.trim()) {
                      alert(`${currentUser.firstName}, please upload a video file or provide a link`);
                      return;
                    }

                    setUploadingVideo(true);
                    setUploadProgress(0);

                    try {
                      let finalVideoLink = videoLink;

                      // Upload file if selected
                      if (selectedVideoFile) {
                        if (!storage) {
                          alert(`❌ ${currentUser.firstName}, Firebase Storage is not configured. Please use a link instead.`);
                          setUploadingVideo(false);
                          return;
                        }

                        finalVideoLink = await uploadFileToStorage(
                          selectedVideoFile,
                          'videos',
                          (progress) => setUploadProgress(progress)
                        );
                      }

                      if (finalVideoLink && finalVideoLink.trim()) {
                        const newVideo = {
                          id: Date.now().toString(),
                          clientId: effectiveClientId,
                          videoLink: finalVideoLink,
                          description: videoDescription || 'No description provided',
                          status: 'pending',
                          submittedAt: new Date().toISOString(),
                          fileName: selectedVideoFile ? selectedVideoFile.name : null
                        };

                        if (!db) {
                          alert(`⚠️ ${currentUser.firstName}, cloud storage not configured. Video not saved.`);
                          setUploadingVideo(false);
                          return;
                        }

                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                        // Send SMS notification
                        await sendSMS(
                          '+17867882699',
                          `New video uploaded by ${currentUser.companyName}. Description: ${videoDescription || 'None'}. Check the admin portal!`
                        );

                        // Clear form
                        setSelectedVideoFile(null);
                        setVideoLink('');
                        setVideoDescription('');
                        await loadUserVideos();
                        alert(`✅ ${currentUser.firstName}, your video was submitted successfully!`);
                      }
                    } catch (error) {
                      console.error('Error submitting video:', error);
                      alert(`❌ ${currentUser.firstName}, there was an error submitting your video. Please try again.`);
                    } finally {
                      setUploadingVideo(false);
                      setUploadProgress(0);
                    }
                  }}
                  disabled={(!selectedVideoFile && !videoLink?.trim()) || uploadingVideo}
                  className="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  {uploadingVideo ? 'Uploading...' : 'Submit Video for Editing'}
                </button>

                {/* Previously Uploaded Videos */}
                {userVideos.filter(v => !v.contentId).length > 0 && (
                  <div className="mt-8 border-t pt-6">
                    <h5 className="font-medium text-gray-800 mb-4">Your Uploaded Videos</h5>
                    <div className="space-y-3">
                      {userVideos.filter(v => !v.contentId).map(video => (
                        <div key={video.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{video.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Submitted {new Date(video.submittedAt).toLocaleDateString()}
                              {video.fileName && ` • ${video.fileName}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              video.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              video.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {video.status === 'pending' ? 'Pending Review' :
                               video.status === 'in-progress' ? 'Being Edited' :
                               'Completed'}
                            </span>
                            {video.completedLink && (
                              <a href={video.completedLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                <Download className="w-4 h-4" />Download
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                              alert(`⚠️ ${currentUser.firstName}, cloud storage not configured. Cannot remove team member.`);
                              return;
                            }

                            console.log(`🗑️ Removing team member: ${member.email}`);
                            await deleteDoc(doc(db, 'users', member.id));
                            console.log('✅ Team member deleted from Firestore');
                            // onSnapshot will automatically update local state
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
                <RichTextDisplay content={selectedContent.content} />
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
                    // Save to localStorage immediately to prevent race conditions
                    try { localStorage.setItem(`tutorialCompleted_${currentUser.id}`, 'true'); } catch {}
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
                        // Save to localStorage immediately to prevent race conditions
                        try { localStorage.setItem(`tutorialCompleted_${currentUser.id}`, 'true'); } catch {}
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
                        // Save to localStorage immediately to prevent race conditions
                        try { localStorage.setItem(`tutorialCompleted_${currentUser.id}`, 'true'); } catch {}
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
    const [publishMode, setPublishMode] = useState('single'); // 'single', 'all-realtors', 'all-loan-officers', 'approval-group'
    const [targetApprovalGroup, setTargetApprovalGroup] = useState('review-required'); // 'review-required' or 'auto-approve'
    const [videos, setVideos] = useState([]);

    // Helper functions for persisting filter state to sessionStorage
    const getStoredFilter = (key: string, defaultValue: string | boolean) => {
      if (typeof window === 'undefined') return defaultValue;
      try {
        const stored = sessionStorage.getItem(`adminFilter_${key}`);
        if (stored === null) return defaultValue;
        if (typeof defaultValue === 'boolean') return stored === 'true';
        return stored;
      } catch {
        return defaultValue;
      }
    };

    const setStoredFilter = (key: string, value: string | boolean) => {
      if (typeof window === 'undefined') return;
      try {
        sessionStorage.setItem(`adminFilter_${key}`, String(value));
      } catch {
        // Ignore storage errors
      }
    };

    // Initialize filter states from sessionStorage to persist across re-renders/actions
    const [activeTab, setActiveTabState] = useState(() => getStoredFilter('activeTab', 'clients') as string);
    const setActiveTab = (tab: string) => {
      setActiveTabState(tab);
      setStoredFilter('activeTab', tab);
    };

    // Expandable sections - allows multiple sections open at once
    const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
      if (typeof window === 'undefined') return new Set(['clients']);
      try {
        const stored = sessionStorage.getItem('adminExpandedSections');
        if (stored) return new Set(JSON.parse(stored));
      } catch {}
      return new Set(['clients']);
    });

    const toggleSection = (section: string) => {
      setExpandedSections(prev => {
        const next = new Set(prev);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        try { sessionStorage.setItem('adminExpandedSections', JSON.stringify([...next])); } catch {}
        return next;
      });
    };

    const [selectedUser, setSelectedUser] = useState(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiGenerationResult, setAiGenerationResult] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const [contentTypeFilter, setContentTypeFilterState] = useState(() => getStoredFilter('contentTypeFilter', 'all') as string);
    const setContentTypeFilter = (filter: string) => {
      setContentTypeFilterState(filter);
      setStoredFilter('contentTypeFilter', filter);
    };

    const [contentClientFilter, setContentClientFilterState] = useState(() => getStoredFilter('contentClientFilter', 'all') as string);
    const setContentClientFilter = (filter: string) => {
      setContentClientFilterState(filter);
      setStoredFilter('contentClientFilter', filter);
    };

    const [selectedContent, setSelectedContent] = useState(null);
    const [selectedTodayContent, setSelectedTodayContent] = useState(null); // For today's scheduled content modal
    const [contentDetailItem, setContentDetailItem] = useState(null); // For viewing content details in All Content section

    const [groupFilter, setGroupFilterState] = useState(() => getStoredFilter('groupFilter', 'all') as string);
    const setGroupFilter = (filter: string) => {
      setGroupFilterState(filter);
      setStoredFilter('groupFilter', filter);
    };

    // Calendar filter state variables - persisted to sessionStorage
    const [calendarClientFilter, setCalendarClientFilterState] = useState(() => getStoredFilter('calendarClientFilter', 'all') as string);
    const setCalendarClientFilter = (filter: string) => {
      setCalendarClientFilterState(filter);
      setStoredFilter('calendarClientFilter', filter);
    };

    const [calendarTypeFilter, setCalendarTypeFilterState] = useState(() => getStoredFilter('calendarTypeFilter', 'all') as string);
    const setCalendarTypeFilter = (filter: string) => {
      setCalendarTypeFilterState(filter);
      setStoredFilter('calendarTypeFilter', filter);
    };

    const [approvedContentSearch, setApprovedContentSearchState] = useState(() => getStoredFilter('approvedContentSearch', '') as string);
    const setApprovedContentSearch = (search: string) => {
      setApprovedContentSearchState(search);
      setStoredFilter('approvedContentSearch', search);
    };

    const [showOnlyUnscheduled, setShowOnlyUnscheduledState] = useState(() => getStoredFilter('showOnlyUnscheduled', true) as boolean);
    const setShowOnlyUnscheduled = (show: boolean) => {
      setShowOnlyUnscheduledState(show);
      setStoredFilter('showOnlyUnscheduled', show);
    };

    // Recurring post state
    const [recurrence, setRecurrence] = useState('none'); // 'none', 'daily', 'weekly', 'biweekly', 'monthly'
    const [recurrenceCount, setRecurrenceCount] = useState(4); // Number of occurrences

    // Drag and drop state
    const [draggedContent, setDraggedContent] = useState(null);
    const [dragOverDate, setDragOverDate] = useState(null);

    // Admin video attachment state
    const [attachVideoModal, setAttachVideoModal] = useState<{
      isOpen: boolean;
      event: any;
      contentItem: any;
    }>({ isOpen: false, event: null, contentItem: null });
    const [adminVideoFile, setAdminVideoFile] = useState<File | null>(null);
    const [adminVideoLink, setAdminVideoLink] = useState('');
    const [adminVideoUploading, setAdminVideoUploading] = useState(false);
    const [adminVideoProgress, setAdminVideoProgress] = useState(0);

    // SMS state variables
    const [smsSelectedClients, setSmsSelectedClients] = useState([]);
    const [smsTemplate, setSmsTemplate] = useState('');
    const [smsCustomMessage, setSmsCustomMessage] = useState('');
    const [smsSending, setSmsSending] = useState(false);
    const [sendingDailyTexts, setSendingDailyTexts] = useState(false);

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

    // Daily Tasks state
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [newTask, setNewTask] = useState({ clientId: 'all', name: '', description: '', frequency: 'daily' });

    // Log admin activity
    const logAdminActivity = async (action: string, details: string, metadata?: Record<string, any>) => {
      if (!db || !currentUser) return;

      try {
        const activityId = Date.now().toString();
        await setDoc(doc(db, 'adminActivities', activityId), {
          id: activityId,
          adminId: currentUser.id,
          adminName: currentUser.name || currentUser.email,
          action,
          details,
          metadata: metadata || {},
          timestamp: new Date().toISOString()
        });
        console.log(`📝 Logged activity: ${action}`);
      } catch (e) {
        console.error('❌ Error logging activity:', e);
      }
    };

    // Toggle scheduled content completion
    const toggleContentCompletion = async (eventId: string, currentStatus: boolean, eventTitle?: string, clientName?: string) => {
      if (!db) {
        console.warn('⚠️ Firestore not available');
        return;
      }

      try {
        const eventRef = doc(db, 'calendarEvents', eventId);
        await updateDoc(eventRef, {
          completed: !currentStatus,
          completedBy: !currentStatus ? currentUser?.id : null,
          completedByName: !currentStatus ? (currentUser?.name || currentUser?.email) : null,
          completedAt: !currentStatus ? new Date().toISOString() : null
        });
        console.log(`✅ Toggled content completion for event ${eventId}`);

        // Log activity
        if (!currentStatus) {
          await logAdminActivity(
            'content_completed',
            `Marked "${eventTitle || 'content'}" as completed${clientName ? ` for ${clientName}` : ''}`,
            { eventId, eventTitle, clientName }
          );
        }
      } catch (e) {
        console.error('❌ Error toggling content completion:', e);
      }
    };

    // Get today's date string for task completions
    const getTodayDateString = () => formatDateLocal(new Date());

    // Get the Monday of the current week (for weekly task tracking)
    const getWeekStartString = () => {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      return formatDateLocal(monday);
    };

    // Check if a task is completed for its period (today for daily, this week for weekly)
    const isTaskCompletedToday = (taskId: string, clientId: string, frequency?: string) => {
      if (frequency === 'weekly') {
        const weekStart = getWeekStartString();
        return dailyTaskCompletions.some(
          completion => completion.taskId === taskId &&
                       completion.clientId === clientId &&
                       completion.date >= weekStart
        );
      }
      const today = getTodayDateString();
      return dailyTaskCompletions.some(
        completion => completion.taskId === taskId &&
                     completion.clientId === clientId &&
                     completion.date === today
      );
    };

    // Toggle daily task completion for today
    const toggleDailyTaskCompletion = async (taskId: string, clientId: string, taskName?: string, clientName?: string) => {
      if (!db) {
        console.warn('⚠️ Firestore not available');
        return;
      }

      const today = getTodayDateString();
      const completionId = `${taskId}_${clientId}_${today}`;
      const isCompleted = isTaskCompletedToday(taskId, clientId);

      try {
        if (isCompleted) {
          // Remove completion
          await deleteDoc(doc(db, 'dailyTaskCompletions', completionId));
          console.log(`✅ Removed task completion for ${completionId}`);
        } else {
          // Add completion
          await setDoc(doc(db, 'dailyTaskCompletions', completionId), {
            taskId,
            clientId,
            date: today,
            completedAt: new Date().toISOString(),
            completedBy: currentUser?.id,
            completedByName: currentUser?.name || currentUser?.email
          });
          console.log(`✅ Added task completion for ${completionId}`);

          // Log activity
          await logAdminActivity(
            'daily_task_completed',
            `Completed "${taskName || 'task'}"${clientName ? ` for ${clientName}` : ''}`,
            { taskId, clientId, taskName, clientName }
          );
        }
      } catch (e) {
        console.error('❌ Error toggling task completion:', e);
      }
    };

    // Add a new daily task
    const addDailyTask = async () => {
      if (!db || !newTask.name.trim()) {
        return;
      }

      try {
        const taskId = Date.now().toString();
        await setDoc(doc(db, 'dailyTasks', taskId), {
          id: taskId,
          clientId: newTask.clientId,
          name: newTask.name.trim(),
          description: newTask.description.trim(),
          frequency: newTask.frequency || 'daily',
          createdAt: new Date().toISOString()
        });
        console.log(`✅ Added ${newTask.frequency} task: ${newTask.name}`);
        setNewTask({ clientId: 'all', name: '', description: '', frequency: 'daily' });
        setShowAddTaskModal(false);
      } catch (e) {
        console.error('❌ Error adding daily task:', e);
      }
    };

    // Delete a daily task
    const deleteDailyTask = async (taskId: string) => {
      if (!db) return;

      try {
        await deleteDoc(doc(db, 'dailyTasks', taskId));
        // Also delete all completions for this task
        const completionsToDelete = dailyTaskCompletions.filter(c => c.taskId === taskId);
        for (const completion of completionsToDelete) {
          await deleteDoc(doc(db, 'dailyTaskCompletions', completion.id));
        }
        console.log(`✅ Deleted daily task: ${taskId}`);
      } catch (e) {
        console.error('❌ Error deleting daily task:', e);
      }
    };

    useEffect(() => {
      // Set up real-time listener for videos
      if (!db) {
        console.warn('⚠️ Firestore not available - skipping videos sync');
        setVideos([]);
        return;
      }

      const unsubVideos = onSnapshot(collection(db, 'videos'), (snapshot) => {
        setVideos(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      }, (error) => {
        console.error('Error syncing videos:', error);
        setVideos([]);
      });

      return () => unsubVideos();
    }, []);

    const saveVideos = async (v) => {
      if (!db) {
        setVideos(v);
        return;
      }

      try {
        const savePromises = v.map(video => setDoc(doc(db, 'videos', video.id), video));
        await Promise.all(savePromises);
      } catch (e) {
        console.error('Error saving videos:', e);
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

    const handleSendDailyTexts = async () => {
      const today = formatDateLocal(new Date());
      const eligibleUsers = users.filter(u => !u.parentClientId && u.receiveDailyTexts && u.phoneNumber);

      if (eligibleUsers.length === 0) {
        alert('No users have daily text notifications enabled. Enable it in each client\'s details.');
        return;
      }

      const todaysScheduledContent = calendarEvents.filter(e => e.date === today);

      if (todaysScheduledContent.length === 0) {
        alert('No content scheduled for today.');
        return;
      }

      if (!confirm(`Send daily text updates to ${eligibleUsers.length} client${eligibleUsers.length > 1 ? 's' : ''}?`)) return;

      setSendingDailyTexts(true);
      let sent = 0;
      let failed = 0;

      try {
        for (const user of eligibleUsers) {
          const userEvents = todaysScheduledContent.filter(e => e.clientId === user.id);
          if (userEvents.length === 0) continue;

          const eventList = userEvents.map(e => `- ${e.title} (${e.type})`).join('\n');
          const message = `Hi ${user.firstName}! You have ${userEvents.length} content piece${userEvents.length > 1 ? 's' : ''} scheduled for today:\n\n${eventList}\n\nCheck your portal for details!`;

          try {
            await sendSMS(user.phoneNumber, message);
            sent++;
          } catch {
            failed++;
          }
        }

        alert(`Daily texts sent to ${sent} client${sent !== 1 ? 's' : ''}!${failed > 0 ? ` (${failed} failed)` : ''}`);
      } catch (error) {
        console.error('Error sending daily texts:', error);
        alert('Error sending daily texts.');
      } finally {
        setSendingDailyTexts(false);
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

        // Save only the new content items - let real-time sync update state
        const saved = await saveContentItems(allNewContent);
        if (!saved) {
          console.error('❌ Failed to save some generated content');
        }

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
      return calendarEvents.filter(event => {
        if (event.date !== dateStr) return false;
        if (calendarClientFilter !== 'all' && event.clientId !== calendarClientFilter) return false;
        if (calendarTypeFilter !== 'all' && event.type !== calendarTypeFilter) return false;
        return true;
      });
    };

    const isToday = (date) => {
      if (!date) return false;
      const today = new Date();
      return date.toDateString() === today.toDateString();
    };

    return (
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-gray-800 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              {currentUser.companyLogo && (
                <img src={currentUser.companyLogo} alt="Logo" className="h-12 w-auto object-contain" onError={(e) => e.target.style.display = 'none'} />
              )}
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-xs text-gray-400">Logged in as {currentUser?.name || currentUser?.email}</p>
              </div>
            </div>
            <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-300 hover:text-white px-4 py-2 rounded hover:bg-gray-700 transition">Logout</button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
              <p className="text-2xl font-bold text-gray-800">{users.filter(u => !u.parentClientId).length}</p>
              <p className="text-xs text-gray-500">Total Clients</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
              <p className="text-2xl font-bold text-yellow-600">{content.filter(c => c.status === 'pending').length}</p>
              <p className="text-xs text-gray-500">Pending Review</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
              <p className="text-2xl font-bold text-green-600">{content.filter(c => c.status === 'approved').length}</p>
              <p className="text-xs text-gray-500">Approved</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
              <p className="text-2xl font-bold text-purple-600">{videos.filter(v => v.status === 'pending').length}</p>
              <p className="text-xs text-gray-500">Videos Pending</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-indigo-500">
              <p className="text-2xl font-bold text-indigo-600">{calendarEvents.filter(e => e.date === formatDateLocal(new Date())).length}</p>
              <p className="text-xs text-gray-500">Today's Posts</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-teal-500">
              <p className="text-2xl font-bold text-teal-600">{users.filter(u => !u.parentClientId && u.approvalGroup === 'auto-approve').length}</p>
              <p className="text-xs text-gray-500">Auto-Approve</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-6 flex flex-wrap justify-end gap-2">
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

                      // Update content with reminder tracking - only save modified items
                      const modifiedItems = [];
                      result.details.forEach(detail => {
                        const existingItem = content.find(c => c.id === detail.contentId);
                        if (existingItem) {
                          const updatedItem = {
                            ...existingItem,
                            reminders: [
                              ...(existingItem.reminders || []),
                              { type: detail.reminderType, sentAt: detail.sentAt }
                            ]
                          };
                          modifiedItems.push(updatedItem);
                        }
                      });
                      if (modifiedItems.length > 0) {
                        await saveContentItems(modifiedItems);
                      }
                    } else {
                      alert(`❌ Error: ${result.error}`);
                    }
                  } catch (error) {
                    console.error('❌ Error checking reminders:', error);
                    alert('Failed to check reminders. See console for details.');
                  }
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm"
              >
                <Clock className="w-4 h-4" />
                Reminders
              </button>
              <button
                onClick={handleAIGenerateContent}
                disabled={isGeneratingAI}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingAI ? 'Generating...' : 'AI Content'}
              </button>
              <button
                onClick={handleSendDailyTexts}
                disabled={sendingDailyTexts}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Bell className="w-4 h-4" />
                {sendingDailyTexts ? 'Sending...' : 'Daily Texts'}
              </button>
              <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
                <Upload className="w-4 h-4" />Upload Content
              </button>
            </div>

          {/* Alert: Scheduled Social Posts Without Videos */}
          {(() => {
            // Find all scheduled social posts
            const scheduledSocialEvents = calendarEvents.filter(event => event.type === 'social');

            // Find which ones don't have a video attached
            const postsWithoutVideos = scheduledSocialEvents.filter(event => {
              // Check if there's a video linked to the content
              const linkedVideo = videos.find(v => v.contentId === event.contentId);
              return !linkedVideo;
            });

            if (postsWithoutVideos.length === 0) return null;

            // Group by client for better organization
            const groupedByClient = postsWithoutVideos.reduce((acc, event) => {
              const clientId = event.clientId;
              if (!acc[clientId]) {
                acc[clientId] = [];
              }
              acc[clientId].push(event);
              return acc;
            }, {} as Record<string, typeof postsWithoutVideos>);

            return (
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-lg p-6 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Video className="w-6 h-6 text-red-600" />
                  <h3 className="text-xl font-semibold text-red-800">Scheduled Posts Missing Videos</h3>
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">{postsWithoutVideos.length}</span>
                </div>
                <p className="text-sm text-red-700 mb-4">
                  The following social media posts are scheduled but don't have a video attached. Follow up with clients to get their videos.
                </p>
                <div className="space-y-4">
                  {Object.entries(groupedByClient).map(([clientId, events]) => {
                    const client = users.find(u => u.id === clientId);
                    return (
                      <div key={clientId} className="bg-white rounded-lg p-4 shadow-sm border border-red-200">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="font-semibold text-gray-800">{client?.companyName || 'Unknown Client'}</span>
                          <span className="text-sm text-gray-500">({client?.firstName} {client?.lastName || ''})</span>
                          {client?.phoneNumber && (
                            <a href={`tel:${client.phoneNumber}`} className="text-blue-600 hover:underline text-sm ml-2">
                              {client.phoneNumber}
                            </a>
                          )}
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(event => {
                            const linkedContent = content.find(c => c.id === event.contentId);
                            const eventDate = new Date(event.date + 'T00:00:00');
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isPast = eventDate < today;
                            const isToday = eventDate.getTime() === today.getTime();

                            return (
                              <div
                                key={event.id}
                                className={`p-3 rounded border ${
                                  isPast ? 'bg-red-100 border-red-300' :
                                  isToday ? 'bg-yellow-100 border-yellow-300' :
                                  'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <p className="font-medium text-sm text-gray-800 truncate" title={event.title}>{event.title}</p>
                                <p className={`text-xs ${isPast ? 'text-red-700 font-semibold' : isToday ? 'text-yellow-700 font-semibold' : 'text-gray-500'}`}>
                                  {isPast ? '⚠️ OVERDUE: ' : isToday ? '📅 TODAY: ' : ''}
                                  {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                                <button
                                  onClick={() => setAttachVideoModal({
                                    isOpen: true,
                                    event: event,
                                    contentItem: linkedContent
                                  })}
                                  className="mt-2 w-full text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                                >
                                  <Upload className="w-3 h-3" />
                                  Attach Video
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Today's Scheduled Content */}
          {(() => {
            const today = formatDateLocal(new Date());
            const todaysEvents = calendarEvents.filter(event => event.date === today);
            const completedCount = todaysEvents.filter(e => e.completed).length;

            if (todaysEvents.length > 0) {
              return (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <h3 className="text-xl font-semibold text-gray-800">Today's Scheduled Content</h3>
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{completedCount}/{todaysEvents.length}</span>
                    {completedCount === todaysEvents.length && todaysEvents.length > 0 && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">All Done!</span>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todaysEvents.map(event => {
                      const client = users.find(u => u.id === event.clientId);
                      const linkedContent = content.find(c => c.id === event.contentId);
                      const isCompleted = event.completed || false;
                      return (
                        <div
                          key={event.id}
                          className={`bg-white rounded-lg p-4 shadow-sm border transition-all ${
                            isCompleted
                              ? 'border-green-300 bg-green-50/50'
                              : 'border-gray-200 hover:shadow-md hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleContentCompletion(event.id, isCompleted, event.title, client?.companyName);
                              }}
                              className={`mt-0.5 flex-shrink-0 transition-colors ${
                                isCompleted ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-blue-600'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                            <div
                              className="flex-1 cursor-pointer"
                              onClick={() => setSelectedTodayContent({ event, client, linkedContent })}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className={`font-semibold text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{event.title}</h4>
                                <span className={`inline-block px-2 py-1 rounded text-xs ${
                                  event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                                  event.type === 'email' ? 'bg-green-100 text-green-800' :
                                  event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>{event.type}</span>
                              </div>
                              <p className={`text-xs mb-2 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>{client?.companyName || 'Unknown Client'}</p>
                              {event.description && (
                                <p className={`text-xs line-clamp-2 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>{event.description}</p>
                              )}
                              <p className="text-xs text-blue-600 mt-2 font-medium">Click for details →</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Today's Content Details Modal */}
          {selectedTodayContent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTodayContent(null)}>
              <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-gray-800">{selectedTodayContent.event.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedTodayContent.event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                        selectedTodayContent.event.type === 'email' ? 'bg-green-100 text-green-800' :
                        selectedTodayContent.event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedTodayContent.event.type}
                      </span>
                    </div>
                    <button onClick={() => setSelectedTodayContent(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Client Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500 font-medium mb-1">Client</p>
                    <p className="text-lg text-gray-800 font-semibold">{selectedTodayContent.client?.firstName} {selectedTodayContent.client?.lastName || ''} - {selectedTodayContent.client?.companyName || 'Unknown Client'}</p>
                  </div>

                  {/* Scheduled Date */}
                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Scheduled Date</p>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedTodayContent.event.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Description */}
                  {selectedTodayContent.event.description && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Description</p>
                      <p className="text-gray-700">{selectedTodayContent.event.description}</p>
                    </div>
                  )}

                  {/* Full Content (if linked) */}
                  {selectedTodayContent.linkedContent && (
                    <div className="border-t pt-6">
                      <p className="text-sm text-gray-500 font-medium mb-3">Full Content</p>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="prose prose-sm max-w-none">
                          <div className="whitespace-pre-wrap text-gray-700">{selectedTodayContent.linkedContent.content}</div>
                        </div>
                      </div>
                      {selectedTodayContent.linkedContent.fileLink && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-500 font-medium mb-1">Attached File</p>
                          <a
                            href={selectedTodayContent.linkedContent.fileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline"
                          >
                            View Attachment
                          </a>
                        </div>
                      )}
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedTodayContent.linkedContent.status === 'approved' ? 'bg-green-100 text-green-800' :
                          selectedTodayContent.linkedContent.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {selectedTodayContent.linkedContent.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-between items-center">
                  <button
                    onClick={() => {
                      toggleContentCompletion(
                        selectedTodayContent.event.id,
                        selectedTodayContent.event.completed || false,
                        selectedTodayContent.event.title,
                        selectedTodayContent.client?.companyName
                      );
                      setSelectedTodayContent({
                        ...selectedTodayContent,
                        event: { ...selectedTodayContent.event, completed: !selectedTodayContent.event.completed }
                      });
                    }}
                    className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      selectedTodayContent.event.completed
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selectedTodayContent.event.completed ? (
                      <>
                        <CheckSquare className="w-5 h-5" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Square className="w-5 h-5" />
                        Mark as Done
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedTodayContent(null)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Daily & Weekly Tasks Section */}
          {(() => {
            const today = getTodayDateString();
            // Get all clients (excluding team members)
            const clients = users.filter(u => !u.parentClientId);
            // Get tasks that apply to all clients or specific clients
            const allClientTasks = dailyTasks.filter(t => t.clientId === 'all');

            // Build task list: for each client, show their specific tasks + all-client tasks
            const tasksByClient = clients.map(client => {
              const clientSpecificTasks = dailyTasks.filter(t => t.clientId === client.id);
              const tasksForClient = [...clientSpecificTasks, ...allClientTasks];
              const completedCount = tasksForClient.filter(task =>
                isTaskCompletedToday(task.id, client.id, task.frequency)
              ).length;
              return {
                client,
                tasks: tasksForClient,
                completedCount,
                totalCount: tasksForClient.length
              };
            }).filter(c => c.tasks.length > 0);

            const totalTasks = tasksByClient.reduce((sum, c) => sum + c.totalCount, 0);
            const totalCompleted = tasksByClient.reduce((sum, c) => sum + c.completedCount, 0);

            return (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ListTodo className="w-6 h-6 text-amber-600" />
                    <h3 className="text-xl font-semibold text-gray-800">Daily & Weekly Tasks</h3>
                    {totalTasks > 0 && (
                      <>
                        <span className="bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {totalCompleted}/{totalTasks}
                        </span>
                        {totalCompleted === totalTasks && totalTasks > 0 && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">All Done!</span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setShowAddTaskModal(true)}
                    className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Task
                  </button>
                </div>

                {tasksByClient.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ListTodo className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No daily tasks yet. Add repeating tasks to track for each client.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasksByClient.map(({ client, tasks, completedCount, totalCount }) => (
                      <div key={client.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-800">{client.companyName || `${client.firstName} ${client.lastName || ''}`}</h4>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              completedCount === totalCount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {completedCount}/{totalCount}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {tasks.map(task => {
                            const isCompleted = isTaskCompletedToday(task.id, client.id, task.frequency);
                            return (
                              <div
                                key={`${task.id}-${client.id}`}
                                className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                                  isCompleted ? 'bg-green-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <button
                                  onClick={() => toggleDailyTaskCompletion(task.id, client.id, task.name, client.companyName || `${client.firstName} ${client.lastName || ''}`)}
                                  className={`mt-0.5 flex-shrink-0 transition-colors ${
                                    isCompleted ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-amber-600'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <CheckSquare className="w-5 h-5" />
                                  ) : (
                                    <Square className="w-5 h-5" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                    {task.name}
                                    {task.frequency === 'weekly' && (
                                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-normal">weekly</span>
                                    )}
                                    {task.clientId === 'all' && (
                                      <span className="ml-2 text-xs text-amber-600 font-normal">(all clients)</span>
                                    )}
                                  </p>
                                  {task.description && (
                                    <p className={`text-xs mt-0.5 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manage Tasks Link */}
                {dailyTasks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-amber-200">
                    <details className="group">
                      <summary className="text-sm text-amber-700 cursor-pointer hover:text-amber-800 font-medium">
                        Manage task templates ({dailyTasks.length})
                      </summary>
                      <div className="mt-3 space-y-2">
                        {dailyTasks.map(task => {
                          const taskClient = task.clientId === 'all' ? null : users.find(u => u.id === task.clientId);
                          return (
                            <div key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{task.name}</p>
                                <p className="text-xs text-gray-500">
                                  {task.frequency === 'weekly' ? 'Weekly' : 'Daily'} • {task.clientId === 'all' ? 'All clients' : `For: ${taskClient?.companyName || 'Unknown'}`}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteDailyTask(task.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Add Daily Task Modal */}
          {showAddTaskModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddTaskModal(false)}>
              <div className="bg-white rounded-lg shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">Add Task</h3>
                    <button onClick={() => setShowAddTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Task Name *</label>
                    <input
                      type="text"
                      value={newTask.name}
                      onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                      placeholder="e.g., Post to Instagram"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Add any notes or details..."
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="taskFrequency" value="daily" checked={newTask.frequency === 'daily'} onChange={() => setNewTask({ ...newTask, frequency: 'daily' })} className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-gray-700">Daily</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="taskFrequency" value="weekly" checked={newTask.frequency === 'weekly'} onChange={() => setNewTask({ ...newTask, frequency: 'weekly' })} className="w-4 h-4 text-amber-600" />
                        <span className="text-sm text-gray-700">Weekly</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Apply to</label>
                    <select
                      value={newTask.clientId}
                      onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    >
                      <option value="all">All Clients</option>
                      {users.filter(u => !u.parentClientId).map(user => (
                        <option key={user.id} value={user.id}>
                          {`${user.firstName} ${user.lastName || ''}`.trim()}{user.companyName ? ` (${user.companyName})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {newTask.clientId === 'all'
                        ? 'This task will appear for every client'
                        : 'This task will only appear for the selected client'}
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => setShowAddTaskModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addDailyTask}
                    disabled={!newTask.name.trim()}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expandable Sections */}
          <div className="space-y-3">
            {/* Clients & Content */}
            <button onClick={() => toggleSection('clients')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('clients') ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-gray-700 hover:bg-blue-50 hover:border-blue-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Users className="w-5 h-5" />Clients & Content <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{users.filter(u => !u.parentClientId).length}</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('clients') ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.has('clients') && (
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
                        <div className="flex flex-col items-end gap-1">
                          {userGroup && (
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full font-medium">
                              {userGroup.name}
                            </span>
                          )}
                          <span className={`px-3 py-1 text-xs rounded-full font-medium ${user.approvalGroup === 'auto-approve' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {user.approvalGroup === 'auto-approve' ? 'Auto-Approve' : 'Review Required'}
                          </span>
                        </div>
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
                    <div className="flex gap-3">
                      <select
                        value={contentClientFilter}
                        onChange={(e) => setContentClientFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Clients</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.firstName} {user.lastName || ''} - {user.companyName}</option>
                        ))}
                      </select>
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
                  </div>
                  <div className="space-y-3">
                    {content
                      .filter(item => contentTypeFilter === 'all' || item.type === contentTypeFilter)
                      .filter(item => contentClientFilter === 'all' || item.clientId === contentClientFilter)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => setContentDetailItem(item)}
                        >
                          <div className="flex justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium">{item.title}</p>
                              <p className="text-sm text-gray-600">{client?.firstName} {client?.lastName || ''} - {client?.companyName} • {item.type}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded text-xs ${item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                                    // Delete from Firestore - onSnapshot will automatically update local state
                                    if (db) {
                                      await deleteDoc(doc(db, 'content', item.id));
                                    } else {
                                      // Fallback for when db is not available
                                      const updatedContent = content.filter(c => c.id !== item.id);
                                      setContent(updatedContent);
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

            {/* Content Calendar */}
            <button onClick={() => toggleSection('calendar')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('calendar') ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Calendar className="w-5 h-5" />Content Calendar <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{calendarEvents.length}</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('calendar') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('calendar') && (
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

                {/* Calendar Filters */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Client</label>
                      <select
                        value={calendarClientFilter}
                        onChange={(e) => setCalendarClientFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Clients</option>
                        {users.filter(u => !u.parentClientId).map(user => (
                          <option key={user.id} value={user.id}>
                            {user.companyName} - {user.firstName} {user.lastName || ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Content Type</label>
                      <select
                        value={calendarTypeFilter}
                        onChange={(e) => setCalendarTypeFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="all">All Types</option>
                        <option value="social">Social Media</option>
                        <option value="email">Email</option>
                        <option value="blog">Blog Post</option>
                      </select>
                    </div>
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

                    const isDragOver = dragOverDate && date && formatDateLocal(dragOverDate) === formatDateLocal(date);

                    return (
                      <div
                        key={idx}
                        className={`min-h-[100px] border rounded p-1 ${date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-100'} ${todayClass} ${isDragOver ? 'bg-blue-100 border-blue-400 border-2' : ''}`}
                        onClick={() => {
                          if (date) {
                            setSelectedDate(date);
                            setShowScheduleModal(true);
                          }
                        }}
                        onDragOver={(e) => {
                          if (date && draggedContent) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                          }
                        }}
                        onDragEnter={(e) => {
                          if (date && draggedContent) {
                            e.preventDefault();
                            setDragOverDate(date);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (date && e.currentTarget === e.target) {
                            setDragOverDate(null);
                          }
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          if (date && draggedContent) {
                            await saveCalendarEvents([...calendarEvents, {
                              id: Date.now().toString(),
                              clientId: draggedContent.clientId,
                              title: draggedContent.title,
                              description: draggedContent.description,
                              date: formatDateLocal(date),
                              type: draggedContent.type,
                              contentId: draggedContent.id,
                              createdAt: new Date().toISOString()
                            }]);
                            setDraggedContent(null);
                            setDragOverDate(null);
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
                                  className={`text-xs p-1 rounded flex items-start justify-between gap-1 group ${
                                    event.type === 'social' ? 'bg-blue-100 text-blue-800' :
                                    event.type === 'email' ? 'bg-green-100 text-green-800' :
                                    event.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                  title={event.title}
                                >
                                  <span className="truncate flex-1">{event.title}</span>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm(`Unschedule "${event.title}"?`)) {
                                        // Delete from Firestore - onSnapshot will automatically update local state
                                        if (db) {
                                          await deleteDoc(doc(db, 'calendarEvents', event.id));
                                        } else {
                                          const updatedEvents = calendarEvents.filter(ev => ev.id !== event.id);
                                          setCalendarEvents(updatedEvents);
                                        }
                                      }
                                    }}
                                    className="hover:bg-red-500 hover:text-white bg-white/50 rounded px-1 transition-all flex-shrink-0"
                                    title="Unschedule"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
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
                <p className="text-sm text-gray-600 mb-4">Drag content to a calendar day or click to schedule</p>

                {/* Search and Filter Controls */}
                <div className="space-y-3 mb-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Search by title..."
                      value={approvedContentSearch}
                      onChange={(e) => setApprovedContentSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showOnlyUnscheduled"
                      checked={showOnlyUnscheduled}
                      onChange={(e) => setShowOnlyUnscheduled(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="showOnlyUnscheduled" className="text-sm text-gray-700 cursor-pointer">
                      Show only unscheduled
                    </label>
                  </div>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {(() => {
                    // Filter approved content
                    let filteredContent = content.filter(item => item.status === 'approved');

                    // Apply client filter
                    if (calendarClientFilter !== 'all') {
                      filteredContent = filteredContent.filter(item => item.clientId === calendarClientFilter);
                    }

                    // Apply search filter
                    if (approvedContentSearch.trim()) {
                      const searchLower = approvedContentSearch.toLowerCase();
                      filteredContent = filteredContent.filter(item =>
                        item.title.toLowerCase().includes(searchLower) ||
                        item.description?.toLowerCase().includes(searchLower)
                      );
                    }

                    // Apply unscheduled filter
                    if (showOnlyUnscheduled) {
                      filteredContent = filteredContent.filter(item => {
                        const scheduleCount = calendarEvents.filter(event => event.contentId === item.id).length;
                        return scheduleCount === 0;
                      });
                    }

                    if (filteredContent.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <Check className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No matching content found</p>
                        </div>
                      );
                    }

                    return filteredContent.map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      const scheduleCount = calendarEvents.filter(event => event.contentId === item.id).length;

                      return (
                        <div
                          key={item.id}
                          draggable={true}
                          onDragStart={(e) => {
                            setDraggedContent(item);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            setDraggedContent(null);
                            setDragOverDate(null);
                          }}
                          className="border rounded p-3 cursor-move hover:bg-blue-50 hover:border-blue-300 transition-colors"
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
                          <p className="text-xs text-gray-600 mb-2">{client?.companyName}</p>
                          {scheduleCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                              <Check className="w-3 h-3" />
                              <span>Scheduled {scheduleCount} time{scheduleCount !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

            {/* Video Production Queue */}
            <button onClick={() => toggleSection('videos')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('videos') ? 'bg-purple-600 text-white shadow-purple-200' : 'bg-white text-gray-700 hover:bg-purple-50 hover:border-purple-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Video className="w-5 h-5" />Video Production Queue <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{videos.filter(v => v.status !== 'completed').length} pending</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('videos') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('videos') && (
            <div className="bg-white rounded-lg shadow p-6">
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

            {/* Groups */}
            <button onClick={() => toggleSection('groups')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('groups') ? 'bg-teal-600 text-white shadow-teal-200' : 'bg-white text-gray-700 hover:bg-teal-50 hover:border-teal-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Users className="w-5 h-5" />Groups <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{groups.length}</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('groups') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('groups') && (
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
                                    // Delete group from Firestore - onSnapshot will automatically update local state
                                    if (db) {
                                      await deleteDoc(doc(db, 'groups', group.id));
                                    } else {
                                      const updatedGroups = groups.filter(g => g.id !== group.id);
                                      setGroups(updatedGroups);
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

            {/* Send SMS */}
            <button onClick={() => toggleSection('sms')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('sms') ? 'bg-green-600 text-white shadow-green-200' : 'bg-white text-gray-700 hover:bg-green-50 hover:border-green-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><MessageSquare className="w-5 h-5" />Send SMS</div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('sms') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('sms') && (
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

            {/* Activity Log */}
            <button onClick={() => toggleSection('activity')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('activity') ? 'bg-amber-600 text-white shadow-amber-200' : 'bg-white text-gray-700 hover:bg-amber-50 hover:border-amber-200 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Clock className="w-5 h-5" />Activity Log <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{adminActivities.length}</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('activity') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('activity') && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-6">Track what your team has accomplished</p>

                {adminActivities.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No activity recorded yet</p>
                    <p className="text-sm mt-1">Activities will appear here as team members complete tasks</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...adminActivities]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 100)
                      .map(activity => {
                        const activityDate = new Date(activity.timestamp);
                        const isToday = formatDateLocal(activityDate) === formatDateLocal(new Date());
                        const isYesterday = formatDateLocal(activityDate) === formatDateLocal(new Date(Date.now() - 86400000));

                        return (
                          <div key={activity.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              activity.action === 'content_completed' ? 'bg-green-100 text-green-600' :
                              activity.action === 'daily_task_completed' ? 'bg-amber-100 text-amber-600' :
                              activity.action === 'content_approved' ? 'bg-blue-100 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {activity.action === 'content_completed' ? <Check className="w-5 h-5" /> :
                               activity.action === 'daily_task_completed' ? <CheckSquare className="w-5 h-5" /> :
                               activity.action === 'content_approved' ? <Sparkles className="w-5 h-5" /> :
                               <Clock className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{activity.adminName}</span>
                                <span className="text-xs text-gray-500">
                                  {isToday ? 'Today' : isYesterday ? 'Yesterday' : activityDate.toLocaleDateString()}
                                  {' at '}
                                  {activityDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{activity.details}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Activity Summary by Team Member */}
              {adminActivities.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Team Summary (Last 7 Days)</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
                      const recentActivities = adminActivities.filter(a => new Date(a.timestamp) >= sevenDaysAgo);

                      // Group by admin
                      const byAdmin = recentActivities.reduce((acc, activity) => {
                        const adminId = activity.adminId;
                        if (!acc[adminId]) {
                          acc[adminId] = {
                            name: activity.adminName,
                            contentCompleted: 0,
                            tasksCompleted: 0,
                            total: 0
                          };
                        }
                        acc[adminId].total++;
                        if (activity.action === 'content_completed') acc[adminId].contentCompleted++;
                        if (activity.action === 'daily_task_completed') acc[adminId].tasksCompleted++;
                        return acc;
                      }, {});

                      const adminStats = Object.values(byAdmin);
                      if (adminStats.length === 0) {
                        return <p className="text-gray-500 col-span-full">No activity in the last 7 days</p>;
                      }

                      return adminStats.map((admin: any) => (
                        <div key={admin.name} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 mb-3">{admin.name}</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Content completed</span>
                              <span className="font-medium text-green-600">{admin.contentCompleted}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Tasks completed</span>
                              <span className="font-medium text-amber-600">{admin.tasksCompleted}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                              <span className="text-gray-700 font-medium">Total actions</span>
                              <span className="font-bold text-gray-900">{admin.total}</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

            {/* Team */}
            <button onClick={() => toggleSection('team')} className={`w-full px-5 py-3.5 rounded-xl font-medium flex items-center justify-between shadow-sm transition-all ${expandedSections.has('team') ? 'bg-gray-600 text-white shadow-gray-200' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-3"><Users className="w-5 h-5" />Team <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">{adminUsers.length}</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.has('team') ? 'rotate-180' : ''}`} />
            </button>
          {expandedSections.has('team') && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600 mb-6">Manage admin users who can access the portal</p>

                {/* Current User Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Logged in as: {currentUser?.name || currentUser?.email}</p>
                      <p className="text-sm text-gray-600">{currentUser?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Admin Users List */}
                <h4 className="font-medium text-gray-800 mb-3">Team Members ({adminUsers.length})</h4>
                <div className="space-y-3">
                  {adminUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No team members found</p>
                    </div>
                  ) : (
                    adminUsers.map(admin => (
                      <div key={admin.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {admin.name?.charAt(0) || admin.email?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{admin.name}</p>
                            <p className="text-sm text-gray-600">{admin.email}</p>
                          </div>
                          {admin.isOwner && (
                            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">Owner</span>
                          )}
                          {admin.id === currentUser?.id && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">You</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Joined {new Date(admin.createdAt).toLocaleDateString()}
                          </span>
                          {admin.id !== currentUser?.id && !admin.isOwner && (
                            <button
                              onClick={async () => {
                                if (confirm(`Remove ${admin.name} from the team?`)) {
                                  if (db) {
                                    await deleteDoc(doc(db, 'adminUsers', admin.id));
                                  }
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove team member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Team Member Instructions */}
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-900 mb-2">Adding New Team Members</h4>
                  <p className="text-sm text-amber-800 mb-2">
                    To add a new team member, have them visit the admin login page and click "Need to create an account? Enter setup code".
                  </p>
                  <p className="text-sm text-amber-800">
                    <strong>Setup Code:</strong> <code className="bg-amber-100 px-2 py-1 rounded">SETUP2024</code>
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Share this code only with trusted team members who should have admin access.
                  </p>
                </div>
              </div>
            </div>
          )}
          </div>
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
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="publishMode"
                        value="approval-group"
                        checked={publishMode === 'approval-group'}
                        onChange={(e) => setPublishMode(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">By Approval Group</span>
                    </label>
                  </div>
                </div>

                {/* Approval Group Selection */}
                {publishMode === 'approval-group' && (
                  <div className="border rounded p-4 bg-blue-50">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Target Group:</label>
                    <select
                      value={targetApprovalGroup}
                      onChange={(e) => setTargetApprovalGroup(e.target.value)}
                      className="w-full px-4 py-2 border rounded"
                    >
                      <option value="review-required">Review Required (content goes to review)</option>
                      <option value="auto-approve">Auto-Approve (content is automatically approved)</option>
                    </select>
                    <p className="text-xs text-gray-600 mt-2">
                      {targetApprovalGroup === 'auto-approve'
                        ? 'Content will be automatically approved and ready for scheduling.'
                        : 'Content will appear in the client\'s review section for approval.'}
                    </p>
                  </div>
                )}

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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <RichTextEditor
                    value={newContent.content}
                    onChange={(value) => setNewContent({ ...newContent, content: value })}
                    placeholder="Enter content with formatting..."
                  />
                </div>
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

                  // Helper to determine content status based on user's approval group
                  const getContentStatus = (userId) => {
                    const user = users.find(u => u.id === userId);
                    return (user?.approvalGroup === 'auto-approve') ? 'approved' : 'pending';
                  };

                  // Approval group mode
                  if (publishMode === 'approval-group') {
                    const targetUsers = users.filter(u => {
                      if (u.parentClientId) return false;
                      const group = u.approvalGroup || 'review-required';
                      return group === targetApprovalGroup;
                    });

                    if (targetUsers.length === 0) {
                      alert(`No clients found in the "${targetApprovalGroup === 'auto-approve' ? 'Auto-Approve' : 'Review Required'}" group`);
                      return;
                    }

                    const confirmMsg = `Publish this content to ${targetUsers.length} client${targetUsers.length > 1 ? 's' : ''} in the "${targetApprovalGroup === 'auto-approve' ? 'Auto-Approve' : 'Review Required'}" group?\n\n${targetUsers.map(u => u.companyName).join(', ')}`;
                    if (!confirm(confirmMsg)) return;

                    const newContentPieces = targetUsers.map(user => ({
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                      clientId: user.id,
                      type: newContent.type,
                      title: newContent.title,
                      description: newContent.description,
                      content: newContent.content,
                      fileLink: newContent.fileLink,
                      status: getContentStatus(user.id),
                      createdAt: new Date().toISOString()
                    }));

                    const saved = await saveContentItems(newContentPieces);
                    if (!saved) {
                      alert('⚠️ Failed to save some content. Please try again.');
                      return;
                    }

                    const autoApprovedCount = newContentPieces.filter(c => c.status === 'approved').length;
                    alert(`✅ Published to ${targetUsers.length} client${targetUsers.length > 1 ? 's' : ''}!${autoApprovedCount > 0 ? ` (${autoApprovedCount} auto-approved)` : ''}`);
                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setPublishMode('single');
                    setShowForm(false);
                  }
                  // Bulk publish mode
                  else if (publishMode === 'all-realtors' || publishMode === 'all-loan-officers') {
                    const targetIndustry = publishMode === 'all-realtors' ? 'Realtor' : 'Loan Officer';

                    const targetUsers = users.filter(u => {
                      if (u.parentClientId) return false;
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

                    const newContentPieces = targetUsers.map(user => ({
                      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                      clientId: user.id,
                      type: newContent.type,
                      title: newContent.title,
                      description: newContent.description,
                      content: newContent.content,
                      fileLink: newContent.fileLink,
                      status: getContentStatus(user.id),
                      createdAt: new Date().toISOString()
                    }));

                    const saved = await saveContentItems(newContentPieces);
                    if (!saved) {
                      alert('⚠️ Failed to save some content. Please try again.');
                      return;
                    }

                    const autoApprovedCount = newContentPieces.filter(c => c.status === 'approved').length;
                    alert(`✅ Published to ${targetUsers.length} ${targetIndustry}${targetUsers.length > 1 ? 's' : ''}!${autoApprovedCount > 0 ? ` (${autoApprovedCount} auto-approved)` : ''}`);
                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setPublishMode('single');
                    setShowForm(false);
                  }
                  // Single client mode
                  else {
                    const singleContent = { id: Date.now().toString(), ...newContent, status: getContentStatus(newContent.clientId), createdAt: new Date().toISOString() };
                    const saved = await saveContentItems([singleContent]);
                    if (!saved) {
                      alert('⚠️ Failed to save content. Please try again.');
                      return;
                    }

                    const statusMsg = singleContent.status === 'approved' ? ' (auto-approved)' : '';
                    console.log(`✅ Content published to client${statusMsg}`);

                    setNewContent({ clientId: '', type: 'content-idea', title: '', description: '', content: '', fileLink: '' });
                    setShowForm(false);
                  }
                }} className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700">
                  {publishMode === 'single' ? 'Upload' : publishMode === 'approval-group' ? `Publish to ${targetApprovalGroup === 'auto-approve' ? 'Auto-Approve' : 'Review Required'} Group` : `Publish to All ${publishMode === 'all-realtors' ? 'Realtors' : 'Loan Officers'}`}
                </button>
                <button onClick={() => {
                  setShowForm(false);
                  setPublishMode('single');
                }} className="flex-1 bg-gray-200 py-3 rounded hover:bg-gray-300">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Attach Video Modal */}
        {attachVideoModal.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Attach Video to Content</h2>
                <button
                  onClick={() => {
                    setAttachVideoModal({ isOpen: false, event: null, contentItem: null });
                    setAdminVideoFile(null);
                    setAdminVideoLink('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {attachVideoModal.event && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                  <p className="font-medium text-gray-800">{attachVideoModal.event.title}</p>
                  <p className="text-sm text-gray-600">
                    Scheduled: {new Date(attachVideoModal.event.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Client: {users.find(u => u.id === attachVideoModal.event.clientId)?.companyName || 'Unknown'}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* File Upload Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Video File</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setAdminVideoFile(e.target.files?.[0] || null)}
                      className="w-full text-sm"
                    />
                    {adminVideoFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        Selected: {adminVideoFile.name} ({(adminVideoFile.size / 1024 / 1024).toFixed(2)} MB)
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
                    value={adminVideoLink}
                    onChange={(e) => setAdminVideoLink(e.target.value)}
                    placeholder="Google Drive, Dropbox, or direct video link"
                    className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Upload Progress */}
                {adminVideoUploading && (
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-600 h-4 transition-all duration-300 flex items-center justify-center text-xs text-white font-semibold"
                      style={{ width: `${adminVideoProgress}%` }}
                    >
                      {adminVideoProgress > 5 && `${Math.round(adminVideoProgress)}%`}
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={async () => {
                    if (!adminVideoFile && !adminVideoLink.trim()) {
                      alert('Please upload a video file or provide a link');
                      return;
                    }

                    setAdminVideoUploading(true);
                    setAdminVideoProgress(0);

                    try {
                      let finalVideoLink = adminVideoLink;

                      // If a file is selected, upload it to Firebase Storage
                      if (adminVideoFile) {
                        if (!storage) {
                          alert('❌ Firebase Storage is not configured.');
                          setAdminVideoUploading(false);
                          return;
                        }

                        finalVideoLink = await uploadFileToStorage(
                          adminVideoFile,
                          'videos',
                          (progress) => setAdminVideoProgress(progress)
                        );
                      }

                      if (finalVideoLink && finalVideoLink.trim()) {
                        const newVideo = {
                          id: Date.now().toString(),
                          clientId: attachVideoModal.event.clientId,
                          contentId: attachVideoModal.event.contentId,
                          contentTitle: attachVideoModal.event.title,
                          videoLink: finalVideoLink,
                          description: `Video for: ${attachVideoModal.event.title}`,
                          status: 'pending',
                          submittedAt: new Date().toISOString(),
                          fileName: adminVideoFile ? adminVideoFile.name : null,
                          uploadedByAdmin: true
                        };

                        if (!db) {
                          alert('⚠️ Database not configured.');
                          setAdminVideoUploading(false);
                          return;
                        }

                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                        // Log admin activity
                        await logAdminActivity('video_attached', `Attached video to "${attachVideoModal.event.title}"`, {
                          contentId: attachVideoModal.event.contentId,
                          clientId: attachVideoModal.event.clientId
                        });

                        // Reset and close modal
                        setAdminVideoFile(null);
                        setAdminVideoLink('');
                        setAttachVideoModal({ isOpen: false, event: null, contentItem: null });
                        alert('Video attached successfully!');
                      }
                    } catch (error) {
                      console.error('❌ Error attaching video:', error);
                      alert('Error attaching video. Please try again.');
                    } finally {
                      setAdminVideoUploading(false);
                      setAdminVideoProgress(0);
                    }
                  }}
                  disabled={(!adminVideoFile && !adminVideoLink.trim()) || adminVideoUploading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adminVideoUploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Attach Video
                    </>
                  )}
                </button>
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Repeat className="w-4 h-4 inline mr-1" />
                      Repeat
                    </label>
                    <div className="flex gap-3">
                      <select
                        value={recurrence}
                        onChange={(e) => setRecurrence(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded"
                      >
                        <option value="none">No Repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 Weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      {recurrence !== 'none' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="2"
                            max="52"
                            value={recurrenceCount}
                            onChange={(e) => setRecurrenceCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                            className="w-20 px-3 py-2 border rounded"
                          />
                          <span className="text-sm text-gray-600">times</span>
                        </div>
                      )}
                    </div>
                    {recurrence !== 'none' && (
                      <p className="text-xs text-gray-500 mt-1">
                        This will create {recurrenceCount} scheduled posts starting from the selected date.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={async () => {
                        if (!selectedDate) {
                          alert('Please select a date');
                          return;
                        }

                        const newEvents = [];
                        const baseDate = new Date(selectedDate);

                        const count = recurrence === 'none' ? 1 : recurrenceCount;
                        for (let i = 0; i < count; i++) {
                          const eventDate = new Date(baseDate);
                          if (recurrence === 'daily') eventDate.setDate(baseDate.getDate() + i);
                          else if (recurrence === 'weekly') eventDate.setDate(baseDate.getDate() + (i * 7));
                          else if (recurrence === 'biweekly') eventDate.setDate(baseDate.getDate() + (i * 14));
                          else if (recurrence === 'monthly') eventDate.setMonth(baseDate.getMonth() + i);

                          newEvents.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            clientId: selectedContent.clientId,
                            title: selectedContent.title,
                            description: selectedContent.description,
                            date: formatDateLocal(eventDate),
                            type: selectedContent.type,
                            contentId: selectedContent.id,
                            recurrenceGroup: recurrence !== 'none' ? Date.now().toString() : undefined,
                            createdAt: new Date().toISOString()
                          });
                        }

                        await saveCalendarEvents([...calendarEvents, ...newEvents]);

                        setShowScheduleModal(false);
                        setSelectedContent(null);
                        setSelectedDate(null);
                        setRecurrence('none');
                        setRecurrenceCount(4);
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
                    >
                      {recurrence === 'none' ? 'Schedule' : `Schedule ${recurrenceCount} Posts`}
                    </button>
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setSelectedContent(null);
                        setSelectedDate(null);
                        setRecurrence('none');
                        setRecurrenceCount(4);
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

                  {/* Existing events for this date */}
                  {(() => {
                    const dateEvents = getEventsForDate(selectedDate);
                    if (dateEvents.length > 0) {
                      return (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-gray-700 mb-2">Already Scheduled ({dateEvents.length})</h3>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {dateEvents.map(event => {
                              const client = users.find(u => u.id === event.clientId);
                              return (
                                <div
                                  key={event.id}
                                  className={`border rounded p-3 flex items-start justify-between ${
                                    event.type === 'social' ? 'bg-blue-50 border-blue-200' :
                                    event.type === 'email' ? 'bg-green-50 border-green-200' :
                                    event.type === 'blog' ? 'bg-purple-50 border-purple-200' :
                                    'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm text-gray-800">{event.title}</h4>
                                    <p className="text-xs text-gray-600">{client?.companyName} • {event.type}</p>
                                  </div>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm(`Unschedule "${event.title}"?`)) {
                                        // Delete from Firestore - onSnapshot will automatically update local state
                                        if (db) {
                                          await deleteDoc(doc(db, 'calendarEvents', event.id));
                                        } else {
                                          const updatedEvents = calendarEvents.filter(ev => ev.id !== event.id);
                                          setCalendarEvents(updatedEvents);
                                        }
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded transition-colors"
                                    title="Unschedule"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Schedule New Content</h3>
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
                    <div>
                      <span className="text-gray-600">Approval Group:</span>
                      <select
                        value={selectedUser.approvalGroup || 'review-required'}
                        onChange={async (e) => {
                          const updatedUser = { ...selectedUser, approvalGroup: e.target.value };
                          setSelectedUser(updatedUser);
                          const updatedUsers = users.map(u => u.id === selectedUser.id ? updatedUser : u);
                          await saveUsers(updatedUsers);
                        }}
                        className="ml-2 px-2 py-1 border rounded text-sm font-medium"
                      >
                        <option value="review-required">Review Required</option>
                        <option value="auto-approve">Auto-Approve</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-gray-600">Daily Text Notifications:</span>
                      <button
                        onClick={async () => {
                          const updatedUser = { ...selectedUser, receiveDailyTexts: !selectedUser.receiveDailyTexts };
                          setSelectedUser(updatedUser);
                          const updatedUsers = users.map(u => u.id === selectedUser.id ? updatedUser : u);
                          await saveUsers(updatedUsers);
                        }}
                        className={`ml-2 px-3 py-1 rounded text-xs font-medium ${selectedUser.receiveDailyTexts ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {selectedUser.receiveDailyTexts ? 'Enabled' : 'Disabled'}
                      </button>
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
                        <span className="text-gray-600 font-medium">Brand Voice:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.brandVoice)
                            ? selectedUser.onboardingAnswers.brandVoice.join(', ')
                            : selectedUser.onboardingAnswers.brandVoice || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Specialties:</span>
                        <p className="text-gray-800 mt-1">
                          {Array.isArray(selectedUser.onboardingAnswers.specialties)
                            ? selectedUser.onboardingAnswers.specialties.join(', ')
                            : selectedUser.onboardingAnswers.specialties || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Client Pain Points:</span>
                        <p className="text-gray-800 mt-1">{selectedUser.onboardingAnswers.clientPainPoints || 'Not provided'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 font-medium">Topics to Avoid:</span>
                        <p className="text-gray-800 mt-1">{selectedUser.onboardingAnswers.topicsToAvoid || 'Not provided'}</p>
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

        {/* Content Detail Modal */}
        {contentDetailItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{contentDetailItem.title}</h2>
                  <p className="text-gray-600">
                    {users.find(u => u.id === contentDetailItem.clientId)?.companyName || 'Unknown Client'}
                  </p>
                </div>
                <button onClick={() => setContentDetailItem(null)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Status and Type */}
                <div className="flex flex-wrap gap-3">
                  <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    contentDetailItem.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    contentDetailItem.status === 'approved' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Status: {contentDetailItem.status.charAt(0).toUpperCase() + contentDetailItem.status.slice(1)}
                  </span>
                  <span className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    contentDetailItem.type === 'social' ? 'bg-blue-100 text-blue-800' :
                    contentDetailItem.type === 'email' ? 'bg-green-100 text-green-800' :
                    contentDetailItem.type === 'blog' ? 'bg-purple-100 text-purple-800' :
                    contentDetailItem.type === 'landing-page' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    Type: {contentDetailItem.type === 'landing-page' ? 'Landing Page' :
                           contentDetailItem.type === 'social' ? 'Social Media' :
                           contentDetailItem.type === 'blog' ? 'Blog Post' :
                           contentDetailItem.type === 'email' ? 'Email Campaign' :
                           contentDetailItem.type.charAt(0).toUpperCase() + contentDetailItem.type.slice(1)}
                  </span>
                  {contentDetailItem.uploadedByAdmin && (
                    <span className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-100 text-orange-800">
                      Uploaded by Admin
                    </span>
                  )}
                </div>

                {/* Client Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Client Information
                  </h3>
                  {(() => {
                    const client = users.find(u => u.id === contentDetailItem.clientId);
                    return client ? (
                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <span className="ml-2 font-medium">{client.firstName} {client.lastName || ''}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Company:</span>
                          <span className="ml-2 font-medium">{client.companyName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Email:</span>
                          <span className="ml-2 font-medium">{client.email}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Client information not available</p>
                    );
                  })()}
                </div>

                {/* Description */}
                {contentDetailItem.description && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Description
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{contentDetailItem.description}</p>
                  </div>
                )}

                {/* Content Body */}
                {contentDetailItem.content && (
                  <div className="bg-white border rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Content
                    </h3>
                    <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
                      {contentDetailItem.content}
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {(contentDetailItem.fileLink || contentDetailItem.videoLink) && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      Attachments
                    </h3>
                    <div className="space-y-2">
                      {contentDetailItem.fileLink && (
                        <a
                          href={contentDetailItem.fileLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <FileText className="w-4 h-4" />
                          View Attached File
                        </a>
                      )}
                      {contentDetailItem.videoLink && (
                        <a
                          href={contentDetailItem.videoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <Video className="w-4 h-4" />
                          View Attached Video
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {contentDetailItem.feedback && (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Admin Feedback
                    </h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{contentDetailItem.feedback}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Timeline
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="ml-2 font-medium">
                        {new Date(contentDetailItem.createdAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {contentDetailItem.reviewedAt && (
                      <div>
                        <span className="text-gray-600">Reviewed:</span>
                        <span className="ml-2 font-medium">
                          {new Date(contentDetailItem.reviewedAt).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => setContentDetailItem(null)}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${contentDetailItem.title}"? This cannot be undone.`)) {
                        if (db) {
                          await deleteDoc(doc(db, 'content', contentDetailItem.id));
                        }
                        setContentDetailItem(null);
                      }
                    }}
                    className="px-6 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const onboardingViewProps = { currentUser, handleOnboarding };

  if (view === 'login') return <LoginView />;
  if (view === 'admin-login') return <AdminLoginView />;
  if (view === 'onboarding') return <OnboardingView {...onboardingViewProps} />;
  if (view === 'dashboard') return <DashboardView />;
  if (view === 'admin') return <AdminView />;
};

export default ClientPortal;
