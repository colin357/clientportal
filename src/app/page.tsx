"use client";
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Mail, Layout, Check, X, Clock, Eye, ChevronRight, ChevronLeft, EyeOff, Share2, Users, Sparkles, UserPlus, Settings, Calendar, Video, Download, Wand2, CheckSquare, Square, Plus, Trash2, ListTodo, MessageSquare, Repeat, Bell, BellOff, PlusCircle, LayoutDashboard, ChevronDown, Home, Gift, LogOut, Menu, Circle, CheckCircle2, ArrowRight, ExternalLink, ListChecks, LayoutGrid, List, ChevronsLeft, ChevronsRight, ClipboardList, FolderKanban, Pencil, Flag, AlertCircle, BarChart3, Target } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextDisplay } from '@/components/ui/rich-text-display';
import AiAssistant from '@/components/AiAssistant';
import { formatPhoneE164, formatPhoneDisplay, getClientPhoneNumbers, getClientSmsRecipients } from '@/lib/smsRecipients';

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
    if (!firebaseConfig.storageBucket) {
      console.warn('⚠️ NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is missing - file uploads will not work');
    }
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

// ---------------------------------------------------------------------------
// Media helpers (a submission can be one video or a whole batch of photos)
// ---------------------------------------------------------------------------
const MEDIA_ACCEPT = 'image/*,video/*';

const isImageMedia = (item: any) => {
  const type = item?.contentType || item?.type || '';
  if (type) return type.startsWith('image/');
  const name = item?.fileName || item?.name || '';
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif|tiff?)$/i.test(name);
};

// Submissions used to hold a single `videoLink`. New ones carry a `media`
// array, so normalize both shapes into one list of { url, fileName, contentType }.
const getSubmissionMedia = (submission: any) => {
  if (Array.isArray(submission?.media) && submission.media.length > 0) return submission.media;
  if (submission?.videoLink) {
    return [{
      url: submission.videoLink,
      fileName: submission.fileName || '',
      contentType: submission.mediaType === 'photo' ? 'image/*' : ''
    }];
  }
  return [];
};

const summarizeMediaType = (media: any[]) => {
  const photos = media.filter(isImageMedia).length;
  const videos = media.length - photos;
  if (photos && videos) return 'mixed';
  if (photos) return 'photo';
  return 'video';
};

const describeMedia = (media: any[]) => {
  const photos = media.filter(isImageMedia).length;
  const videos = media.length - photos;
  const parts = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? '' : 's'}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  return parts.join(' + ');
};

const formatFileSize = (bytes: number) => `${((bytes || 0) / 1024 / 1024).toFixed(2)} MB`;

// A pasted link becomes a single media entry; guess photo vs video from its extension
const makeLinkMedia = (url: string) => ({
  url,
  fileName: '',
  contentType: /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif|tiff?)(\?|$)/i.test(url) ? 'image/*' : ''
});

// "3 photos + 1 video selected · 24.10 MB"
const describeSelection = (files: File[]) =>
  `${describeMedia(files)} selected · ${formatFileSize(files.reduce((sum, f) => sum + (f.size || 0), 0))}`;

// Merge newly picked files into the current selection, skipping duplicates.
const mergeFileSelection = (existing: File[], picked: any): File[] => {
  const merged = [...existing];
  Array.from<File>(picked || []).forEach(file => {
    if (!merged.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) {
      merged.push(file);
    }
  });
  return merged;
};

