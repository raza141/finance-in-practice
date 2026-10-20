/**
 * A reader's answers, kept in this browser only. The pick is stored under the
 * question's key (as it always was); whether it was right sits beside it, so the
 * Question Bank can show progress. Picks saved before that only read "answered".
 */
export class AnswerStore {
  static picked(key: string): number | null {
    const saved = Number(localStorage.getItem(key) ?? NaN);
    return Number.isInteger(saved) ? saved : null;
  }

  static save(key: string, picked: number, correct: number): void {
    localStorage.setItem(key, String(picked));
    localStorage.setItem(`${key}:result`, picked === correct ? "right" : "wrong");
  }

  static result(key: string): "right" | "wrong" | "answered" | null {
    if (localStorage.getItem(key) === null) return null;
    const r = localStorage.getItem(`${key}:result`);
    return r === "right" || r === "wrong" ? r : "answered";
  }
}
