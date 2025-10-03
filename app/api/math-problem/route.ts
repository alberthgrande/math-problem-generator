import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("No valid JSON found in AI response");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const difficultyInput = body.difficulty?.toLowerCase() || "easy";

    // Validate difficulty (fallback to "easy")
    let difficulty: "easy" | "medium" | "hard" = "easy";
    if (["easy", "medium", "hard"].includes(difficultyInput)) {
      difficulty = difficultyInput as "easy" | "medium" | "hard";
    }

    const prompt = `
Generate a Primary 5 (Grade 5) math word problem.
The problem must be one of these types: addition, subtraction, multiplication, or division.
Difficulty level: ${difficulty}

Return ONLY valid JSON in this shape. No extra text, no markdown, no explanation:

{
  "problem_text": "string",
  "final_answer": number,
  "type": "addition" | "subtraction" | "multiplication" | "division",
  "difficulty": "easy" | "medium" | "hard"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log("AI raw response:", text);

    const problemData = extractJSON(text);

    // Validate AI output
    if (
      !problemData.problem_text ||
      problemData.final_answer === undefined ||
      !problemData.type ||
      !problemData.difficulty
    ) {
      throw new Error("Invalid problem structure from AI");
    }

    // Normalize difficulty to match DB constraint
    let aiDifficulty = (problemData.difficulty as string).toLowerCase();
    if (!["easy", "medium", "hard"].includes(aiDifficulty)) {
      aiDifficulty = difficulty; // fallback to requested difficulty
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from("math_problem_sessions")
      .insert({
        problem_text: problemData.problem_text,
        correct_answer: problemData.final_answer,
        type: problemData.type,
        difficulty: aiDifficulty,
      })
      .select()
      .single();

    if (sessionError) {
      console.error("Supabase insert error:", sessionError);
      throw new Error("Failed to save problem to database");
    }

    return NextResponse.json({
      session_id: sessionData.id,
      problem_text: problemData.problem_text,
      final_answer: problemData.final_answer,
      type: problemData.type,
      difficulty: aiDifficulty,
    });
  } catch (error) {
    console.error("Error generating problem:", error);
    return NextResponse.json(
      { error: "Failed to generate math problem" },
      { status: 500 }
    );
  }
}
