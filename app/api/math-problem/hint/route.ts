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

export async function POST(req: NextRequest) {
  try {
    const { session_id, hint_level } = await req.json();

    if (!session_id) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    // Fetch the existing session
    const { data: session, error } = await supabase
      .from("math_problem_sessions")
      .select("id, problem_text, difficulty, hints")
      .eq("id", session_id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    // Generate a new hint
    const prompt = `You are a kind math tutor. 
Problem: ${session.problem_text}
Difficulty: ${session.difficulty}
Hint level: ${hint_level}

Give the student a helpful hint, not the full solution. Keep it short and encouraging.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const hint =
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      "Try breaking the problem into smaller steps.";

    // Ensure hints array exists
    const updatedHints: string[] = session.hints || [];
    updatedHints.push(hint);

    // Save back to DB
    const { error: updateError } = await supabase
      .from("math_problem_sessions")
      .update({ hints: updatedHints })
      .eq("id", session_id);

    if (updateError) {
      console.error("Error saving hint:", updateError);
      return NextResponse.json(
        { error: "Failed to save hint" },
        { status: 500 }
      );
    }

    return NextResponse.json({ hint });
  } catch (err) {
    console.error("Error generating hint:", err);
    return NextResponse.json(
      { error: "Failed to generate hint" },
      { status: 500 }
    );
  }
}
