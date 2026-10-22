import pg from "pg";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const NEW_QUESTIONS = [
  // MS Word Home Tab (9 questions)
  {
    topic: "MS Word Home Tab",
    question: "What is the default font displayed in MS Word's Home tab Font group?",
    optionA: "Arial, 10", optionB: "Times New Roman, 12",
    optionC: "Calibri (Body), 11", optionD: "Calibri, 10",
    correctAnswer: "C",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which group of commands is located immediately to the right of the Paste button?",
    optionA: "Font group", optionB: "Format Painter",
    optionC: "Styles gallery", optionD: "Editing group",
    correctAnswer: "B",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which style appears directly below \"Normal\" in the Styles gallery?",
    optionA: "Heading 1", optionB: "No Space",
    optionC: "Title", optionD: "Subtitle",
    correctAnswer: "B",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which feature would you use to copy formatting (e.g., font, size, color) from one part of the document to another?",
    optionA: "Paste", optionB: "Find",
    optionC: "Format Painter", optionD: "Replace",
    correctAnswer: "C",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which tab contains tools for adding tables, pictures, and page breaks?",
    optionA: "HOME", optionB: "INSERT",
    optionC: "PAGE LAYOUT", optionD: "DESIGN",
    correctAnswer: "B",
  },
  {
    topic: "MS Word Home Tab",
    question: "Under which group would you find the commands \"Find\", \"Replace\", and \"Select\"?",
    optionA: "Clipboard", optionB: "Font",
    optionC: "Styles", optionD: "Editing",
    correctAnswer: "D",
  },
  {
    topic: "MS Word Home Tab",
    question: "The placeholder \"AaBbCcDc\" repeated in the Styles gallery typically indicates:",
    optionA: "The style's formatting", optionB: "A list of keyboard shortcuts",
    optionC: "The document's author name", optionD: "A spelling error",
    correctAnswer: "A",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which style would most likely be used for the main heading of a report?",
    optionA: "Normal", optionB: "Heading 1",
    optionC: "Subtitle", optionD: "No Space",
    correctAnswer: "B",
  },
  {
    topic: "MS Word Home Tab",
    question: "Which ribbon tab allows you to change paper size, margins, and orientation?",
    optionA: "INSERT", optionB: "PAGE LAYOUT",
    optionC: "VIEW", optionD: "REFERENCES",
    correctAnswer: "B",
  },

  // MS Word File Menu (10 questions)
  {
    topic: "MS Word File Menu",
    question: "Which of the following options is NOT listed in the File menu?",
    optionA: "Info", optionB: "Save As",
    optionC: "Page Setup", optionD: "Close",
    correctAnswer: "C",
  },
  {
    topic: "MS Word File Menu",
    question: "Which option would you use to create a blank document or choose a template?",
    optionA: "Open", optionB: "New",
    optionC: "Save", optionD: "Print",
    correctAnswer: "B",
  },
  {
    topic: "MS Word File Menu",
    question: "If you want to send a document via email as a PDF attachment, which option is most direct?",
    optionA: "Print", optionB: "Save As",
    optionC: "Share", optionD: "Export",
    correctAnswer: "C",
  },
  {
    topic: "MS Word File Menu",
    question: "Which option saves the current document with a different name or in a different location?",
    optionA: "Save", optionB: "Save As",
    optionC: "Export", optionD: "Close",
    correctAnswer: "B",
  },
  {
    topic: "MS Word File Menu",
    question: "To remove the current document from the screen without closing the application, you would use:",
    optionA: "Close", optionB: "Minimize",
    optionC: "Save", optionD: "Info",
    correctAnswer: "B",
  },
  {
    topic: "MS Word File Menu",
    question: "Which option displays document properties, protection settings, and version history?",
    optionA: "Info", optionB: "New",
    optionC: "Open", optionD: "Export",
    correctAnswer: "A",
  },
  {
    topic: "MS Word File Menu",
    question: "A user needs to send the document to a printer. Which command should they click?",
    optionA: "Share", optionB: "Export",
    optionC: "Print", optionD: "Close",
    correctAnswer: "C",
  },
  {
    topic: "MS Word File Menu",
    question: "Which option would you choose to convert a document into a PDF or change file type (e.g., .docx to .pdf)?",
    optionA: "Save", optionB: "Export",
    optionC: "Share", optionD: "Info",
    correctAnswer: "B",
  },
  {
    topic: "MS Word File Menu",
    question: "Which option allows you to open a previously saved document from your computer or cloud storage?",
    optionA: "New", optionB: "Open",
    optionC: "Save", optionD: "Close",
    correctAnswer: "B",
  },
  {
    topic: "MS Word File Menu",
    question: "If you have just finished editing a document and want to keep the latest changes, you click:",
    optionA: "Save", optionB: "Save As",
    optionC: "Close", optionD: "Export",
    correctAnswer: "A",
  },
];

