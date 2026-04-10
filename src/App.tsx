/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Component } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from './firebase';
import { Ticket, TicketType, TicketStatus, Question } from './types';
import { 
  LayoutGrid, 
  Sparkles, 
  PlusSquare, 
  Upload, 
  Library, 
  Share2, 
  LogOut, 
  LogIn,
  Trash2,
  ExternalLink,
  Download,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const COLORS = ['#0C9488', '#534AB7', '#059669', '#D97706', '#DC2626', '#2563EB', '#7C3AED', '#0891B2', '#BE185D'];
const LA_COLORS: Record<string, { bg: string, color: string }> = {
  Critical:      { bg: '#FEF2F2', color: '#7F1D1D' },
  Collaborative: { bg: '#EFF6FF', color: '#1E3A5F' },
  Committed:     { bg: '#F0FDF4', color: '#14532D' },
  Creative:      { bg: '#FDF4FF', color: '#581C87' },
  Curious:       { bg: '#FFFBEB', color: '#78350F' },
  Communicative: { bg: '#FFF7ED', color: '#7C2D12' }
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ErrorBoundary: any = class extends Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if ((this as any).state.hasError) {
      let msg = "Something went wrong.";
      try {
        const parsed = JSON.parse((this as any).state.error.message);
        if (parsed.error.includes('Missing or insufficient permissions')) {
          msg = "You don't have permission to perform this action. Please make sure you are logged in and own this resource.";
        }
      } catch (e) {
        msg = (this as any).state.error.message || msg;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-50">
          <div className="card max-w-md p-8">
            <div className="text-red-500 mb-4"><AlertCircle size={48} className="mx-auto" /></div>
            <h2 className="text-xl font-bold mb-2">Application Error</h2>
            <p className="text-t2 mb-6 text-sm">{msg}</p>
            <button className="btn btn-navy w-full" onClick={() => window.location.reload()}>Reload Application</button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [libFilter, setLibFilter] = useState('all');
  const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' | '' } | null>(null);
  
  // AI Gen State
  const [genName, setGenName] = useState('');
  const [genSubject, setGenSubject] = useState('');
  const [genTopic, setGenTopic] = useState('');
  const [genConcepts, setGenConcepts] = useState('');
  const [genQCount, setGenQCount] = useState('5');
  const [genDiff, setGenDiff] = useState('standard');
  const [genStatus, setGenStatus] = useState<TicketStatus>('active');
  const [genClass, setGenClass] = useState('');
  const [selectedType, setSelectedType] = useState<TicketType>('quiz');
  const [selectedLAs, setSelectedLAs] = useState<string[]>([]);
  const [lastGenerated, setLastGenerated] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Manual Build State
  const [manualQs, setManualQs] = useState<Question[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<TicketType>('quiz');
  const [manualSubject, setManualSubject] = useState('');
  const [manualTopic, setManualTopic] = useState('');
  const [manualClass, setManualClass] = useState('');
  const [manualStatus, setManualStatus] = useState<TicketStatus>('active');
  const [manualLAs, setManualLAs] = useState<string[]>([]);
  const [manualPreviewHTML, setManualPreviewHTML] = useState('');

  // Upload State
  const [ulName, setUlName] = useState('');
  const [ulUrl, setUlUrl] = useState('');
  const [ulSubject, setUlSubject] = useState('');
  const [ulTopic, setUlTopic] = useState('');
  const [ulClass, setUlClass] = useState('');
  const [ulStatus, setUlStatus] = useState<TicketStatus>('active');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        // Set a default Guest user to bypass login as requested
        setUser({
          uid: 'public-teacher',
          displayName: 'Guest Teacher',
          email: 'guest@exitstudio.local',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'
        } as any);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'tickets'), orderBy('created', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      setTickets(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // Connection Test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' | '' = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast("Logged in successfully!", "success");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        showToast("Domain not authorized in Firebase Console.", "error");
      } else if (error.code === 'auth/popup-blocked') {
        showToast("Login popup was blocked by your browser.", "error");
      } else {
        showToast("Login failed.", "error");
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      showToast("Logged out.");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const esc = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const toggleLA = (la: string, isManual: boolean = false) => {
    if (isManual) {
      setManualLAs(prev => prev.includes(la) ? prev.filter(x => x !== la) : [...prev, la]);
    } else {
      setSelectedLAs(prev => prev.includes(la) ? prev.filter(x => x !== la) : [...prev, la]);
    }
  };

  const generateTicket = async () => {
    if (!genName) { setGenError('Please enter a ticket name.'); return; }
    if (!genTopic && !genConcepts) { setGenError('Please enter a topic or learning objectives.'); return; }
    setGenError('');
    setIsGenerating(true);
    setLastGenerated(null);

    const typeDesc: Record<string, string> = {
      quiz: 'multiple choice quiz with 4 options per question and one correct answer',
      circle: 'emoji/face confidence check-in where students rate their understanding',
      reflect: 'written reflection prompts for short open-ended answers',
      mixed: 'a mix of multiple choice questions and reflection prompts'
    };
    const diffDesc: Record<string, string> = {
      foundation: 'foundation level: straightforward recall and recognition questions',
      standard: 'standard level: application and understanding questions',
      higher: 'higher level: analysis, evaluation, and exam-style reasoning questions'
    };

    const laCtx = selectedLAs.length ? ` Also, this ticket develops these Learner Ambitions: ${selectedLAs.join(', ')}. Align the questions to these ambitions.` : '';
    const prompt = `You are a teacher creating an exit ticket for ${genSubject || 'a class'} on the topic "${genTopic || genSubject}". Key concepts: ${genConcepts || genTopic}. Difficulty: ${diffDesc[genDiff]}. Type: ${typeDesc[selectedType]}. Number of questions: ${genQCount}.${laCtx}\n\nGenerate an exit ticket as a JSON object only. No markdown, no explanation, just raw JSON.\n\nFor mcq questions include 4 options and a correct index (0-3).\nFor circle questions students rate with emojis.\nFor reflect questions students write a free response.\n\n{"title":"${genName}","subject":"${genSubject}","topic":"${genTopic}","type":"${selectedType}","questions":[{"type":"mcq","text":"question","options":["A","B","C","D"],"correct":0},{"type":"circle","text":"I can explain X"},{"type":"reflect","text":"Describe how..."}]}`;

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing. If you just added it to Vercel, you MUST trigger a new 'Redeploy' for it to take effect.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      let text = response.text || '{}';
      // Clean up potential markdown code blocks if the model ignored the raw JSON instruction
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0];
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0];
      }
      
      const parsed = JSON.parse(text.trim());
      setLastGenerated(parsed);
      setIsGenerating(false);
      showToast("Exit ticket generated!", "success");
    } catch (e: any) {
      console.error("AI Gen Error:", e);
      setIsGenerating(false);
      const errorMsg = e.message || 'Unknown error';
      setGenError(`Generation failed: ${errorMsg}. If you are on Vercel, ensure GEMINI_API_KEY is set.`);
      showToast("Generation failed.", "error");
    }
  };

  const saveGenerated = async () => {
    if (!lastGenerated || !user) return;
    
    const ticketData: Omit<Ticket, 'id'> = {
      name: lastGenerated.title || genName,
      subject: lastGenerated.subject || genSubject,
      topic: lastGenerated.topic || genTopic,
      cls: genClass,
      status: genStatus,
      type: (lastGenerated.type as TicketType) || selectedType,
      source: 'generated',
      html: buildTicketPageHTML({ ...lastGenerated, learnerAmbitions: selectedLAs }),
      learnerAmbitions: selectedLAs,
      color: COLORS[tickets.length % COLORS.length],
      created: new Date().toISOString(),
      teacherId: user.uid,
      teacherEmail: user.email || '',
      questions: lastGenerated.questions
    };

    try {
      await addDoc(collection(db, 'tickets'), ticketData);
      showToast("Saved to library!", "success");
      setCurrentPage('library');
      // Reset
      setLastGenerated(null);
      setGenName('');
      setGenSubject('');
      setGenTopic('');
      setGenConcepts('');
      setSelectedLAs([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tickets');
    }
  };

  const addManualQ = () => {
    setManualQs(prev => [...prev, { type: 'mcq', text: '', options: ['', '', '', ''], correct: 0 }]);
  };

  const updateQ = (index: number, field: keyof Question, value: any) => {
    setManualQs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateOpt = (qIndex: number, oIndex: number, value: string) => {
    setManualQs(prev => {
      const next = [...prev];
      const opts = [...(next[qIndex].options || [])];
      opts[oIndex] = value;
      next[qIndex] = { ...next[qIndex], options: opts };
      return next;
    });
  };

  const removeQ = (index: number) => {
    setManualQs(prev => prev.filter((_, i) => i !== index));
  };

  const saveManual = async () => {
    if (!manualName || !user) { showToast("Please enter a name."); return; }
    if (!manualQs.length) { showToast("Add at least one question."); return; }

    const data = {
      title: manualName,
      subject: manualSubject,
      topic: manualTopic,
      type: manualType,
      questions: manualQs,
      learnerAmbitions: manualLAs
    };

    const ticketData: Omit<Ticket, 'id'> = {
      name: manualName,
      subject: manualSubject,
      topic: manualTopic,
      cls: manualClass,
      status: manualStatus,
      type: manualType,
      source: 'manual',
      html: buildTicketPageHTML(data),
      learnerAmbitions: manualLAs,
      color: COLORS[tickets.length % COLORS.length],
      created: new Date().toISOString(),
      teacherId: user.uid,
      teacherEmail: user.email || '',
      questions: manualQs
    };

    try {
      await addDoc(collection(db, 'tickets'), ticketData);
      showToast("Ticket saved!", "success");
      setCurrentPage('library');
      // Reset
      setManualName('');
      setManualQs([]);
      setManualLAs([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tickets');
    }
  };

  const previewManual = () => {
    if (!manualName || !manualQs.length) { showToast("Fill in name and questions first."); return; }
    const data = {
      title: manualName,
      subject: manualSubject,
      topic: manualTopic,
      type: manualType,
      questions: manualQs,
      learnerAmbitions: manualLAs
    };
    setManualPreviewHTML(renderTicketHTML(data, true));
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.name.endsWith('.html')) { showToast("Please upload an HTML file.", "error"); return; }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const html = event.target?.result as string;
      const nameMatch = html.match(/<title>(.*?)<\/title>/i);
      const name = nameMatch ? nameMatch[1] : file.name.replace('.html', '');

      const ticketData: Omit<Ticket, 'id'> = {
        name,
        subject: '',
        topic: '',
        cls: '',
        status: 'draft',
        type: 'upload',
        source: 'upload',
        html,
        learnerAmbitions: [],
        color: COLORS[tickets.length % COLORS.length],
        created: new Date().toISOString(),
        teacherId: user.uid,
        teacherEmail: user.email || ''
      };

      try {
        await addDoc(collection(db, 'tickets'), ticketData);
        showToast(`"${name}" uploaded!`, "success");
        setCurrentPage('library');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tickets');
      }
    };
    reader.readAsText(file);
  };

  const saveLink = async () => {
    if (!ulName || !ulUrl || !user) { showToast("Name and URL are required."); return; }
    
    const ticketData: Omit<Ticket, 'id'> = {
      name: ulName,
      subject: ulSubject,
      topic: ulTopic,
      cls: ulClass,
      status: ulStatus,
      type: 'upload',
      source: 'link',
      url: ulUrl,
      learnerAmbitions: [],
      color: COLORS[tickets.length % COLORS.length],
      created: new Date().toISOString(),
      teacherId: user.uid,
      teacherEmail: user.email || ''
    };

    try {
      await addDoc(collection(db, 'tickets'), ticketData);
      showToast("Link added!", "success");
      setCurrentPage('library');
      setUlName('');
      setUlUrl('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'tickets');
    }
  };

  const [confirmModal, setConfirmModal] = useState<{ show: boolean, id: string } | null>(null);

  const deleteTicket = async (id: string) => {
    setConfirmModal({ show: true, id });
  };

  const confirmDelete = async () => {
    if (!confirmModal || !user) return;
    const id = confirmModal.id;
    setConfirmModal(null);
    try {
      await deleteDoc(doc(db, 'tickets', id));
      showToast("Removed.");
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `tickets/${id}`);
    }
  };

  const toggleActive = async (ticket: Ticket) => {
    const newStatus = ticket.status === 'active' ? 'draft' : 'active';
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), { status: newStatus });
      showToast(newStatus === 'active' ? 'Set to active.' : 'Set to draft.');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tickets/${ticket.id}`);
    }
  };

  const downloadTicket = (ticket: Ticket) => {
    if (!ticket.html) return;
    const blob = new Blob([ticket.html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ticket.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
    a.click();
    showToast("Downloaded!", "success");
  };

  const previewTicket = (ticket: Ticket) => {
    if (!ticket.html) return;
    const blob = new Blob([ticket.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const buildTicketPageHTML = (data: any) => {
    const qs = (data.questions || []).map((q: any, i: number) => {
      if (q.type === 'mcq') {
        return `<div class="q"><div class="q-num">Question ${i + 1}</div><div class="q-text">${esc(q.text)}</div>${(q.options || []).map((o: any, oi: number) => `<div class="opt" onclick="pick(this,${i},${oi},${q.correct})"><div class="opt-b">${String.fromCharCode(65 + oi)}</div>${esc(o)}</div>`).join('')}</div>`;
      } else if (q.type === 'circle') {
        return `<div class="q"><div class="q-num">Check-in ${i + 1}</div><div class="q-text">${esc(q.text)}</div><div class="circles">${['😕', '🙂', '😊', '😄', '🤩'].map(e => `<span class="copt" onclick="selC(this)">${e}</span>`).join('')}</div></div>`;
      } else {
        return `<div class="q"><div class="q-num">Reflect ${i + 1}</div><div class="q-text">${esc(q.text)}</div><textarea class="ta" placeholder="Write your answer here..."></textarea></div>`;
      }
    }).join('');
    
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data.title || 'Exit Ticket')}</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F5F7FA;min-height:100vh;padding:2rem 1rem;display:flex;align-items:flex-start;justify-content:center}.wrap{width:100%;max-width:560px}.hdr{background:#1C2B3A;border-radius:12px 12px 0 0;padding:1.25rem 1.5rem;color:#fff}.hdr-t{font-family:'Fraunces',serif;font-size:18px;font-weight:600}.hdr-s{font-size:11.5px;opacity:.5;margin-top:3px}.body{background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:1.5rem}.q{margin-bottom:1.25rem}.q-num{font-size:10.5px;font-weight:700;color:#0C9488;text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}.q-text{font-size:14px;font-weight:500;color:#1C2B3A;margin-bottom:10px}.opt{display:flex;align-items:center;gap:10px;padding:9px 13px;border-radius:8px;border:1px solid #E2E8F0;font-size:13px;color:#475569;cursor:pointer;margin-bottom:6px;transition:all .15s}.opt:hover{border-color:#0C9488;color:#0C9488;background:#F0FDFB}.opt.correct{border-color:#059669;background:#ECFDF5;color:#064E3B;font-weight:500}.opt.wrong{border-color:#DC2626;background:#FEF2F2;color:#7F1D1D}.opt-b{width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}.circles{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}.copt{font-size:28px;cursor:pointer;border-radius:50%;padding:4px;border:2px solid transparent;transition:all .15s}.copt:hover{border-color:#0C9488;transform:scale(1.1)}.copt.sel{border-color:#1C2B3A;transform:scale(1.15)}.ta{width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;min-height:70px;resize:none;color:#1C2B3A;line-height:1.6}.sub-row{margin-top:1.25rem;padding-top:1.25rem;border-top:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between}.sub-btn{padding:9px 22px;border-radius:8px;background:#1C2B3A;color:#fff;border:none;font-size:14px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}.sub-btn:hover{background:#0C9488}.sub-btn:disabled{background:#94A3B8;cursor:default}</style></head><body><div class="wrap"><div class="hdr"><div class="hdr-t">${esc(data.title || 'Exit Ticket')}</div><div class="hdr-s">${esc([data.subject, data.topic].filter(Boolean).join(' · '))}</div></div>${((data.learnerAmbitions && data.learnerAmbitions.length) ? `<div style="padding:7px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Learner ambitions</span>${data.learnerAmbitions.map((la: string) => { const cols = { Critical: { bg: "#FEF2F2", tx: "#7F1D1D" }, Collaborative: { bg: "#EFF6FF", tx: "#1E3A5F" }, Committed: { bg: "#F0FDF4", tx: "#14532D" }, Creative: { bg: "#FDF4FF", tx: "#581C87" }, Curious: { bg: "#FFFBEB", tx: "#78350F" }, Communicative: { bg: "#FFF7ED", tx: "#7C2D12" } }[la as keyof typeof LA_COLORS] || { bg: "#F3F4F6", tx: "#374151" }; return `<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:${cols.bg};color:${cols.tx}">${esc(la)}</span>`; }).join('')}</div>` : '')}<div class="body">${qs}<div class="sub-row"><span style="font-size:12px;color:#94A3B8">Answer all questions</span><button class="sub-btn" onclick="sub(this)">Submit ticket</button></div></div></div><script>function pick(el,qi,oi,c){var g=el.parentNode.querySelectorAll('.opt');g.forEach(function(o,i){o.classList.remove('correct','wrong');if(i===c)o.classList.add('correct');else if(i===oi)o.classList.add('wrong');});}function selC(el){el.closest('.circles').querySelectorAll('.copt').forEach(function(e){e.classList.remove('sel');});el.classList.add('sel');}function sub(btn){btn.textContent='Submitted!';btn.style.background='#059669';btn.disabled=true;}<\/script></body></html>`;
  };

  const renderTicketHTML = (data: any, interactive: boolean) => {
    const qs = (data.questions || []).map((q: any, i: number) => {
      if (q.type === 'mcq') {
        const opts = (q.options || []).map((o: any, oi: number) => {
          return `<div class="et-opt" ${interactive ? `onclick="this.parentNode.querySelectorAll('.et-opt').forEach((el,idx)=>{el.classList.remove('correct','wrong'); if(idx===${q.correct})el.classList.add('correct'); else if(idx===${oi})el.classList.add('wrong');})"` : ''}><span style="width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${String.fromCharCode(65 + oi)}</span>${esc(o)}</div>`;
        }).join('');
        return `<div class="et-q"><div class="et-q-num">Question ${i + 1}</div><div class="et-q-text">${esc(q.text)}</div><div class="et-options">${opts}</div></div>`;
      } else if (q.type === 'circle') {
        const emojis = ['😕', '🙂', '😊', '😄', '🤩'];
        const circles = emojis.map(e => `<span class="et-circle-opt" ${interactive ? `onclick="this.parentNode.querySelectorAll('.et-circle-opt').forEach(el=>el.classList.remove('selected')); this.classList.add('selected')"` : ''}>${e}</span>`).join('');
        return `<div class="et-q"><div class="et-q-num">Check-in ${i + 1}</div><div class="et-q-text">${esc(q.text)}</div><div class="et-circle">${circles}</div></div>`;
      } else {
        return `<div class="et-q"><div class="et-q-num">Reflect ${i + 1}</div><div class="et-q-text">${esc(q.text)}</div><textarea class="et-text-area" placeholder="Write your answer here..."></textarea></div>`;
      }
    }).join('');
    
    const las = data.learnerAmbitions || [];
    const laBarHTML = las.length ? `<div style="padding:7px 14px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">NAE Learner Ambitions</span>${las.map((la: string) => { const c = { Critical: { bg: "#FEF2F2", fg: "#7F1D1D" }, Collaborative: { bg: "#EFF6FF", fg: "#1E3A5F" }, Committed: { bg: "#F0FDF4", fg: "#14532D" }, Creative: { bg: "#FDF4FF", fg: "#581C87" }, Curious: { bg: "#FFFBEB", fg: "#78350F" }, Communicative: { bg: "#FFF7ED", fg: "#7C2D12" } }[la as keyof typeof LA_COLORS] || { bg: "#F3F4F6", fg: "#374151" }; return `<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.bg};color:${c.fg}">${esc(la)}</span>`; }).join('')}</div>` : '';
    
    return `<div class="et-wrap"><div class="et-header"><div class="et-title">${esc(data.title || 'Exit Ticket')}</div><div class="et-subtitle">${esc([data.subject, data.topic].filter(Boolean).join(' · '))}</div></div>${laBarHTML}<div class="et-body">${qs}<div class="et-submit-row"><span style="font-size:11px;color:var(--t3)">Complete all questions</span><button class="et-submit-btn" onclick="this.textContent='Submitted!'; this.style.background='var(--green)'; this.disabled=true;">Submit</button></div></div></div>`;
  };

  const buildStudentPageHTML = () => {
    const active = tickets.filter(t => t.status === 'active');
    const typeLabels: Record<string, string> = { quiz: 'Quiz', circle: 'Emoji check-in', reflect: 'Reflection', mixed: 'Mixed', upload: 'Uploaded' };
    
    const rows = active.map(t => {
      const link = t.url ? t.url : '#';
      const hasHTML = !!t.html;
      return `<div class="card" style="cursor:pointer" onclick="${hasHTML ? `openEmbed('${t.id}')` : `window.open('${link}','_blank')`}">` +
        `<div class="dot" style="background:${t.color}"></div>` +
        `<div class="info"><div class="tname">${esc(t.name)}</div>` +
        `<div class="tmeta">${[typeLabels[t.type] || 'Ticket', t.subject, t.topic].filter(Boolean).join(' · ')}</div></div>` +
        `<button class="open-btn">Open &rarr;</button></div>` +
        (hasHTML ? `<div id="embed-${t.id}" style="display:none;margin-bottom:1rem"><iframe srcdoc="${esc(t.html)}" style="width:100%;height:520px;border:1px solid #E2E8F0;border-radius:12px"></iframe><button onclick="closeEmbed('${t.id}')" style="margin-top:6px;padding:5px 14px;border:1px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-family:sans-serif">Close</button></div>` : '');
    }).join('');

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Exit Tickets</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#F5F7FA;min-height:100vh;padding:2.5rem 1rem}.wrap{max-width:580px;margin:0 auto}h1{font-family:'Fraunces',serif;font-size:22px;color:#1C2B3A;margin-bottom:4px}.sub{font-size:13px;color:#94A3B8;margin-bottom:1.5rem}.card{background:#fff;border-radius:12px;border:1px solid #E2E8F0;padding:1rem 1.25rem;display:flex;align-items:center;gap:12px;margin-bottom:.75rem;transition:box-shadow .15s}.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}.dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}.info{flex:1;min-width:0}.tname{font-size:15px;font-weight:500;color:#1C2B3A}.tmeta{font-size:11.5px;color:#94A3B8;margin-top:3px}.open-btn{padding:8px 18px;border-radius:8px;background:#1C2B3A;color:#fff;border:none;font-size:13px;font-weight:500;white-space:nowrap;flex-shrink:0;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}.open-btn:hover{background:#0C9488}.footer{text-align:center;font-size:11px;color:#CBD5E1;margin-top:2rem}.empty{text-align:center;padding:3rem;color:#94A3B8}</style></head><body><div class="wrap"><h1>Exit tickets</h1><p class="sub">Click a ticket to open it</p>${active.length ? rows : '<div class="empty">No active tickets right now.</div>'}<div class="footer">Shared by your teacher</div></div><script>function openEmbed(id){document.getElementById("embed-"+id).style.display="block";}function closeEmbed(id){document.getElementById("embed-"+id).style.display="none";}<\/script></body></html>`;
  };

  const exportStudentPage = () => {
    const active = tickets.filter(t => t.status === 'active');
    if (!active.length) { showToast("No active tickets to export.", "error"); return; }
    const blob = new Blob([buildStudentPageHTML()], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'student_exit_tickets.html';
    a.click();
    showToast("Student page downloaded!", "success");
  };

  const filteredTickets = libFilter === 'all' ? tickets : tickets.filter(t => {
    if (libFilter === 'active') return t.status === 'active';
    if (libFilter === 'draft') return t.status === 'draft';
    if (libFilter === 'upload') return t.source === 'upload' || t.source === 'link';
    if (libFilter.startsWith('la:')) {
      const la = libFilter.slice(3);
      return (t.learnerAmbitions || []).includes(la);
    }
    return t.type === libFilter;
  });

  if (!isAuthReady) return <div className="flex items-center justify-center h-screen"><div className="spinner"></div></div>;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="logo-row">
            <div className="logo-box">E</div>
            <span className="logo-text">ExitStudio</span>
          </div>
          <div className="logo-sub">Exit ticket builder </div>
        </div>
        <nav className="sb-nav">
          <div className="sb-sec">Workspace</div>
          <button className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>
            <LayoutGrid className="ni" /> Dashboard
          </button>
          <button className={`nav-btn ${currentPage === 'generate' ? 'active' : ''}`} onClick={() => setCurrentPage('generate')}>
            <Sparkles className="ni" /> AI Generate
          </button>
          <button className={`nav-btn ${currentPage === 'build' ? 'active' : ''}`} onClick={() => setCurrentPage('build')}>
            <PlusSquare className="ni" /> Build manually
          </button>
          <button className={`nav-btn ${currentPage === 'upload' ? 'active' : ''}`} onClick={() => setCurrentPage('upload')}>
            <Upload className="ni" /> Upload existing
          </button>
          <div className="sb-sec">Library</div>
          <button className={`nav-btn ${currentPage === 'library' ? 'active' : ''}`} onClick={() => setCurrentPage('library')}>
            <Library className="ni" /> All tickets <span className="nb hi">{tickets.length}</span>
          </button>
          <button className={`nav-btn ${currentPage === 'share' ? 'active' : ''}`} onClick={() => setCurrentPage('share')}>
            <Share2 className="ni" /> Share with students
          </button>
        </nav>
        <div className="sb-footer">
          <div className="flex items-center gap-2 mb-4">
           
          Exit Ticket Studio 
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar-title capitalize">{currentPage.replace('-', ' ')}</span>
          <div className="topbar-actions">
            <button className="btn btn-teal btn-sm" onClick={() => setCurrentPage('generate')}>+ New ticket</button>
          </div>
        </div>

        <div className="content">
          {/* DASHBOARD */}
          {currentPage === 'dashboard' && (
            <div className="page active">
              <div className="stats">
                <div className="stat"><div className="stat-l">Total</div><div className="stat-v">{tickets.length}</div><div className="stat-s">in library</div></div>
                <div className="stat"><div className="stat-l">Active</div><div className="stat-v text-green">{tickets.filter(t => t.status === 'active').length}</div><div className="stat-s">shared</div></div>
                <div className="stat"><div className="stat-l">AI generated</div><div className="stat-v text-purple">{tickets.filter(t => t.source === 'generated').length}</div><div className="stat-s">tickets</div></div>
                <div className="stat"><div className="stat-l">Uploaded</div><div className="stat-v text-amber">{tickets.filter(t => t.source === 'upload' || t.source === 'link').length}</div><div className="stat-s">your files</div></div>
              </div>
              <div className="sec-hdr">
                <span className="sec-title">Recent tickets</span>
                <button className="btn btn-outline btn-sm" onClick={() => setCurrentPage('library')}>View all</button>
              </div>
              <div id="recent-list">
                {tickets.length === 0 ? (
                  <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No tickets yet</div><div className="empty-sub">Use AI Generate to create your first exit ticket</div></div>
                ) : (
                  tickets.slice(0, 5).map(t => (
                    <TicketItem key={t.id} ticket={t} user={user} onDelete={deleteTicket} onToggleActive={toggleActive} onPreview={previewTicket} onDownload={downloadTicket} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* AI GENERATE */}
          {currentPage === 'generate' && (
            <div className="page active">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="card">
                  <div className="sec-title mb-4">Configure your exit ticket</div>
                  <div className="form-section">
                    <label className="form-label">Ticket name *</label>
                    <input type="text" value={genName} onChange={e => setGenName(e.target.value)} placeholder="e.g. ER Diagrams Exit Ticket — Lesson 3" />
                  </div>
                  <div className="form-section">
                    <label className="form-label">Subject & topic</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={genSubject} onChange={e => setGenSubject(e.target.value)} placeholder="Subject" />
                      <input type="text" value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder="Topic" />
                    </div>
                  </div>
                  <div className="form-section">
                    <label className="form-label">Year group / class</label>
                    <input type="text" value={genClass} onChange={e => setGenClass(e.target.value)} placeholder="e.g. IB Year 1 · 11B" />
                  </div>
                  <div className="form-section">
                    <label className="form-label">Learning objectives / key concepts</label>
                    <textarea value={genConcepts} onChange={e => setGenConcepts(e.target.value)} placeholder="e.g. Students should understand cardinality (1:1, 1:M, M:N)..."></textarea>
                    <div className="form-hint">The more detail you provide, the more targeted the questions.</div>
                  </div>
                  <div className="form-section">
                    <label className="form-label">Ticket type</label>
                    <div className="type-grid">
                      {(['quiz', 'circle', 'reflect', 'mixed'] as TicketType[]).map(type => (
                        <div key={type} className={`type-card ${selectedType === type ? 'selected' : ''}`} onClick={() => setSelectedType(type)}>
                          <div className="type-icon">{{ quiz: '📝', circle: '😊', reflect: '💬', mixed: '🎯' }[type as any]}</div>
                          <div className="type-name capitalize">{type}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="form-section">
                    <label className="form-label">Number of questions</label>
                    <select value={genQCount} onChange={e => setGenQCount(e.target.value)}>
                      {[3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n} questions</option>)}
                    </select>
                  </div>
                  <div className="form-section">
                    <label className="form-label">Learner Ambitions</label>
                    <div className="la-row">
                      {Object.keys(LA_COLORS).map(la => (
                        <button key={la} className={`la-btn ${selectedLAs.includes(la) ? 'sel' : ''}`} style={{ background: LA_COLORS[la].bg, color: LA_COLORS[la].color, borderColor: LA_COLORS[la].color }} onClick={() => toggleLA(la)}>
                          {la}
                        </button>
                      ))}
                    </div>
                  </div>
                  {genError && <div className="text-red text-xs mb-2 flex items-center gap-1"><AlertCircle size={12} /> {genError}</div>}
                  <button className="btn btn-teal w-full" disabled={isGenerating} onClick={generateTicket}>
                    {isGenerating ? <><div className="spinner w-4 h-4 border-2"></div> Generating...</> : <><Sparkles size={16} /> Generate with AI</>}
                  </button>
                </div>

                <div>
                  <div className="sec-hdr">
                    <span className="sec-title">Preview</span>
                    <div className="flex gap-2">
                      {lastGenerated && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={generateTicket}>Regenerate</button>
                          <button className="btn btn-navy btn-sm" onClick={saveGenerated}>Save to library</button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="gen-preview">
                    {isGenerating ? (
                      <div className="gen-placeholder">
                        <div className="spinner"></div>
                        <div className="text-t2 font-medium mt-2">Generating your exit ticket...</div>
                      </div>
                    ) : lastGenerated ? (
                      <div dangerouslySetInnerHTML={{ __html: renderTicketHTML(lastGenerated, true) }} />
                    ) : (
                      <div className="gen-placeholder">
                        <div className="text-3xl opacity-30">✨</div>
                        <div className="text-sm font-medium text-t2">Your exit ticket will appear here</div>
                        <div className="text-xs text-t3">Fill in the form and click Generate</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BUILD MANUALLY */}
          {currentPage === 'build' && (
            <div className="page active">
              <div className="card">
                <div className="sec-title mb-4">Build your own exit ticket</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="form-label">Ticket name *</label><input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. ER Diagrams — Lesson 3" /></div>
                  <div><label className="form-label">Type</label><select value={manualType} onChange={e => setManualType(e.target.value as TicketType)}><option value="quiz">Quiz</option><option value="circle">Emoji check-in</option><option value="reflect">Reflection</option><option value="mixed">Mixed</option></select></div>
                  <div><label className="form-label">Subject</label><input type="text" value={manualSubject} onChange={e => setManualSubject(e.target.value)} placeholder="Subject" /></div>
                  <div><label className="form-label">Topic</label><input type="text" value={manualTopic} onChange={e => setManualTopic(e.target.value)} placeholder="Topic" /></div>
                  <div><label className="form-label">Year group</label><input type="text" value={manualClass} onChange={e => setManualClass(e.target.value)} placeholder="e.g. IB Year 1" /></div>
                  <div><label className="form-label">Status</label><select value={manualStatus} onChange={e => setManualStatus(e.target.value as TicketStatus)}><option value="active">Active</option><option value="draft">Draft</option></select></div>
                </div>
                <div className="form-section">
                  <label className="form-label">Learner Ambitions</label>
                  <div className="la-row">
                    {Object.keys(LA_COLORS).map(la => (
                      <button key={la} className={`la-btn ${manualLAs.includes(la) ? 'sel' : ''}`} style={{ background: LA_COLORS[la].bg, color: LA_COLORS[la].color, borderColor: LA_COLORS[la].color }} onClick={() => toggleLA(la, true)}>
                        {la}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="divider"></div>
                <div className="sec-hdr">
                  <span className="text-sm font-semibold">Questions</span>
                  <button className="btn btn-outline btn-sm" onClick={addManualQ}>+ Add question</button>
                </div>
                <div className="space-y-2">
                  {manualQs.length === 0 ? (
                    <div className="text-center p-6 text-t3 text-sm">No questions yet — click Add question</div>
                  ) : (
                    manualQs.map((q, i) => (
                      <div key={i} className="q-builder">
                        <div className="q-builder-hdr">
                          <span className="q-num-badge">Q{i + 1}</span>
                          <div className="flex gap-2 items-center">
                            <select value={q.type} onChange={e => updateQ(i, 'type', e.target.value)} className="w-auto py-1 px-2 text-xs">
                              <option value="mcq">Multiple choice</option>
                              <option value="circle">Emoji check-in</option>
                              <option value="reflect">Open reflection</option>
                            </select>
                            <button className="btn-ghost" onClick={() => removeQ(i)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <input type="text" value={q.text} onChange={e => updateQ(i, 'text', e.target.value)} placeholder="Question text..." className="mb-2" />
                        {q.type === 'mcq' && (
                          <div className="opts-list">
                            {(q.options || []).map((o, oi) => (
                              <div key={oi} className="opt-row">
                                <input type="text" value={o} onChange={e => updateOpt(i, oi, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                                <button className={`correct-btn ${q.correct === oi ? 'marked' : ''}`} onClick={() => updateQ(i, 'correct', oi)}>
                                  {q.correct === oi ? '✓ Correct' : 'Mark correct'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="divider"></div>
                <div className="flex gap-2">
                  <button className="btn btn-navy" onClick={saveManual}>Save to library</button>
                  <button className="btn btn-outline" onClick={previewManual}>Preview</button>
                </div>
                {manualPreviewHTML && (
                  <div className="mt-4 p-4 bg-sand rounded-xl border border-dashed border-b2" dangerouslySetInnerHTML={{ __html: manualPreviewHTML }} />
                )}
              </div>
            </div>
          )}

          {/* UPLOAD */}
          {currentPage === 'upload' && (
            <div className="page active">
              <div className="card">
                <div className="sec-title mb-2">Upload your own exit tickets</div>
                <p className="text-sm text-t2 mb-5 leading-relaxed">Upload HTML exit tickets you have already made. They appear in your library and can be shared with students.</p>
                <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <div className="upload-icon">📂</div>
                  <div className="upload-text">Click to browse, or drag and drop here</div>
                  <div className="upload-sub">Accepts .html files</div>
                </div>
                <input type="file" ref={fileInputRef} accept=".html" className="hidden" onChange={handleUpload} />
                <div className="divider"></div>
                <div className="sec-title mb-3 text-sm">Or add a link directly</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div><label className="form-label">Ticket name *</label><input type="text" value={ulName} onChange={e => setUlName(e.target.value)} placeholder="Name for this ticket" /></div>
                  <div><label className="form-label">URL / link *</label><input type="url" value={ulUrl} onChange={e => setUlUrl(e.target.value)} placeholder="https://..." /></div>
                  <div><label className="form-label">Subject</label><input type="text" value={ulSubject} onChange={e => setUlSubject(e.target.value)} placeholder="Subject" /></div>
                  <div><label className="form-label">Topic</label><input type="text" value={ulTopic} onChange={e => setUlTopic(e.target.value)} placeholder="Topic" /></div>
                  <div><label className="form-label">Year group</label><input type="text" value={ulClass} onChange={e => setUlClass(e.target.value)} placeholder="e.g. IB Year 1" /></div>
                  <div><label className="form-label">Status</label><select value={ulStatus} onChange={e => setUlStatus(e.target.value as TicketStatus)}><option value="active">Active</option><option value="draft">Draft</option></select></div>
                </div>
                <button className="btn btn-navy" onClick={saveLink}>Add link to library</button>
              </div>
            </div>
          )}

          {/* LIBRARY */}
          {currentPage === 'library' && (
            <div className="page active">
              <div className="pills">
                {['all', 'quiz', 'circle', 'reflect', 'mixed', 'upload', 'active', 'draft'].map(f => (
                  <button key={f} className={`pill capitalize ${libFilter === f ? 'active' : ''}`} onClick={() => setLibFilter(f)}>{f}</button>
                ))}
                {Object.keys(LA_COLORS).map(la => (
                  <button key={la} className={`pill ${libFilter === `la:${la}` ? 'active' : ''}`} style={{ background: LA_COLORS[la].bg, color: LA_COLORS[la].color, borderColor: LA_COLORS[la].color }} onClick={() => setLibFilter(`la:${la}`)}>
                    {la}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredTickets.length === 0 ? (
                  <div className="empty"><div className="empty-icon">📋</div><div className="empty-title">No tickets found</div><div className="empty-sub">Try a different filter</div></div>
                ) : (
                  filteredTickets.map(t => (
                    <TicketItem key={t.id} ticket={t} user={user} onDelete={deleteTicket} onToggleActive={toggleActive} onPreview={previewTicket} onDownload={downloadTicket} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* SHARE */}
          {currentPage === 'share' && (
            <div className="page active">
              <div className="card mb-4">
                <div className="sec-title mb-2">Share active tickets with students</div>
                <p className="text-sm text-t2 mb-5 leading-relaxed">Download a student page listing all your <strong>active</strong> exit tickets. Upload to Microsoft Teams and share the link with your class.</p>
                <div className="share-steps">
                  <div className="step-box"><div className="step-num">1</div><div className="step-title">Export the page</div><div className="step-body">Click below to download the student HTML file.</div></div>
                  <div className="step-box"><div className="step-num">2</div><div className="step-title">Upload to Teams</div><div className="step-body">Class channel → Files → Upload the file.</div></div>
                  <div className="step-box"><div className="step-num">3</div><div className="step-title">Share the link</div><div className="step-body">Copy the Teams file link and post in your channel.</div></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-teal" onClick={exportStudentPage}>Download student page</button>
                </div>
              </div>
              <div className="card">
                <div className="sec-title mb-3 text-sm">Active tickets included</div>
                <div className="space-y-2">
                  {tickets.filter(t => t.status === 'active').length === 0 ? (
                    <div className="text-center p-4 text-t3 text-sm">No active tickets yet.</div>
                  ) : (
                    tickets.filter(t => t.status === 'active').map(t => (
                      <TicketItem key={t.id} ticket={t} user={user} onDelete={deleteTicket} onToggleActive={toggleActive} onPreview={previewTicket} onDownload={downloadTicket} />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className={`toast show ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={14} className="inline mr-2" /> : toast.type === 'error' ? <AlertCircle size={14} className="inline mr-2" /> : null}
          {toast.msg}
        </div>
      )}

      {confirmModal?.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="card max-w-sm w-full p-6 shadow-2xl">
            <div className="text-red-500 mb-4"><Trash2 size={32} /></div>
            <div className="text-lg font-bold mb-2">Remove Ticket?</div>
            <p className="text-sm text-t2 mb-6">This will permanently remove the ticket from the library. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button className="btn btn-outline flex-1" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn bg-red-600 text-white hover:bg-red-700 flex-1" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TicketItemProps {
  ticket: Ticket;
  user: User | null;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (t: Ticket) => Promise<void>;
  onPreview: (t: Ticket) => void;
  onDownload: (t: Ticket) => void;
}

function TicketItem(props: any) {
  const { ticket, user, onDelete, onToggleActive, onPreview, onDownload } = props as TicketItemProps;
  const isOwner = true; // Everyone can manage all tickets in this shared version
  const typeLabels: Record<string, string> = { quiz: 'Quiz', circle: 'Emoji', reflect: 'Reflection', mixed: 'Mixed', upload: 'Uploaded' };
  const typeCls: Record<string, string> = { quiz: 'bq', circle: 'bc', reflect: 'br', mixed: 'bq', upload: 'bu' };

  return (
    <div className="ticket-item">
      <div className="ticket-accent" style={{ background: ticket.color }}></div>
      <div className="ticket-info">
        <div className="ticket-name flex items-center gap-2">
          {ticket.name}
          {!isOwner && <span className="text-[10px] bg-navy/5 text-navy/40 px-1.5 py-0.5 rounded uppercase font-bold">Shared by {ticket.teacherEmail.split('@')[0]}</span>}
        </div>
        <div className="ticket-meta">
          <span className={`tbadge ${typeCls[ticket.type] || 'bu'}`}>{typeLabels[ticket.type] || ticket.type}</span>
          {(ticket.learnerAmbitions || []).map(la => {
            const c = LA_COLORS[la] || { bg: '#F3F4F6', color: '#374151' };
            return <span key={la} className="la-pill" style={{ background: c.bg, color: c.color }}>{la}</span>;
          })}
          <span className={`pip ${ticket.status === 'active' ? 'pip-active' : 'pip-draft'}`}></span>
          <span className="capitalize">{ticket.status}</span>
          {ticket.subject && <span>· {ticket.subject}</span>}
          {ticket.topic && <span>· {ticket.topic}</span>}
          <span>· {new Date(ticket.created).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="ticket-actions">
        {ticket.html && <button className="btn btn-outline btn-sm" onClick={() => onPreview(ticket)}><Eye size={14} /></button>}
        {ticket.html && <button className="btn btn-outline btn-sm" onClick={() => onDownload(ticket)}><Download size={14} /></button>}
        {ticket.url && <a href={ticket.url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm"><ExternalLink size={14} /></a>}
        {isOwner && (
          <button className="btn btn-outline btn-sm" onClick={() => onToggleActive(ticket)}>
            {ticket.status === 'active' ? 'Draft' : 'Activate'}
          </button>
        )}
        {isOwner && <button className="btn btn-ghost btn-sm" onClick={() => onDelete(ticket.id)}><Trash2 size={14} /></button>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
