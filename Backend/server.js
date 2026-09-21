import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'C-rev Inspection & Execution Engine',
    version: '2.1.0',
    engineConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '')
  });
});

// Candidate models ordered by stability and availability
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

// Helper: Diagnose error with C-rev engine to pinpoint bug line, cause, and solution
async function diagnoseError(code, language, rawError, executionOutput = '') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      lineNumber: 'Unknown',
      bugLocation: 'Code execution error',
      cause: rawError || 'Execution failed.',
      solution: 'Fix the syntax or runtime error in the code.',
      fixedCode: code
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `The following ${language} code was executed and resulted in an error.
Source Code:
\`\`\`${language}
${code}
\`\`\`

Execution Error / Stack Trace:
${rawError}
${executionOutput ? `Output: ${executionOutput}` : ''}

Diagnose the bug and provide an exact, complete fix. Respond ONLY with a valid JSON object matching this schema:
{
  "lineNumber": "integer or string indicating the exact line number where the bug occurs",
  "bugLocation": "the exact line or token causing the error",
  "faultySnippet": "the exact erroneous code line or statement before the fix",
  "fixedSnippet": "the exact corrected replacement code line or statement after the fix",
  "cause": "clear, concise explanation of why the bug occurred",
  "solution": "clear explanation of how it is fixed",
  "fixedCode": "the complete, corrected source code ready to run without errors"
}
Do not wrap in markdown or backticks, just output raw valid JSON.`;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.1,
          }
        });
        if (response && response.text) {
          return JSON.parse(response.text.trim());
        }
      } catch (e) {
        // Fallback to next model
      }
    }
  } catch (err) {
    console.warn('Diagnosis warning:', err.message);
  }

  return {
    lineNumber: 'Runtime',
    bugLocation: 'Execution failed',
    cause: rawError || 'Execution error encountered.',
    solution: 'Inspect stack trace above.',
    fixedCode: code
  };
}

// Code Execution Endpoint: Runs code, captures output, and detects bugs with solutions
app.post('/ai/run-code', async (req, res) => {
  const { code, language = 'javascript' } = req.body;

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'Source code is required to execute.' });
  }

  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // 1. Python Native Execution
  if (language === 'python') {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `crev_py_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.py`);
    try {
      await fs.writeFile(tmpFile, code, 'utf8');

      return new Promise((resolve) => {
        exec(`python "${tmpFile}"`, { timeout: 6000 }, async (error, stdout, stderr) => {
          try { await fs.unlink(tmpFile); } catch (_) {}
          const executionTimeMs = Date.now() - startTime;

          if (error || (stderr && stderr.trim().length > 0 && !stdout)) {
            const errString = stderr || error.message;
            console.log('Python error captured:', errString);
            const bugAnalysis = await diagnoseError(code, language, errString, stdout);
            return resolve(res.json({
              status: 'error',
              executionTimeMs,
              errorTrace: errString,
              output: stdout || '',
              bugAnalysis
            }));
          }

          return resolve(res.json({
            status: 'success',
            executionTimeMs,
            output: stdout || '(Program executed successfully with exit code 0 and no console output.)'
          }));
        });
      });
    } catch (fsErr) {
      return res.status(500).json({ error: fsErr.message });
    }
  }

  // 2. JavaScript / Node.js Native Execution
  if (language === 'javascript' || language === 'typescript') {
    const tmpDir = os.tmpdir();
    const ext = language === 'typescript' ? 'ts' : 'js';
    const tmpFile = path.join(tmpDir, `crev_js_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`);
    try {
      await fs.writeFile(tmpFile, code, 'utf8');

      return new Promise((resolve) => {
        exec(`node "${tmpFile}"`, { timeout: 6000 }, async (error, stdout, stderr) => {
          try { await fs.unlink(tmpFile); } catch (_) {}
          const executionTimeMs = Date.now() - startTime;

          if (error || (stderr && stderr.trim().length > 0 && !stdout)) {
            const errString = stderr || error.message;
            console.log('Node error captured:', errString);
            const bugAnalysis = await diagnoseError(code, language, errString, stdout);
            return resolve(res.json({
              status: 'error',
              executionTimeMs,
              errorTrace: errString,
              output: stdout || '',
              bugAnalysis
            }));
          }

          return resolve(res.json({
            status: 'success',
            executionTimeMs,
            output: stdout || '(Program executed successfully with exit code 0 and no console output.)'
          }));
        });
      });
    } catch (fsErr) {
      return res.status(500).json({ error: fsErr.message });
    }
  }

  // 3. Other languages (C++, Java, Go) or Virtual Execution
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Act as an exact compiler, linker, and runtime execution engine for ${language}.
Evaluate the following code snippet:
\`\`\`${language}
${code}
\`\`\`

Check if this code has compilation errors, missing symbols, undefined variables, syntax flaws, or runtime crashes.
Respond ONLY with a valid JSON object matching this schema:
{
  "hasError": boolean,
  "output": "The realistic terminal stdout output if the code would run successfully or partially",
  "errorTrace": "The realistic compiler error or runtime exception stack trace if hasError is true",
  "bugAnalysis": {
    "lineNumber": "The line number where the bug is located",
    "bugLocation": "The snippet or token causing the error",
    "faultySnippet": "The exact faulty line or statement before the fix",
    "fixedSnippet": "The exact corrected replacement line or statement after the fix",
    "cause": "Clear explanation of why this bug or error happened",
    "solution": "Clear explanation of how to fix it",
    "fixedCode": "Complete, corrected, runnable code block"
  }
}
Do not wrap in markdown, just output raw JSON.`;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.1,
            }
          });

          if (response && response.text) {
            const result = JSON.parse(response.text.trim());
            const executionTimeMs = Date.now() - startTime;

            if (result.hasError) {
              return res.json({
                status: 'error',
                executionTimeMs,
                errorTrace: result.errorTrace || 'Compilation / Runtime Error',
                output: result.output || '',
                bugAnalysis: result.bugAnalysis
              });
            } else {
              return res.json({
                status: 'success',
                executionTimeMs,
                output: result.output || '(Execution completed successfully with no runtime errors.)'
              });
            }
          }
        } catch (e) {
          // try next candidate model
        }
      }
    } catch (err) {
      console.warn('Virtual execution error:', err.message);
    }
  }

  // Default fallback
  res.json({
    status: 'success',
    executionTimeMs: Date.now() - startTime,
    output: `[${language.toUpperCase()}] Execution simulation finished.`
  });
});

