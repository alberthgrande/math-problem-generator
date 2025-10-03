"use client";

import { useState } from "react";

interface MathProblem {
  problem_text: string;
  final_answer: number;
  type: "addition" | "subtraction" | "multiplication" | "division";
  difficulty: "Easy" | "Medium" | "Hard";
}

interface Submission {
  id: number;
  user_answer: number;
  is_correct: boolean;
  feedback_text: string;
  created_at: string;
  difficulty?: "Easy" | "Medium" | "Hard";
}

export default function Home() {
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback_text, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">(
    "Medium"
  );

  // Solution-specific state
  const [solution, setSolution] = useState<string | null>(null);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Hints-specific state
  const [hints, setHints] = useState<string[]>([]);
  const [loadingHint, setLoadingHint] = useState(false);

  const generateProblem = async () => {
    setIsLoading(true);
    setFeedback("");
    setUserAnswer("");
    setIsCorrect(null);
    setHistory([]);
    setSolution(null);
    setAttempted(false);
    setHints([]);

    try {
      const response = await fetch("/api/math-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty }),
      });
      if (!response.ok) throw new Error("Failed to generate");
      const data = await response.json();
      setProblem(data);
      setSessionId(data.session_id);
    } catch (err) {
      console.error("Generate error:", err);
      setFeedback("Failed to generate a new problem. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/math-problem/history?session_id=${sessionId}`
      );
      if (!res.ok) throw new Error("History fetch failed");
      const data = await res.json();
      setHistory(data.submissions || []);
    } catch (err) {
      console.error("History error:", err);
    }
  };

  const submitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      setFeedback("No active session. Generate a problem first.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/math-problem/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          user_answer: parseFloat(userAnswer),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Failed to submit");
      } else {
        setFeedback(data.feedback_text);
        setIsCorrect(data.is_correct);
        setAttempted(true);
        // Refresh history
        await fetchHistory(sessionId);
      }
    } catch (err) {
      console.error("Submit error:", err);
      setFeedback("Failed to submit your answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const showSolution = async () => {
    if (!sessionId) return;
    setLoadingSolution(true);
    setSolution(null);
    try {
      const res = await fetch("/api/math-problem/solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Failed to load solution");
      } else {
        setSolution(data.solution);
      }
    } catch (err) {
      console.error("Solution fetch error:", err);
      setFeedback("Failed to load solution. Please try again.");
    } finally {
      setLoadingSolution(false);
    }
  };

  const getHint = async () => {
    if (!sessionId) return;
    setLoadingHint(true);
    try {
      const res = await fetch("/api/math-problem/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          hint_level: hints.length + 1,
        }),
      });
      const data = await res.json();
      if (data.hint) {
        setHints([...hints, data.hint]);
      }
    } catch (err) {
      console.error("Hint fetch error:", err);
      setFeedback("Failed to load hint. Please try again.");
    } finally {
      setLoadingHint(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Math Problem Generator
        </h1>

        {/* Difficulty selector */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <label className="block mb-2 text-gray-700 font-medium">
            Select Difficulty:
          </label>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")
            }
            className="w-full border px-4 py-2 rounded-lg mb-4"
          >
            <option value="Easy">🟢 Easy</option>
            <option value="Medium">🟡 Medium</option>
            <option value="Hard">🔴 Hard</option>
          </select>

          <button
            onClick={generateProblem}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg"
          >
            {isLoading ? "Generating..." : "Generate New Problem"}
          </button>
        </div>

        {/* Problem */}
        {problem && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Problem ({problem.type.toUpperCase()} - {problem.difficulty})
            </h2>
            <p className="text-lg text-gray-800 mb-6">{problem.problem_text}</p>

            <form onSubmit={submitAnswer} className="space-y-4">
              <input
                type="number"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Enter your answer"
                required
              />
              <button
                type="submit"
                disabled={!userAnswer || isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg"
              >
                {isLoading ? "Submitting..." : "Submit Answer"}
              </button>
            </form>

            {/* Hints Section */}
            <div className="mt-4">
              <button
                type="button"
                onClick={getHint}
                disabled={loadingHint}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg"
              >
                {loadingHint ? "Getting hint..." : "Get Hint"}
              </button>

              {hints.length > 0 && (
                <div className="mt-3 space-y-2">
                  {hints.map((hint, i) => (
                    <p
                      key={i}
                      className="p-2 bg-purple-50 border border-purple-200 rounded text-gray-700"
                    >
                      💡 Hint {i + 1}: {hint}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback_text && (
          <div
            className={`rounded-lg shadow-lg p-6 ${
              isCorrect ? "bg-green-50" : "bg-yellow-50"
            }`}
          >
            <h2 className="text-xl font-semibold mb-4">
              {isCorrect ? "✅ Correct!" : "❌ Try again"}
            </h2>
            <p>{feedback_text}</p>

            <div className="mt-4">
              <button
                onClick={showSolution}
                disabled={!attempted || loadingSolution}
                className="bg-gray-100 hover:bg-gray-200 disabled:opacity-60 px-4 py-2 rounded"
              >
                {loadingSolution
                  ? "Loading solution..."
                  : "Show step-by-step solution"}
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Solutions are shown only after you attempt the problem.
              </p>
            </div>
          </div>
        )}

        {/* Solution */}
        {solution && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h3 className="text-lg font-semibold mb-3">
              Step-by-step solution
            </h3>
            <pre className="whitespace-pre-wrap text-gray-800">{solution}</pre>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Submission History
            </h2>
            <ul className="space-y-4">
              {history.map((sub) => (
                <li
                  key={sub.id}
                  className={`p-4 rounded-lg border ${
                    sub.is_correct
                      ? "border-green-300 bg-green-50"
                      : "border-yellow-300 bg-yellow-50"
                  }`}
                >
                  <p>
                    <strong>Your Answer:</strong> {sub.user_answer}
                  </p>
                  <p>
                    <strong>Result:</strong>{" "}
                    {sub.is_correct ? "✅ Correct" : "❌ Incorrect"}
                  </p>
                  {sub.difficulty && (
                    <p>
                      <strong>Difficulty:</strong> {sub.difficulty}
                    </p>
                  )}
                  <p>
                    <strong>Feedback:</strong> {sub.feedback_text}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(sub.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