// Thumbnail strip for a submission's files - photos preview, videos show a tile
function MediaGallery({ media, className = '' }: { media: any[]; className?: string }) {
  if (!media || media.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {media.map((m: any, idx: number) => (
        <a
          key={`${m.url}-${idx}`}
          href={m.url}
          target="_blank"
          rel="noopener noreferrer"
          title={m.fileName || `File ${idx + 1}`}
          className="block w-20 h-20 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:border-blue-400 transition-colors"
        >
          {isImageMedia(m) ? (
            <img src={m.url} alt={m.fileName || `Photo ${idx + 1}`} className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex flex-col items-center justify-center gap-1 px-1 text-center text-[10px] text-gray-500">
              <Video className="w-5 h-5 text-purple-500" />
              <span className="truncate w-full">{m.fileName || 'Video'}</span>
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Tasks
// ---------------------------------------------------------------------------

const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', icon: Circle, iconClass: 'text-red-500', badgeClass: 'bg-red-50 text-red-600 border-red-200', dotClass: 'bg-red-500' },
  { id: 'in_progress', label: 'In Progress', icon: ArrowRight, iconClass: 'text-amber-500', badgeClass: 'bg-amber-50 text-amber-600 border-amber-200', dotClass: 'bg-amber-500' },
  { id: 'under_review', label: 'Under Review', icon: Eye, iconClass: 'text-violet-500', badgeClass: 'bg-violet-50 text-violet-600 border-violet-200', dotClass: 'bg-violet-500' },
  { id: 'done', label: 'Done', icon: CheckCircle2, iconClass: 'text-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200', dotClass: 'bg-emerald-500' },
];

const taskStatusMeta = (status) => TASK_STATUSES.find(s => s.id === status) || TASK_STATUSES[0];

const PROJECT_STATUSES = [
  { id: 'not_started', label: 'Not Started', icon: Circle, iconClass: 'text-gray-400', badgeClass: 'bg-gray-50 text-gray-600 border-gray-200', dotClass: 'bg-gray-400' },
  { id: 'in_progress', label: 'In Progress', icon: ArrowRight, iconClass: 'text-blue-500', badgeClass: 'bg-blue-50 text-blue-600 border-blue-200', dotClass: 'bg-blue-500' },
  { id: 'on_hold', label: 'On Hold', icon: Clock, iconClass: 'text-amber-500', badgeClass: 'bg-amber-50 text-amber-600 border-amber-200', dotClass: 'bg-amber-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, iconClass: 'text-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200', dotClass: 'bg-emerald-500' },
];

const projectStatusMeta = (status) => PROJECT_STATUSES.find(s => s.id === status) || PROJECT_STATUSES[0];

const PROJECT_PRIORITIES = [
  { id: 'low', label: 'Low', bgClass: 'bg-gray-100 text-gray-600' },
  { id: 'medium', label: 'Medium', bgClass: 'bg-blue-100 text-blue-600' },
  { id: 'high', label: 'High', bgClass: 'bg-orange-100 text-orange-600' },
  { id: 'urgent', label: 'Urgent', bgClass: 'bg-red-100 text-red-600' },
];

const projectPriorityMeta = (priority) => PROJECT_PRIORITIES.find(p => p.id === priority) || PROJECT_PRIORITIES[1];

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDueDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Pages a task can deep-link to inside the client portal
const TASK_LINK_PAGES = [
  { value: '', label: 'No link' },
  { value: 'onboarding-form', label: 'Onboarding Form' },
  { value: 'content', label: 'Content Review' },
  { value: 'settings', label: 'Settings' },
  { value: 'social', label: 'Social Media' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'crm', label: 'CRM' },
  { value: 'ai-generator', label: 'AI Generator' },
];

const buildTaskLink = (page) => {
  if (!page) return null;
  if (page === 'onboarding-form') return { type: 'onboarding-form', label: 'Open Onboarding Form' };
  const label = TASK_LINK_PAGES.find(p => p.value === page)?.label || page;
  return { type: 'page', page, label: `Open ${label}` };
};

// Built-in task templates available in the admin portal. Custom templates
// live in the `taskTemplates` Firestore collection alongside these.
const BUILT_IN_TASK_TEMPLATES = [
  { id: 'builtin_video', title: 'Upload a New Video 🎥', tag: 'Content', linkPage: 'settings', dueInDays: 3, instructions: '🎬 We need fresh footage from you! Record and upload a new video so our team can edit it into content for your channels.' },
  { id: 'builtin_review', title: 'Review Your New Content Ideas', tag: 'Content', linkPage: 'content', dueInDays: 3, instructions: '✅ We just added new content ideas for you. Review them and approve your favorites (or request changes) so we can get them scheduled.' },
  { id: 'builtin_logins', title: 'Update Your Social Media Logins', tag: 'Account', linkPage: 'settings', dueInDays: 5, instructions: '🔑 One or more of your account logins needs updating. Head to Settings and make sure they\'re current so we can keep posting for you.' },
  { id: 'builtin_headshot', title: 'Upload a New Headshot 📸', tag: 'Branding', linkPage: 'settings', dueInDays: 7, instructions: '📸 Time to refresh your headshot! Upload a current photo in Settings so your content stays on-brand.' },
  { id: 'builtin_onboarding', title: 'Complete Your Onboarding Form', tag: 'Onboarding', linkPage: 'onboarding-form', dueInDays: 3, instructions: '👉 Tell us about your business, brand, and goals so we can create content that sounds like you. It takes about 10 minutes.' },
  { id: 'builtin_call', title: 'Book a Check-In Call 📞', tag: 'Strategy', linkPage: '', dueInDays: 7, instructions: '📞 Let\'s catch up on your strategy and results. Reply to our text or email to grab a time that works for you.' },
];

// Default tasks waiting for every new client right after signup.
// Deterministic ids keep seeding idempotent across signup + login.
const buildDefaultClientTasks = (clientId) => {
  const createdAt = new Date().toISOString();
  return [
    {
      id: `${clientId}_welcome`,
      title: 'Welcome to Own It Social! 🎉',
      instructions: "😀 We're excited to have you! Take a look around your new portal — your tasks here will guide you through getting fully set up.",
      link: null,
      dueDate: daysFromNow(2),
      order: 1,
    },
    {
      id: `${clientId}_onboarding_form`,
      title: 'Complete Your Onboarding Form',
      instructions: '👉 Tell us about your business, brand, and goals so we can create content that sounds like you. It takes about 10 minutes.',
      link: { type: 'onboarding-form', label: 'Open Onboarding Form' },
      dueDate: daysFromNow(3),
      order: 2,
    },
    {
      id: `${clientId}_social_logins`,
      title: 'Add Your Social Media Logins',
      instructions: '🔑 Add your account logins in Settings so we can publish content on your behalf.',
      link: { type: 'page', page: 'settings', label: 'Go to Settings' },
      dueDate: daysFromNow(5),
      order: 3,
    },
    {
      id: `${clientId}_headshot`,
      title: 'Upload Your Headshot & Logo',
      instructions: '📸 Add a headshot and company logo in Settings so your content stays on-brand.',
      link: { type: 'page', page: 'settings', label: 'Go to Settings' },
      dueDate: daysFromNow(5),
      order: 4,
    },
    {
      id: `${clientId}_review_content`,
      title: 'Review Your First Content Ideas',
      instructions: "✅ Once your onboarding form is in, we'll generate your first content ideas. Review them and approve your favorites.",
      link: { type: 'page', page: 'content', label: 'Open Content Review' },
      dueDate: daysFromNow(7),
      order: 5,
    },
  ].map(t => ({ ...t, clientId, tag: 'Getting Started', status: 'todo', notes: '', createdAt }));
};

// Module-level so state survives ClientPortal re-renders (Firebase listeners
// re-render the parent, which remounts components defined inside it).
function TaskDetailModal({ task, onClose, onUpdate, onOpenLink }) {
  const [notes, setNotes] = useState(task.notes || '');
  const meta = taskStatusMeta(task.status);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
              {meta.label.toUpperCase()}
            </span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-zinc-200 text-zinc-600">
                <Calendar className="w-3 h-3" />
                {formatDueDate(task.dueDate)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5">
          <h2 className="text-2xl font-bold text-zinc-900 mb-1">{task.title}</h2>
          {task.tag && <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 border border-zinc-200 rounded-full px-2.5 py-0.5 mb-4 mt-1">🏷 {task.tag}</span>}

          {task.instructions && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-zinc-800">
                <FileText className="w-4 h-4" /> Instructions
              </div>
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700 whitespace-pre-wrap">
                {task.instructions}
              </div>
            </div>
          )}

          {task.link && (
            <button
              onClick={() => onOpenLink(task)}
              className="mt-4 w-full bg-zinc-900 text-white py-3 rounded-xl hover:bg-zinc-800 transition font-medium flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {task.link.label || 'Open'}
            </button>
          )}

          <div className="mt-6">
            <p className="text-sm font-semibold text-zinc-800 mb-2">Update Status</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TASK_STATUSES.map(s => {
                const Icon = s.icon;
                const active = task.status === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onUpdate(task, { status: s.id, completedAt: s.id === 'done' ? new Date().toISOString() : null })}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-semibold transition ${active ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 bg-white'}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : s.iconClass}`} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-zinc-800 mb-2">Your Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your own notes about this task..."
              rows={3}
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 resize-none text-sm"
            />
            {notes !== (task.notes || '') && (
              <button
                onClick={() => onUpdate(task, { notes })}
                className="mt-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
              >
                Save Notes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referral Modal — refer a friend, get a free month of service
// ---------------------------------------------------------------------------

function ReferralModal({ currentUser, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Please add their name.'); return; }
    if (!email.trim() && !phone.trim()) { setError('Please add an email or phone number so we can reach out.'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), company: company.trim(), notes: notes.trim() });
      setSubmitted(true);
    } catch (e) {
      console.error('Error submitting referral:', e);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Thanks, {currentUser.firstName}! 🎉</h2>
            <p className="text-sm text-zinc-600 mb-6">
              We'll reach out to {name} and handle the rest. If they join, you'll get a <strong>free month of service</strong> on us.
            </p>
            <button onClick={onClose} className="w-full bg-zinc-900 text-white py-3 rounded-xl hover:bg-zinc-800 font-medium">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-1">
              <div className="w-11 h-11 bg-zinc-900 rounded-xl flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mt-3">Refer a Friend</h2>
            <p className="text-sm text-zinc-600 mt-1 mb-5">
              💸 Know someone we can help? Drop their name and best contact — we'll reach out and handle the rest.
              For every successful referral, you get <strong>one month of service free</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Their Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 555-5555" className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Company / What they do</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g., Realtor at ABC Realty" className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Anything we should know?</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="How you know them, what they need..." className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm resize-none" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button onClick={handleSubmit} disabled={submitting} className="w-full bg-zinc-900 text-white py-3 rounded-xl hover:bg-zinc-800 disabled:bg-zinc-300 font-medium flex items-center justify-center gap-2">
                <Gift className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Send Referral'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding Form — replaces the old signup question wizard. Opened from the
// "Complete Your Onboarding Form" task. Module-level so answers survive
// parent re-renders from Firebase listeners.
// ---------------------------------------------------------------------------

const ONBOARDING_MULTI_OPTIONS = {
  industry: ['Realtor', 'Loan Officer'],
  targetAudience: ['Young Professionals', 'Small Business Owners', 'Students', 'Parents', 'Seniors', 'Millennials', 'Gen Z', 'Entrepreneurs'],
  brandVoice: ['Professional', 'Casual', 'Friendly', 'Inspirational', 'Authoritative', 'Playful', 'Educational', 'Empathetic', 'Bold'],
  specialties: ['First-Time Buyers', 'Luxury Homes', 'Investment Properties', 'Commercial', 'VA Loans', 'FHA Loans', 'Refinancing', 'New Construction', 'Relocation', 'Downsizing'],
};

const RATING_FIELDS = [
  { key: 'socialPresenceRating', label: 'Your current social media presence' },
  { key: 'contentSystemRating', label: 'How consistently you post content today' },
  { key: 'videoComfortRating', label: 'How comfortable you are on video' },
  { key: 'leadFollowUpRating', label: 'Your lead follow-up / CRM system' },
];

// Hoisted to module level so React keeps a stable component type across
// re-renders — defining these inside the form would remount inputs (and drop
// focus) on every keystroke.
function FormSection({ emoji, title, subtitle, children }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 mb-6">
      <h2 className="text-lg font-bold text-zinc-900 mb-1">{emoji} {title}</h2>
      {subtitle && <p className="text-sm text-zinc-500 mb-5">{subtitle}</p>}
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function FormMultiSelect({ field, label, values, onToggle }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-zinc-800 mb-1.5">{label} *</label>
      <div className="flex flex-wrap gap-2">
        {ONBOARDING_MULTI_OPTIONS[field].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(field, opt)}
            className={`px-3.5 py-2 rounded-full border text-sm font-medium transition ${(values || []).includes(opt) ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FormRating({ field, label, value, onSelect }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1">
      <span className="text-sm text-zinc-700">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onSelect(field, String(n))}
            className={`w-9 h-9 rounded-lg border text-sm font-semibold transition ${value === String(n) ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

const ONBOARDING_REQUIRED_FIELDS = [
  ['companyName', 'Company Name'],
  ['contactName', 'Contact Name'],
  ['email', 'Email Address'],
  ['phoneNumber', 'Phone Number'],
  ['instagram', 'Instagram'],
  ['industry', 'What You Do'],
  ['targetAudience', 'Target Audience'],
  ['brandVoice', 'Brand Voice'],
  ['specialties', 'Specialties'],
  ['primaryMarkets', 'Primary Markets'],
  ['pricePoint', 'Price Point'],
  ['clientPainPoints', 'Client Pain Points'],
  ['vision', 'Vision'],
  ['objectives', 'Objectives'],
  ['roadblocks', 'Roadblocks'],
  ['successMetrics', 'Success'],
  ['win', 'Biggest Win'],
  ['excitement', 'Excitement'],
  ['marketingSource', 'How You Found Us'],
];

function OnboardingFormView({ currentUser, onSubmit, onOpenReferral, uploadFile, onClose }) {
  const [form, setForm] = useState({
    companyName: currentUser.companyName || '',
    contactName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
    email: currentUser.email || '',
    phoneNumber: currentUser.phoneNumber || '',
    birthday: '',
    shippingAddress: '',
    instagram: '',
    industry: [],
    industryOther: '',
    primaryMarkets: '',
    pricePoint: '',
    teamMembers: '',
    targetAudience: [],
    brandVoice: [],
    specialties: [],
    identity: '',
    clientPainPoints: '',
    topicsToAvoid: '',
    styleInspirations: '',
    vision: '',
    objectives: '',
    roadblocks: '',
    dislikes: '',
    successMetrics: '',
    win: '',
    excitement: '',
    socialPresenceRating: '',
    contentSystemRating: '',
    videoComfortRating: '',
    leadFollowUpRating: '',
    ratingNotes: '',
    marketingSource: '',
    differentiator: '',
    pastResources: '',
    anythingElse: '',
  });
  const [headshotUrl, setHeadshotUrl] = useState(currentUser.headshot || '');
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const [headshotProgress, setHeadshotProgress] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleMulti = (key, option) => {
    setForm(prev => {
      const current = prev[key] || [];
      return { ...prev, [key]: current.includes(option) ? current.filter(o => o !== option) : [...current, option] };
    });
  };

  const missingFields = () => ONBOARDING_REQUIRED_FIELDS
    .filter(([key]) => {
      const v = form[key];
      return Array.isArray(v) ? v.length === 0 : !String(v || '').trim();
    })
    .map(([, label]) => label);

  const handleSubmit = async () => {
    const missing = missingFields();
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}`);
      window.scrollTo({ top: 0 });
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ ...form, headshot: headshotUrl });
    } catch (e) {
      console.error('Error submitting onboarding form:', e);
      setError('Something went wrong saving your answers. Please try again.');
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 text-sm bg-white';
  const labelClass = 'block text-sm font-semibold text-zinc-800 mb-1.5';
  const hintClass = 'text-xs text-zinc-500 mb-1.5 -mt-1';

  const Section = FormSection;
  const MultiSelect = (props) => <FormMultiSelect {...props} values={form[props.field]} onToggle={toggleMulti} />;
  const Rating = (props) => <FormRating {...props} value={form[props.field]} onSelect={set} />;

  return (
    <div className="fixed inset-0 bg-zinc-100 overflow-y-auto z-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">Your Onboarding Form</h1>
            <p className="text-sm text-zinc-600 mt-2 max-w-lg">
              Please take your time filling this out. It helps us get to know your business and your brand so we can create content that sounds like you. 🙂
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-2 bg-white border border-zinc-200 rounded-xl" title="Save for later">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>
        )}

        <Section emoji="💼" title="Your Details" subtitle="The basics — so we know who we're working with.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Company Name *</label>
              <input type="text" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact Name *</label>
              <input type="text" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Address *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone Number *</label>
              <input type="tel" value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>🎂 Birthday</label>
              <input type="date" value={form.birthday} onChange={(e) => set('birthday', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>📲 Instagram *</label>
              <input type="text" value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="www.instagram.com/yourhandle" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>📍 Shipping Address</label>
            <p className={hintClass}>Best address in case we ever send you something. 👀</p>
            <input type="text" value={form.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>📸 Headshot</label>
            <p className={hintClass}>A current photo of you — we'll use it across your content and profile.</p>
            <div className="border-2 border-dashed border-zinc-300 rounded-xl p-4 hover:border-zinc-400 transition">
              <input
                type="file"
                accept="image/*"
                disabled={uploadingHeadshot}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingHeadshot(true);
                  setHeadshotProgress(0);
                  try {
                    const url = await uploadFile(file, 'headshots', (p) => setHeadshotProgress(Math.round(p)));
                    setHeadshotUrl(url);
                  } catch (err) {
                    console.error('Headshot upload failed:', err);
                    alert('Upload failed — you can also add your headshot later in Settings.');
                  } finally {
                    setUploadingHeadshot(false);
                  }
                }}
                className="text-sm"
              />
              {uploadingHeadshot && (
                <div className="w-full bg-zinc-200 rounded-full h-1.5 mt-3">
                  <div className="bg-zinc-900 h-1.5 rounded-full transition-all" style={{ width: `${headshotProgress}%` }} />
                </div>
              )}
              {headshotUrl && !uploadingHeadshot && (
                <img src={headshotUrl} alt="Headshot preview" className="w-20 h-20 object-cover rounded-full mt-3" onError={(e) => e.target.style.display = 'none'} />
              )}
            </div>
          </div>
        </Section>

        <Section emoji="📈" title="Your Business" subtitle="A snapshot of where things stand today.">
          <MultiSelect field="industry" label="What do you do?" />
          {(form.industry || []).length > 0 && (
            <div>
              <label className={labelClass}>Anything else about what you do?</label>
              <input type="text" value={form.industryOther} onChange={(e) => set('industryOther', e.target.value)} placeholder="Optional — e.g., team lead, broker/owner..." className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass}>📍 Primary Markets *</label>
            <input type="text" value={form.primaryMarkets} onChange={(e) => set('primaryMarkets', e.target.value)} placeholder="e.g., Los Angeles, Orange County, San Diego" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>💰 Average Price Point or Loan Size *</label>
            <input type="text" value={form.pricePoint} onChange={(e) => set('pricePoint', e.target.value)} placeholder="e.g., $500K-$1M homes, $300K loans" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>👥 Team Size</label>
            <input type="text" value={form.teamMembers} onChange={(e) => set('teamMembers', e.target.value)} placeholder="How many people work with you, if any?" className={inputClass} />
          </div>
        </Section>

        <Section emoji="🎨" title="Your Brand & Audience" subtitle="This is what shapes the content we create for you.">
          <MultiSelect field="targetAudience" label="Who is your target audience?" />
          <MultiSelect field="brandVoice" label="How would you describe your brand voice?" />
          <MultiSelect field="specialties" label="What are your specialties?" />
          <div>
            <label className={labelClass}>📝 Identity</label>
            <p className={hintClass}>What words would you use to describe yourself? What would your clients say?</p>
            <textarea value={form.identity} onChange={(e) => set('identity', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Client Pain Points *</label>
            <p className={hintClass}>What are the biggest challenges your clients face?</p>
            <textarea value={form.clientPainPoints} onChange={(e) => set('clientPainPoints', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>🚫 Topics to Avoid</label>
            <p className={hintClass}>Anything you never want us to create content about?</p>
            <textarea value={form.topicsToAvoid} onChange={(e) => set('topicsToAvoid', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>✨ Style Inspirations</label>
            <p className={hintClass}>Creators or competitors whose content style you love.</p>
            <textarea value={form.styleInspirations} onChange={(e) => set('styleInspirations', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
        </Section>

        <Section emoji="🎯" title="Goals & Vision" subtitle="Where you're headed — and what's in the way.">
          <div>
            <label className={labelClass}>📝 Vision *</label>
            <p className={hintClass}>What's the 3-5 year vision for your business?</p>
            <textarea value={form.vision} onChange={(e) => set('vision', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Objectives *</label>
            <p className={hintClass}>What are your goals for this quarter and this year? Include deals, revenue, and follower/lead goals if you have them.</p>
            <textarea value={form.objectives} onChange={(e) => set('objectives', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Roadblocks *</label>
            <p className={hintClass}>What are the biggest roadblocks getting in the way of those goals?</p>
            <textarea value={form.roadblocks} onChange={(e) => set('roadblocks', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Dislikes</label>
            <p className={hintClass}>Top 3 things you hate dealing with day-to-day in your business.</p>
            <textarea value={form.dislikes} onChange={(e) => set('dislikes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Success *</label>
            <p className={hintClass}>What does success look like in the next 30, 60, and 90 days? What would make working together a huge win?</p>
            <textarea value={form.successMetrics} onChange={(e) => set('successMetrics', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Win *</label>
            <p className={hintClass}>If there's one urgent, pressing pain we could solve for you right away, what would it be?</p>
            <textarea value={form.win} onChange={(e) => set('win', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Excitement *</label>
            <p className={hintClass}>What are you most excited about?</p>
            <textarea value={form.excitement} onChange={(e) => set('excitement', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
        </Section>

        <Section emoji="⚙️" title="Systems Check" subtitle="Rate each from 1 (needs work) to 5 (dialed in).">
          {RATING_FIELDS.map(f => <Rating key={f.key} field={f.key} label={f.label} />)}
          <div>
            <label className={labelClass}>📝 Anything we should know about your ratings?</label>
            <textarea value={form.ratingNotes} onChange={(e) => set('ratingNotes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
        </Section>

        <Section emoji="🔍" title="About Us" subtitle="Help us understand what brought you here.">
          <div>
            <label className={labelClass}>📝 What made you join Own It Social? *</label>
            <p className={hintClass}>What did you see or hear from us before signing up that made you want to work together?</p>
            <textarea value={form.marketingSource} onChange={(e) => set('marketingSource', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Differentiator</label>
            <p className={hintClass}>What stood out about us compared to other options?</p>
            <textarea value={form.differentiator} onChange={(e) => set('differentiator', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Past Resources</label>
            <p className={hintClass}>Books, podcasts, YouTube channels, or influencers you've followed for marketing advice. Have you worked with an agency before?</p>
            <textarea value={form.pastResources} onChange={(e) => set('pastResources', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>📝 Anything Else?</label>
            <p className={hintClass}>What else should we know about you or your business?</p>
            <textarea value={form.anythingElse} onChange={(e) => set('anythingElse', e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </div>
        </Section>

        {/* Referral section */}
        <div className="bg-zinc-900 text-white rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-lg font-bold mb-2">💸 Get a FREE month of service</h2>
          <p className="text-sm text-zinc-300 mb-4">
            Refer someone you think we can help and you'll get <strong className="text-white">one month of service free</strong> for
            every referral that joins. Just drop their name and best contact — we'll reach out and handle the rest.
          </p>
          <button
            type="button"
            onClick={onOpenReferral}
            className="w-full sm:w-auto bg-white text-zinc-900 px-6 py-3 rounded-xl font-semibold hover:bg-zinc-100 transition flex items-center justify-center gap-2"
          >
            <Gift className="w-4 h-4" />
            👉 Click here to share someone you think we can help
          </button>
          <p className="text-xs text-zinc-400 mt-3">...or hit submit below to finish the form 🙂</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-zinc-900 text-white py-4 rounded-2xl hover:bg-zinc-800 disabled:bg-zinc-300 font-semibold text-lg flex items-center justify-center gap-2 mb-12"
        >
          <Check className="w-5 h-5" />
          {submitting ? 'Submitting...' : 'Submit Onboarding Form'}
        </button>
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
  const [clientTasks, setClientTasks] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  // Dashboard UI state lives here (not in DashboardView) so it survives the
  // re-renders triggered by Firebase real-time listeners.
  const [activePage, setActivePage] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskView, setTaskView] = useState('kanban');
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

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
      unsubscribers.push(listen('clientTasks', setClientTasks));
      unsubscribers.push(listen('taskTemplates', setTaskTemplates));
      unsubscribers.push(listen('projects', setProjects));
      unsubscribers.push(listen('projectTasks', setProjectTasks));
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

  const updateClientTask = async (task, patch) => {
    const updated = { ...task, ...patch };
    if (!db) {
      setClientTasks(prev => prev.map(t => t.id === task.id ? updated : t));
      return;
    }
    try {
      await setDoc(doc(db, 'clientTasks', task.id), updated);
    } catch (e) {
      console.error('Error updating task:', e);
    }
  };

  // Admin: add a task to a client's portal, optionally texting them about it
  const createClientTask = async (client, taskData, notifyBySms) => {
    const task = {
      id: `${client.id}_${Date.now()}`,
      clientId: client.id,
      title: taskData.title.trim(),
      instructions: (taskData.instructions || '').trim(),
      tag: (taskData.tag || '').trim(),
      link: buildTaskLink(taskData.linkPage),
      dueDate: taskData.dueDate || '',
      status: 'todo',
      notes: '',
      order: 100 + clientTasks.filter(t => t.clientId === client.id).length,
      createdAt: new Date().toISOString(),
    };
    if (db) {
      await setDoc(doc(db, 'clientTasks', task.id), task);
    } else {
      setClientTasks(prev => [...prev, task]);
    }
    if (notifyBySms) {
      await sendSMSToClient(
        client,
        `📌 Hi ${client.firstName}, we just added a new task to your portal: "${task.title}"${task.dueDate ? ` (due ${formatDueDate(task.dueDate)})` : ''}. Log in to check it out!`
      );
    }
    return task;
  };

  const deleteClientTask = async (taskId) => {
    if (db) {
      await deleteDoc(doc(db, 'clientTasks', taskId));
    } else {
      setClientTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const saveTaskTemplate = async (template) => {
    const tpl = { id: Date.now().toString(), ...template, createdAt: new Date().toISOString() };
    if (db) {
      await setDoc(doc(db, 'taskTemplates', tpl.id), tpl);
    } else {
      setTaskTemplates(prev => [...prev, tpl]);
    }
  };

  const deleteTaskTemplate = async (templateId) => {
    if (db) {
      await deleteDoc(doc(db, 'taskTemplates', templateId));
    } else {
      setTaskTemplates(prev => prev.filter(t => t.id !== templateId));
    }
  };

  // Seed the default onboarding tasks for a client. Idempotent: deterministic
  // ids + an existence check, so calling it on every login is safe.
  const ensureDefaultClientTasks = async (user) => {
    if (!user || user.parentClientId) return;
    const defaults = buildDefaultClientTasks(user.id);
    if (!db) {
      setClientTasks(prev => prev.some(t => t.clientId === user.id) ? prev : [...prev, ...defaults]);
      return;
    }
    try {
      const marker = await getDoc(doc(db, 'clientTasks', `${user.id}_onboarding_form`));
      if (marker.exists()) return;
      await Promise.all(defaults.map(t => setDoc(doc(db, 'clientTasks', t.id), t)));
    } catch (e) {
      console.error('Error seeding default tasks:', e);
    }
  };

  const handleLogin = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      setView('dashboard');
      saveSession(user, 'dashboard');
      if (!user.onboarded) {
        ensureDefaultClientTasks(user);
      }
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
    setActivePage('tasks');
    setView('dashboard');
    saveSession(newUser, 'dashboard');
    await saveUsers([...users, newUser]);
    await ensureDefaultClientTasks(newUser);
  };

  // Called when the client submits the in-portal onboarding form (opened from
  // the "Complete Your Onboarding Form" task).
  const handleOnboardingFormSubmit = async (answers) => {
    const updatedUser = {
      ...currentUser,
      onboarded: true,
      onboardingAnswers: answers,
      onboardingFormCompletedAt: new Date().toISOString(),
      ...(answers.headshot ? { headshot: answers.headshot } : {})
    };
    setCurrentUser(updatedUser);
    saveSession(updatedUser, 'dashboard');
    await saveUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));

    // Mark the onboarding form task as done
    const formTask = clientTasks.find(t => t.clientId === currentUser.id && t.link?.type === 'onboarding-form');
    if (formTask && formTask.status !== 'done') {
      await updateClientTask(formTask, { status: 'done', completedAt: new Date().toISOString() });
    }

    setShowOnboardingForm(false);
    setActivePage('tasks');
    sendSMS('+17867882699', `📋 ${updatedUser.firstName} ${updatedUser.lastName || ''} (${updatedUser.companyName}) completed their onboarding form!`);
  };

  const handleReferralSubmit = async (referral) => {
    const referralDoc = {
      id: Date.now().toString(),
      referrerId: currentUser?.id || '',
      referrerName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
      referrerCompany: currentUser?.companyName || '',
      ...referral,
      status: 'new',
      createdAt: new Date().toISOString()
    };
    if (db) {
      await setDoc(doc(db, 'referrals', referralDoc.id), referralDoc);
    }
    sendSMS('+17867882699', `🎁 New referral from ${referralDoc.referrerName} (${referralDoc.referrerCompany}): ${referral.name}${referral.phone ? ` • ${referral.phone}` : ''}${referral.email ? ` • ${referral.email}` : ''}${referral.company ? ` • ${referral.company}` : ''}`);
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

  // Helper to parse date string (YYYY-MM-DD) as local date, not UTC
  const parseDateLocal = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // SMS notification helper function. Never throws — returns true/false so
  // callers can report how many messages actually went out.
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
        return false;
      }

      console.log('✅ SMS sent successfully:', result.messageSid);
      return true;
    } catch (error) {
      console.error('❌ Failed to send SMS:', error);
      return false;
    }
  };

  // Send one message to a client and everyone else on their account.
  // Returns { sent, failed, total } counted in phone numbers, not clients.
  const sendSMSToClient = async (client, message) => {
    const recipients = getClientSmsRecipients(client);
    let sent = 0;
    for (const recipient of recipients) {
      const ok = await sendSMS(recipient.phoneNumber, message);
      if (ok) sent++;
    }
    return { sent, failed: recipients.length - sent, total: recipients.length };
  };

  // File upload helper function
  const uploadFileToStorage = async (file, path, onProgress) => {
    if (!storage) {
      throw new Error('Firebase Storage is not configured. Check that NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is set.');
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

  // Uploads a batch of files one after another, reporting combined progress (0-100)
  const uploadFilesToStorage = async (files: any, path: string, onProgress?: (progress: number) => void) => {
    const list = Array.from<File>(files || []);
    if (list.length === 0) return [];

    const totalBytes = list.reduce((sum, f) => sum + (f.size || 0), 0) || 1;
    const transferred = list.map(() => 0);
    const report = () => {
      if (onProgress) onProgress((transferred.reduce((a, b) => a + b, 0) / totalBytes) * 100);
    };

    const uploaded: any[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const url = await uploadFileToStorage(file, path, (progress) => {
        transferred[i] = ((progress || 0) / 100) * (file.size || 0);
        report();
      });
      transferred[i] = file.size || 0;
      report();
      uploaded.push({ url, fileName: file.name, size: file.size || 0, contentType: file.type || '' });
    }
    return uploaded;
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

    const inputClass = "w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm bg-white";
    const labelClass = "block text-xs font-semibold text-zinc-700 mb-1.5";

    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="w-11 h-11 bg-zinc-900 rounded-xl flex items-center justify-center mb-5">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-sm text-zinc-500 mb-6">{isSignup ? 'Join the Own It Social client portal' : 'Sign in to your Own It Social portal'}</p>

          <div className="space-y-4">
            {isSignup && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+1234567890" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
                </div>
              </>
            )}

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} className={`${inputClass} pr-10`} />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button onClick={handleSubmit} className="w-full bg-zinc-900 text-white py-3 rounded-xl hover:bg-zinc-800 transition font-semibold text-sm">{isSignup ? 'Create Account' : 'Sign In'}</button>
          </div>

          <button onClick={() => setIsSignup(!isSignup)} className="w-full mt-4 text-sm text-zinc-600 hover:text-zinc-900 font-medium">
            {isSignup ? 'Already have an account? Sign in' : "New client? Create an account"}
          </button>

          <div className="mt-6 pt-5 border-t border-zinc-100">
            <button onClick={() => setView('admin-login')} className="w-full text-zinc-400 hover:text-zinc-700 text-xs font-medium">Admin Access →</button>
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
    const [teamEmail, setTeamEmail] = useState('');
    const [teamPass, setTeamPass] = useState('');
    const [teamName, setTeamName] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [expandedContentType, setExpandedContentType] = useState(null); // For content review sections
    const [editedAnswers, setEditedAnswers] = useState(currentUser.onboardingAnswers || {});
    const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
    const [selectedMediaFiles, setSelectedMediaFiles] = useState<File[]>([]);
    const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
    const [headshotProgress, setHeadshotProgress] = useState(0);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [logoProgress, setLogoProgress] = useState(0);
    const [contentVideoUploads, setContentVideoUploads] = useState({}); // Track uploads per content item
    const [contentVideoFiles, setContentVideoFiles] = useState({}); // Track selected files (arrays) per content item
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
    const [headerMediaFiles, setHeaderMediaFiles] = useState<File[]>([]);
    const [headerVideoLink, setHeaderVideoLink] = useState('');
    const [headerVideoDescription, setHeaderVideoDescription] = useState('');
    const [headerVideoUploading, setHeaderVideoUploading] = useState(false);
    const [headerVideoProgress, setHeaderVideoProgress] = useState(0);

    useEffect(() => {
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

    const myTasks = clientTasks
      .filter(t => t.clientId === effectiveClientId)
      .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.dueDate || '').localeCompare(b.dueDate || ''));
    const openTasks = myTasks.filter(t => t.status !== 'done');
    const pendingContentCount = clientContent.filter(c => c.status === 'pending').length;
    const onboardingFormTask = myTasks.find(t => t.link?.type === 'onboarding-form');

    const openTaskLink = (task) => {
      setSelectedTaskId(null);
      setMobileNavOpen(false);
      if (task.link?.type === 'onboarding-form') {
        setShowOnboardingForm(true);
      } else if (task.link?.type === 'page' && task.link.page) {
        setActivePage(task.link.page);
      }
    };

    const sidebarNav = [
      { id: 'home', label: 'Home', icon: Home },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: openTasks.length },
      { id: 'content', label: 'Content Review', icon: FileText, badge: pendingContentCount },
      { id: 'social', label: 'Social Media', icon: Share2 },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'crm', label: 'CRM', icon: Users },
      { id: 'ai', label: 'AI Optimization', icon: Sparkles },
      { id: 'ai-generator', label: 'AI Generator', icon: Wand2 },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const pageTitle = sidebarNav.find(n => n.id === activePage)?.label || '';
    const initials = `${(currentUser.firstName || ' ')[0] || ''}${(currentUser.lastName || ' ')[0] || ''}`.trim().toUpperCase() || '?';

    return (
      <div className="min-h-screen bg-zinc-100">
        {/* Mobile nav backdrop */}
        {mobileNavOpen && (
          <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-zinc-200 flex flex-col w-64 transition-all duration-200 ${sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-64'} ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          {/* Brand */}
          <div className={`flex items-center gap-3 px-4 pt-5 pb-4 ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}`}>
            {currentUser.companyLogo ? (
              <img src={currentUser.companyLogo} alt="Logo" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
            ) : (
              <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">Own It Social</p>
                <p className="text-[11px] text-zinc-500 truncate">Client Portal</p>
              </div>
            )}
            <button onClick={() => setMobileNavOpen(false)} className="ml-auto text-zinc-400 hover:text-zinc-600 lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User card */}
          <div className={`flex items-center gap-3 mx-3 mb-4 px-3 py-3 bg-zinc-50 border border-zinc-200 rounded-xl ${sidebarCollapsed ? 'lg:justify-center lg:px-1' : ''}`}>
            {currentUser.headshot ? (
              <img src={currentUser.headshot} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" onError={(e) => e.target.style.display = 'none'} />
            ) : (
              <div className="w-9 h-9 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{initials}</div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{currentUser.firstName} {currentUser.lastName}</p>
                <p className="text-[11px] text-zinc-500 truncate">{currentUser.email}</p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 space-y-1">
            {sidebarNav.map(item => {
              const Icon = item.icon;
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => { setActivePage(item.id); setMobileNavOpen(false); }}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${sidebarCollapsed ? 'lg:justify-center' : ''} ${active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {!sidebarCollapsed && item.badge > 0 && (
                    <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white text-zinc-900' : 'bg-red-500 text-white'}`}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom actions */}
          <div className="px-3 pb-4 pt-3 border-t border-zinc-200 space-y-1">
            <button
              onClick={() => { setShowReferralModal(true); setMobileNavOpen(false); }}
              title="Refer a Friend — get a free month"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
            >
              <Gift className="w-[18px] h-[18px] flex-shrink-0 text-emerald-600" />
              {!sidebarCollapsed && <span>Refer a Friend</span>}
            </button>
            <button
              onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }}
              title="Sign Out"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
            >
              <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
              className={`w-full hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition ${sidebarCollapsed ? 'lg:justify-center' : ''}`}
            >
              {sidebarCollapsed ? <ChevronsRight className="w-[18px] h-[18px] flex-shrink-0" /> : <ChevronsLeft className="w-[18px] h-[18px] flex-shrink-0" />}
              {!sidebarCollapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className={`min-w-0 transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-zinc-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
              <button onClick={() => setMobileNavOpen(true)} className="lg:hidden text-zinc-600 hover:text-zinc-900 p-1">
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-zinc-900">{pageTitle}</h1>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowHeaderVideoModal(true)}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-xl hover:bg-zinc-800 flex items-center gap-2 text-sm font-medium transition"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload Media</span>
                </button>
              </div>
            </div>
          </header>

        {/* Header Video Upload Modal */}
        {showHeaderVideoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  Upload Photos or Video
                </h2>
                <button onClick={() => {
                  setShowHeaderVideoModal(false);
                  setHeaderVideoAttachType('standalone');
                  setHeaderVideoContentId('');
                  setHeaderMediaFiles([]);
                  setHeaderVideoLink('');
                  setHeaderVideoDescription('');
                }} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Is this for a content idea?</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input type="radio" name="videoAttach" value="standalone" checked={headerVideoAttachType === 'standalone'} onChange={() => setHeaderVideoAttachType('standalone')} className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-800">Standalone Upload</p>
                        <p className="text-xs text-gray-500">Not attached to any content idea</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input type="radio" name="videoAttach" value="content" checked={headerVideoAttachType === 'content'} onChange={() => setHeaderVideoAttachType('content')} className="w-4 h-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-800">Attach to Content Idea</p>
                        <p className="text-xs text-gray-500">Link this upload to a specific content piece</p>
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
                  <textarea value={headerVideoDescription} onChange={(e) => setHeaderVideoDescription(e.target.value)} placeholder="Describe the photos or video..." rows={2} className="w-full px-4 py-2 border rounded-lg resize-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Photos or Video</label>
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-400 transition-colors">
                      <input
                        type="file"
                        accept={MEDIA_ACCEPT}
                        multiple
                        disabled={headerVideoUploading}
                        onChange={(e) => {
                          setHeaderMediaFiles(prev => mergeFileSelection(prev, e.target.files));
                          e.target.value = '';
                        }}
                        className="text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-2">Pick one video, or select several photos at once to send a whole collection.</p>
                    </div>
                    {headerMediaFiles.length > 0 && (
                      <div className="border rounded-lg divide-y">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                          <p className="text-xs font-medium text-gray-700">{describeSelection(headerMediaFiles)}</p>
                          <button
                            type="button"
                            onClick={() => setHeaderMediaFiles([])}
                            disabled={headerVideoUploading}
                            className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {headerMediaFiles.map((file, idx) => (
                            <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-2 px-3 py-2">
                              <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                              <button
                                type="button"
                                onClick={() => setHeaderMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                                disabled={headerVideoUploading}
                                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-center text-sm text-gray-400">or</div>
                    <input type="text" value={headerVideoLink} onChange={(e) => setHeaderVideoLink(e.target.value)} placeholder="Paste a link (Google Drive, Dropbox, etc.)" className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                </div>

                {headerVideoUploading && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${headerVideoProgress}%` }}></div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    disabled={headerVideoUploading || (headerMediaFiles.length === 0 && !headerVideoLink)}
                    onClick={async () => {
                      if (headerVideoAttachType === 'content' && !headerVideoContentId) {
                        alert('Please select a content idea to attach this upload to.');
                        return;
                      }

                      setHeaderVideoUploading(true);
                      try {
                        let media: any[] = [];

                        if (headerMediaFiles.length > 0) {
                          if (!storage) {
                            alert('Storage not configured. Please use a link instead.');
                            setHeaderVideoUploading(false);
                            return;
                          }
                          media = await uploadFilesToStorage(
                            headerMediaFiles,
                            'videos',
                            (progress) => setHeaderVideoProgress(Math.round(progress))
                          );
                        }

                        if (media.length === 0 && headerVideoLink) {
                          media = [makeLinkMedia(headerVideoLink)];
                        }

                        const mediaType = summarizeMediaType(media);
                        const mediaSummary = describeMedia(media);
                        const contentItem = headerVideoContentId ? clientContent.find(c => c.id === headerVideoContentId) : null;
                        const videoDoc = {
                          id: Date.now().toString(),
                          clientId: effectiveClientId,
                          contentId: headerVideoContentId || '',
                          contentTitle: contentItem?.title || '',
                          videoLink: media[0]?.url || '',
                          media,
                          fileCount: media.length,
                          mediaType,
                          description: headerVideoDescription,
                          status: 'pending',
                          submittedById: currentUser.id,
                          submittedByName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
                          submittedAt: new Date().toISOString(),
                          uploadedAt: new Date().toISOString(),
                          fileName: headerMediaFiles[0]?.name || ''
                        };

                        if (db) await setDoc(doc(db, 'videos', videoDoc.id), videoDoc);

                        const smsMessage = `📸 New media submitted by ${currentUser.firstName} ${currentUser.lastName} (${currentUser.companyName}) — ${mediaSummary}${contentItem ? ` for content: "${contentItem.title}"` : ''}`;
                        await sendSMS('+17867882699', smsMessage);
                        await sendSMS('+12678976117', smsMessage);

                        await loadUserVideos();
                        alert(mediaType === 'photo' && media.length > 1
                          ? `${media.length} photos uploaded successfully!`
                          : 'Upload successful!');
                        setShowHeaderVideoModal(false);
                        setHeaderVideoAttachType('standalone');
                        setHeaderVideoContentId('');
                        setHeaderMediaFiles([]);
                        setHeaderVideoLink('');
                        setHeaderVideoDescription('');
                      } catch (error) {
                        console.error('Error uploading media:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        alert(`Failed to upload: ${errorMessage}`);
                      } finally {
                        setHeaderVideoUploading(false);
                        setHeaderVideoProgress(0);
                      }
                    }}
                    className="flex-1 bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    {headerVideoUploading
                      ? `Uploading${headerMediaFiles.length > 1 ? ` ${headerMediaFiles.length} files` : ''}... ${headerVideoProgress}%`
                      : headerMediaFiles.length > 1 ? `Upload ${headerMediaFiles.length} Files` : 'Upload'}
                  </button>
                  <button onClick={() => {
                    setShowHeaderVideoModal(false);
                    setHeaderVideoAttachType('standalone');
                    setHeaderVideoContentId('');
                    setHeaderMediaFiles([]);
                    setHeaderVideoLink('');
                    setHeaderVideoDescription('');
                  }} className="flex-1 bg-gray-200 py-3 rounded-lg hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {activePage === 'home' && (
          <>
          <div className="bg-zinc-900 rounded-2xl p-8 mb-6 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/5 rounded-full" />
            <div className="absolute -right-2 top-16 w-24 h-24 bg-white/5 rounded-full" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Welcome back, {currentUser.firstName}! 👋</h2>
            <p className="text-zinc-300">Here's what's happening with your marketing today.</p>
          </div>

          {/* Onboarding form callout */}
          {onboardingFormTask && onboardingFormTask.status !== 'done' && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-zinc-900">Complete your onboarding form</h3>
                <p className="text-sm text-zinc-500">Tell us about your business so we can create content that sounds like you. Takes ~10 minutes.</p>
              </div>
              <button
                onClick={() => setShowOnboardingForm(true)}
                className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-800 text-sm font-semibold flex items-center justify-center gap-2 flex-shrink-0"
              >
                Start Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Open tasks preview */}
          {openTasks.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-zinc-900" />
                  <h3 className="font-bold text-zinc-900">Your Tasks</h3>
                  <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{openTasks.length} open</span>
                </div>
                <button onClick={() => setActivePage('tasks')} className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {openTasks.slice(0, 3).map(task => {
                  const meta = taskStatusMeta(task.status);
                  return (
                    <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className="w-full flex items-center gap-3 px-4 py-3 border border-zinc-100 rounded-xl hover:border-zinc-300 hover:bg-zinc-50 transition text-left">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                      <span className="text-sm font-medium text-zinc-800 truncate flex-1">{task.title}</span>
                      {task.dueDate && <span className="text-xs text-zinc-400 flex-shrink-0">{formatDueDate(task.dueDate)}</span>}
                      <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
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
              <div className="bg-white rounded-2xl p-6 mb-6 border border-zinc-200">
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

          </>
          )}

          {/* ---------------- Tasks ---------------- */}
          {activePage === 'tasks' && (() => {
            const doneCount = myTasks.filter(t => t.status === 'done').length;
            const pct = myTasks.length > 0 ? Math.round((doneCount / myTasks.length) * 100) : 0;

            const TaskCard = (task) => {
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="w-full text-left bg-white border border-zinc-200 rounded-xl p-4 hover:border-zinc-300 hover:shadow-md transition"
                >
                  <p className="font-semibold text-zinc-900 text-sm leading-snug mb-2">{task.title}</p>
                  {task.tag && (
                    <span className="inline-flex items-center text-[11px] font-medium text-zinc-500 border border-zinc-200 rounded-full px-2 py-0.5 mb-2">🏷 {task.tag}</span>
                  )}
                  {task.instructions && (
                    <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{task.instructions}</p>
                  )}
                  {task.dueDate && (
                    <p className="text-xs text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDueDate(task.dueDate)}</p>
                  )}
                </button>
              );
            };

            return (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-6 h-6 text-zinc-900" />
                    <h2 className="text-2xl font-bold text-zinc-900">Your Tasks</h2>
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl p-1">
                    <button
                      onClick={() => setTaskView('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${taskView === 'list' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                    >
                      <List className="w-4 h-4" /> List
                    </button>
                    <button
                      onClick={() => setTaskView('kanban')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${taskView === 'kanban' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                    >
                      <LayoutGrid className="w-4 h-4" /> Kanban
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-600">{doneCount} of {myTasks.length} completed</span>
                    <span className="text-2xl font-bold text-zinc-900">{pct}%</span>
                  </div>
                  <div className="w-full bg-zinc-200 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-zinc-900 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {myTasks.length === 0 ? (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center">
                    <CheckCircle2 className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    <h3 className="font-bold text-zinc-900 mb-1">No tasks yet</h3>
                    <p className="text-sm text-zinc-500">When we have something for you, it'll show up here.</p>
                  </div>
                ) : taskView === 'kanban' ? (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
                    {TASK_STATUSES.map(status => {
                      const Icon = status.icon;
                      const tasks = myTasks.filter(t => t.status === status.id);
                      return (
                        <div key={status.id} className="min-w-0">
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${status.iconClass}`} />
                              <span className="text-sm font-bold text-zinc-900">{status.label}</span>
                            </div>
                            <span className="bg-zinc-200 text-zinc-700 text-xs font-bold px-2 py-0.5 rounded-full">{tasks.length}</span>
                          </div>
                          <div className="space-y-3 bg-zinc-50 border border-zinc-200/60 rounded-2xl p-3 min-h-[120px]">
                            {tasks.length === 0 ? (
                              <p className="text-xs text-zinc-400 text-center py-8">No tasks</p>
                            ) : tasks.map(TaskCard)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100">
                    {[...myTasks].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0)).map(task => {
                      const meta = taskStatusMeta(task.status);
                      const Icon = meta.icon;
                      return (
                        <button key={task.id} onClick={() => setSelectedTaskId(task.id)} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition text-left">
                          <Icon className={`w-5 h-5 flex-shrink-0 ${meta.iconClass}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${task.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>{task.title}</p>
                            {task.tag && <p className="text-xs text-zinc-400 truncate">🏷 {task.tag}</p>}
                          </div>
                          {task.dueDate && <span className="text-xs text-zinc-400 flex-shrink-0">{formatDueDate(task.dueDate)}</span>}
                          <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

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
                      const selectedFiles = contentVideoFiles[item.id] || [];

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
                              <h5 className="font-medium text-gray-800">Upload Photos or Video for This Content</h5>
                            </div>

                            {linkedVideo ? (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800 mb-1">
                                      {describeMedia(getSubmissionMedia(linkedVideo)) || 'Media'} Submitted
                                    </p>
                                    <p className="text-xs text-green-600 mb-2">{linkedVideo.description}</p>
                                    <MediaGallery media={getSubmissionMedia(linkedVideo)} className="mb-2" />
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
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Upload Photos or Video</label>
                                  <input
                                    type="file"
                                    accept={MEDIA_ACCEPT}
                                    multiple
                                    onChange={(e) => {
                                      setContentVideoFiles(prev => ({
                                        ...prev,
                                        [item.id]: mergeFileSelection(prev[item.id] || [], e.target.files)
                                      }));
                                      e.target.value = '';
                                    }}
                                    className="w-full text-sm"
                                    disabled={isUploading}
                                  />
                                  {selectedFiles.length > 0 && (
                                    <div className="border rounded-lg divide-y mt-2 bg-white">
                                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                                        <p className="text-xs font-medium text-gray-700">{describeSelection(selectedFiles)}</p>
                                        <button
                                          type="button"
                                          onClick={() => setContentVideoFiles(prev => ({ ...prev, [item.id]: [] }))}
                                          disabled={isUploading}
                                          className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                                        >
                                          Clear all
                                        </button>
                                      </div>
                                      <div className="max-h-32 overflow-y-auto">
                                        {selectedFiles.map((file, idx) => (
                                          <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-2 px-3 py-1.5">
                                            <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                                            <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                                            <button
                                              type="button"
                                              onClick={() => setContentVideoFiles(prev => ({
                                                ...prev,
                                                [item.id]: (prev[item.id] || []).filter((_, i) => i !== idx)
                                              }))}
                                              disabled={isUploading}
                                              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                              title="Remove"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
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
                                  <label className="block text-xs font-medium text-gray-700 mb-1">Link</label>
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
                                    const files = contentVideoFiles[item.id] || [];
                                    const link = contentVideoLinks[item.id];

                                    if (files.length === 0 && !link?.trim()) {
                                      alert(`${currentUser.firstName}, please add photos or a video file, or provide a link`);
                                      return;
                                    }

                                    setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: true, progress: 0 } }));

                                    try {
                                      let media: any[] = [];

                                      // Upload files if any were selected
                                      if (files.length > 0) {
                                        if (!storage) {
                                          alert(`❌ ${currentUser.firstName}, Firebase Storage is not configured. Please use a link instead.`);
                                          setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                          return;
                                        }

                                        media = await uploadFilesToStorage(
                                          files,
                                          'videos',
                                          (progress) => setContentVideoUploads(prev => ({
                                            ...prev,
                                            [item.id]: { uploading: true, progress }
                                          }))
                                        );
                                      }

                                      if (media.length === 0 && link?.trim()) {
                                        media = [makeLinkMedia(link.trim())];
                                      }

                                      if (media.length > 0) {
                                        const mediaType = summarizeMediaType(media);
                                        const mediaSummary = describeMedia(media);
                                        const newVideo = {
                                          id: Date.now().toString(),
                                          clientId: effectiveClientId,
                                          contentId: item.id, // Link to the content item
                                          contentTitle: item.title, // Store content title for reference
                                          videoLink: media[0].url,
                                          media,
                                          fileCount: media.length,
                                          mediaType,
                                          description: `${mediaType === 'photo' ? 'Photos' : 'Video'} for: ${item.title}`,
                                          status: 'pending',
                                          submittedById: currentUser.id,
                                          submittedByName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
                                          submittedAt: new Date().toISOString(),
                                          fileName: files[0]?.name || null
                                        };

                                        if (!db) {
                                          alert(`⚠️ ${currentUser.firstName}, cloud storage not configured. Upload not saved.`);
                                          setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                          return;
                                        }

                                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                                        // Send SMS notification
                                        const smsMessage = `📸 New media submitted by ${currentUser.firstName} ${currentUser.lastName} (${currentUser.companyName}) — ${mediaSummary} for "${item.title}". Check the admin portal!`;
                                        await sendSMS('+17867882699', smsMessage);
                                        await sendSMS('+12678976117', smsMessage);

                                        // Clear form
                                        setContentVideoFiles(prev => ({ ...prev, [item.id]: [] }));
                                        setContentVideoLinks(prev => ({ ...prev, [item.id]: '' }));
                                        await loadUserVideos();
                                        alert(`✅ ${currentUser.firstName}, your ${mediaSummary} ${media.length === 1 ? 'was' : 'were'} submitted successfully!`);
                                      }
                                    } catch (error) {
                                      console.error('❌ Error submitting media:', error);
                                      alert(`❌ ${currentUser.firstName}, there was an error submitting your files. Please try again.`);
                                    } finally {
                                      setContentVideoUploads(prev => ({ ...prev, [item.id]: { uploading: false, progress: 0 } }));
                                    }
                                  }}
                                  disabled={(selectedFiles.length === 0 && !contentVideoLinks[item.id]?.trim()) || isUploading}
                                  className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
                                >
                                  <Upload className="w-4 h-4" />
                                  {isUploading
                                    ? `Uploading${selectedFiles.length > 1 ? ` ${selectedFiles.length} files` : ''}...`
                                    : selectedFiles.length > 1 ? `Submit ${selectedFiles.length} Files for Editing` : 'Submit for Editing'}
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

                  {/* Media preview */}
                  {selectedEvent.mediaUrl && selectedEvent.mediaType === 'image' && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Media</p>
                      <img
                        src={selectedEvent.mediaUrl}
                        alt="Post media"
                        className="w-full max-h-64 object-cover rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(selectedEvent.mediaUrl); }}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">Click image to view full size</p>
                    </div>
                  )}
                  {selectedEvent.mediaUrl && selectedEvent.mediaType === 'video' && (
                    <div>
                      <p className="text-sm text-gray-500 font-medium mb-1">Media</p>
                      <video src={selectedEvent.mediaUrl} className="w-full max-h-64 rounded-lg border" controls />
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500 font-medium mb-1">Description</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                  </div>

                  {/* Full content text */}
                  {(() => {
                    const fullItem = selectedEvent.contentId ? clientContent.find(c => c.id === selectedEvent.contentId) : null;
                    if (!fullItem?.content) return null;
                    return (
                      <div>
                        <p className="text-sm text-gray-500 font-medium mb-1">Content</p>
                        <div className="bg-gray-50 rounded-lg border p-4 max-h-64 overflow-y-auto">
                          <RichTextDisplay content={fullItem.content} className="text-sm text-gray-700" />
                        </div>
                      </div>
                    );
                  })()}
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

          {/* Image lightbox */}
          {lightboxUrl && (
            <div
              className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4 cursor-zoom-out"
              onClick={() => setLightboxUrl(null)}
            >
              <button
                className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/40 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
                onClick={() => setLightboxUrl(null)}
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={lightboxUrl}
                alt="Full size"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
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
                  <h4 className="font-semibold">Upload Photos & Videos</h4>
                </div>
                <p className="text-sm text-gray-600 mb-6">Send us a video or a batch of photos for editing, without attaching them to specific content</p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photos or Video</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-purple-400 transition-colors">
                      <input
                        type="file"
                        accept={MEDIA_ACCEPT}
                        multiple
                        onChange={(e) => {
                          setSelectedMediaFiles(prev => mergeFileSelection(prev, e.target.files));
                          e.target.value = '';
                        }}
                        className="text-sm"
                        disabled={uploadingVideo}
                      />
                      <p className="text-xs text-gray-500 mt-2">Select as many photos as you like — they'll be submitted together.</p>
                    </div>
                    {selectedMediaFiles.length > 0 && (
                      <div className="border rounded-lg divide-y mt-2">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                          <p className="text-xs font-medium text-gray-700">{describeSelection(selectedMediaFiles)}</p>
                          <button
                            type="button"
                            onClick={() => setSelectedMediaFiles([])}
                            disabled={uploadingVideo}
                            className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Clear all
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {selectedMediaFiles.map((file, idx) => (
                            <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-2 px-3 py-2">
                              <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                              <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                                disabled={uploadingVideo}
                                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Describe your photos or video, or what you'd like done with them..."
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
                    if (selectedMediaFiles.length === 0 && !videoLink?.trim()) {
                      alert(`${currentUser.firstName}, please add photos or a video file, or provide a link`);
                      return;
                    }

                    setUploadingVideo(true);
                    setUploadProgress(0);

                    try {
                      let media: any[] = [];

                      // Upload files if any were selected
                      if (selectedMediaFiles.length > 0) {
                        if (!storage) {
                          alert(`❌ ${currentUser.firstName}, Firebase Storage is not configured. Please use a link instead.`);
                          setUploadingVideo(false);
                          return;
                        }

                        media = await uploadFilesToStorage(
                          selectedMediaFiles,
                          'videos',
                          (progress) => setUploadProgress(progress)
                        );
                      }

                      if (media.length === 0 && videoLink?.trim()) {
                        media = [makeLinkMedia(videoLink.trim())];
                      }

                      if (media.length > 0) {
                        const mediaType = summarizeMediaType(media);
                        const mediaSummary = describeMedia(media);
                        const newVideo = {
                          id: Date.now().toString(),
                          clientId: effectiveClientId,
                          videoLink: media[0].url,
                          media,
                          fileCount: media.length,
                          mediaType,
                          description: videoDescription || 'No description provided',
                          status: 'pending',
                          submittedById: currentUser.id,
                          submittedByName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
                          submittedAt: new Date().toISOString(),
                          fileName: selectedMediaFiles[0]?.name || null
                        };

                        if (!db) {
                          alert(`⚠️ ${currentUser.firstName}, cloud storage not configured. Upload not saved.`);
                          setUploadingVideo(false);
                          return;
                        }

                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                        // Send SMS notification
                        const smsMessage = `New media uploaded by ${currentUser.firstName} ${currentUser.lastName} (${currentUser.companyName}) — ${mediaSummary}. Description: ${videoDescription || 'None'}. Check the admin portal!`;
                        await sendSMS('+17867882699', smsMessage);
                        await sendSMS('+12678976117', smsMessage);

                        // Clear form
                        setSelectedMediaFiles([]);
                        setVideoLink('');
                        setVideoDescription('');
                        await loadUserVideos();
                        alert(`✅ ${currentUser.firstName}, your ${mediaSummary} ${media.length === 1 ? 'was' : 'were'} submitted successfully!`);
                      }
                    } catch (error) {
                      console.error('Error submitting media:', error);
                      alert(`❌ ${currentUser.firstName}, there was an error submitting your files. Please try again.`);
                    } finally {
                      setUploadingVideo(false);
                      setUploadProgress(0);
                    }
                  }}
                  disabled={(selectedMediaFiles.length === 0 && !videoLink?.trim()) || uploadingVideo}
                  className="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  {uploadingVideo
                    ? `Uploading${selectedMediaFiles.length > 1 ? ` ${selectedMediaFiles.length} files` : ''}...`
                    : selectedMediaFiles.length > 1 ? `Submit ${selectedMediaFiles.length} Files for Editing` : 'Submit for Editing'}
                </button>

                {/* Previously Uploaded Videos */}
                {userVideos.filter(v => !v.contentId).length > 0 && (
                  <div className="mt-8 border-t pt-6">
                    <h5 className="font-medium text-gray-800 mb-4">Your Uploads</h5>
                    <div className="space-y-3">
                      {userVideos.filter(v => !v.contentId).map(video => (
                        <div key={video.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{video.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Submitted {new Date(video.submittedAt).toLocaleDateString()}
                              {describeMedia(getSubmissionMedia(video)) && ` • ${describeMedia(getSubmissionMedia(video))}`}
                            </p>
                            <MediaGallery media={getSubmissionMedia(video)} className="mt-2" />
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
        </main>

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
        </div>
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
    const [activeTab, setActiveTabState] = useState(() => getStoredFilter('activeTab', 'today') as string);
    // Tasks tab state
    const emptyTaskForm = { title: '', instructions: '', tag: '', dueDate: '', linkPage: '' };
    const [taskClientId, setTaskClientId] = useState('');
    const [taskForm, setTaskForm] = useState(emptyTaskForm);
    const [taskNotifySms, setTaskNotifySms] = useState(true);
    const [savingTask, setSavingTask] = useState(false);
    const [clientTagFilter, setClientTagFilter] = useState('all');
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
    const [scheduledContentOpen, setScheduledContentOpen] = useState(false);
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

    // Schedule modal media state
    const [scheduleMediaUrl, setScheduleMediaUrl] = useState('');
    const [scheduleMediaType, setScheduleMediaType] = useState<'image' | 'video' | ''>('');
    const [scheduleMediaUploadProgress, setScheduleMediaUploadProgress] = useState<number | null>(null);

    // Edit existing event media state
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [editMediaUrl, setEditMediaUrl] = useState('');
    const [editMediaType, setEditMediaType] = useState<'image' | 'video' | ''>('');
    const [editMediaUploadProgress, setEditMediaUploadProgress] = useState<number | null>(null);

    // Drag and drop state
    const [draggedContent, setDraggedContent] = useState(null);
    const [dragOverDate, setDragOverDate] = useState(null);

    // Admin video attachment state
    const [attachVideoModal, setAttachVideoModal] = useState<{
      isOpen: boolean;
      event: any;
      contentItem: any;
    }>({ isOpen: false, event: null, contentItem: null });
    const [adminMediaFiles, setAdminMediaFiles] = useState<File[]>([]);
    const [adminVideoLink, setAdminVideoLink] = useState('');
    const [adminVideoUploading, setAdminVideoUploading] = useState(false);
    const [adminVideoProgress, setAdminVideoProgress] = useState(0);

    // SMS state variables
    const [smsSelectedClients, setSmsSelectedClients] = useState([]);
    const [smsTemplate, setSmsTemplate] = useState('');
    const [smsCustomMessage, setSmsCustomMessage] = useState('');
    const [smsSending, setSmsSending] = useState(false);
    const [sendingDailyTexts, setSendingDailyTexts] = useState(false);

    // "Additional text recipients" form on the client details modal
    const [newRecipientName, setNewRecipientName] = useState('');
    const [newRecipientPhone, setNewRecipientPhone] = useState('');
    const [savingRecipient, setSavingRecipient] = useState(false);

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

    // Projects state
    const [selectedProject, setSelectedProject] = useState(null);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    const emptyProjectForm = { name: '', description: '', clientId: '', status: 'not_started', priority: 'medium', startDate: '', dueDate: '' };
    const [projectForm, setProjectForm] = useState(emptyProjectForm);
    const [showProjectTaskForm, setShowProjectTaskForm] = useState(false);
    const emptyProjectTaskForm = { title: '', description: '', assignee: '', status: 'todo', priority: 'medium', dueDate: '' };
    const [projectTaskForm, setProjectTaskForm] = useState(emptyProjectTaskForm);
    const [editingProjectTask, setEditingProjectTask] = useState(null);
    const [projectStatusFilter, setProjectStatusFilterState] = useState(() => getStoredFilter('projectStatusFilter', 'all') as string);
    const setProjectStatusFilter = (f: string) => { setProjectStatusFilterState(f); setStoredFilter('projectStatusFilter', f); };
    const [projectClientFilter, setProjectClientFilterState] = useState(() => getStoredFilter('projectClientFilter', 'all') as string);
    const setProjectClientFilter = (f: string) => { setProjectClientFilterState(f); setStoredFilter('projectClientFilter', f); };
    const [projectPriorityFilter, setProjectPriorityFilterState] = useState(() => getStoredFilter('projectPriorityFilter', 'all') as string);
    const setProjectPriorityFilter = (f: string) => { setProjectPriorityFilterState(f); setStoredFilter('projectPriorityFilter', f); };
    const [savingProject, setSavingProject] = useState(false);
    const [savingProjectTask, setSavingProjectTask] = useState(false);

    const openProjectForm = (project = null) => {
      if (project) {
        setEditingProject(project);
        setProjectForm({ name: project.name || '', description: project.description || '', clientId: project.clientId || '', status: project.status || 'not_started', priority: project.priority || 'medium', startDate: project.startDate || '', dueDate: project.dueDate || '' });
      } else {
        setEditingProject(null);
        setProjectForm(emptyProjectForm);
      }
      setShowProjectForm(true);
    };

    const saveProject = async () => {
      if (!db || !projectForm.name.trim()) return;
      setSavingProject(true);
      try {
        const now = new Date().toISOString();
        if (editingProject) {
          await updateDoc(doc(db, 'projects', editingProject.id), { ...projectForm, updatedAt: now });
          if (selectedProject?.id === editingProject.id) setSelectedProject({ ...selectedProject, ...projectForm, updatedAt: now });
          await logAdminActivity('Updated project', `Updated project "${projectForm.name}"`, { projectId: editingProject.id });
        } else {
          const projectId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(db, 'projects', projectId), { id: projectId, ...projectForm, createdAt: now, updatedAt: now });
          await logAdminActivity('Created project', `Created project "${projectForm.name}"`, { projectId });
        }
        setShowProjectForm(false);
        setEditingProject(null);
        setProjectForm(emptyProjectForm);
      } catch (e) { console.error('Error saving project:', e); }
      setSavingProject(false);
    };

    const deleteProject = async (projectId, projectName) => {
      if (!db || !confirm(`Delete "${projectName}"? All tasks in this project will also be deleted.`)) return;
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        const tasksToDelete = projectTasks.filter(t => t.projectId === projectId);
        for (const task of tasksToDelete) await deleteDoc(doc(db, 'projectTasks', task.id));
        if (selectedProject?.id === projectId) setSelectedProject(null);
        await logAdminActivity('Deleted project', `Deleted project "${projectName}" and ${tasksToDelete.length} tasks`, { projectId });
      } catch (e) { console.error('Error deleting project:', e); }
    };

    const openProjectTaskForm = (task = null) => {
      if (task) {
        setEditingProjectTask(task);
        setProjectTaskForm({ title: task.title || '', description: task.description || '', assignee: task.assignee || '', status: task.status || 'todo', priority: task.priority || 'medium', dueDate: task.dueDate || '' });
      } else {
        setEditingProjectTask(null);
        setProjectTaskForm(emptyProjectTaskForm);
      }
      setShowProjectTaskForm(true);
    };

    const saveProjectTask = async (projectId) => {
      if (!db || !projectTaskForm.title.trim()) return;
      setSavingProjectTask(true);
      try {
        const now = new Date().toISOString();
        if (editingProjectTask) {
          const updates = { ...projectTaskForm, updatedAt: now };
          if (projectTaskForm.status === 'done' && editingProjectTask.status !== 'done') updates.completedAt = now;
          if (projectTaskForm.status !== 'done') updates.completedAt = null;
          await updateDoc(doc(db, 'projectTasks', editingProjectTask.id), updates);
          await logAdminActivity('Updated project task', `Updated task "${projectTaskForm.title}"`, { taskId: editingProjectTask.id, projectId });
        } else {
          const taskId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const taskCount = projectTasks.filter(t => t.projectId === projectId).length;
          await setDoc(doc(db, 'projectTasks', taskId), { id: taskId, projectId, ...projectTaskForm, order: taskCount, createdAt: now, updatedAt: now, completedAt: null });
          await logAdminActivity('Created project task', `Created task "${projectTaskForm.title}"`, { taskId, projectId });
        }
        setShowProjectTaskForm(false);
        setEditingProjectTask(null);
        setProjectTaskForm(emptyProjectTaskForm);
      } catch (e) { console.error('Error saving project task:', e); }
      setSavingProjectTask(false);
    };

    const deleteProjectTask = async (taskId, taskTitle) => {
      if (!db || !confirm(`Delete task "${taskTitle}"?`)) return;
      try {
        await deleteDoc(doc(db, 'projectTasks', taskId));
        await logAdminActivity('Deleted project task', `Deleted task "${taskTitle}"`, { taskId });
      } catch (e) { console.error('Error deleting project task:', e); }
    };

    const updateProjectTaskStatus = async (taskId, newStatus) => {
      if (!db) return;
      try {
        const now = new Date().toISOString();
        const updates: any = { status: newStatus, updatedAt: now };
        if (newStatus === 'done') updates.completedAt = now;
        else updates.completedAt = null;
        await updateDoc(doc(db, 'projectTasks', taskId), updates);
      } catch (e) { console.error('Error updating task status:', e); }
    };

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

    // Additional people (besides the primary contact) who should get this
    // client's portal texts. Stored on the client's user doc.
    const saveAdditionalRecipients = async (client, recipients) => {
      const updatedUser = { ...client, additionalSmsRecipients: recipients };
      setSelectedUser(updatedUser);
      await saveUsers(users.map(u => u.id === client.id ? updatedUser : u), [client.id]);
    };

    const handleAddSmsRecipient = async (client) => {
      const phone = newRecipientPhone.trim();
      if (phone.replace(/\D/g, '').length < 10) {
        alert('Please enter a valid 10-digit phone number.');
        return;
      }

      const phoneNumber = formatPhoneE164(phone);
      const existing = client.additionalSmsRecipients || [];
      const alreadyListed = getClientSmsRecipients(client).some(r => r.phoneNumber === phoneNumber);
      if (alreadyListed) {
        alert('That number is already receiving this client\'s texts.');
        return;
      }

      setSavingRecipient(true);
      try {
        await saveAdditionalRecipients(client, [
          ...existing,
          { id: Date.now().toString(), name: newRecipientName.trim(), phoneNumber },
        ]);
        setNewRecipientName('');
        setNewRecipientPhone('');
      } catch (e) {
        console.error('Error adding text recipient:', e);
        alert('❌ Failed to add recipient. Please try again.');
      } finally {
        setSavingRecipient(false);
      }
    };

    // Opt an already-known number (team member, onboarding form) into the
    // client's texts by copying it into the additional recipients list.
    const handleAddLinkedNumberToTexts = async (client, entry) => {
      try {
        await saveAdditionalRecipients(client, [
          ...(client.additionalSmsRecipients || []),
          { id: Date.now().toString(), name: entry.name, phoneNumber: entry.phoneNumber },
        ]);
      } catch (e) {
        console.error('Error adding text recipient:', e);
        alert('❌ Failed to add recipient. Please try again.');
      }
    };

    const handleRemoveSmsRecipient = async (client, recipientId) => {
      try {
        await saveAdditionalRecipients(
          client,
          (client.additionalSmsRecipients || []).filter(r => r.id !== recipientId)
        );
      } catch (e) {
        console.error('Error removing text recipient:', e);
        alert('❌ Failed to remove recipient. Please try again.');
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
      let numberCount = 0;
      let skippedCount = 0;

      try {
        for (const clientId of smsSelectedClients) {
          const client = users.find(u => u.id === clientId);
          if (!client) continue;
          // Goes to the client plus any additional recipients on their account.
          const result = await sendSMSToClient(client, message);
          if (result.total === 0) {
            console.warn(`⏭️ Skipping ${client.companyName} - no phone numbers on file`);
            skippedCount++;
          } else if (result.sent > 0) {
            successCount++;
            numberCount += result.sent;
            console.log(`✅ SMS sent to ${client.companyName} (${result.sent} number${result.sent > 1 ? 's' : ''})`);
          } else {
            console.error(`❌ Failed to send SMS to ${client.companyName}`);
            errorCount++;
          }
        }

        alert(`✅ SMS sent successfully to ${successCount} client${successCount !== 1 ? 's' : ''} (${numberCount} phone number${numberCount !== 1 ? 's' : ''})!${errorCount > 0 ? `\n⚠️ Failed to send to ${errorCount} client${errorCount > 1 ? 's' : ''}` : ''}${skippedCount > 0 ? `\n⚠️ Skipped ${skippedCount} client${skippedCount > 1 ? 's' : ''} with no phone number on file` : ''}`);

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
      const eligibleUsers = users.filter(u => !u.parentClientId && u.receiveDailyTexts && getClientSmsRecipients(u).length > 0);

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

          const result = await sendSMSToClient(user, message);
          if (result.sent > 0) sent++;
          else failed++;
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
      <div className="min-h-screen bg-gray-50">

        {/* Sticky header with tab navigation */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                {currentUser.companyLogo && (
                  <img src={currentUser.companyLogo} alt="Logo" className="h-10 w-auto object-contain" onError={(e) => e.target.style.display = 'none'} />
                )}
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-xs text-gray-400">{currentUser?.name || currentUser?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={async () => {
                    if (!confirm('Check for pending content and send reminder texts to clients who need them?')) return;
                    try {
                      const response = await fetch('/api/check-reminders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ users, content })
                      });
                      const result = await response.json();
                      if (response.ok) {
                        alert(`✅ Reminders sent: ${result.remindersSent}\n\nDetails:\n${result.details.map(d => `- ${d.companyName}: ${d.reminderType} reminder for "${d.contentTitle}"`).join('\n')}`);
                        const modifiedItems = [];
                        result.details.forEach(detail => {
                          const existingItem = content.find(c => c.id === detail.contentId);
                          if (existingItem) modifiedItems.push({ ...existingItem, reminders: [...(existingItem.reminders || []), { type: detail.reminderType, sentAt: detail.sentAt }] });
                        });
                        if (modifiedItems.length > 0) await saveContentItems(modifiedItems);
                      } else {
                        alert(`❌ Error: ${result.error}`);
                      }
                    } catch (error) {
                      console.error('❌ Error checking reminders:', error);
                      alert('Failed to check reminders. See console for details.');
                    }
                  }}
                  className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 text-sm"
                >
                  <Clock className="w-4 h-4" />Reminders
                </button>
                <button
                  onClick={handleAIGenerateContent}
                  disabled={isGeneratingAI}
                  className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 text-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />{isGeneratingAI ? 'Generating...' : 'AI Content'}
                </button>
                <button
                  onClick={handleSendDailyTexts}
                  disabled={sendingDailyTexts}
                  className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 text-sm disabled:opacity-50"
                >
                  <Bell className="w-4 h-4" />{sendingDailyTexts ? 'Sending...' : 'Daily Texts'}
                </button>
                <button onClick={() => setShowForm(true)} className="ml-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium">
                  <Upload className="w-4 h-4" />Upload
                </button>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                <button onClick={() => { setCurrentUser(null); setView('login'); clearSession(); }} className="text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 text-sm">
                  Logout
                </button>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex items-center overflow-x-auto">
              {(['today', 'clients', 'tasks', 'calendar', 'projects', 'videos', 'sms', 'more'] as const).map(tabId => {
                const badge = tabId === 'today' ? calendarEvents.filter(e => e.date === formatDateLocal(new Date())).length
                  : tabId === 'clients' ? users.filter(u => !u.parentClientId).length
                  : tabId === 'tasks' ? clientTasks.filter(t => t.status === 'under_review').length
                  : tabId === 'projects' ? projects.filter(p => p.status === 'in_progress').length
                  : tabId === 'videos' ? videos.filter(v => v.status !== 'completed').length
                  : 0;
                const label = { today: 'Today', clients: 'Clients', tasks: 'Tasks', calendar: 'Calendar', projects: 'Projects', videos: 'Media', sms: 'SMS', more: 'More' }[tabId];
                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tabId
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
                    }`}
                  >
                    {label}
                    {badge > 0 && (
                      <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === tabId ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-5 overflow-x-auto text-sm">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-gray-800">{users.filter(u => !u.parentClientId).length}</span>
              <span className="text-gray-400">Clients</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-amber-500">{content.filter(c => c.status === 'pending').length}</span>
              <span className="text-gray-400">Pending</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-green-600">{content.filter(c => c.status === 'approved').length}</span>
              <span className="text-gray-400">Approved</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-purple-600">{videos.filter(v => v.status === 'pending').length}</span>
              <span className="text-gray-400">Videos Pending</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-blue-600">{calendarEvents.filter(e => e.date === formatDateLocal(new Date())).length}</span>
              <span className="text-gray-400">Today's Posts</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-teal-600">{users.filter(u => !u.parentClientId && u.approvalGroup === 'auto-approve').length}</span>
              <span className="text-gray-400">Auto-Approve</span>
            </div>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-base font-bold text-indigo-600">{projects.length}</span>
              <span className="text-gray-400">Projects</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {activeTab === 'today' && (
          <div className="space-y-6">

          {/* Today's Scheduled Content */}
          {(() => {
            const today = formatDateLocal(new Date());
            const todaysEvents = calendarEvents.filter(event => event.date === today);
            const completedCount = todaysEvents.filter(e => e.completed).length;
            if (todaysEvents.length === 0) return null;
            return (
              <div className="bg-white border border-gray-200 rounded-lg mb-6">
                <button
                  onClick={() => setScheduledContentOpen(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold text-gray-800">Today's Scheduled Content</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${completedCount === todaysEvents.length ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {completedCount}/{todaysEvents.length}{completedCount === todaysEvents.length ? ' — All Done!' : ''}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${scheduledContentOpen ? 'rotate-180' : ''}`} />
                </button>
                {scheduledContentOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
                      {todaysEvents.map(event => {
                        const client = users.find(u => u.id === event.clientId);
                        const linkedContent = content.find(c => c.id === event.contentId);
                        const isCompleted = event.completed || false;
                        return (
                          <div
                            key={event.id}
                            className={`rounded-lg p-4 border transition-all ${
                              isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleContentCompletion(event.id, isCompleted, event.title, client?.companyName);
                                }}
                                className={`mt-0.5 flex-shrink-0 transition-colors ${isCompleted ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-blue-600'}`}
                              >
                                {isCompleted ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                              </button>
                              <div className="flex-1 cursor-pointer" onClick={() => setSelectedTodayContent({ event, client, linkedContent })}>
                                <div className="flex items-start justify-between mb-1.5">
                                  <h4 className={`font-semibold text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{event.title}</h4>
                                  <span className={`ml-2 flex-shrink-0 px-1.5 py-0.5 rounded text-xs ${
                                    event.type === 'social' ? 'bg-blue-100 text-blue-700' :
                                    event.type === 'email' ? 'bg-green-100 text-green-700' :
                                    event.type === 'blog' ? 'bg-purple-100 text-purple-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>{event.type}</span>
                                </div>
                                <p className={`text-xs ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>{client?.companyName || 'Unknown Client'}</p>
                                {event.description && (
                                  <p className={`text-xs line-clamp-2 mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>{event.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
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

          </div>
          )}

          {/* ===== CLIENTS TAB ===== */}
          {activeTab === 'clients' && (
          <div>
              <div className="mb-6 flex items-center gap-4 flex-wrap">
                <label className="text-sm font-medium text-gray-700">Filter by Group:</label>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                >
                  <option value="all">All Clients</option>
                  <option value="ungrouped">Ungrouped</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                {(() => {
                  const allTags = [...new Set(users.filter(u => !u.parentClientId).flatMap(u => u.tags || []))].sort();
                  if (allTags.length === 0 && clientTagFilter === 'all') return null;
                  return (
                    <>
                      <label className="text-sm font-medium text-gray-700">Tag:</label>
                      <select
                        value={clientTagFilter}
                        onChange={(e) => setClientTagFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="all">All Tags</option>
                        {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                      </select>
                    </>
                  );
                })()}
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {users.filter(u => {
                  if (u.parentClientId) return false;
                  if (clientTagFilter !== 'all' && !(u.tags || []).includes(clientTagFilter)) return false;
                  if (groupFilter === 'all') return true;
                  if (groupFilter === 'ungrouped') return !u.groupId;
                  return u.groupId === groupFilter;
                }).map(user => {
                  const userContent = content.filter(c => c.clientId === user.id);
                  const teamMembers = users.filter(u => u.parentClientId === user.id);
                  const userGroup = groups.find(g => g.id === user.groupId);
                  return (
                    <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{user.firstName} {user.lastName || ''} – {user.companyName}</h3>
                          <p className="text-sm text-gray-500">{user.email}</p>
                          {teamMembers.length > 0 && <p className="text-xs text-gray-400 mt-0.5">{teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                          {userGroup && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">{userGroup.name}</span>}
                          <span className={`px-2 py-0.5 text-xs rounded-full ${user.approvalGroup === 'auto-approve' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {user.approvalGroup === 'auto-approve' ? 'Auto-Approve' : 'Review Required'}
                          </span>
                        </div>
                      </div>
                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        {(user.tags || []).map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs rounded-full">
                            🏷 {tag}
                            <button
                              onClick={async () => {
                                const updated = { ...user, tags: (user.tags || []).filter(t => t !== tag) };
                                await saveUsers(users.map(u => u.id === user.id ? updated : u), [user.id]);
                              }}
                              className="text-blue-400 hover:text-red-500"
                              title="Remove tag"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <button
                          onClick={async () => {
                            const tag = prompt('Add a tag (e.g., "VIP", "Onboarding", "Realtor"):');
                            const clean = tag?.trim();
                            if (!clean) return;
                            if ((user.tags || []).some(t => t.toLowerCase() === clean.toLowerCase())) {
                              alert('This client already has that tag.');
                              return;
                            }
                            const updated = { ...user, tags: [...(user.tags || []), clean] };
                            await saveUsers(users.map(u => u.id === user.id ? updated : u), [user.id]);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 rounded-full transition"
                        >
                          <Plus className="w-3 h-3" /> Tag
                        </button>
                      </div>
                      <div className="flex gap-3 mb-3">
                        <div className="flex-1 bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-amber-700">{userContent.filter(c => c.status === 'pending').length}</p>
                          <p className="text-xs text-amber-600">Pending</p>
                        </div>
                        <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                          <p className="text-xl font-bold text-green-700">{userContent.filter(c => c.status === 'approved').length}</p>
                          <p className="text-xs text-green-600">Approved</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUser(user)} className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition text-sm flex items-center justify-center gap-2">
                        <Eye className="w-4 h-4" />View Details
                      </button>
                    </div>
                  );
                })}
              </div>

              {content.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h3 className="text-base font-semibold text-gray-800">All Content</h3>
                    <div className="flex gap-3 flex-wrap">
                      <select
                        value={contentClientFilter}
                        onChange={(e) => setContentClientFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="all">All Clients</option>
                        {users.map(user => (
                          <option key={user.id} value={user.id}>{user.firstName} {user.lastName || ''} – {user.companyName}</option>
                        ))}
                      </select>
                      <select
                        value={contentTypeFilter}
                        onChange={(e) => setContentTypeFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      >
                        <option value="all">All Types</option>
                        <option value="social">Social Media</option>
                        <option value="blog">Blog Posts</option>
                        <option value="email">Email Campaigns</option>
                        <option value="landing-page">Landing Pages</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {content
                      .filter(item => contentTypeFilter === 'all' || item.type === contentTypeFilter)
                      .filter(item => contentClientFilter === 'all' || item.clientId === contentClientFilter)
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(item => {
                      const client = users.find(u => u.id === item.clientId);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200"
                          onClick={() => setContentDetailItem(item)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800 truncate">{item.title}</p>
                            <p className="text-xs text-gray-500">{client?.firstName} {client?.lastName || ''} – {client?.companyName} · {item.type}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${item.status === 'pending' ? 'bg-amber-100 text-amber-700' : item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.status}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${item.title}"? This cannot be undone.`)) {
                                if (db) await deleteDoc(doc(db, 'content', item.id));
                                else setContent(content.filter(c => c.id !== item.id));
                              }
                            }}
                            className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          {item.feedback && <div className="mt-1 px-2 py-1 bg-blue-50 rounded text-xs text-blue-600">Feedback: {item.feedback}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </div>
          )}

          {/* ===== CALENDAR TAB ===== */}
          {activeTab === 'tasks' && (() => {
            const clients = users.filter(u => !u.parentClientId);
            const selectedClient = clients.find(c => c.id === taskClientId);
            const selectedClientTasks = clientTasks
              .filter(t => t.clientId === taskClientId)
              .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.dueDate || '').localeCompare(b.dueDate || ''));
            const allTemplates = [
              ...BUILT_IN_TASK_TEMPLATES,
              ...taskTemplates.map(t => ({ ...t, isCustom: true })),
            ];

            const applyTemplate = (tpl) => {
              setTaskForm({
                title: tpl.title || '',
                instructions: tpl.instructions || '',
                tag: tpl.tag || '',
                linkPage: tpl.linkPage || '',
                dueDate: daysFromNow(tpl.dueInDays || 7),
              });
            };

            const handleAddTask = async () => {
              if (!selectedClient) { alert('Select a client first.'); return; }
              if (!taskForm.title.trim()) { alert('Task title is required.'); return; }
              setSavingTask(true);
              try {
                await createClientTask(selectedClient, taskForm, taskNotifySms);
                setTaskForm(emptyTaskForm);
                const notified = taskNotifySms ? getClientSmsRecipients(selectedClient).length : 0;
                alert(`✅ Task added to ${selectedClient.companyName}'s portal${notified > 0 ? ` — text notification sent to ${notified} number${notified > 1 ? 's' : ''}.` : '.'}`);
              } catch (e) {
                console.error('Error adding task:', e);
                alert('❌ Failed to add task. Please try again.');
              } finally {
                setSavingTask(false);
              }
            };

            return (
              <div className="space-y-6">
                {/* Client selector */}
                <div className="bg-white border border-gray-200 rounded-lg p-5">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Client</label>
                  <select
                    value={taskClientId}
                    onChange={(e) => setTaskClientId(e.target.value)}
                    className="w-full max-w-md px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName} ({c.firstName} {c.lastName || ''})</option>
                    ))}
                  </select>
                </div>

                {selectedClient && (
                  <div className="grid lg:grid-cols-2 gap-6 items-start">
                    {/* Add task form */}
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <PlusCircle className="w-5 h-5 text-blue-600" />
                        <h3 className="font-bold text-gray-800">Add Task for {selectedClient.companyName}</h3>
                      </div>

                      {/* Templates */}
                      <div className="mb-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Start from a template</p>
                        <div className="flex flex-wrap gap-2">
                          {allTemplates.map(tpl => (
                            <span key={tpl.id} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full text-sm hover:border-blue-400 transition">
                              <button onClick={() => applyTemplate(tpl)} className="pl-3 pr-1 py-1.5 text-gray-700 hover:text-blue-700 font-medium">
                                {tpl.title}
                              </button>
                              {tpl.isCustom ? (
                                <button
                                  onClick={() => { if (confirm(`Delete template "${tpl.title}"?`)) deleteTaskTemplate(tpl.id); }}
                                  className="pr-2 text-gray-400 hover:text-red-500"
                                  title="Delete template"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : <span className="pr-3" />}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                          <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g., Upload a new video" className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                          <textarea value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} rows={3} placeholder="What should the client do?" className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                            <input type="text" value={taskForm.tag} onChange={(e) => setTaskForm({ ...taskForm, tag: e.target.value })} placeholder="e.g., Content" className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                            <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Link to</label>
                            <select value={taskForm.linkPage} onChange={(e) => setTaskForm({ ...taskForm, linkPage: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                              {TASK_LINK_PAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                          </div>
                        </div>

                        <label className="flex items-center gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg cursor-pointer">
                          <input type="checkbox" checked={taskNotifySms} onChange={(e) => setTaskNotifySms(e.target.checked)} className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">
                            📱 Text {selectedClient.firstName} about this task
                            {(() => {
                              const recipientCount = getClientSmsRecipients(selectedClient).length;
                              if (recipientCount === 0) return <span className="text-red-500 font-medium"> (no phone number on file)</span>;
                              if (recipientCount > 1) return <span className="text-gray-500"> and {recipientCount - 1} other recipient{recipientCount > 2 ? 's' : ''} on the account</span>;
                              return null;
                            })()}
                          </span>
                        </label>

                        <div className="flex gap-3">
                          <button onClick={handleAddTask} disabled={savingTask || !taskForm.title.trim()} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" />{savingTask ? 'Adding...' : 'Add Task'}
                          </button>
                          <button
                            onClick={async () => {
                              if (!taskForm.title.trim()) { alert('Fill in the task first, then save it as a template.'); return; }
                              await saveTaskTemplate({ title: taskForm.title.trim(), instructions: taskForm.instructions.trim(), tag: taskForm.tag.trim(), linkPage: taskForm.linkPage, dueInDays: 7 });
                              alert('✅ Template saved!');
                            }}
                            disabled={!taskForm.title.trim()}
                            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
                            title="Save this task as a reusable template"
                          >
                            Save as Template
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Client's current tasks */}
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <ListChecks className="w-5 h-5 text-gray-700" />
                        <h3 className="font-bold text-gray-800">{selectedClient.companyName}'s Tasks</h3>
                        <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{selectedClientTasks.length}</span>
                      </div>
                      {selectedClientTasks.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6 text-center">No tasks yet for this client.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedClientTasks.map(task => {
                            const meta = taskStatusMeta(task.status);
                            return (
                              <div key={task.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:border-gray-200">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</p>
                                  <p className="text-xs text-gray-400 truncate">
                                    {task.dueDate ? `Due ${formatDueDate(task.dueDate)}` : 'No due date'}
                                    {task.notes ? ` • 📝 ${task.notes}` : ''}
                                  </p>
                                </div>
                                <select
                                  value={task.status}
                                  onChange={(e) => updateClientTask(task, { status: e.target.value, completedAt: e.target.value === 'done' ? new Date().toISOString() : null })}
                                  className="text-xs border rounded-lg px-2 py-1.5 outline-none flex-shrink-0"
                                >
                                  {TASK_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                                <button
                                  onClick={() => { if (confirm(`Delete task "${task.title}"?`)) deleteClientTask(task.id); }}
                                  className="text-gray-300 hover:text-red-500 flex-shrink-0"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                                  <button
                                    className="truncate flex-1 text-left hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingEvent(event);
                                      setEditMediaUrl(event.mediaUrl || '');
                                      setEditMediaType(event.mediaType || '');
                                    }}
                                  >
                                    {event.mediaUrl && <span className="mr-1">🖼</span>}
                                    {event.title}
                                  </button>
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

          {/* ===== PROJECTS TAB ===== */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              {selectedProject ? (() => {
                const proj = projects.find(p => p.id === selectedProject.id) || selectedProject;
                const tasks = projectTasks.filter(t => t.projectId === proj.id).sort((a, b) => (a.order || 0) - (b.order || 0));
                const completedTasks = tasks.filter(t => t.status === 'done').length;
                const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
                const client = users.find(u => u.id === proj.clientId);
                const statusMeta = projectStatusMeta(proj.status);
                const priorityMeta = projectPriorityMeta(proj.priority);

                return (
                  <div>
                    {/* Back button */}
                    <button onClick={() => setSelectedProject(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                      Back to Projects
                    </button>

                    {/* Project header */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-bold text-gray-800">{proj.name}</h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityMeta.bgClass}`}>{priorityMeta.label}</span>
                          </div>
                          {proj.description && <p className="text-sm text-gray-600 mb-3">{proj.description}</p>}
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {client && (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-4 h-4" />
                                <span>{client.companyName || client.email}</span>
                              </div>
                            )}
                            {proj.startDate && (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                <span>Start: {formatDueDate(proj.startDate)}</span>
                              </div>
                            )}
                            {proj.dueDate && (
                              <div className="flex items-center gap-1.5">
                                <Flag className="w-4 h-4" />
                                <span>Due: {formatDueDate(proj.dueDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openProjectForm(proj)} className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteProject(proj.id, proj.name)} className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">Progress</span>
                          <span className="text-sm text-gray-500">{completedTasks}/{tasks.length} tasks ({progress}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Tasks section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <ListChecks className="w-5 h-5 text-blue-600" />
                          <h3 className="text-base font-semibold text-gray-800">Tasks</h3>
                          <span className="text-sm text-gray-400">({tasks.length})</span>
                        </div>
                        <button onClick={() => openProjectTaskForm()} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium">
                          <Plus className="w-4 h-4" />
                          Add Task
                        </button>
                      </div>

                      {/* Task status summary */}
                      {tasks.length > 0 && (
                        <div className="grid grid-cols-4 gap-3 mb-5">
                          {TASK_STATUSES.map(s => {
                            const count = tasks.filter(t => t.status === s.id).length;
                            return (
                              <div key={s.id} className="bg-gray-50 rounded-lg p-3 text-center">
                                <div className={`text-lg font-bold ${s.iconClass}`}>{count}</div>
                                <div className="text-xs text-gray-500">{s.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Task list */}
                      {tasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-40" />
                          <p className="text-sm">No tasks yet. Add a task to get started.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map(task => {
                            const tMeta = taskStatusMeta(task.status);
                            const tPriority = projectPriorityMeta(task.priority);
                            const TIcon = tMeta.icon;
                            return (
                              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-colors group">
                                <button
                                  onClick={() => {
                                    const statusOrder = ['todo', 'in_progress', 'under_review', 'done'];
                                    const currentIdx = statusOrder.indexOf(task.status);
                                    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
                                    updateProjectTaskStatus(task.id, nextStatus);
                                  }}
                                  className={`flex-shrink-0 ${tMeta.iconClass} hover:opacity-70 transition`}
                                  title={`Status: ${tMeta.label} (click to advance)`}
                                >
                                  <TIcon className="w-5 h-5" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tPriority.bgClass}`}>{tPriority.label}</span>
                                  </div>
                                  {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>}
                                  <div className="flex items-center gap-3 mt-1">
                                    {task.assignee && (
                                      <span className="text-xs text-gray-400 flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {(() => { const a = adminUsers.find(au => au.id === task.assignee); return a ? a.name || a.email : 'Unassigned'; })()}
                                      </span>
                                    )}
                                    {task.dueDate && (
                                      <span className={`text-xs flex items-center gap-1 ${task.status !== 'done' && task.dueDate < new Date().toISOString().split('T')[0] ? 'text-red-500' : 'text-gray-400'}`}>
                                        <Clock className="w-3 h-3" />
                                        {formatDueDate(task.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openProjectTaskForm(task)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => deleteProjectTask(task.id, task.title)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Project Task Form Modal */}
                    {showProjectTaskForm && (
                      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectTaskForm(false)}>
                        <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
                          <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800">{editingProjectTask ? 'Edit Task' : 'New Task'}</h3>
                          </div>
                          <div className="p-6 space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                              <input value={projectTaskForm.title} onChange={e => setProjectTaskForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Task title" />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <textarea value={projectTaskForm.description} onChange={e => setProjectTaskForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="Task details..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select value={projectTaskForm.status} onChange={e => setProjectTaskForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                  {TASK_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select value={projectTaskForm.priority} onChange={e => setProjectTaskForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                  {PROJECT_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
                                <select value={projectTaskForm.assignee} onChange={e => setProjectTaskForm(f => ({ ...f, assignee: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                                  <option value="">Unassigned</option>
                                  {adminUsers.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                <input type="date" value={projectTaskForm.dueDate} onChange={e => setProjectTaskForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                              </div>
                            </div>
                          </div>
                          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button onClick={() => setShowProjectTaskForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                            <button onClick={() => saveProjectTask(proj.id)} disabled={!projectTaskForm.title.trim() || savingProjectTask} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              {savingProjectTask ? 'Saving...' : editingProjectTask ? 'Update Task' : 'Add Task'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div>
                  {/* Project list header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-5 h-5 text-indigo-600" />
                      <h2 className="text-lg font-bold text-gray-800">Projects</h2>
                      <span className="text-sm text-gray-400">({projects.length})</span>
                    </div>
                    <button onClick={() => openProjectForm()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium">
                      <Plus className="w-4 h-4" />
                      New Project
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <select value={projectStatusFilter} onChange={e => setProjectStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                      <option value="all">All Statuses</option>
                      {PROJECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <select value={projectClientFilter} onChange={e => setProjectClientFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                      <option value="all">All Clients</option>
                      {users.filter(u => !u.parentClientId).map(u => <option key={u.id} value={u.id}>{u.companyName || u.email}</option>)}
                    </select>
                    <select value={projectPriorityFilter} onChange={e => setProjectPriorityFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                      <option value="all">All Priorities</option>
                      {PROJECT_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>

                  {/* Status overview cards */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {PROJECT_STATUSES.map(s => {
                      const count = projects.filter(p => p.status === s.id).length;
                      const SIcon = s.icon;
                      return (
                        <button key={s.id} onClick={() => setProjectStatusFilter(projectStatusFilter === s.id ? 'all' : s.id)} className={`rounded-lg p-4 text-center border transition-colors ${projectStatusFilter === s.id ? 'border-blue-300 bg-blue-50/50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                          <SIcon className={`w-5 h-5 mx-auto mb-1 ${s.iconClass}`} />
                          <div className="text-lg font-bold text-gray-800">{count}</div>
                          <div className="text-xs text-gray-500">{s.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Project cards */}
                  {(() => {
                    let filtered = projects;
                    if (projectStatusFilter !== 'all') filtered = filtered.filter(p => p.status === projectStatusFilter);
                    if (projectClientFilter !== 'all') filtered = filtered.filter(p => p.clientId === projectClientFilter);
                    if (projectPriorityFilter !== 'all') filtered = filtered.filter(p => p.priority === projectPriorityFilter);
                    filtered = filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

                    if (filtered.length === 0) return (
                      <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-gray-200">
                        <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No projects found</p>
                        <p className="text-xs mt-1">{projects.length === 0 ? 'Create your first project to get started.' : 'Try adjusting your filters.'}</p>
                      </div>
                    );

                    return (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map(proj => {
                          const tasks = projectTasks.filter(t => t.projectId === proj.id);
                          const completedTasks = tasks.filter(t => t.status === 'done').length;
                          const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
                          const client = users.find(u => u.id === proj.clientId);
                          const sMeta = projectStatusMeta(proj.status);
                          const pMeta = projectPriorityMeta(proj.priority);
                          const isOverdue = proj.dueDate && proj.status !== 'completed' && proj.dueDate < new Date().toISOString().split('T')[0];

                          return (
                            <div key={proj.id} onClick={() => setSelectedProject(proj)} className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group">
                              <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">{proj.name}</h3>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sMeta.badgeClass}`}>{sMeta.label}</span>
                                </div>
                              </div>
                              {proj.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{proj.description}</p>}
                              <div className="space-y-3">
                                {client && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>{client.companyName || client.email}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pMeta.bgClass}`}>{pMeta.label}</span>
                                  {proj.dueDate && (
                                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                                      <Clock className="w-3 h-3" />
                                      {isOverdue && <AlertCircle className="w-3 h-3" />}
                                      {formatDueDate(proj.dueDate)}
                                    </span>
                                  )}
                                </div>
                                {/* Progress */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-400">{completedTasks}/{tasks.length} tasks</span>
                                    <span className="text-xs text-gray-400">{progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Create/Edit Project Modal */}
              {showProjectForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectForm(false)}>
                  <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-bold text-gray-800">{editingProject ? 'Edit Project' : 'New Project'}</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                        <input value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="e.g. Website Redesign" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="Project details..." />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                        <select value={projectForm.clientId} onChange={e => setProjectForm(f => ({ ...f, clientId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                          <option value="">No client assigned</option>
                          {users.filter(u => !u.parentClientId).map(u => <option key={u.id} value={u.id}>{u.companyName || u.email}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select value={projectForm.status} onChange={e => setProjectForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            {PROJECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                          <select value={projectForm.priority} onChange={e => setProjectForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
                            {PROJECT_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                          <input type="date" value={projectForm.startDate} onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                          <input type="date" value={projectForm.dueDate} onChange={e => setProjectForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                      <button onClick={() => setShowProjectForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                      <button onClick={saveProject} disabled={!projectForm.name.trim() || savingProject} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {savingProject ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== VIDEOS TAB ===== */}
          {activeTab === 'videos' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Video className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-semibold text-gray-800">Media Production Queue</h3>
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{videos.filter(v => v.status !== 'completed').length} pending</span>
              </div>
              {videos.length === 0 ? (
                <div className="text-center py-12">
                  <Video className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No media submitted yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {videos
                    .sort((a, b) => {
                      const statusOrder = { 'pending': 1, 'in-progress': 2, 'completed': 3 };
                      return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
                    })
                    .map(video => {
                    const submissionMedia = getSubmissionMedia(video);
                    const client = users.find(u => u.id === video.clientId);
                    const submitter = video.submittedById ? users.find(u => u.id === video.submittedById) : null;
                    const contactName = (
                      video.submittedByName ||
                      `${submitter?.firstName || ''} ${submitter?.lastName || ''}`.trim() ||
                      `${client?.firstName || ''} ${client?.lastName || ''}`.trim()
                    );
                    return (
                      <div key={video.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {client?.companyName || 'Unknown Company'}
                              {contactName && <span className="ml-2 font-normal text-gray-500">— {contactName}</span>}
                            </p>
                            {video.contentTitle && (
                              <p className="text-sm text-purple-600">For: {video.contentTitle}</p>
                            )}
                            <p className="text-xs text-gray-400">Submitted {new Date(video.submittedAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            video.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            video.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>{video.status}</span>
                        </div>
                        {video.description && <p className="text-sm text-gray-600 mb-3">{video.description}</p>}
                        {submissionMedia.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              {describeMedia(submissionMedia) || 'Raw file'} submitted
                            </p>
                            <MediaGallery media={submissionMedia} className="mb-2" />
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {submissionMedia.map((m, idx) => (
                                <a
                                  key={`${m.url}-${idx}`}
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {m.fileName || (submissionMedia.length > 1 ? `File ${idx + 1}` : 'View raw file')}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => updateVideoStatus(video.id, 'in-progress')} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Mark In Progress</button>
                          <button onClick={() => {
                            const link = prompt('Enter completed video link:');
                            if (link) updateVideoStatus(video.id, 'completed', link);
                          }} className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Mark Complete</button>
                        </div>
                        {video.completedLink && (
                          <div className="mt-3 p-3 bg-green-50 rounded-lg">
                            <p className="text-xs font-medium text-green-700 mb-1">Completed Video:</p>
                            <a href={video.completedLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline text-sm">{video.completedLink}</a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== SMS TAB ===== */}
          {activeTab === 'sms' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <h3 className="text-base font-semibold text-gray-800">Send SMS</h3>
                </div>
                <p className="text-sm text-gray-500 mb-5">Select clients and a template to send SMS notifications manually.</p>

                {/* Client Selection */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Clients ({smsSelectedClients.length} selected)</label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    <label className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsSelectedClients.length === users.filter(u => !u.parentClientId).length}
                        onChange={(e) => {
                          if (e.target.checked) setSmsSelectedClients(users.filter(u => !u.parentClientId).map(u => u.id));
                          else setSmsSelectedClients([]);
                        }}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="font-medium text-sm text-gray-800">Select All</span>
                    </label>
                    <div className="border-t pt-1">
                      {users.filter(u => !u.parentClientId).map(user => (
                        <label key={user.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={smsSelectedClients.includes(user.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSmsSelectedClients([...smsSelectedClients, user.id]);
                              else setSmsSelectedClients(smsSelectedClients.filter(id => id !== user.id));
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-800">{user.companyName}</p>
                            <p className="text-xs text-gray-500">
                              {user.firstName} {user.lastName} · {user.phoneNumber}
                              {(user.additionalSmsRecipients || []).length > 0 && (
                                <span className="ml-1 text-green-700 font-medium">
                                  +{user.additionalSmsRecipients.length} more
                                </span>
                              )}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Template */}
                <div className="mb-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select
                    value={smsTemplate}
                    onChange={(e) => { setSmsTemplate(e.target.value); if (e.target.value !== 'custom') setSmsCustomMessage(''); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="">-- Select a template --</option>
                    {Object.entries(smsTemplates).map(([key, template]) => <option key={key} value={key}>{template.name}</option>)}
                  </select>
                </div>

                {smsTemplate && (
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{smsTemplate === 'custom' ? 'Your Message' : 'Message Preview'}</label>
                    {smsTemplate === 'custom' ? (
                      <textarea
                        value={smsCustomMessage}
                        onChange={(e) => setSmsCustomMessage(e.target.value)}
                        placeholder="Enter your custom message..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        rows={6}
                      />
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{smsTemplates[smsTemplate]?.message}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{(smsTemplate === 'custom' ? smsCustomMessage : smsTemplates[smsTemplate]?.message || '').length} chars</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSendManualSMS}
                    disabled={smsSending || smsSelectedClients.length === 0 || !smsTemplate}
                    className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {smsSending ? 'Sending...' : `Send to ${smsSelectedClients.length} client${smsSelectedClients.length !== 1 ? 's' : ''}`}
                  </button>
                  <button onClick={() => { setSmsSelectedClients([]); setSmsTemplate(''); setSmsCustomMessage(''); }} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== MORE TAB (Groups + Activity + Team) ===== */}
          {activeTab === 'more' && (
            <div className="space-y-6">

              {/* Groups */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Groups</h3>
                  <button
                    onClick={async () => {
                      const groupName = prompt('Enter group name:');
                      if (groupName && groupName.trim()) {
                        const newGroup = { id: Date.now().toString(), name: groupName.trim(), createdAt: new Date().toISOString() };
                        await saveGroups([...groups, newGroup]);
                      }
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <UserPlus className="w-4 h-4" />Create Group
                  </button>
                </div>
                {groups.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">No groups yet. Create one to organize clients.</p>
                ) : (
                  <div className="space-y-3">
                    {groups.map(group => {
                      const groupUsers = users.filter(u => u.groupId === group.id && !u.parentClientId);
                      return (
                        <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-800">{group.name}</h4>
                              <p className="text-xs text-gray-500">{groupUsers.length} client{groupUsers.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={async () => { const n = prompt('New name:', group.name); if (n && n.trim() && n !== group.name) await saveGroups(groups.map(g => g.id === group.id ? { ...g, name: n.trim() } : g)); }} className="text-sm text-blue-600 hover:underline">Rename</button>
                              <button onClick={async () => { if (confirm(`Delete "${group.name}"?`)) { await saveUsers(users.map(u => u.groupId === group.id ? { ...u, groupId: null } : u)); if (db) await deleteDoc(doc(db, 'groups', group.id)); else setGroups(groups.filter(g => g.id !== group.id)); } }} className="text-sm text-red-500 hover:underline">Delete</button>
                            </div>
                          </div>
                          {groupUsers.length > 0 && (
                            <div className="space-y-1.5">
                              {groupUsers.map(user => (
                                <div key={user.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                  <span>{user.firstName} {user.lastName} – {user.companyName}</span>
                                  <button onClick={async () => { await saveUsers(users.map(u => u.id === user.id ? { ...u, groupId: null } : u)); }} className="text-red-500 text-xs hover:underline">Remove</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {users.filter(u => !u.parentClientId).length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Assign Clients to Groups</h4>
                    <div className="space-y-2">
                      {users.filter(u => !u.parentClientId).map(user => (
                        <div key={user.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{user.firstName} {user.lastName} – {user.companyName}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                          <select
                            value={user.groupId || ''}
                            onChange={async (e) => { const newGroupId = e.target.value || null; await saveUsers(users.map(u => u.id === user.id ? { ...u, groupId: newGroupId } : u)); }}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">No Group</option>
                            {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Activity Log */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Activity Log</h3>
                {adminActivities.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Clock className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">No activity recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...adminActivities]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .slice(0, 100)
                      .map(activity => {
                        const activityDate = new Date(activity.timestamp);
                        const isActivityToday = formatDateLocal(activityDate) === formatDateLocal(new Date());
                        const isYesterday = formatDateLocal(activityDate) === formatDateLocal(new Date(Date.now() - 86400000));
                        return (
                          <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.action === 'content_completed' ? 'bg-green-100 text-green-600' : activity.action === 'daily_task_completed' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                              {activity.action === 'content_completed' ? <Check className="w-4 h-4" /> : activity.action === 'daily_task_completed' ? <CheckSquare className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-gray-800">{activity.adminName}</span>
                                <span className="text-xs text-gray-400">{isActivityToday ? 'Today' : isYesterday ? 'Yesterday' : activityDate.toLocaleDateString()} at {activityDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-sm text-gray-600">{activity.details}</p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {adminActivities.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Team Summary (Last 7 Days)</h4>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(() => {
                        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
                        const recentActivities = adminActivities.filter(a => new Date(a.timestamp) >= sevenDaysAgo);
                        const byAdmin = recentActivities.reduce((acc, activity) => {
                          if (!acc[activity.adminId]) acc[activity.adminId] = { name: activity.adminName, contentCompleted: 0, tasksCompleted: 0, total: 0 };
                          acc[activity.adminId].total++;
                          if (activity.action === 'content_completed') acc[activity.adminId].contentCompleted++;
                          if (activity.action === 'daily_task_completed') acc[activity.adminId].tasksCompleted++;
                          return acc;
                        }, {});
                        const adminStats = Object.values(byAdmin);
                        if (!adminStats.length) return <p className="text-sm text-gray-400 col-span-full">No activity in the last 7 days</p>;
                        return adminStats.map((admin: any) => (
                          <div key={admin.name} className="bg-gray-50 rounded-lg p-3">
                            <h5 className="font-medium text-sm text-gray-800 mb-2">{admin.name}</h5>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-gray-500">Content</span><span className="font-medium text-green-600">{admin.contentCompleted}</span></div>
                              <div className="flex justify-between"><span className="text-gray-500">Tasks</span><span className="font-medium text-amber-600">{admin.tasksCompleted}</span></div>
                              <div className="flex justify-between pt-1 border-t"><span className="text-gray-600 font-medium">Total</span><span className="font-bold">{admin.total}</span></div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Team */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4">Team</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{currentUser?.name || currentUser?.email}</p>
                      <p className="text-xs text-gray-500">{currentUser?.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {adminUsers.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">No team members yet</p>
                    </div>
                  ) : (
                    adminUsers.map(admin => (
                      <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                            {admin.name?.charAt(0) || admin.email?.charAt(0) || 'A'}
                          </div>
                          <div>
                            <p className="font-medium text-sm text-gray-800">{admin.name}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                          {admin.isOwner && <span className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">Owner</span>}
                          {admin.id === currentUser?.id && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">You</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Joined {new Date(admin.createdAt).toLocaleDateString()}</span>
                          {admin.id !== currentUser?.id && !admin.isOwner && (
                            <button onClick={async () => { if (confirm(`Remove ${admin.name}?`)) { if (db) await deleteDoc(doc(db, 'adminUsers', admin.id)); } }} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-900 text-sm mb-1">Adding New Team Members</h4>
                  <p className="text-xs text-amber-700 mb-1">Have them visit admin login and click "Need to create an account? Enter setup code".</p>
                  <p className="text-xs text-amber-700"><strong>Setup Code:</strong> <code className="bg-amber-100 px-1.5 py-0.5 rounded">SETUP2024</code></p>
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
                <h2 className="text-xl font-bold">Attach Media to Content</h2>
                <button
                  onClick={() => {
                    setAttachVideoModal({ isOpen: false, event: null, contentItem: null });
                    setAdminMediaFiles([]);
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photos or Video</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      accept={MEDIA_ACCEPT}
                      multiple
                      disabled={adminVideoUploading}
                      onChange={(e) => {
                        setAdminMediaFiles(prev => mergeFileSelection(prev, e.target.files));
                        e.target.value = '';
                      }}
                      className="w-full text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">Attach one video or a batch of photos.</p>
                  </div>
                  {adminMediaFiles.length > 0 && (
                    <div className="border rounded-lg divide-y mt-2">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                        <p className="text-xs font-medium text-gray-700">{describeSelection(adminMediaFiles)}</p>
                        <button
                          type="button"
                          onClick={() => setAdminMediaFiles([])}
                          disabled={adminVideoUploading}
                          className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {adminMediaFiles.map((file, idx) => (
                          <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-2 px-3 py-2">
                            <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                            <button
                              type="button"
                              onClick={() => setAdminMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                              disabled={adminVideoUploading}
                              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="text-gray-500 text-sm">OR</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>

                {/* Link Option */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Media Link</label>
                  <input
                    type="text"
                    value={adminVideoLink}
                    onChange={(e) => setAdminVideoLink(e.target.value)}
                    placeholder="Google Drive, Dropbox, or direct media link"
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
                    if (adminMediaFiles.length === 0 && !adminVideoLink.trim()) {
                      alert('Please add photos or a video file, or provide a link');
                      return;
                    }

                    setAdminVideoUploading(true);
                    setAdminVideoProgress(0);

                    try {
                      let media: any[] = [];

                      // If files are selected, upload them to Firebase Storage
                      if (adminMediaFiles.length > 0) {
                        if (!storage) {
                          alert('❌ Firebase Storage is not configured.');
                          setAdminVideoUploading(false);
                          return;
                        }

                        media = await uploadFilesToStorage(
                          adminMediaFiles,
                          'videos',
                          (progress) => setAdminVideoProgress(progress)
                        );
                      }

                      if (media.length === 0 && adminVideoLink.trim()) {
                        media = [makeLinkMedia(adminVideoLink.trim())];
                      }

                      if (media.length > 0) {
                        const mediaType = summarizeMediaType(media);
                        const newVideo = {
                          id: Date.now().toString(),
                          clientId: attachVideoModal.event.clientId,
                          contentId: attachVideoModal.event.contentId,
                          contentTitle: attachVideoModal.event.title,
                          videoLink: media[0].url,
                          media,
                          fileCount: media.length,
                          mediaType,
                          description: `${mediaType === 'photo' ? 'Photos' : 'Video'} for: ${attachVideoModal.event.title}`,
                          status: 'pending',
                          submittedAt: new Date().toISOString(),
                          fileName: adminMediaFiles[0]?.name || null,
                          uploadedByAdmin: true
                        };

                        if (!db) {
                          alert('⚠️ Database not configured.');
                          setAdminVideoUploading(false);
                          return;
                        }

                        await setDoc(doc(db, 'videos', newVideo.id), newVideo);

                        // Log admin activity
                        await logAdminActivity('video_attached', `Attached ${describeMedia(media) || 'media'} to "${attachVideoModal.event.title}"`, {
                          contentId: attachVideoModal.event.contentId,
                          clientId: attachVideoModal.event.clientId
                        });

                        // Reset and close modal
                        setAdminMediaFiles([]);
                        setAdminVideoLink('');
                        setAttachVideoModal({ isOpen: false, event: null, contentItem: null });
                        alert(`${describeMedia(media) || 'Media'} attached successfully!`);
                      }
                    } catch (error) {
                      console.error('❌ Error attaching media:', error);
                      alert('Error attaching media. Please try again.');
                    } finally {
                      setAdminVideoUploading(false);
                      setAdminVideoProgress(0);
                    }
                  }}
                  disabled={(adminMediaFiles.length === 0 && !adminVideoLink.trim()) || adminVideoUploading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {adminVideoUploading ? (
                    <>Uploading{adminMediaFiles.length > 1 ? ` ${adminMediaFiles.length} files` : ''}...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {adminMediaFiles.length > 1 ? `Attach ${adminMediaFiles.length} Files` : 'Attach Media'}
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
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="p-6 border-b flex-shrink-0">
                <h2 className="text-2xl font-bold">Schedule Content</h2>
              </div>
              <div className="overflow-y-auto flex-1 p-6">

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

                  {/* Media Attachment */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Media Attachment (optional)
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-gray-600">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const isVideo = file.type.startsWith('video/');
                              if (!storage) {
                                alert('Firebase Storage is not configured. Please paste an image or video URL in the field below instead.');
                                e.target.value = '';
                                return;
                              }
                              try {
                                setScheduleMediaUploadProgress(0);
                                const url = await uploadFileToStorage(file, 'schedule-media', (p) => setScheduleMediaUploadProgress(p));
                                setScheduleMediaUrl(url);
                                setScheduleMediaType(isVideo ? 'video' : 'image');
                                setScheduleMediaUploadProgress(null);
                              } catch (err) {
                                alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}\n\nPlease paste an image or video URL in the field below instead.`);
                                setScheduleMediaUploadProgress(null);
                                e.target.value = '';
                              }
                            }}
                          />
                          {scheduleMediaUploadProgress !== null
                            ? `Uploading… ${Math.round(scheduleMediaUploadProgress)}%`
                            : 'Upload photo or video'}
                        </label>
                      </div>
                      <input
                        type="url"
                        placeholder="Or paste an image / video URL"
                        value={scheduleMediaUrl}
                        onChange={(e) => {
                          const url = e.target.value;
                          setScheduleMediaUrl(url);
                          if (!url) { setScheduleMediaType(''); return; }
                          const lower = url.toLowerCase();
                          if (lower.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/)) setScheduleMediaType('video');
                          else setScheduleMediaType('image');
                        }}
                        className="w-full px-3 py-2 border rounded text-sm"
                      />
                      {scheduleMediaUrl && scheduleMediaType === 'image' && (
                        <div className="relative">
                          <img src={scheduleMediaUrl} alt="Preview" className="w-full max-h-40 object-cover rounded border" />
                          <button onClick={() => { setScheduleMediaUrl(''); setScheduleMediaType(''); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                        </div>
                      )}
                      {scheduleMediaUrl && scheduleMediaType === 'video' && (
                        <div className="relative">
                          <video src={scheduleMediaUrl} className="w-full max-h-40 rounded border" controls />
                          <button onClick={() => { setScheduleMediaUrl(''); setScheduleMediaType(''); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                        </div>
                      )}
                    </div>
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
                            createdAt: new Date().toISOString(),
                            ...(scheduleMediaUrl ? { mediaUrl: scheduleMediaUrl, mediaType: scheduleMediaType } : {})
                          });
                        }

                        await saveCalendarEvents([...calendarEvents, ...newEvents]);

                        setShowScheduleModal(false);
                        setSelectedContent(null);
                        setSelectedDate(null);
                        setRecurrence('none');
                        setRecurrenceCount(4);
                        setScheduleMediaUrl('');
                        setScheduleMediaType('');
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
                        setScheduleMediaUrl('');
                        setScheduleMediaType('');
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
          </div>
        )}

        {/* Edit scheduled event media modal */}
        {editingEvent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{editingEvent.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(editingEvent.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {' · '}
                    <span className={`font-medium ${editingEvent.type === 'social' ? 'text-blue-600' : editingEvent.type === 'email' ? 'text-green-600' : 'text-purple-600'}`}>{editingEvent.type}</span>
                  </p>
                </div>
                <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600 ml-4"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">Media Attachment</label>

                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm text-gray-600">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const isVideo = file.type.startsWith('video/');
                      if (!storage) {
                        alert('Firebase Storage is not configured. Please paste a URL instead.');
                        e.target.value = '';
                        return;
                      }
                      try {
                        setEditMediaUploadProgress(0);
                        const url = await uploadFileToStorage(file, 'schedule-media', (p) => setEditMediaUploadProgress(p));
                        setEditMediaUrl(url);
                        setEditMediaType(isVideo ? 'video' : 'image');
                        setEditMediaUploadProgress(null);
                      } catch (err) {
                        alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
                        setEditMediaUploadProgress(null);
                        e.target.value = '';
                      }
                    }}
                  />
                  {editMediaUploadProgress !== null ? `Uploading… ${Math.round(editMediaUploadProgress)}%` : 'Upload photo or video'}
                </label>

                <input
                  type="url"
                  placeholder="Or paste an image / video URL"
                  value={editMediaUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setEditMediaUrl(url);
                    if (!url) { setEditMediaType(''); return; }
                    const lower = url.toLowerCase();
                    if (lower.match(/\.(mp4|mov|webm|avi|mkv)(\?|$)/)) setEditMediaType('video');
                    else setEditMediaType('image');
                  }}
                  className="w-full px-3 py-2 border rounded text-sm"
                />

                {editMediaUrl && editMediaType === 'image' && (
                  <div className="relative">
                    <img src={editMediaUrl} alt="Preview" className="w-full max-h-48 object-cover rounded-lg border" />
                    <button onClick={() => { setEditMediaUrl(''); setEditMediaType(''); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">×</button>
                  </div>
                )}
                {editMediaUrl && editMediaType === 'video' && (
                  <div className="relative">
                    <video src={editMediaUrl} className="w-full max-h-48 rounded-lg border" controls />
                    <button onClick={() => { setEditMediaUrl(''); setEditMediaType(''); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">×</button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={async () => {
                    const updated = { ...editingEvent, mediaUrl: editMediaUrl || null, mediaType: editMediaType || null };
                    if (db) {
                      await updateDoc(doc(db, 'calendarEvents', editingEvent.id), {
                        mediaUrl: editMediaUrl || null,
                        mediaType: editMediaType || null
                      });
                    } else {
                      await saveCalendarEvents(calendarEvents.map(ev => ev.id === editingEvent.id ? updated : ev));
                    }
                    setEditingEvent(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 bg-gray-200 py-2.5 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
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

                {/* Phone Numbers / Text Message Recipients */}
                {(() => {
                  const teamMembers = users.filter(u => u.parentClientId === selectedUser.id);
                  const linkedNumbers = getClientPhoneNumbers(selectedUser, teamMembers);
                  const textedCount = linkedNumbers.filter(n => n.receivesTexts).length;

                  return (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    Phone Numbers
                    <span className="text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                      {linkedNumbers.length} on file · {textedCount} texted
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Every number linked to {selectedUser.companyName}. The ones marked <span className="font-medium text-green-700">Gets texts</span> receive every text we send this client from the portal.
                  </p>

                  <div className="space-y-2 mb-4">
                    {linkedNumbers.map(entry => (
                      <div key={`${entry.source}_${entry.phoneNumber}`} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 flex flex-wrap items-center gap-2">
                            {entry.name}
                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{entry.sourceLabel}</span>
                            {entry.receivesTexts ? (
                              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Gets texts</span>
                            ) : (
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">No texts</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">{entry.display}</p>
                        </div>
                        {entry.source === 'additional' ? (
                          <button
                            onClick={() => handleRemoveSmsRecipient(selectedUser, entry.recipientId)}
                            className="text-red-600 hover:text-red-800 text-sm whitespace-nowrap"
                          >
                            Remove
                          </button>
                        ) : !entry.receivesTexts ? (
                          <button
                            onClick={() => handleAddLinkedNumberToTexts(selectedUser, entry)}
                            className="text-green-700 hover:text-green-900 text-sm font-medium whitespace-nowrap"
                          >
                            Add to texts
                          </button>
                        ) : null}
                      </div>
                    ))}

                    {linkedNumbers.length === 0 && (
                      <p className="text-sm text-red-500 font-medium">No phone numbers on file for this client.</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
                    <input
                      type="text"
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      placeholder="Name (optional)"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    />
                    <input
                      type="tel"
                      value={newRecipientPhone}
                      onChange={(e) => setNewRecipientPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    />
                    <button
                      onClick={() => handleAddSmsRecipient(selectedUser)}
                      disabled={savingRecipient || !newRecipientPhone.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />{savingRecipient ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
                  );
                })()}

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

  if (view === 'login') return <LoginView />;
  if (view === 'admin-login') return <AdminLoginView />;
  // Legacy sessions saved with the old onboarding wizard view land on the dashboard
  if (view === 'dashboard' || view === 'onboarding') {
    if (!currentUser) return <LoginView />;
    const selectedTask = clientTasks.find(t => t.id === selectedTaskId);
    return (
      <>
        <DashboardView />
        {/* Rendered here (module-level components) so their form state survives
            the re-renders caused by Firebase real-time listeners. */}
        {showOnboardingForm && (
          <OnboardingFormView
            currentUser={currentUser}
            onSubmit={handleOnboardingFormSubmit}
            onOpenReferral={() => setShowReferralModal(true)}
            uploadFile={uploadFileToStorage}
            onClose={() => setShowOnboardingForm(false)}
          />
        )}
        {showReferralModal && (
          <ReferralModal
            currentUser={currentUser}
            onClose={() => setShowReferralModal(false)}
            onSubmit={handleReferralSubmit}
          />
        )}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={updateClientTask}
            onOpenLink={(task) => {
              setSelectedTaskId(null);
              setMobileNavOpen(false);
              if (task.link?.type === 'onboarding-form') {
                setShowOnboardingForm(true);
              } else if (task.link?.type === 'page' && task.link.page) {
                setActivePage(task.link.page);
              }
            }}
          />
        )}
        <AiAssistant clientId={currentUser.id} />
      </>
    );
  }
  if (view === 'admin') return (
    <>
      <AdminView />
      <AiAssistant clientId={currentUser.id} isAdmin />
    </>
  );
};

export default ClientPortal;