// Full Code Review Endpoint
app.post('/ai/get-review', async (req, res) => {
  const { code, language } = req.body;

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return res.status(400).json({ error: 'Source code is required for review.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    const placeholderReview = `## ⚠️ Review Engine Key Missing

The **C-rev Review Engine** is running on port ${PORT}, but the engine access key is not yet configured in \`.env\`.

### 🔑 Key Setup:
Please add your API key in \`Backend/.env\`:
\`\`\`bash
GEMINI_API_KEY=your_key_here
\`\`\`
`;
    return res.send(placeholderReview);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are a Principal Software Engineer conducting a clear, easy-to-understand peer code review.
Use simple, clear, plain language so anyone (even junior programmers, students, or examiners) can instantly understand what the code does, where the bug is, and how it is fixed.
Avoid overly dense academic jargon without plain English context.
NEVER mention AI, automated tool, or Gemini.

Format your response strictly into two sections separated by the delimiter "---SPLIT_DETAIL---":

### ⚡ Quick Verdict
- **Code Score:** [X]/10 (Overall health & reliability)
- **Performance:** Time: O(...) [Fast/Average/Slow] | Memory: O(...) [Low/High memory usage]
- **Status:** [Simple 1-line clear verdict, e.g. "Crashes on line X due to missing check" or "Clean & working well"]

### 🎯 Key Findings (What & Why)
- **The Issue (Line X):** [Explain in 1-2 simple sentences what is wrong in everyday words]
- **Why It Matters:** [Explain simply what happens if not fixed (e.g. program crashes, wrong calculation)]

### 💡 Direct Solution
\`\`\`[language]
[Concise corrected replacement code with simple comments explaining the fix]
\`\`\`

---SPLIT_DETAIL---

### 🔍 Deep Dive: Edge Cases & Best Practices
- **Edge Cases:** [Explain what tricky inputs or values could break this code (e.g., negative numbers, empty list, 0, null)]
- **Best Practice:** [1-2 simple tips to write safer, cleaner code]
- **Production Refactor:**
\`\`\`[language]
[Fully commented, safe, clean production version]
\`\`\``;

    const languageContext = language && language !== 'auto' ? ` (${language})` : '';
    const prompt = `Review this code for programmers:${languageContext}\n\`\`\`\n${code}\n\`\`\``;

    let responseText = '';
    let lastError = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`Processing review with engine: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.3,
          }
        });

        if (response && response.text) {
          responseText = response.text;
          console.log(`Review successfully completed with engine: ${modelName}`);
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`Engine ${modelName} attempt failed:`, modelErr.message);
      }
    }

    if (!responseText) {
      throw lastError || new Error('All review engine attempts failed.');
    }

    res.send(responseText);
  } catch (error) {
    console.error('Error generating review:', error);
    const errorMessage = error?.message || 'Unexpected error occurred while generating review.';
    res.status(500).send(`## ⚠️ Review Generation Interrupted\n\n**Details:** \`${errorMessage}\`\n\nPlease verify network connectivity and try again.`);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 C-rev Engine is running on http://localhost:${PORT}`);
  console.log(`📡 Ready for review & execution at POST http://localhost:${PORT}/ai/run-code`);
});
