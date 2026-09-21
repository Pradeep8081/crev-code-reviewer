import { useState, useEffect, useMemo, useRef } from 'react'
import "prismjs/themes/prism-tomorrow.css"
import * as EditorModule from "react-simple-code-editor"
import prism from "prismjs"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-python"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-c"
import "prismjs/components/prism-cpp"
import "prismjs/components/prism-java"
import "prismjs/components/prism-go"
import "prismjs/components/prism-json"
import "prismjs/components/prism-css"

import Markdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"
import axios from 'axios'
import './App.css'

import {
  Play,
  Sparkles,
  Zap,
  Clock,
  RotateCcw,
  Copy,
  Check,
  ChevronRight,
  Settings,
  Flame,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  Wrench,
  Loader2,
  Terminal,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  CodeXml,
  Layers,
  Activity,
  Maximize2,
  Info,
  Search,
  Upload,
  Download,
  FolderOpen,
  FileCheck,
  FileWarning,
  X
} from 'lucide-react'

// Fix react-simple-code-editor Vite CJS/ESM interop
const Editor = EditorModule.default?.default || EditorModule.default || EditorModule

// 7 Days in Milliseconds for Auto-Expiration
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getValidHistory() {
  try {
    const raw = localStorage.getItem('crev_code_history');
    if (!raw) return [];
    const list = JSON.parse(raw);
    const now = Date.now();
    const valid = list.filter(item => (now - item.createdAt) <= ONE_WEEK_MS);
    if (valid.length !== list.length) {
      localStorage.setItem('crev_code_history', JSON.stringify(valid));
    }
    return valid;
  } catch (e) {
    return [];
  }
}

function formatTimeAgo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function extractTitle(code) {
  if (!code || code.trim() === '') return 'Untitled Snippet';
  const lines = code.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return 'Untitled Snippet';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
      const cleanComment = trimmed.replace(/^(\/\/|#|\/\*+|\*+)\s*/, '').replace(/\*\/$/, '').trim();
      if (cleanComment.length > 3) return cleanComment.slice(0, 24);
    }
    const funcMatch = trimmed.match(/(?:function|def|class|public\s+void|const|let|var)\s+([a-zA-Z0-9_]+)/);
    if (funcMatch && funcMatch[1]) {
      return funcMatch[1];
    }
  }
  return lines[0].replace(/[{}();]/g, '').trim().slice(0, 22) || 'Code Snippet';
}

// Helper to extract token/word difference between two lines of code
function getChangedTokenInfo(oldStr, newStr) {
  if (!oldStr || !newStr || oldStr === newStr) return null;

  let prefixLen = 0;
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++;
  }

  let oldSuffix = oldStr.length;
  let newSuffix = newStr.length;
  while (
    oldSuffix > prefixLen &&
    newSuffix > prefixLen &&
    oldStr[oldSuffix - 1] === newStr[newSuffix - 1]
  ) {
    oldSuffix--;
    newSuffix--;
  }

  const rawOld = oldStr.slice(prefixLen, oldSuffix);
  const rawNew = newStr.slice(prefixLen, newSuffix);

  function expandToken(str, start, end) {
    if (!str || str.length === 0) return '';
    let left = Math.max(0, Math.min(start, str.length - 1));
    let right = Math.max(0, Math.min(end, str.length));
    while (left > 0 && /[a-zA-Z0-9_$?.\[\]]/.test(str[left - 1])) left--;
    while (right < str.length && /[a-zA-Z0-9_$?.\[\]]/.test(str[right])) right++;
    let token = str.slice(left, right).trim();
    if (!token) token = str.slice(start, end).trim();
    return token;
  }

  const newExpanded = expandToken(newStr, prefixLen, newSuffix);
  const oldExpanded = expandToken(oldStr, prefixLen, oldSuffix);

  return {
    rawOld,
    rawNew,
    oldWord: oldExpanded || rawOld || oldStr.trim(),
    fixedWord: newExpanded || rawNew || newStr.trim()
  };
}

// Helper to extract dual diff comparison: original faulty code vs fixed replacement
function extractDiffInfo(originalCode, fixedCode, bugAnalysis) {
  if (!bugAnalysis && !fixedCode) return null;

  const origLines = (originalCode || '').split('\n');
  const fixedLines = (fixedCode || '').split('\n');

  let lineNo = parseInt(bugAnalysis?.lineNumber, 10);
  if (isNaN(lineNo) || lineNo < 1 || lineNo > origLines.length) {
    lineNo = 1;
    for (let i = 0; i < Math.max(origLines.length, fixedLines.length); i++) {
      if ((origLines[i] || '').trim() !== (fixedLines[i] || '').trim()) {
        lineNo = i + 1;
        break;
      }
    }
  }

  const faultySnippet = 
    bugAnalysis?.faultySnippet?.trim() || 
    origLines[lineNo - 1]?.trim() || 
    bugAnalysis?.bugLocation || 
    'Faulty code expression';

  const fixedSnippet = 
    bugAnalysis?.fixedSnippet?.trim() || 
    fixedLines[lineNo - 1]?.trim() || 
    'Corrected replacement expression';

  const tokenInfo = getChangedTokenInfo(origLines[lineNo - 1] || '', fixedLines[lineNo - 1] || '');

  return {
    lineNo,
    faultySnippet,
    fixedSnippet,
    faultyWord: tokenInfo?.oldWord || faultySnippet,
    fixedWord: tokenInfo?.fixedWord || fixedSnippet,
    rawNew: tokenInfo?.rawNew || '',
    rawOld: tokenInfo?.rawOld || '',
    cause: bugAnalysis?.cause || 'Runtime exception or logic error detected.',
    solution: bugAnalysis?.solution || 'Applied automated remediation and defensive checks.',
    fixedCode: fixedCode || bugAnalysis?.fixedCode
  };
}

// Custom Engineering Emblem: Minimalist geometric 'C' bracket with code-inspection chevron
function CrevLogo({ size = 28 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 28 28" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="cr-logo-svg"
    >
      <defs>
        <linearGradient id="crBrandGrad" x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" />
          <stop offset="0.6" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      
      {/* Precision Frame */}
      <rect 
        x="1.5" 
        y="1.5" 
        width="25" 
        height="25" 
        rx="6.5" 
        fill="#0c1322" 
        stroke="rgba(56, 189, 248, 0.35)" 
        strokeWidth="1.2" 
      />
      
      {/* Geometric 'C' Bracket */}
      <path 
        d="M19 8.5H11C8.79 8.5 7 10.29 7 12.5V15.5C7 17.71 8.79 19.5 11 19.5H19" 
        stroke="url(#crBrandGrad)" 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Code Review Chevron / Inspection Pointer */}
      <path 
        d="M12.5 11.5L16 14L12.5 16.5" 
        stroke="#38bdf8" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Precision Node Dot */}
      <circle cx="19" cy="8.5" r="1.4" fill="#38bdf8" />
    </svg>
  );
}