async function generateExplanations(questions: typeof NEW_QUESTIONS): Promise<string[]> {
  const prompt = `You are an MS Word exam tutor. For each MCQ below, write a SHORT explanation (1-2 sentences max) of WHY the correct answer is correct. Be direct and educational. Do NOT start with "The correct answer is..." — just explain the key concept.

Return ONLY a valid JSON array of strings (no markdown, no extra text), one explanation per question in the same order.

Questions:
${questions.map((q, i) => {
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
    const idx = ["A", "B", "C", "D"].indexOf(q.correctAnswer);
    return `${i + 1}. [${q.topic}] ${q.question}
  A) ${opts[0]}  B) ${opts[1]}  C) ${opts[2]}  D) ${opts[3]}
  Correct: ${q.correctAnswer}) ${opts[idx]}`;
  }).join("\n\n")}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  const text = data.candidates[0].content.parts[0].text.trim();
  const jsonStr = text.startsWith("```") ? text.replace(/```json?\n?/g, "").replace(/```/g, "").trim() : text;
  const explanations: string[] = JSON.parse(jsonStr);
  if (explanations.length !== questions.length) throw new Error(`Got ${explanations.length} explanations for ${questions.length} questions`);
  return explanations;
}

async function main() {
  // 1. Check for duplicates to keep idempotent
  const { rows: existing } = await pool.query(
    `SELECT question FROM questions WHERE subject='ICT' AND exam_type='Final'`,
  );
  const existingSet = new Set(existing.map((r: { question: string }) => r.question.trim().toLowerCase()));

  const toInsert = NEW_QUESTIONS.filter((q) => !existingSet.has(q.question.trim().toLowerCase()));
  console.log(`📋 ${toInsert.length}/${NEW_QUESTIONS.length} new questions to insert (${NEW_QUESTIONS.length - toInsert.length} already exist)`);

  if (toInsert.length === 0) {
    console.log("✅ Nothing to insert.");
    await pool.end();
    return;
  }

  // 2. Generate AI explanations
  console.log("🤖 Generating AI explanations via Gemini...");
  const explanations = await generateExplanations(toInsert);
  console.log(`✅ Got ${explanations.length} explanations`);

  // 3. Insert questions with explanations
  for (let i = 0; i < toInsert.length; i++) {
    const q = toInsert[i];
    await pool.query(
      `INSERT INTO questions (question, option_a, option_b, option_c, option_d, correct_answer, briefing, topic, sem, subject, exam_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [q.question, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, explanations[i], q.topic, 1, "ICT", "Final"],
    );
  }

  const homeCnt = toInsert.filter((q) => q.topic === "MS Word Home Tab").length;
  const fileCnt = toInsert.filter((q) => q.topic === "MS Word File Menu").length;

  await pool.end();
  console.log(`\n🎉 Done! Inserted ${toInsert.length} questions:`);
  console.log(`   • MS Word Home Tab:  ${homeCnt}`);
  console.log(`   • MS Word File Menu: ${fileCnt}`);

  const total = 208 + toInsert.length;
  console.log(`\n   Total ICT Final questions: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
