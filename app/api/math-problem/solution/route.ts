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

// Helper: safe extract (not strictly needed here because we expect plain text)
function safeTextFromResponse(response: any): string {
  return (
    response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    response?.output?.[0]?.content?.[0]?.text?.trim() ??
    ""
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // Ensure the student has attempted this problem at least once
    const { data: submissions, error: subErr } = await supabase
      .from("math_problem_submissions")
      .select("id")
      .eq("session_id", session_id)
      .limit(1);

    if (subErr) {
      console.error("DB error checking submissions:", subErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json(
        {
          error:
            "Please try answering the problem before viewing the solution.",
        },
        { status: 403 }
      );
    }

    // Fetch the original problem/session
    const { data: sessionData, error: fetchError } = await supabase
      .from("math_problem_sessions")
      .select("*")
      .eq("id", session_id)
      .single();

    if (fetchError || !sessionData) {
      console.error("Session fetch error:", fetchError);
      return NextResponse.json(
        { error: "Problem session not found" },
        { status: 404 }
      );
    }

    // Prompt: ask for clear numbered step-by-step explanation for Primary 5 students
    const prompt = `You are a friendly Primary 5 (Grade 5) math tutor. 
Provide a clear, concise, step-by-step solution suitable for a 10-11 year old. 
Use numbered steps, show calculations where needed, and conclude with the final answer on the last line.

Problem: ${sessionData.problem_text}
Operation: ${sessionData.type ?? "unknown"}
Difficulty: ${sessionData.difficulty ?? "medium"}

Return ONLY the step-by-step explanation as plain text (no JSON, no headings). Keep it to ~3-8 short steps.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const solutionText = safeTextFromResponse(response);

    if (!solutionText) {
      console.error("Empty solution from AI:", response);
      return NextResponse.json(
        { error: "AI returned empty solution" },
        { status: 500 }
      );
    }

    // Optionally: you could persist the solution to DB here (not implemented)
    return NextResponse.json({ solution: solutionText });
  } catch (err) {
    console.error("Error generating solution:", err);
    return NextResponse.json(
      { error: "Failed to generate solution" },
      { status: 500 }
    );
  }
}
