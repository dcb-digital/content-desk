/**
 * Basic QA rules that run on document body markdown.
 * Returns an array of flags/warnings.
 * Iron rule: never invent metrics — only flag what can be measured from the text.
 */
import { parsePagePackage } from "@/lib/ai/page-package";

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

/**
 * Extra checks for page packages (brief §6.7 + acceptance test #6). These are the
 * fields a developer needs to publish the page, so a missing one is a hard flag —
 * a package that can't ship isn't a package.
 *
 * `packageJson` is whatever came out of `documents.package_json`; anything that
 * isn't a page package returns no results rather than throwing.
 */
export function runPackageQA(packageJson: unknown): QAResult[] {
  const pkg = parsePagePackage(packageJson);
  if (!pkg) return [];

  const results: QAResult[] = [];

  // Meta — Google truncates around these lengths, so over is a real problem, not a nit.
  const titleLen = pkg.seoTitle.trim().length;
  if (titleLen === 0) {
    results.push({ rule: "pkg_no_seo_title", level: "flag", message: "Page package has no SEO title." });
  } else if (titleLen > 60) {
    results.push({
      rule: "pkg_seo_title_long",
      level: "warn",
      message: `SEO title is ${titleLen} characters — will truncate in results above ~60.`,
    });
  }

  const descLen = pkg.metaDescription.trim().length;
  if (descLen === 0) {
    results.push({ rule: "pkg_no_meta_description", level: "flag", message: "Page package has no meta description." });
  } else if (descLen > 160) {
    results.push({
      rule: "pkg_meta_description_long",
      level: "warn",
      message: `Meta description is ${descLen} characters — will truncate above ~160.`,
    });
  }

  if (!pkg.h1.trim()) {
    results.push({ rule: "pkg_no_h1", level: "flag", message: "Page package has no H1." });
  }

  if (pkg.services.items.length === 0) {
    results.push({
      rule: "pkg_no_services",
      level: "flag",
      message: "No services/inclusions in the package — the page has nothing to sell.",
    });
  }
  if (pkg.process.steps.length === 0) {
    results.push({ rule: "pkg_no_process", level: "warn", message: "No process section — add the steps a client goes through." });
  }
  if (pkg.faq.length < 3) {
    results.push({
      rule: "pkg_faq_thin",
      level: "flag",
      message: `Only ${pkg.faq.length} FAQ question${pkg.faq.length === 1 ? "" : "s"} — 3 minimum for FAQ schema to be worth emitting.`,
    });
  }
  if (!pkg.cta.heading.trim() || !pkg.cta.buttonLabel.trim()) {
    results.push({ rule: "pkg_no_cta", level: "flag", message: "Page package has no call to action." });
  }

  // Grounding, not style: an empty proof section means we could not evidence one.
  if (pkg.trustProof.points.length === 0) {
    results.push({
      rule: "pkg_no_proof",
      level: "warn",
      message: "No proof points — add a proof_case_studies knowledge doc so the trust section can be evidenced.",
    });
  }
  if (pkg.internalLinks.length === 0) {
    results.push({
      rule: "pkg_no_internal_links",
      level: "warn",
      message: "No internal links suggested — no URLs for this client appeared in the evidence.",
    });
  }
  if (pkg.dataGaps.length > 0) {
    results.push({
      rule: "pkg_data_gaps",
      level: "warn",
      message: `${pkg.dataGaps.length} data gap${pkg.dataGaps.length === 1 ? "" : "s"} reported: ${pkg.dataGaps.join("; ")}`,
    });
  }

  return results;
}
