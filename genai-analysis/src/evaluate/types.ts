export type StatsSummary = {
  count: number;
  mean: number;
  stdev: number;
  min: number;
  max: number;
};

export type StructuredMetrics = {
  totalStudents: number;
  citationValidityRate: number;
  invalidCitationCount: number;
  evidenceInProfileRate: number;
  evidenceBelowThresholdCount: number;
  competencyCoverageRate: number;
  programSlateConsistencyRate: number;
  wrongProgramClauseCount: number;
};

export type NarrativeMetrics = {
  totalNarratives: number;
  sectionStructureComplianceRate: number;
  citationValidityRate: number;
  invalidCitationCount: number;
  taggedSentenceRate: number; // average across narratives
  groundedness: StatsSummary; // ROUGE-L narrative vs. profile
  frameworkAlignment: StatsSummary; // ROUGE-L per-sentence vs. cited clause
  frameworkAlignmentBelowThresholdCount: number;
};

export type BandDistribution = {
  "bottom-quartile": number;
  "below-median": number;
  "above-median": number;
  "top-quartile": number;
};

export type CohortMetrics = {
  cohortSize: number;
  bandDistribution: BandDistribution;
  programBreakdown: Record<string, { size: number; meanScore: number }>;
  suspiciousPrograms: string[];
};

export type StudentFlag = {
  kind:
    | "invalid_citation_structured"
    | "invalid_citation_narrative"
    | "evidence_not_in_profile"
    | "missing_competency"
    | "wrong_program_clause"
    | "missing_section"
    | "low_tagged_sentence_rate"
    | "low_groundedness"
    | "low_framework_alignment";
  detail: string;
};

export type PerStudentEval = {
  student_id: string;
  program: string;
  flags: StudentFlag[];
};

export type EvaluationResult = {
  runId: string;
  runDir: string;
  bundleVersion: string;
  generatedAt: string;
  thresholds: Thresholds;
  structured: StructuredMetrics;
  narrative: NarrativeMetrics;
  cohort: CohortMetrics;
  perStudent: PerStudentEval[];
  overallPass: boolean;
  failingMetrics: string[];
};

export type Thresholds = {
  citationValidityRateMin: number;      // 1.00 expected — clauses must resolve
  evidenceInProfileRateMin: number;     // 0.70 expected
  competencyCoverageRateMin: number;    // 1.00 expected — slate is fixed
  programSlateConsistencyRateMin: number; // 0.90 expected — BSCpE cites ched-87 etc.
  sectionStructureComplianceRateMin: number; // 1.00 expected
  taggedSentenceRateMin: number;        // 0.70 expected — most sentences carry clause tags
  groundednessMeanMin: number;          // 0.25 expected — frac of profile tokens echoed
  frameworkAlignmentMeanMin: number;    // 0.10 expected — sentence vs cited clause
  evidenceOverlapThreshold: number;     // 0.40 — fraction of evidence tokens that appear in the profile (paraphrase-tolerant)
};

// Thresholds calibrated against observed run behavior. Tighten when
// the pipeline produces consistently better output; loosen only if
// the measurement is known to be noisy for that metric.
export const DEFAULT_THRESHOLDS: Thresholds = {
  citationValidityRateMin: 1.0,
  evidenceInProfileRateMin: 0.7,
  competencyCoverageRateMin: 1.0,
  programSlateConsistencyRateMin: 0.9,
  sectionStructureComplianceRateMin: 1.0,
  taggedSentenceRateMin: 0.7,
  groundednessMeanMin: 0.25,
  frameworkAlignmentMeanMin: 0.1,
  evidenceOverlapThreshold: 0.4,
};
