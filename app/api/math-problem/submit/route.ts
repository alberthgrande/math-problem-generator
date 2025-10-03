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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, user_answer } = body;

    if (!session_id || user_answer === undefined) {
      return NextResponse.json(
        { error: "Missing session_id or user_answer" },
        { status: 400 }
      );
    }

    // ✅ Fetch original session (includes difficulty & type)
    const { data: sessionData, error: fetchError } = await supabase
      .from("math_problem_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (fetchError || !sessionData) {
      return NextResponse.json(
        { error: "Problem session not found" },
        { status: 404 }
      );
    }

    const isCorrect = Math.abs(user_answer - sessionData.correct_answer) < 0.01;

    const feedbackPrompt = `You are a friendly Primary 5 math tutor.
Problem Type: ${sessionData.type}
Difficulty: ${sessionData.difficulty}
Problem: ${sessionData.problem_text}
Correct Answer: ${sessionData.correct_answer}
Student's Answer: ${user_answer}
Result: ${isCorrect ? "CORRECT" : "INCORRECT"}

Write 2–4 warm, encouraging sentences of feedback. No JSON, no markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: feedbackPrompt }] }],
    });

    const feedback_text =
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      "Good job! Keep practicing.";

    // ✅ Save submission with difficulty
    const { error: submissionError } = await supabase
      .from("math_problem_submissions")
      .insert({
        session_id,
        user_answer,
        is_correct: isCorrect,
        feedback_text,
        type: sessionData.type,
        difficulty: sessionData.difficulty, // 🔥 Added this
      });

    if (submissionError) {
      console.error("Failed to save submission:", submissionError);
    }

    return NextResponse.json({
      is_correct: isCorrect,
      feedback_text,
      correct_answer: sessionData.correct_answer,
      type: sessionData.type,
      difficulty: sessionData.difficulty, // 🔥 Return difficulty too
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}
