/**
 * Basic QA rules that run on document body markdown.
 * Returns an array of flags/warnings.
 * Iron rule: never invent metrics — only flag what can be measured from the text.
 */

export type QAResult = {
  rule: string;
  level: "flag" | "warn";
  message: string;
};

export function runQA(bodyMd: string, targetKeyword?: string): QAResult[] {
  const results: QAResult[] = [];
  const text = bodyMd.trim();
  if (!text) return results;

  // Word count
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 300) {
    results.push({ rule: "word_count_low", level: "flag", message: `Only ${wordCount} words — minimum 300 recommended.` });
  } else if (wordCount < 600) {
    results.push({ rule: "word_count_short", level: "warn", message: `${wordCount} words — consider expanding to 800+.` });
  }

  // H1 heading
  const h1s = text.match(/^#\s+.+/gm) ?? [];
  if (h1s.length === 0) {
    results.push({ rule: "no_h1", level: "flag", message: "No H1 heading found. Add a # Title at the top." });
  } else if (h1s.length > 1) {
    results.push({ rule: "multiple_h1", level: "warn", message: `${h1s.length} H1 headings found — use only one.` });
  }

  // H2 headings
  const h2s = text.match(/^##\s+.+/gm) ?? [];
  if (h2s.length === 0 && wordCount > 400) {
    results.push({ rule: "no_h2", level: "warn", message: "No H2 subheadings — add section headings for structure." });
  }

  // Placeholder data
  const needsData = text.match(/\[NEEDS DATA:[^\]]+\]/g) ?? [];
  if (needsData.length > 0) {
    results.push({
      rule: "needs_data",
      level: "flag",
      message: `${needsData.length} [NEEDS DATA] placeholder${needsData.length === 1 ? "" : "s"} — fill in before publishing.`,
    });
  }

  // AI clichés
  const cliches = ["game-changer", "game changer", "delve", "in today's fast-paced", "unlock your", "revolutionize", "leverage", "synergy"];
  const foundCliches = cliches.filter((c) => text.toLowerCase().includes(c));
  if (foundCliches.length > 0) {
    results.push({
      rule: "ai_cliche",
      level: "warn",
      message: `Possible AI clichés detected: ${foundCliches.map((c) => `"${c}"`).join(", ")}`,
    });
  }

  // Target keyword presence
  if (targetKeyword?.trim()) {
    const kw = targetKeyword.trim().toLowerCase();
    const bodyLower = text.toLowerCase();
    if (!bodyLower.includes(kw)) {
      results.push({
        rule: "keyword_missing",
        level: "flag",
        message: `Target keyword "${targetKeyword}" not found in the document.`,
      });
    } else {
      // Check it's in the first 150 words
      const first150 = text.split(/\s+/).slice(0, 150).join(" ").toLowerCase();
      if (!first150.includes(kw)) {
        results.push({
          rule: "keyword_not_in_intro",
          level: "warn",
          message: `Target keyword "${targetKeyword}" not in the opening — move it to the first 150 words.`,
        });
      }
    }
  }

  return results;
}