// Automatic Language Detector
function detectLanguage(code) {
  if (!code || code.trim() === '') return 'python';
  const text = code.trim();

  // Python patterns
  if (
    /^\s*(def|class)\s+\w+.*:/m.test(text) ||
    /^\s*from\s+[\w.]+\s+import/m.test(text) ||
    /^\s*import\s+[a-zA-Z0-9_]+$/m.test(text) ||
    /\belif\s+.*:/m.test(text) ||
    /\bprint\s*\(.*\)/m.test(text) ||
    /\b__init__\b/.test(text) ||
    /\bself\.\w+/.test(text) ||
    (/:\s*$/m.test(text) && !/[;{}]/.test(text))
  ) {
    return 'python';
  }

  // C / C++ patterns
  if (
    /#include\s*<.*>/.test(text) ||
    /\bstd::\w+/.test(text) ||
    /\bcout\s*<<|\bcin\s*>>/.test(text) ||
    /\b(nullptr|constexpr)\b/.test(text) ||
    /\bvector\s*<.*>/.test(text) ||
    /\b(template\s*<|namespace\s+\w+)/.test(text)
  ) {
    return 'cpp';
  }

  // Java patterns
  if (
    /\bpublic\s+(final\s+|abstract\s+)?(class|interface|enum)\b/.test(text) ||
    /\bpublic\s+static\s+void\s+main\b/.test(text) ||
    /\bSystem\.(out|err)\.print/.test(text) ||
    /@Override\b/.test(text) ||
    (/\b(package|implements|extends)\s+\w+/.test(text) && !/export\s+default/.test(text))
  ) {
    return 'java';
  }

  // Go patterns
  if (
    /\bpackage\s+\w+/.test(text) ||
    /\bfunc\s+(\(.*\)\s+)?\w+\(/.test(text) ||
    /\bfmt\.(Print|Sprint|Errorf)/.test(text) ||
    /:\=\s*/.test(text)
  ) {
    return 'go';
  }

  // TypeScript patterns
  if (
    /\b(interface|type)\s+\w+\s*(=|\{)/.test(text) ||
    /:\s*(string|number|boolean|any|void|unknown)\b/.test(text) ||
    /\b(public|private|protected|readonly)\s+\w+\s*:\s*\w+/.test(text) ||
    /\bas\s+(const|[A-Z]\w+)/.test(text)
  ) {
    return 'typescript';
  }

  // JavaScript patterns
  if (
    /\b(const|let|var)\s+\w+\s*=/.test(text) ||
    /\bconsole\.log\(/.test(text) ||
    /=>/.test(text)
  ) {
    return 'javascript';
  }

  return 'python';
}

const LANGUAGE_LABELS = {
  python: 'Python 3',
  javascript: 'JavaScript (Node)',
  typescript: 'TypeScript',
  cpp: 'C++ 20',
  java: 'Java 21',
  go: 'Go'
};

const FILE_NAMES = {
  python: 'analytics.py',
  javascript: 'userService.js',
  typescript: 'authHandler.ts',
  cpp: 'algorithm.cpp',
  java: 'MainApplication.java',
  go: 'main.go'
};

const SAMPLE_BENCHMARKS = [
  {
    name: 'Division by Zero Bug (Python)',
    code: `# Price Normalization Routine
prices = [120, 350, 0, 480]
discount_rate = 0

print("Starting normalization batch...")
for p in prices:
    # Potential Bug: Zero denominator causes runtime exception
    normalized = p / discount_rate
    print(f"Price: {p} -> Normalized: {normalized}")
`
  },
  {
    name: 'Null Pointer Dereference (JavaScript)',
    code: `// Account Profile Extractor
const accounts = [
  { id: 101, username: "alex", profile: { tier: "gold" } },
  { id: 102, username: "sarah" } // Missing profile
];

console.log("Extracting account tiers...");
accounts.forEach(acc => {
  // Bug: Reading properties of undefined crashes with TypeError
  console.log("User:", acc.username, "Tier:", acc.profile.tier);
});
`
  },
  {
    name: 'Two Sum Algorithm (Python)',
    code: `# Two Sum Hash Lookup
def find_target_pair(numbers, target_sum):
    index_map = {}
    for i, val in enumerate(numbers):
        complement = target_sum - val
        if complement in index_map:
            return [index_map[complement], i]
        index_map[val] = i
    return []

test_data = [2, 7, 11, 15]
target = 9
result = find_target_pair(test_data, target)
print(f"Found Target Pair Indices: {result}")
`
  },
  {
    name: 'Financial Ledger Pipeline (JavaScript)',
    code: `// Corporate Transactions Pipeline
const ledger = [
  { txId: "TX_01", amount: 450, verified: true },
  { txId: "TX_02", amount: 120, verified: false },
  { txId: "TX_03", amount: 890, verified: true }
];

const totalRevenue = ledger
  .filter(item => item.verified)
  .reduce((sum, item) => sum + item.amount, 0);

console.log("Verified Total Revenue: $" + totalRevenue);
`
  }
];

const BACKEND_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/ai/get-review').replace('/ai/get-review', '');

function getLanguageFromFilename(filename) {
  if (!filename) return null;
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js':
    case 'mjs':
    case 'cjs': return 'javascript';
    case 'jsx': return 'jsx';
    case 'ts': return 'typescript';
    case 'tsx': return 'tsx';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'c': return 'cpp';
    case 'java': return 'java';
    case 'go': return 'go';
    case 'json': return 'json';
    case 'css': return 'css';
    default: return null;
  }
}

const INITIAL_WORKSPACE_FILES = [
  {
    id: 'f_1',
    name: 'analytics.py',
    code: SAMPLE_BENCHMARKS[0].code,
    language: 'python',
    review: '',
    runResult: null,
    appliedFixInfo: null,
    isUploaded: false
  },
  {
    id: 'f_2',
    name: 'userService.js',
    code: SAMPLE_BENCHMARKS[1].code,
    language: 'javascript',
    review: '',
    runResult: null,
    appliedFixInfo: null,
    isUploaded: false
  },
  {
    id: 'f_3',
    name: 'twoSum.py',
    code: SAMPLE_BENCHMARKS[2].code,
    language: 'python',
    review: '',
    runResult: null,
    appliedFixInfo: null,
    isUploaded: false
  }
];

export default function App() {
  // Multi-File Workspace State
  const [workspaceFiles, setWorkspaceFiles] = useState(INITIAL_WORKSPACE_FILES);
  const [activeFileId, setActiveFileId] = useState('f_1');
  const [sidebarTab, setSidebarTab] = useState('files'); // 'files' | 'history'
  const [fileSearch, setFileSearch] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isScanningAll, setIsScanningAll] = useState(false);
  const fileInputRef = useRef(null);

  const [sampleIdx, setSampleIdx] = useState(0);

  // Left History Sidebar State
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [history, setHistory] = useState(getValidHistory);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // Studio Pane View: 'terminal' | 'review' | 'diagnostics' | 'complexity'
  const [studioTab, setStudioTab] = useState('terminal');

  // Loading States
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetailedReview, setShowDetailedReview] = useState(false);

  // Active File Derived from workspaceFiles
  const activeFile = useMemo(() => {
    return workspaceFiles.find(f => f.id === activeFileId) || workspaceFiles[0] || INITIAL_WORKSPACE_FILES[0];
  }, [workspaceFiles, activeFileId]);

  const code = activeFile.code || '';
  const review = activeFile.review || '';
  const runResult = activeFile.runResult || null;
  const appliedFixInfo = activeFile.appliedFixInfo || null;

  // Active File Updaters
  const updateActiveFile = (updater) => {
    setWorkspaceFiles(prev => prev.map(f => {
      if (f.id === activeFile.id) {
        return typeof updater === 'function' ? updater(f) : { ...f, ...updater };
      }
      return f;
    }));
  };

  const setCode = (newCode) => {
    updateActiveFile({ code: newCode });
  };

  const setReview = (newReview) => {
    updateActiveFile({ review: newReview });
  };

  const setRunResult = (newRunResult) => {
    updateActiveFile({ runResult: newRunResult });
  };

  const setAppliedFixInfo = (newFixInfo) => {
    updateActiveFile({ appliedFixInfo: newFixInfo });
  };

  // Split review into concise core section and deep-dive detailed section
  const { conciseSection, detailedSection } = useMemo(() => {
    if (!review) return { conciseSection: '', detailedSection: '' };
    if (review.includes('---SPLIT_DETAIL---')) {
      const parts = review.split('---SPLIT_DETAIL---');
      return {
        conciseSection: parts[0]?.trim() || '',
        detailedSection: parts[1]?.trim() || ''
      };
    }
    return { conciseSection: review.trim(), detailedSection: '' };
  }, [review]);

  // Global UI
  const [engineOnline, setEngineOnline] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const gutterRef = useRef(null);

  // Auto-detect Language
  const detectedLang = useMemo(() => {
    if (activeFile?.language) return activeFile.language;
    return detectLanguage(code);
  }, [activeFile, code]);

  // Split lines for line-numbers gutter
  const codeLines = useMemo(() => {
    return code.split('\n');
  }, [code]);

  // Error Line Number
  const bugLineNumber = useMemo(() => {
    if (runResult?.status === 'error' && runResult?.bugAnalysis?.lineNumber) {
      const parsed = parseInt(runResult.bugAnalysis.lineNumber, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }, [runResult]);

  // Active Diff comparison: Both error code and fixed code
  const activeDiff = useMemo(() => {
    if (appliedFixInfo) {
      return {
        lineNo: appliedFixInfo.lineNumber,
        faultySnippet: appliedFixInfo.faultySnippet,
        fixedSnippet: appliedFixInfo.fixedSnippet,
        faultyWord: appliedFixInfo.faultyWord || appliedFixInfo.faultySnippet,
        fixedWord: appliedFixInfo.fixedWord || appliedFixInfo.fixedSnippet,
        rawNew: appliedFixInfo.rawNew || '',
        rawOld: appliedFixInfo.rawOld || '',
        cause: appliedFixInfo.cause,
        solution: appliedFixInfo.solution,
        fixedCode: appliedFixInfo.fixedCode,
        isApplied: true
      };
    }
    if (runResult?.status === 'error' && runResult.bugAnalysis?.fixedCode) {
      const diff = extractDiffInfo(code, runResult.bugAnalysis.fixedCode, runResult.bugAnalysis);
      return diff ? { ...diff, isApplied: false } : null;
    }
    return null;
  }, [appliedFixInfo, runResult, code]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const query = historySearch.toLowerCase();
    return history.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.language.toLowerCase().includes(query)
    );
  }, [history, historySearch]);

  // Filtered Workspace Files
  const filteredWorkspaceFiles = useMemo(() => {
    if (!fileSearch.trim()) return workspaceFiles;
    const q = fileSearch.toLowerCase();
    return workspaceFiles.filter(f => 
      f.name.toLowerCase().includes(q) || 
      (f.language || '').toLowerCase().includes(q)
    );
  }, [workspaceFiles, fileSearch]);

  // Initial check & mount
  useEffect(() => {
    prism.highlightAll();
    const checkEngine = async () => {
      try {
        await axios.get(BACKEND_BASE || 'http://localhost:5000', { timeout: 3000 });
        setEngineOnline(true);
      } catch (err) {
        setEngineOnline(false);
      }
    };
    checkEngine();
    setHistory(getValidHistory());
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  const handleEditorScroll = (e) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // 1-Week History Persistence
  const saveSessionToHistory = (currentCode, currentReview, currentRun) => {
    if (!currentCode || currentCode.trim() === '') return;

    const currentList = getValidHistory();
    const title = activeFile?.name || extractTitle(currentCode);
    const lang = detectedLang;
    const now = Date.now();

    const existingIndex = currentList.findIndex(item => item.code.trim() === currentCode.trim());
    let updatedList;

    if (existingIndex >= 0) {
      const existing = currentList[existingIndex];
      existing.title = title;
      existing.language = lang;
      existing.review = currentReview || existing.review;
      existing.runResult = currentRun || existing.runResult;
      existing.createdAt = now;
      updatedList = [existing, ...currentList.filter((_, idx) => idx !== existingIndex)];
      setActiveHistoryId(existing.id);
    } else {
      const newItem = {
        id: `crev_${now}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        language: lang,
        code: currentCode,
        review: currentReview || '',
        runResult: currentRun || null,
        createdAt: now
      };
      updatedList = [newItem, ...currentList];
      setActiveHistoryId(newItem.id);
    }

    const valid = updatedList.filter(item => (now - item.createdAt) <= ONE_WEEK_MS);
    localStorage.setItem('crev_code_history', JSON.stringify(valid));
    setHistory(valid);
  };

  // File Upload & Management
  const handleAddFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    let loadedCount = 0;

    filesArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result || '';
        const extLang = getLanguageFromFilename(file.name);
        const detected = extLang || detectLanguage(content);
        const newFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          code: content,
          language: detected,
          review: '',
          runResult: null,
          appliedFixInfo: null,
          isUploaded: true,
          size: file.size
        };
        setWorkspaceFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        loadedCount++;
        if (loadedCount === filesArray.length) {
          showToast(`📁 Added ${loadedCount} file(s) to workspace`);
        }
      };
      reader.readAsText(file);
    });
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCloseFile = (e, fileId) => {
    e.stopPropagation();
    if (workspaceFiles.length <= 1) {
      showToast('At least one file must remain open');
      return;
    }
    const remaining = workspaceFiles.filter(f => f.id !== fileId);
    setWorkspaceFiles(remaining);
    if (activeFileId === fileId) {
      setActiveFileId(remaining[0].id);
    }
    showToast('File closed');
  };

  const handleDownloadFile = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name || 'code.txt';
    link.click();
    URL.revokeObjectURL(url);
    showToast(`💾 Downloaded "${activeFile.name}"`);
  };

  const handleScanAllFiles = async () => {
    if (workspaceFiles.length === 0) return;
    setIsScanningAll(true);
    showToast(`⚡ Scanning all ${workspaceFiles.length} workspace files for bugs...`);

    const updated = [...workspaceFiles];
    for (let i = 0; i < updated.length; i++) {
      const f = updated[i];
      try {
        const res = await axios.post(`${BACKEND_BASE}/ai/run-code`, {
          code: f.code,
          language: f.language || detectLanguage(f.code)
        });
        updated[i] = { ...f, runResult: res.data };
      } catch (err) {
        console.warn(`Scan error on ${f.name}:`, err.message);
      }
    }

    setWorkspaceFiles(updated);
    setIsScanningAll(false);
    const bugCount = updated.filter(f => f.runResult?.status === 'error').length;
    showToast(`Scan complete: ${bugCount} file(s) with bugs found.`);
  };

  const handleLoadHistory = (item) => {
    setActiveHistoryId(item.id);
    // Find or create workspace file for this snippet
    const existing = workspaceFiles.find(f => f.code.trim() === item.code.trim());
    if (existing) {
      setActiveFileId(existing.id);
    } else {
      const ext = item.language === 'python' ? 'py' : 'js';
      const safeName = `${item.title.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 16)}.${ext}`;
      const newFile = {
        id: `hist_${item.id}`,
        name: safeName,
        code: item.code,
        language: item.language,
        review: item.review || '',
        runResult: item.runResult || null,
        appliedFixInfo: null,
        isUploaded: false
      };
      setWorkspaceFiles(prev => [newFile, ...prev]);
      setActiveFileId(newFile.id);
    }
    if (item.runResult) {
      setStudioTab('terminal');
    } else if (item.review) {
      setStudioTab('review');
    }
    showToast(`Loaded: ${item.title}`);
  };

  const handleDeleteHistory = (e, id) => {
    e.stopPropagation();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem('crev_code_history', JSON.stringify(updated));
    setHistory(updated);
    if (activeHistoryId === id) setActiveHistoryId(null);
    showToast('Deleted from history');
  };

  const handleNewSnippet = () => {
    const ext = detectedLang === 'python' ? 'py' : 'js';
    const newFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `snippet_${workspaceFiles.length + 1}.${ext}`,
      code: '',
      language: detectedLang || 'javascript',
      review: '',
      runResult: null,
      appliedFixInfo: null,
      isUploaded: false
    };
    setWorkspaceFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    showToast('New file opened in workspace');
  };

  const handleCycleSample = () => {
    const nextIdx = (sampleIdx + 1) % SAMPLE_BENCHMARKS.length;
    setSampleIdx(nextIdx);
    const sample = SAMPLE_BENCHMARKS[nextIdx];
    const isPy = sample.name.includes('Python');
    const newFile = {
      id: `sample_${Date.now()}`,
      name: `${sample.name.split(' ')[0].toLowerCase()}.${isPy ? 'py' : 'js'}`,
      code: sample.code,
      language: isPy ? 'python' : 'javascript',
      review: '',
      runResult: null,
      appliedFixInfo: null,
      isUploaded: false
    };
    setWorkspaceFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setStudioTab('terminal');
    showToast(`Loaded: ${sample.name}`);
  };

  const handleApplyFix = (fixedCode, analysisOverride) => {
    if (!fixedCode) return;
    const analysis = analysisOverride || runResult?.bugAnalysis;
    const diff = extractDiffInfo(code, fixedCode, analysis);
    const lineNo = diff?.lineNo || bugLineNumber || 1;

    setAppliedFixInfo({
      lineNumber: lineNo,
      faultySnippet: diff?.faultySnippet || 'Faulty code expression',
      fixedSnippet: diff?.fixedSnippet || 'Corrected code expression',
      faultyWord: diff?.faultyWord || diff?.faultySnippet || 'Faulty expression',
      fixedWord: diff?.fixedWord || diff?.fixedSnippet || 'Fixed expression',
      rawNew: diff?.rawNew || '',
      rawOld: diff?.rawOld || '',
      cause: diff?.cause || 'Runtime exception or logic error.',
      solution: diff?.solution || 'Applied automated fix.',
      fixedCode,
      preFixCode: code,
      timestamp: Date.now()
    });

    setCode(fixedCode);
    showToast(`⚡ Quick Fix applied to Line ${lineNo}! Highlighted in editor.`);
    saveSessionToHistory(fixedCode, review, runResult);
  };

  const handleRevertFix = () => {
    if (appliedFixInfo?.preFixCode) {
      setCode(appliedFixInfo.preFixCode);
      setAppliedFixInfo(null);
      showToast('Reverted back to original code');
    }
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showToast('Code copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyReview = () => {
    if (!review) return;
    navigator.clipboard.writeText(review);
    setCopiedReview(true);
    showToast('Audit report copied');
    setTimeout(() => setCopiedReview(false), 2000);
  };

  // Syntax highlighting with exact word-level error & fix markers
  const highlightCode = (input) => {
    const grammars = {
      javascript: prism.languages.javascript,
      typescript: prism.languages.typescript || prism.languages.javascript,
      python: prism.languages.python || prism.languages.javascript,
      cpp: prism.languages.cpp || prism.languages.clike,
      java: prism.languages.java || prism.languages.clike,
      go: prism.languages.go || prism.languages.clike,
    };
    const grammar = grammars[detectedLang] || prism.languages.python;

    let processedInput = input;

    // Check if we have an applied fix with a specific fixedWord to highlight in editor
    if (appliedFixInfo && appliedFixInfo.fixedWord) {
      const lineIdx = (appliedFixInfo.lineNumber || 1) - 1;
      const lines = processedInput.split('\n');
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const line = lines[lineIdx];
        const word = appliedFixInfo.fixedWord;
        const rawNew = appliedFixInfo.rawNew;
        const fixedSnippet = appliedFixInfo.fixedSnippet;

        if (word && line.includes(word)) {
          lines[lineIdx] = line.replace(word, `\uFFF0${word}\uFFF1`);
          processedInput = lines.join('\n');
        } else if (rawNew && rawNew.trim() && line.includes(rawNew)) {
          lines[lineIdx] = line.replace(rawNew, `\uFFF0${rawNew}\uFFF1`);
          processedInput = lines.join('\n');
        } else if (fixedSnippet && line.includes(fixedSnippet)) {
          lines[lineIdx] = line.replace(fixedSnippet, `\uFFF0${fixedSnippet}\uFFF1`);
          processedInput = lines.join('\n');
        }
      }
    } 
    // Otherwise, if there is an active bug detected before fixing, highlight the faulty word/expression
    else if (bugLineNumber && (activeDiff?.faultyWord || runResult?.bugAnalysis?.faultySnippet)) {
      const lineIdx = bugLineNumber - 1;
      const lines = processedInput.split('\n');
      if (lineIdx >= 0 && lineIdx < lines.length) {
        const line = lines[lineIdx];
        const faultyWord = activeDiff?.faultyWord;
        const faultySnippet = runResult?.bugAnalysis?.faultySnippet || activeDiff?.faultySnippet;

        if (faultyWord && line.includes(faultyWord)) {
          lines[lineIdx] = line.replace(faultyWord, `\uFFF2${faultyWord}\uFFF3`);
          processedInput = lines.join('\n');
        } else if (faultySnippet && line.includes(faultySnippet)) {
          lines[lineIdx] = line.replace(faultySnippet, `\uFFF2${faultySnippet}\uFFF3`);
          processedInput = lines.join('\n');
        }
      }
    }

    const highlighted = prism.highlight(processedInput, grammar, detectedLang);

    // Replace the private unicode markers with inline spans
    return highlighted
      .replace(/\uFFF0([\s\S]*?)\uFFF1/g, '<span class="cr-code-word-fixed" title="Fixed code expression">$1</span>')
      .replace(/\uFFF2([\s\S]*?)\uFFF3/g, '<span class="cr-code-word-error" title="Bug expression">$1</span>');
  };

  // Execute Code
  async function runCode() {
    if (!code || code.trim() === '') {
      showToast('Please enter code before running');
      return;
    }

    setIsRunning(true);
    setRunResult(null);
    setStudioTab('terminal'); // Switch side tab to Terminal!

    try {
      const response = await axios.post(`${BACKEND_BASE}/ai/run-code`, {
        code,
        language: detectedLang
      });
      setRunResult(response.data);
      setEngineOnline(true);
      saveSessionToHistory(code, review, response.data);

      if (response.data.status === 'success') {
        showToast('Process executed successfully');
      } else {
        showToast(`Bug identified at line ${response.data.bugAnalysis?.lineNumber || ''}`);
      }
    } catch (err) {
      console.error('Execution error:', err);
      setEngineOnline(false);
      const errMsg = err.response?.data?.error || err.message;
      const fallback = {
        status: 'error',
        executionTimeMs: 0,
        errorTrace: errMsg,
        bugAnalysis: {
          lineNumber: 1,
          bugLocation: 'Execution Container',
          cause: 'Backend execution container unreachable.',
          solution: 'Ensure backend server is running on port 5000.',
          fixedCode: code
        }
      };
      setRunResult(fallback);
      showToast('Backend execution offline');
      saveSessionToHistory(code, review, fallback);
    } finally {
      setIsRunning(false);
    }
  }

  // Senior Peer Review Audit
  async function reviewCode() {
    if (!code || code.trim() === '') {
      showToast('Please enter code before audit');
      return;
    }

    setStudioTab('review');
    setIsReviewing(true);

    try {
      const response = await axios.post(`${BACKEND_BASE}/ai/get-review`, {
        code,
        language: detectedLang
      });
      setReview(response.data);
      setEngineOnline(true);
      saveSessionToHistory(code, response.data, runResult);
      showToast('Senior peer review audit ready');
    } catch (err) {
      console.error('Review audit error:', err);
      setEngineOnline(false);
      const errDetail = err.response?.data?.error || err.message;
      setReview(`## ⚠️ Peer Audit Service Error\n\n**Could not connect to C-rev Review Engine:** \`${BACKEND_BASE}/ai/get-review\`\n\n**Details:** ${errDetail}\n\n### 💡 Solution:\n1. Ensure backend service is running on port **5000**.\n2. Ensure \`GEMINI_API_KEY\` is configured in \`Backend/.env\`.`);
    } finally {
      setIsReviewing(false);
    }
  }

  // Global Keyboard Shortcut: Ctrl+Enter (or Cmd+Enter) to trigger Code Review
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isReviewing && !isRunning) {
          reviewCode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, detectedLang, isRunning, isReviewing]);

  return (
    <div className="cr-app">
      {/* 1. TOP STUDIO NAVIGATION BAR */}
      <header className="cr-navbar">
        <div className="cr-nav-left">
          {/* Sidebar Toggle */}
          <button 
            className="cr-sidebar-toggle-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse History Sidebar" : "Open History Sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>

          {/* C-rev Brand */}
          <div className="cr-brand-cluster" onClick={handleCycleSample} title="C-rev Studio">
            <CrevLogo size={28} />
            <span className="cr-brand-name">C-rev</span>
            <span className="cr-brand-badge">STUDIO</span>
          </div>

          <div className="cr-nav-separator" />

          {/* Active File Path */}
          <div className="cr-breadcrumb">
            <span>workspace</span>
            <ChevronRight size={12} />
            <span>src</span>
            <ChevronRight size={12} />
            <span className="cr-file-pill">{FILE_NAMES[detectedLang] || 'source.code'}</span>
          </div>
        </div>

        {/* Action Controls Island */}
        <div className="cr-nav-actions">
          {/* Auto-detected Language Indicator */}
          <div className="cr-lang-pill" title="Language automatically detected from code syntax">
            <span className="cr-radar-dot" />
            <span className="cr-lang-label">Lang:</span>
            <span className="cr-lang-val">{LANGUAGE_LABELS[detectedLang] || detectedLang}</span>
          </div>

          {/* Upload Code Files Button */}
          <button 
            className="cr-btn-upload" 
            onClick={triggerFileUpload} 
            title="Upload code files (.py, .js, .ts, .cpp, .java, etc.)"
          >
            <Upload size={13} />
            <span>Upload Files</span>
          </button>

          {/* Batch Scan Workspace (LeetCode Style) */}
          {workspaceFiles.length > 1 && (
            <button 
              className="cr-btn-scan-nav" 
              onClick={handleScanAllFiles} 
              disabled={isScanningAll || isRunning}
              title="Batch scan all open workspace files for bugs"
            >
              {isScanningAll ? (
                <>
                  <Loader2 size={13} className="cr-spinner" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Zap size={13} />
                  <span>Scan All ({workspaceFiles.length})</span>
                </>
              )}
            </button>
          )}

          {/* Next Sample Code */}
          <button className="cr-btn-subtle" onClick={handleCycleSample} title="Cycle real-world code snippets">
            <RotateCcw size={13} />
            <span>Sample Snippets</span>
          </button>

          {/* Run Code Button (Secondary Executor) */}
          <button 
            className="cr-btn-run" 
            onClick={runCode} 
            disabled={isRunning || isReviewing}
            title="Execute code in runtime container"
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="cr-spinner" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Play size={12} fill="#2cbb5d" color="#2cbb5d" />
                <span>Run Code</span>
              </>
            )}
          </button>

          {/* Primary Hero Review Button (Highlighted & Animated) */}
          <button 
            className="cr-btn-review cr-btn-hero-animated" 
            onClick={reviewCode} 
            disabled={isRunning || isReviewing}
            title="Review Code (Ctrl + Enter)"
          >
            <span className="cr-review-shimmer-sweep" />
            {isReviewing ? (
              <>
                <Loader2 size={13} className="cr-spinner" />
                <span className="cr-review-btn-text">Reviewing...</span>
              </>
            ) : (
              <>
                <FileCheck size={14} className="cr-review-icon" />
                <span className="cr-review-btn-text">Code Review</span>
                <span className="cr-review-shortcut-tag">Ctrl ↵</span>
              </>
            )}
          </button>

          {/* Engine Status */}
          <div className={`cr-engine-chip ${engineOnline ? 'online' : 'offline'}`} title="C-rev Engine Status">
            <span className="cr-status-dot" />
            <span>{engineOnline ? 'Engine 2.1' : 'Offline'}</span>
          </div>

          <button className="cr-icon-btn" onClick={() => setShowSettings(true)} title="Settings">
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Hidden File Input for uploading multiple code files */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={(e) => handleAddFiles(e.target.files)} 
        multiple 
        accept=".py,.js,.jsx,.ts,.tsx,.cpp,.cc,.cxx,.c,.java,.go,.html,.css,.json,.rs,.php,.txt"
        style={{ display: 'none' }} 
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="cr-workspace">
        {/* LEFT DEDICATED HISTORY & FILES SIDEBAR */}
        <aside className={`cr-history-rail ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="cr-rail-header">
            {/* Mode Switcher: Workspace Files vs History */}
            <div className="cr-rail-mode-switch">
              <button 
                className={`cr-rail-mode-btn ${sidebarTab === 'files' ? 'active' : ''}`}
                onClick={() => setSidebarTab('files')}
              >
                <FolderOpen size={13} />
                <span>Files</span>
                <span className="cr-count-chip">{workspaceFiles.length}</span>
              </button>
              <button 
                className={`cr-rail-mode-btn ${sidebarTab === 'history' ? 'active' : ''}`}
                onClick={() => setSidebarTab('history')}
              >
                <Clock size={13} />
                <span>History</span>
                <span className="cr-count-chip">{history.length}</span>
              </button>
            </div>

            {sidebarTab === 'files' ? (
              <>
                <div className="cr-rail-actions-row">
                  <button className="cr-rail-sub-btn" onClick={triggerFileUpload} title="Upload code files">
                    <Upload size={12} />
                    <span>Upload</span>
                  </button>
                  <button className="cr-rail-sub-btn" onClick={handleNewSnippet} title="Create new file">
                    <Plus size={12} />
                    <span>New</span>
                  </button>
                  <button 
                    className="cr-rail-sub-btn scan" 
                    onClick={handleScanAllFiles} 
                    disabled={isScanningAll}
                    title="Scan all workspace files for bugs"
                  >
                    {isScanningAll ? <Loader2 size={12} className="cr-spinner" /> : <Zap size={12} />}
                    <span>Scan All</span>
                  </button>
                </div>

                {/* Quick File Search */}
                <div className="cr-search-box">
                  <Search size={12} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Search files..." 
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <button className="cr-new-btn" onClick={handleNewSnippet}>
                  <Plus size={13} />
                  <span>New Snippet</span>
                </button>

                {/* Quick History Search */}
                <div className="cr-search-box">
                  <Search size={12} color="#64748b" />
                  <input 
                    type="text" 
                    placeholder="Search history..." 
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Rail Body: Either Files list or History list */}
          {sidebarTab === 'files' ? (
            <div className="cr-files-list">
              {filteredWorkspaceFiles.length === 0 ? (
                <div className="cr-empty-history">
                  <span>No matching workspace files.</span>
                </div>
              ) : (
                filteredWorkspaceFiles.map(file => {
                  const isCurrent = file.id === activeFile.id;
                  const hasBug = file.runResult?.status === 'error';
                  const isFixed = Boolean(file.appliedFixInfo);
                  const isClean = file.runResult?.status === 'success';

                  return (
                    <div 
                      key={file.id} 
                      className={`cr-file-row ${isCurrent ? 'active' : ''} ${hasBug ? 'has-bug' : isFixed ? 'is-fixed' : isClean ? 'is-clean' : ''}`}
                      onClick={() => {
                        setActiveFileId(file.id);
                        if (file.runResult) setStudioTab('terminal');
                      }}
                    >
                      <div className="cr-file-row-left">
                        <FileCode size={14} className="cr-file-row-icon" />
                        <span className="cr-file-row-name" title={file.name}>{file.name}</span>
                      </div>

                      <div className="cr-file-row-right">
                        {hasBug ? (
                          <span className="cr-file-badge error" title={`Bug detected on line ${file.runResult.bugAnalysis?.lineNumber || '?'}`}>
                            Line {file.runResult.bugAnalysis?.lineNumber || '?'}: Bug
                          </span>
                        ) : isFixed ? (
                          <span className="cr-file-badge fixed" title="Fixed in editor">
                            Fixed
                          </span>
                        ) : isClean ? (
                          <span className="cr-file-badge clean" title="Clean execution (Exit 0)">
                            Clean
                          </span>
                        ) : (
                          <span className="cr-file-badge idle" title="Ready to scan">
                            Ready
                          </span>
                        )}

                        {workspaceFiles.length > 1 && (
                          <button 
                            className="cr-file-row-del"
                            onClick={(e) => handleCloseFile(e, file.id)}
                            title="Close file"
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="cr-history-list">
              {filteredHistory.length === 0 ? (
                <div className="cr-empty-history">
                  <span>No history saved yet. Run or review code to store snippets.</span>
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div 
                    key={item.id} 
                    className={`cr-history-card ${activeHistoryId === item.id ? 'active' : ''}`}
                    onClick={() => handleLoadHistory(item)}
                  >
                    <div className="cr-card-top">
                      <div className="cr-card-name-group">
                        <FileCode size={14} className="cr-card-icon" />
                        <span className="cr-card-title">{item.title}</span>
                      </div>
                      <button 
                        className="cr-card-del"
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        title="Delete from history"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="cr-card-bottom">
                      <span className="cr-card-lang">{item.language}</span>
                      <span className="cr-card-time">{formatTimeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Notice Footer */}
          <div className="cr-rail-footer">
            <Info size={12} />
            <span>{sidebarTab === 'files' ? 'Drag & drop code files anytime' : 'Auto-purges items older than 7 days'}</span>
          </div>
        </aside>

        {/* CENTER / SPLIT VIEW: Editor on Left, Review on Right */}
        <main className="cr-main-layout">
          {/* LEFT STUDIO PANE: Code Editor & Execution Console */}
          <section className="cr-editor-pane">
            <div className="cr-editor-header">
              <div className="cr-editor-tabs-scroll">
                {workspaceFiles.map((file) => {
                  const isActive = file.id === activeFile.id;
                  const hasBug = file.runResult?.status === 'error';
                  const isFixed = Boolean(file.appliedFixInfo);
                  const isClean = file.runResult?.status === 'success';

                  return (
                    <div 
                      key={file.id} 
                      className={`cr-file-tab ${isActive ? 'active' : ''} ${hasBug ? 'has-bug' : isFixed ? 'is-fixed' : ''}`}
                      onClick={() => setActiveFileId(file.id)}
                      title={file.name}
                    >
                      <FileCode size={13} className="cr-tab-icon" />
                      <span className="cr-tab-name">{file.name}</span>
                      {hasBug && (
                        <span className="cr-tab-status-dot bug" title={`Bug detected (Line ${file.runResult?.bugAnalysis?.lineNumber || '?'})`} />
                      )}
                      {isFixed && (
                        <span className="cr-tab-status-dot fixed" title="Bug fixed" />
                      )}
                      {isClean && (
                        <span className="cr-tab-status-dot clean" title="Clean execution" />
                      )}
                      {workspaceFiles.length > 1 && (
                        <button 
                          className="cr-tab-close-btn"
                          onClick={(e) => handleCloseFile(e, file.id)}
                          title="Close file"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button 
                  className="cr-tab-add-btn" 
                  onClick={triggerFileUpload}
                  title="Upload code files (.py, .js, .ts, .cpp, .java, etc.)"
                >
                  <Upload size={12} />
                  <span>Upload</span>
                </button>
                <button 
                  className="cr-tab-add-btn" 
                  onClick={handleNewSnippet}
                  title="Add new file to workspace"
                >
                  <Plus size={12} />
                  <span>New</span>
                </button>
              </div>

              <div className="cr-editor-metrics">
                <button 
                  className="cr-btn-download" 
                  onClick={handleDownloadFile} 
                  title={`Download "${activeFile.name}"`}
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
                <span className="cr-metric-tag">{codeLines.length} lines</span>
                <span className="cr-metric-tag">{code.length} chars</span>
                <button className="cr-btn-copy" onClick={handleCopyCode} title="Copy Code">
                  {copiedCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Fix Alert Banner above editor when fix is applied */}
            {appliedFixInfo && (
              <div className="cr-editor-fix-toast-bar">
                <div className="cr-toast-bar-content">
                  <span className="cr-fix-check-icon">
                    <CheckCircle2 size={15} />
                  </span>
                  <span>
                    <strong>Line {appliedFixInfo.lineNumber} Fixed:</strong> Replaced <code className="cr-toast-code-old">{appliedFixInfo.faultyWord || appliedFixInfo.faultySnippet}</code> with <code className="cr-toast-code-new">{appliedFixInfo.fixedWord || appliedFixInfo.fixedSnippet}</code>
                  </span>
                </div>
                <div className="cr-toast-bar-actions">
                  <button className="cr-btn-bar-run" onClick={runCode} title="Verify fix by executing code">
                    <Play size={12} />
                    <span>Run Fixed Code</span>
                  </button>
                  <button className="cr-btn-bar-dismiss" onClick={() => setAppliedFixInfo(null)} title="Dismiss highlight">
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Code Editor Body with Line Numbers Gutter & Drag Drop */}
            <div 
              className={`cr-editor-box ${isDraggingOver ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOver(false);
                handleDropFiles(e.dataTransfer.files);
              }}
            >
              {/* Drag and Drop Visual Overlay */}
              {isDraggingOver && (
                <div className="cr-drag-overlay">
                  <div className="cr-drag-box">
                    <Upload size={38} className="cr-drag-icon" />
                    <div className="cr-drag-title">Drop Code Files Here</div>
                    <div className="cr-drag-sub">Supports .py, .js, .ts, .cpp, .java, .go, .json & more</div>
                  </div>
                </div>
              )}

              {/* Line Numbers Gutter */}
              <div className="cr-editor-gutter" ref={gutterRef}>
                {codeLines.map((_, i) => {
                  const lineNo = i + 1;
                  const isFixedLine = appliedFixInfo?.lineNumber === lineNo;
                  const isBugLine = bugLineNumber === lineNo && !appliedFixInfo;
                  return (
                    <div 
                      key={lineNo} 
                      className={`cr-gutter-num ${isFixedLine ? 'fixed-line' : isBugLine ? 'error-line' : ''}`}
                      title={isFixedLine ? `Line ${lineNo}: Fix Applied` : isBugLine ? `Line ${lineNo}: Bug Detected` : undefined}
                    >
                      {isFixedLine && (
                        <span className="cr-gutter-fixed-dot" title={`Line ${lineNo} fixed`}>
                          <Check size={10} />
                        </span>
                      )}
                      {isBugLine && <span className="cr-gutter-dot" title={`Bug at line ${lineNo}`} />}
                      <span>{lineNo}</span>
                    </div>
                  );
                })}
              </div>

              {/* Simple Code Editor Canvas */}
              <div className="cr-editor-canvas" onScroll={handleEditorScroll}>
                {/* Visual Line Highlight overlay for fixed line */}
                {appliedFixInfo && (
                  <div 
                    className="cr-code-fixed-highlight-bar"
                    style={{
                      top: `${14 + (appliedFixInfo.lineNumber - 1) * 22}px`,
                      height: '22px'
                    }}
                  >
                    <span className="cr-fixed-line-badge">
                      <Check size={10} /> Line {appliedFixInfo.lineNumber} Fixed: {appliedFixInfo.fixedWord || appliedFixInfo.fixedSnippet}
                    </span>
                  </div>
                )}
                <Editor
                  value={code}
                  onValueChange={(val) => setCode(val)}
                  highlight={highlightCode}
                  padding={14}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13.5,
                    minHeight: '100%',
                    width: '100%',
                    backgroundColor: 'transparent',
                    color: '#f8fafc',
                    lineHeight: '22px'
                  }}
                />
              </div>
            </div>
          </section>

          {/* RIGHT STUDIO PANE: Terminal, Peer Review & Diagnostics Hub */}
          <section className="cr-studio-pane">
            <div className="cr-pane-header">
              <div className="cr-pane-tabs">
                <button 
                  className={`cr-pane-tab ${studioTab === 'terminal' ? 'active' : ''}`}
                  onClick={() => setStudioTab('terminal')}
                >
                  <Terminal size={14} />
                  <span>Terminal</span>
                  {runResult && (
                    <span className={`cr-tab-dot ${runResult.status === 'success' ? 'success' : 'error'}`} />
                  )}
                </button>

                <button 
                  className={`cr-pane-tab ${studioTab === 'review' ? 'active' : ''}`}
                  onClick={() => setStudioTab('review')}
                >
                  <ShieldCheck size={14} />
                  <span>Peer Review</span>
                  {review && <span className="cr-tab-dot success" />}
                </button>

                <button 
                  className={`cr-pane-tab ${studioTab === 'diagnostics' ? 'active' : ''}`}
                  onClick={() => setStudioTab('diagnostics')}
                >
                  <AlertTriangle size={14} />
                  <span>Diagnostics</span>
                  {activeDiff && (
                    <span className={`cr-tab-badge ${activeDiff.isApplied ? 'success' : 'error'}`}>
                      {activeDiff.isApplied ? 'Fixed' : 'Error'}
                    </span>
                  )}
                </button>

                <button 
                  className={`cr-pane-tab ${studioTab === 'complexity' ? 'active' : ''}`}
                  onClick={() => setStudioTab('complexity')}
                >
                  <Layers size={14} />
                  <span>Architecture</span>
                </button>
              </div>

              <div className="cr-pane-header-right">
                {workspaceFiles.length > 1 && (
                  <span className="cr-workspace-subtle-badge">
                    {workspaceFiles.filter(f => f.runResult?.status === 'error').length > 0 
                      ? `${workspaceFiles.filter(f => f.runResult?.status === 'error').length}/${workspaceFiles.length} with bugs` 
                      : `${workspaceFiles.length} files clean`}
                  </span>
                )}
                {studioTab === 'review' && review && (
                  <button className="cr-btn-copy" onClick={handleCopyReview} title="Copy Review">
                    {copiedReview ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copiedReview ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pane Content */}
            <div className="cr-pane-body">
              {/* TAB 0: RUNTIME TERMINAL (SIDE VIEW) */}
              {studioTab === 'terminal' && (
                <div className="cr-tab-content">
                  {isRunning ? (
                    <div className="cr-loading-block">
                      <Loader2 size={24} className="cr-spinner" color="#10b981" />
                      <div className="cr-loading-title">Executing code in runtime container...</div>
                      <p className="cr-loading-desc">Streaming standard output, evaluating error trace, and profiling execution time.</p>
                      <div className="cr-skeleton-bar" />
                      <div className="cr-skeleton-bar" style={{ width: '70%' }} />
                    </div>
                  ) : runResult ? (
                    <div className="cr-side-terminal-card">
                      <div className="cr-side-terminal-top">
                        <div className="cr-status-badge-group">
                          {runResult.status === 'success' ? (
                            <span className="cr-status-pill-success">
                              <CheckCircle2 size={13} />
                              Exit Code: 0 (Execution Successful)
                            </span>
                          ) : (
                            <span className="cr-status-pill-error">
                              <AlertTriangle size={13} />
                              Exit Code: 1 (Runtime Error)
                            </span>
                          )}
                        </div>
                        <span className="cr-side-time-tag">{runResult.executionTimeMs || 40} ms</span>
                      </div>

                      {/* DUAL COMPARISON: Both Error Code & Fixed Code */}
                      {activeDiff && (
                        <div className={`cr-diff-comparison-card ${activeDiff.isApplied ? 'applied' : 'pending'}`}>
                          <div className="cr-diff-card-header">
                            <div className="cr-diff-status-badge">
                              {activeDiff.isApplied ? (
                                <span className="cr-diff-badge-applied">
                                  <CheckCircle2 size={14} />
                                  <span>Line {activeDiff.lineNo}: Fix Applied to Code Editor</span>
                                </span>
                              ) : (
                                <span className="cr-diff-badge-pending">
                                  <AlertTriangle size={14} />
                                  <span>Line {activeDiff.lineNo}: Bug Detected & Ready to Fix</span>
                                </span>
                              )}
                            </div>

                            <div className="cr-diff-actions">
                              {activeDiff.isApplied ? (
                                <>
                                  <button 
                                    className="cr-btn-rerun-fixed"
                                    onClick={runCode}
                                    title="Run the corrected code"
                                  >
                                    <Play size={12} />
                                    <span>Run Fixed Code</span>
                                  </button>
                                  <button 
                                    className="cr-btn-revert-fix"
                                    onClick={handleRevertFix}
                                    title="Revert back to original code"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Revert</span>
                                  </button>
                                </>
                              ) : (
                                <button 
                                  className="cr-btn-apply-fix"
                                  onClick={() => handleApplyFix(activeDiff.fixedCode, runResult?.bugAnalysis)}
                                  title="Replace editor code with corrected version"
                                >
                                  <Zap size={13} />
                                  <span>Apply Quick Fix</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Dual Error vs Fixed Panels */}
                          <div className="cr-diff-dual-container">
                            {/* 1. FAULTY ERROR CODE (RED) */}
                            <div className="cr-diff-panel cr-diff-error-panel">
                              <div className="cr-diff-panel-head">
                                <div className="cr-diff-label">
                                  <XCircle size={13} color="#f87171" />
                                  <span>Faulty Code (Error - Line {activeDiff.lineNo})</span>
                                </div>
                                <span className="cr-diff-pill-error">ERROR</span>
                              </div>
                              <pre className="cr-diff-code error">
                                <code>- {activeDiff.faultySnippet}</code>
                              </pre>
                              {activeDiff.faultyWord && (
                                <div className="cr-diff-token-hint">
                                  <span className="cr-diff-hint-label">Bug expression:</span> <code className="cr-toast-code-old">{activeDiff.faultyWord}</code>
                                </div>
                              )}
                              <div className="cr-diff-panel-desc error">
                                <strong>Root Cause:</strong> {activeDiff.cause}
                              </div>
                            </div>

                            {/* 2. CORRECTED FIXED CODE (GREEN) */}
                            <div className="cr-diff-panel cr-diff-fixed-panel">
                              <div className="cr-diff-panel-head">
                                <div className="cr-diff-label">
                                  <CheckCircle2 size={13} color="#4ade80" />
                                  <span>Corrected Code (Fixed - Line {activeDiff.lineNo})</span>
                                </div>
                                <span className="cr-diff-pill-fixed">FIXED</span>
                              </div>
                              <pre className="cr-diff-code fixed">
                                <code>+ {activeDiff.fixedSnippet}</code>
                              </pre>
                              {activeDiff.fixedWord && (
                                <div className="cr-diff-token-hint">
                                  <span className="cr-diff-hint-label">Fixed expression:</span> <code className="cr-toast-code-new">{activeDiff.fixedWord}</code>
                                </div>
                              )}
                              <div className="cr-diff-panel-desc fixed">
                                <strong>Fix Applied:</strong> {activeDiff.solution}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="cr-terminal-label-row">
                        <span>Terminal Output ($ {FILE_NAMES[detectedLang] || 'run'})</span>
                      </div>
                      <pre className="cr-side-terminal-output">
                        {runResult.output || runResult.errorTrace || '(Execution finished with no console output)'}
                      </pre>
                    </div>
                  ) : (
                    <div className="cr-empty-panel">
                      <div className="cr-empty-icon-ring" style={{ color: '#238636', borderColor: 'rgba(35, 134, 54, 0.4)' }}>
                        <Terminal size={28} />
                      </div>
                      <h3>Runtime Terminal Ready</h3>
                      <p>
                        Click <strong>"Run Code"</strong> in the top toolbar to execute this code. Output and runtime diagnostics will stream right here on the side.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 1: PEER REVIEW AUDIT */}
              {studioTab === 'review' && (
                <div className="cr-tab-content">
                  {isReviewing ? (
                    <div className="cr-loading-block">
                      <Loader2 size={22} className="cr-spinner" color="#38bdf8" />
                      <div className="cr-loading-title">Senior Engineer Peer Audit in Progress...</div>
                      <p className="cr-loading-desc">
                        Analyzing abstract syntax tree, Big-O complexities, security attack vectors, and formulating production refactoring.
                      </p>
                      <div className="cr-skeleton-bar" />
                      <div className="cr-skeleton-bar" style={{ width: '80%' }} />
                      <div className="cr-skeleton-bar" style={{ width: '60%' }} />
                    </div>
                  ) : review ? (
                    <div className="cr-markdown-wrapper">
                      {/* Concise Core Review for Programmers */}
                      <div className="cr-concise-card">
                        <Markdown rehypePlugins={[rehypeHighlight]}>
                          {conciseSection}
                        </Markdown>
                      </div>

                      {/* Explain in Detail Button & Section */}
                      {detailedSection && (
                        <div className="cr-detail-accordion">
                          <button 
                            className={`cr-btn-detail-toggle ${showDetailedReview ? 'open' : ''}`}
                            onClick={() => setShowDetailedReview(!showDetailedReview)}
                            title="Toggle in-depth edge cases and production refactoring"
                          >
                            {showDetailedReview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            <span>{showDetailedReview ? 'Hide In-Depth Analysis' : '🔍 Explain in Detail (Edge Cases & Architecture)'}</span>
                          </button>

                          {showDetailedReview && (
                            <div className="cr-detail-expanded-card">
                              <Markdown rehypePlugins={[rehypeHighlight]}>
                                {detailedSection}
                              </Markdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="cr-empty-panel">
                      <div className="cr-empty-icon-ring">
                        <Activity size={28} />
                      </div>
                      <h3>Senior Peer Review Ready</h3>
                      <p>
                        Generate a comprehensive senior engineering code review, security audit, and architecture refactoring.
                      </p>
                      <button 
                        className="cr-btn-review cr-btn-hero-animated cr-empty-review-cta" 
                        onClick={reviewCode} 
                        disabled={isRunning || isReviewing}
                        title="Start Code Review (Ctrl + Enter)"
                      >
                        <span className="cr-review-shimmer-sweep" />
                        {isReviewing ? (
                          <>
                            <Loader2 size={14} className="cr-spinner" />
                            <span>Analyzing Code & Architecture...</span>
                          </>
                        ) : (
                          <>
                            <FileCheck size={15} className="cr-review-icon" />
                            <span>Start Code Review</span>
                            <span className="cr-review-shortcut-tag">Ctrl ↵</span>
                          </>
                        )}
                      </button>
                      <div className="cr-feature-pills">
                        <div className="cr-pill-item"><ShieldCheck size={14} /> Security Vulnerabilities</div>
                        <div className="cr-pill-item"><Zap size={14} /> Big-O Performance</div>
                        <div className="cr-pill-item"><CheckCircle2 size={14} /> Clean Code Patterns</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: BUG DIAGNOSTICS & QUICK FIX */}
              {studioTab === 'diagnostics' && (
                <div className="cr-tab-content">
                  {activeDiff ? (
                    <div className="cr-diag-wrapper">
                      {/* DUAL COMPARISON: Both Error Code & Fixed Code */}
                      <div className={`cr-diff-comparison-card ${activeDiff.isApplied ? 'applied' : 'pending'}`}>
                        <div className="cr-diff-card-header">
                          <div className="cr-diff-status-badge">
                            {activeDiff.isApplied ? (
                              <span className="cr-diff-badge-applied">
                                <CheckCircle2 size={14} />
                                <span>Line {activeDiff.lineNo}: Fix Applied to Code Editor</span>
                              </span>
                            ) : (
                              <span className="cr-diff-badge-pending">
                                <AlertTriangle size={14} />
                                <span>Line {activeDiff.lineNo}: Bug Detected & Ready to Fix</span>
                              </span>
                            )}
                          </div>

                          <div className="cr-diff-actions">
                            {activeDiff.isApplied ? (
                              <>
                                <button 
                                  className="cr-btn-rerun-fixed"
                                  onClick={runCode}
                                  title="Run the corrected code"
                                >
                                  <Play size={12} />
                                  <span>Run Fixed Code</span>
                                </button>
                                <button 
                                  className="cr-btn-revert-fix"
                                  onClick={handleRevertFix}
                                  title="Revert back to original code"
                                >
                                  <RotateCcw size={12} />
                                  <span>Revert</span>
                                </button>
                              </>
                            ) : (
                              <button 
                                className="cr-btn-apply-fix"
                                onClick={() => handleApplyFix(activeDiff.fixedCode, runResult?.bugAnalysis)}
                                title="Replace editor code with corrected version"
                              >
                                <Zap size={13} />
                                <span>Apply Quick Fix</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dual Error vs Fixed Panels */}
                        <div className="cr-diff-dual-container">
                          {/* 1. FAULTY ERROR CODE (RED) */}
                          <div className="cr-diff-panel cr-diff-error-panel">
                            <div className="cr-diff-panel-head">
                              <div className="cr-diff-label">
                                <XCircle size={13} color="#f87171" />
                                <span>Faulty Code (Error - Line {activeDiff.lineNo})</span>
                              </div>
                              <span className="cr-diff-pill-error">ERROR</span>
                            </div>
                            <pre className="cr-diff-code error">
                              <code>- {activeDiff.faultySnippet}</code>
                            </pre>
                            {activeDiff.faultyWord && (
                              <div className="cr-diff-token-hint">
                                <span className="cr-diff-hint-label">Bug expression:</span> <code className="cr-toast-code-old">{activeDiff.faultyWord}</code>
                              </div>
                            )}
                            <div className="cr-diff-panel-desc error">
                              <strong>Root Cause:</strong> {activeDiff.cause}
                            </div>
                          </div>

                          {/* 2. CORRECTED FIXED CODE (GREEN) */}
                          <div className="cr-diff-panel cr-diff-fixed-panel">
                            <div className="cr-diff-panel-head">
                              <div className="cr-diff-label">
                                <CheckCircle2 size={13} color="#4ade80" />
                                <span>Corrected Code (Fixed - Line {activeDiff.lineNo})</span>
                              </div>
                              <span className="cr-diff-pill-fixed">FIXED</span>
                            </div>
                            <pre className="cr-diff-code fixed">
                              <code>+ {activeDiff.fixedSnippet}</code>
                            </pre>
                            {activeDiff.fixedWord && (
                              <div className="cr-diff-token-hint">
                                <span className="cr-diff-hint-label">Fixed expression:</span> <code className="cr-toast-code-new">{activeDiff.fixedWord}</code>
                              </div>
                            )}
                            <div className="cr-diff-panel-desc fixed">
                              <strong>Fix Applied:</strong> {activeDiff.solution}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Complete Runnable Source Code */}
                      <div className="cr-diag-section" style={{ marginTop: '0.75rem' }}>
                        <div className="cr-diag-label">Complete Corrected Source Code:</div>
                        <pre className="cr-fixed-code-block">
                          <code>{activeDiff.fixedCode}</code>
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="cr-empty-panel">
                      <div className="cr-empty-icon-ring" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}>
                        <CheckCircle2 size={28} />
                      </div>
                      <h3>No Active Code Bugs</h3>
                      <p>
                        When code execution encounters an exception, syntax flaw, or division error, the exact line diagnosis and 1-click solution will show here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ARCHITECTURE & COMPLEXITY */}
              {studioTab === 'complexity' && (
                <div className="cr-tab-content">
                  <div className="cr-arch-overview">
                    <div className="cr-arch-card">
                      <h4>⚡ Execution Engine Architecture</h4>
                      <p>
                        C-rev utilizes an isolated Node.js child-process container for JavaScript/TypeScript and native Python runtime sandboxing, coupled with Gemini 3.5 for multi-perspective senior peer code audits.
                      </p>
                    </div>
                    <div className="cr-arch-card">
                      <h4>🛡️ Defensive Engineering Guidelines</h4>
                      <ul>
                        <li>Input validation before arithmetic operations.</li>
                        <li>Safe optional chaining (<code>?.</code>) for deep nested object keys.</li>
                        <li>Explicit bounds checking on array iteration indices.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="cr-modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="cr-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cr-modal-head">
              <h3>C-rev Studio Settings</h3>
              <button className="cr-icon-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="cr-modal-content">
              <div className="cr-setting-item">
                <div>
                  <div className="cr-set-title">Color Theme</div>
                  <div className="cr-set-sub">C-rev Obsidian & Electric Cobalt</div>
                </div>
                <span className="cr-set-pill">Studio Pro</span>
              </div>
              <div className="cr-setting-item">
                <div>
                  <div className="cr-set-title">1-Week History Retention</div>
                  <div className="cr-set-sub">Auto-purges submissions older than 7 days</div>
                </div>
                <span className="cr-set-pill">Active (7 Days)</span>
              </div>
              <div className="cr-setting-item">
                <div>
                  <div className="cr-set-title">Clear Local History</div>
                  <div className="cr-set-sub">Permanently delete stored snippet history</div>
                </div>
                <button 
                  className="cr-btn-danger"
                  onClick={() => {
                    localStorage.removeItem('crev_code_history');
                    setHistory([]);
                    showToast('History cleared');
                    setShowSettings(false);
                  }}
                >
                  Clear History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="cr-toast">
          <CheckCircle2 size={14} color="#38bdf8" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
