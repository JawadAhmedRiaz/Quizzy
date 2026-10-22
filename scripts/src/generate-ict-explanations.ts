import pg from "pg";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface QuestionRow {
  id: number;
  topic: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
}

async function generateExplanations(questions: QuestionRow[]): Promise<string[]> {
  const prompt = `You are an ICT exam tutor. For each MCQ below, write a SHORT explanation (1-2 sentences max) of WHY the correct answer is correct. Be direct and educational. Do NOT start with "The correct answer is..." — just explain the key concept.

Return ONLY a valid JSON array of strings (no markdown, no extra text), one explanation per question in the same order.

Questions:
${questions.map((q, i) => {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
  const correctIdx = ["A", "B", "C", "D"].indexOf(q.correct_answer);
  return `${i + 1}. [${q.topic}] ${q.question}
  A) ${opts[0]}  B) ${opts[1]}  C) ${opts[2]}  D) ${opts[3]}
  Correct: ${q.correct_answer}) ${opts[correctIdx]}`;
}).join("\n\n")}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] };
  const text = data.candidates[0].content.parts[0].text.trim();
  const jsonStr = text.startsWith("```")
    ? text.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
    : text;

  const explanations: string[] = JSON.parse(jsonStr);
  if (!Array.isArray(explanations) || explanations.length !== questions.length) {
    throw new Error(`Expected ${questions.length} explanations, got ${explanations.length}\nRaw: ${text.slice(0, 500)}`);
  }
  return explanations;
}

async function main() {
  console.log("📚 Fetching all ICT Final questions...");
  const { rows } = await pool.query<QuestionRow>(
    `SELECT id, topic, question, option_a, option_b, option_c, option_d, correct_answer
     FROM questions WHERE subject = 'ICT' AND exam_type = 'Final' ORDER BY id`,
  );
  console.log(`✅ Found ${rows.length} questions`);

  const BATCH_SIZE = 50;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    console.log(`\n🤖 Batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);

    const explanations = await generateExplanations(batch);

    for (let j = 0; j < batch.length; j++) {
      await pool.query(
        `UPDATE questions SET briefing = $1, updated_at = NOW() WHERE id = $2`,
        [explanations[j], batch[j].id],
      );
    }

    updated += batch.length;
    console.log(`   ✓ Saved ${updated}/${rows.length} explanations`);

    if (i + BATCH_SIZE < rows.length) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  await pool.end();
  console.log(`\n🎉 Done! Generated and saved explanations for all ${updated} ICT Final questions.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
