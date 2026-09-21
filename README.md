# C-rev — Code Inspection & Peer Review Studio

A high-performance, developer-first code review and execution studio designed for programmers. Features real-time static code analysis, multi-file workspace management, runtime execution, and precision word-level bug and fix diffing.

---

## Key Features

- **Automated Peer Review & Diagnostics**: Comprehensive analysis of code health, Big-O time and space complexity, runtime vulnerabilities, and architecture refactoring.
- **Dual Diff & Word-Level Highlighting**: Pinpoints the exact faulty token before execution and highlights the corrected expression directly in the code editor canvas.
- **Safe Code Execution**: Live runtime sandbox executing Python and JavaScript/Node.js routines with real-time output and error trace capture.
- **Multi-File Workspace**: Supports managing multiple files simultaneously with batch scanning, tabs, file upload, and drag-and-drop.
- **LeetCode Dark Theme**: Clean, low-contrast dark mode tailored for programmers with zero cursor drift in the code editor.
- **Keyboard-First Workflow**: Full keyboard shortcut support (`Ctrl + Enter` / `Cmd + Enter` to trigger reviews instantly).

---

## Architecture Overview

```
c-rev/
├── Frontend/                 # React 18 + Vite + Prism.js + Lucide
│   ├── src/
│   │   ├── App.jsx           # Main Studio & Dual-Pane Interface
│   │   ├── App.css           # LeetCode-grade Dark Slate Design
│   │   └── main.jsx
│   └── package.json
│
├── Backend/                  # Express.js Inspection & Execution Engine
│   ├── server.js             # Runtime execution & review API
│   ├── .env.example          # Environment template
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Quick Start

### 1. Prerequisites
- **Node.js**: v18+ or v20+ recommended
- **Python**: 3.8+ (for executing Python scripts locally)

### 2. Backend Setup
```bash
cd Backend
npm install
cp .env.example .env
# Configure your GEMINI_API_KEY in Backend/.env
node server.js
```
The backend engine will start on `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser to launch the studio.

---

## Tech Stack

- **Frontend**: React 18, Vite, Prism.js (Syntax Highlighting), Lucide Icons, Rehype / Highlight.js
- **Backend**: Node.js, Express.js, Child Process Execution Sandbox
- **Engine**: AST Analysis, Big-O Complexity Profiler, Automated Diagnostic Remediator

---

## License
MIT License. Created for software engineering research and peer review education.
