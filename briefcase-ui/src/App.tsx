import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const ENDPOINT = "/api/dashboard/latest";

type LoadState = "loading" | "ready" | "error";
type EvidenceItems = number | unknown[];

type StudentDashboard = {
  run?: { id?: string; status?: string; frameworkVersion?: string };
  student?: {
    id?: string;
    name?: string;
    program?: string;
    specialization?: string;
    headline?: string;
    biography?: string;
    yearLevel?: number | null;
    sparsity?: string;
    evidenceCounts?: {
      projects?: EvidenceItems;
      experience?: EvidenceItems;
      education?: EvidenceItems;
      certifications?: EvidenceItems;
      awards?: EvidenceItems;
      trainings?: EvidenceItems;
      organizations?: EvidenceItems;
    };
  };
  overview?: {
    overallScore?: number;
    idealScore?: number;
    ratingLabel?: string;
    summary?: string;
    topIssues?: string[];
    quickFixes?: string[];
  };
  competencies?: {
    name?: string;
    level?: string;
    score?: number;
    idealScore?: number;
    diagnosis?: string;
    evidence?: string[];
  }[];
  strengths?: { area?: string; evidence?: string[] }[];
  gaps?: { area?: string; reason?: string; recommendation?: string }[];
  skills?: {
    hard?: { name?: string; rating?: number }[];
    soft?: { name?: string; rating?: number }[];
    uncategorized?: { name?: string; rating?: number }[];
  };
  learningMap?: {
    programCode?: string;
    programCategory?: string;
    targetYearLevel?: number | null;
    targetScore?: number;
    summary?: string;
    idealSkills?: {
      name?: string;
      courseCode?: string;
      courseTitle?: string;
      year?: string;
      trimester?: string;
      status?: "met" | "needs-work" | "missing";
      currentRating?: number | null;
      targetRating?: number;
      coursewareUrl?: string;
      linkedinLearningUrl?: string;
    }[];
    nodes?: {
      id?: string;
      label?: string;
      detail?: string;
      type?: "ideal" | "learn" | "practice" | "evidence";
      skill?: string;
      courseCode?: string;
      courseTitle?: string;
      year?: string;
      trimester?: string;
      status?: "needs-work" | "missing";
      coursewareUrl?: string;
      linkedinLearningUrl?: string;
    }[];
  };
  recommendations?: {
    title?: string;
    provider?: string;
    reason?: string;
    relatedCompetency?: string;
    url?: string;
  }[];
  narrative?: string;
};

type DashboardPayload = {
  dashboard?: StudentDashboard | null;
};

type StudentsPayload = StudentSummary[] | { students?: StudentSummary[] };

type StudentSummary = {
  id: string;
  name: string;
  program: string;
  yearLevel: number | null;
};

function asJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonBody(body: string): unknown {
  if (!body.trim()) return null;

  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { error: body };
  }
}

function normalizeDashboard(value: unknown): StudentDashboard | null {
  if (!value || typeof value !== "object") return null;
  if ("dashboard" in value) return (value as DashboardPayload).dashboard ?? null;
  return value as StudentDashboard;
}

function scorePercent(score?: number) {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function idealPercent(ideal?: number) {
  if (typeof ideal !== "number" || !Number.isFinite(ideal)) return 0;
  return Math.max(0, Math.min(100, Math.round(ideal)));
}

function evidenceItemCount(value?: EvidenceItems) {
  if (Array.isArray(value)) return value.length;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function statusLabel(status?: string) {
  if (status === "needs-work") return "Needs work";
  if (status === "missing") return "Missing";
  if (status === "met") return "Met";
  return "Unknown";
}

function learningSkillMessage(skill: { name?: string; status?: string }) {
  const name = skill.name ?? "this skill";

  if (skill.status === "missing") {
    return <span>{name} is missing</span>;
  }

  if (skill.status === "needs-work") {
    return (
      <>
        <strong>Keep practicing</strong> {name}
      </>
    );
  }

  if (skill.status === "met") {
    return null;
  }

  return <span>{name}</span>;
}

function progressPercent(current?: number | null, target?: number) {
  if (typeof target !== "number" || !Number.isFinite(target) || target <= 0) return 0;
  const value = typeof current === "number" && Number.isFinite(current) ? current : 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function skillBucketLabel(bucket: string) {
  if (bucket === "hard") return "Technical Skills";
  if (bucket === "soft") return "Professional Skills";
  return "Additional Skills";
}

function skillBucketDescription(bucket: string) {
  if (bucket === "hard") return "Tools, technologies, methods, and discipline-specific abilities demonstrated this year.";
  if (bucket === "soft") return "Communication, collaboration, leadership, and workplace behaviors evidenced in the record.";
  return "Other relevant capabilities detected from the portfolio and analysis.";
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
    </section>
  );
}

function ExpandableText({
  as = "p",
  children,
  className,
}: {
  as?: "p" | "li" | "h3" | "strong";
  children: ReactNode;
  className?: string;
}) {
  if (as === "li") {
    return (
      <li className={className}>
        <span>{children}</span>
      </li>
    );
  }

  if (as === "strong") {
    return (
      <div className={`expandable-text${className ? ` ${className}` : ""}`}>
        <strong>{children}</strong>
      </div>
    );
  }

  const Tag = as;
  return (
    <div className={`expandable-text${className ? ` ${className}` : ""}`}>
      <Tag>{children}</Tag>
    </div>
  );
}

function LinkedInLearningLogo({ href }: { href?: string }) {
  if (!href) return null;

  return (
    <a
      className="linkedin-logo-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Open LinkedIn Learning"
      title="LinkedIn Learning"
    >
      <span className="linkedin-logo-mark" aria-hidden="true">
        in
      </span>
    </a>
  );
}

function ResourceLinks({ coursewareUrl, linkedinLearningUrl }: {
  coursewareUrl?: string;
  linkedinLearningUrl?: string;
}) {
  if (!coursewareUrl && !linkedinLearningUrl) return null;

  return (
    <div className="resource-links">
      {coursewareUrl ? (
        <a className="courseware-link" href={coursewareUrl} target="_blank" rel="noreferrer">
          Courseware
        </a>
      ) : null}
      <LinkedInLearningLogo href={linkedinLearningUrl} />
    </div>
  );
}

function renderNarrativeInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function NarrativeText({ text }: { text?: string }) {
  const content = text?.trim();
  if (!content) return <p className="muted">No narrative returned.</p>;

  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  function flushParagraph(key: string) {
    if (!paragraph.length) return;
    blocks.push(<ExpandableText key={key}>{renderNarrativeInline(paragraph.join(" "))}</ExpandableText>);
    paragraph = [];
  }

  function flushBullets(key: string) {
    if (!bullets.length) return;
    blocks.push(
      <ul key={key}>
        {bullets.map((line) => (
          <ExpandableText as="li" key={line}>{renderNarrativeInline(line)}</ExpandableText>
        ))}
      </ul>,
    );
    bullets = [];
  }

  content.split(/\n/).forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(`paragraph-${index}`);
      flushBullets(`bullets-${index}`);
      return;
    }

    const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph(`paragraph-before-heading-${index}`);
      flushBullets(`bullets-before-heading-${index}`);
      blocks.push(<h3 key={`heading-${index}`}>{renderNarrativeInline(heading[1].replace(/#+\s*$/, "").trim())}</h3>);
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph(`paragraph-before-bullet-${index}`);
      bullets.push(bullet[1]);
      return;
    }

    flushBullets(`bullets-before-paragraph-${index}`);
    paragraph.push(trimmed.replace(/^#{1,6}\s+/, ""));
  });

  flushParagraph("paragraph-final");
  flushBullets("bullets-final");

  return (
    <div className="narrative">
      {blocks}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<LoadState>("loading");
  const [payload, setPayload] = useState<unknown>(null);
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showMetLearning, setShowMetLearning] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [rawText, setRawText] = useState("");
  const latestStudentRequestId = useRef(0);

  async function readApi(path: string) {
    const response = await fetch(`${API_BASE}${path}`);
    const body = await response.text();
    const parsed = parseJsonBody(body);
    return { response, body, parsed };
  }

  async function loadStudentsForRun(runId: string, studentId?: string) {
    const response = await fetch(`${API_BASE}/api/runs/${encodeURIComponent(runId)}/students`);
    if (!response.ok) return;

    const parsed = (await response.json()) as StudentsPayload;
    const list = Array.isArray(parsed) ? parsed : parsed.students ?? [];
    setStudents(list);
    setCurrentIndex(list.findIndex((student) => student.id === studentId));
  }

  async function loadLatestDashboard() {
    setState("loading");

    try {
      const { response, body, parsed } = await readApi(ENDPOINT);
      setRawText(body);
      setPayload(parsed);

      if (!response.ok) {
        setDashboard(null);
        setStudents([]);
        setCurrentIndex(-1);
        setState("error");
        return;
      }

      const nextDashboard = normalizeDashboard(parsed);
      setDashboard(nextDashboard);

      if (nextDashboard?.run?.id) {
        await loadStudentsForRun(nextDashboard.run.id, nextDashboard.student?.id);
      }

      setState("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach API.";
      setRawText(message);
      setPayload(null);
      setDashboard(null);
      setStudents([]);
      setCurrentIndex(-1);
      setState("error");
    }
  }

  async function loadStudent(studentId: string) {
    const runId = dashboard?.run?.id;
    if (!runId) return;

    const requestId = latestStudentRequestId.current + 1;
    latestStudentRequestId.current = requestId;
    const isLatestRequest = () => requestId === latestStudentRequestId.current;

    setState("loading");

    try {
      const { response, body, parsed } = await readApi(
        `/api/runs/${encodeURIComponent(runId)}/students/${encodeURIComponent(studentId)}/dashboard`,
      );
      if (!isLatestRequest()) return;

      setRawText(body);
      setPayload(parsed);

      if (!response.ok) {
        setDashboard(null);
        setState("error");
        return;
      }

      const nextDashboard = normalizeDashboard(parsed);
      setDashboard(nextDashboard);
      setCurrentIndex(students.findIndex((student) => student.id === studentId));
      setState("ready");
    } catch (error) {
      if (!isLatestRequest()) return;

      const message = error instanceof Error ? error.message : "Unable to load student.";
      setRawText(message);
      setPayload(null);
      setDashboard(null);
      setState("error");
    }
  }

  function moveStudent(delta: number) {
    if (!students.length) return;
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (fallbackIndex + delta + students.length) % students.length;
    void loadStudent(students[nextIndex].id);
  }

  useEffect(() => {
    void loadLatestDashboard();
  }, []);

  const percent = useMemo(
    () => scorePercent(dashboard?.overview?.overallScore),
    [dashboard],
  );
  const ideal = useMemo(() => idealPercent(dashboard?.overview?.idealScore), [dashboard]);
  const gap = Math.max(0, ideal - percent);
  const canNavigate = students.length > 1 && Boolean(dashboard?.run?.id);
  const learningSkills = dashboard?.learningMap?.idealSkills ?? [];
  const learningSkillCount = dashboard?.learningMap?.idealSkills?.length ?? 0;
  const learningStats = useMemo(() => {
    const skills = dashboard?.learningMap?.idealSkills ?? [];
    return {
      met: skills.filter((skill) => skill.status === "met").length,
      needsWork: skills.filter((skill) => skill.status === "needs-work").length,
      missing: skills.filter((skill) => skill.status === "missing").length,
    };
  }, [dashboard]);
  const learningCompletion = useMemo(() => {
    if (!learningSkillCount) return 0;

    const targetForSkill = (skill: (typeof learningSkills)[number]) =>
      skill.targetRating ?? dashboard?.learningMap?.targetScore ?? ideal;
    const totalTarget = learningSkills.reduce((sum, skill) => sum + targetForSkill(skill), 0);
    if (totalTarget === 0) return 0;

    const cappedCurrent = learningSkills.reduce((sum, skill) => {
      const target = targetForSkill(skill);
      const current = typeof skill.currentRating === "number" ? skill.currentRating : 0;
      return sum + Math.min(current, target);
    }, 0);
    return Math.round((cappedCurrent / totalTarget) * 100);
  }, [dashboard, ideal, learningSkillCount, learningSkills]);
  const skillBuckets = [
    ["hard", dashboard?.skills?.hard ?? []],
    ["soft", dashboard?.skills?.soft ?? []],
    ["uncategorized", dashboard?.skills?.uncategorized ?? []],
  ] as const;
  const attainedSkillCount = skillBuckets.reduce((sum, [, skills]) => sum + skills.length, 0);
  const allSkills = skillBuckets.flatMap(([, skills]) => skills);
  const averageSkillRating = allSkills.length
    ? Math.round(allSkills.reduce((sum, skill) => sum + scorePercent(skill.rating), 0) / allSkills.length)
    : 0;
  const strongestSkill = allSkills
    .slice()
    .sort((a, b) => scorePercent(b.rating) - scorePercent(a.rating))[0];
  const competencyCount = dashboard?.competencies?.length ?? 0;
  const proficientCompetencies = dashboard?.competencies?.filter((item) =>
    item.level === "Proficient" || item.level === "Advanced"
  ).length ?? 0;
  const learningStatusTotal = Math.max(1, learningStats.met + learningStats.needsWork + learningStats.missing);
  const metEnd = Math.round((learningStats.met / learningStatusTotal) * 100);
  const needsWorkEnd = Math.round(((learningStats.met + learningStats.needsWork) / learningStatusTotal) * 100);
  const unresolvedLearningSkills = learningSkills.filter((skill) => skill.status !== "met");
  const visibleLearningSkills = showMetLearning ? learningSkills : unresolvedLearningSkills;
  const hiddenMetCount = learningStats.met;
  const compactSkillLimit = 3;
  const hiddenSkillCount = skillBuckets.reduce(
    (sum, [, skills]) => sum + Math.max(0, skills.length - compactSkillLimit),
    0,
  );
  const evidenceCounts = dashboard?.student?.evidenceCounts;
  const evidenceStats = [
    ["Work Experience", evidenceItemCount(evidenceCounts?.experience)],
    ["Educational Qualification", evidenceItemCount(evidenceCounts?.education)],
    ["Honors and Awards", evidenceItemCount(evidenceCounts?.awards)],
    ["Licenses and Certifications", evidenceItemCount(evidenceCounts?.certifications)],
    ["Seminars and Trainings", evidenceItemCount(evidenceCounts?.trainings)],
    ["Organizations and Memberships", evidenceItemCount(evidenceCounts?.organizations)],
  ] as const;

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Annual Skills Attainment Summary</p>
          <h1>{dashboard?.student?.name ?? "Student Profile Report"}</h1>
          <p className="subtitle">
            {dashboard
              ? `${dashboard.student?.program ?? "Unknown program"}${dashboard.student?.yearLevel ? ` - Year ${dashboard.student.yearLevel}` : ""}`
              : `${API_BASE}${ENDPOINT}`}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void loadLatestDashboard()}>
            Refresh
          </button>
          <button type="button" onClick={() => moveStudent(-1)} disabled={!canNavigate}>
            Previous
          </button>
          <button type="button" onClick={() => moveStudent(1)} disabled={!canNavigate}>
            Next Student
          </button>
        </div>
      </header>

      <section className="summary-band">
        <div className="score-box">
          <span>{percent}</span>
          <small>%</small>
        </div>
        <div>
          <div className="meta-row">
            <span className={`status status-${state}`}>{state}</span>
            <span>Run {dashboard?.run?.id ?? "not loaded"}</span>
            <span>Framework {dashboard?.run?.frameworkVersion ?? "not available"}</span>
            <span>Ideal {ideal}%</span>
            <span>{gap > 0 ? `${gap}% gap` : "Meets ideal"}</span>
            <span>{attainedSkillCount} recorded skills</span>
            <span>
              {students.length && currentIndex >= 0
                ? `Student ${currentIndex + 1} of ${students.length}`
                : "Student list unavailable"}
            </span>
          </div>
          <h2>{dashboard?.overview?.ratingLabel ?? "Waiting for API response"}</h2>
          <ExpandableText>{dashboard?.overview?.summary ?? rawText}</ExpandableText>
        </div>
      </section>

      {!dashboard ? (
        <EmptyPanel title="No dashboard payload" text="Start the API, then refresh this page." />
      ) : (
        <div className="grid">
          <section className="panel wide student-profile-panel">
            <div>
              <p className="eyebrow">Personal Information</p>
              <h2>{dashboard.student?.name || "Current student"}</h2>
              {dashboard.student?.headline ? <strong className="profile-headline">{dashboard.student.headline}</strong> : null}
              <p>
                {dashboard.student?.biography ||
                  "No profile biography is available for this existing student record."}
              </p>
            </div>
            <div className="student-info-grid">
              <span>
                <strong>{dashboard.student?.program || "Unknown"}</strong>
                Program
              </span>
              <span>
                <strong>{dashboard.student?.specialization || "Not listed"}</strong>
                Specialization
              </span>
              <span>
                <strong>{dashboard.student?.yearLevel ? `Year ${dashboard.student.yearLevel}` : "Unknown"}</strong>
                Year level
              </span>
            </div>
            <div className="evidence-strip" aria-label="Existing profile portfolio sections">
              {evidenceStats.map(([label, count]) => (
                <span key={label}>
                  <strong>{count}</strong>
                  {label}
                </span>
              ))}
            </div>
          </section>

          <section className="visual-overview wide" aria-label="Student summary visuals">
            <article className="metric-card">
              <span>Average Skill Rating</span>
              <strong>{averageSkillRating}%</strong>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${averageSkillRating}%` }} />
              </div>
            </article>
            <article className="metric-card">
              <span>Strongest Attained Skill</span>
              <strong>{strongestSkill?.name ?? "No skill yet"}</strong>
              <small>{strongestSkill ? `${scorePercent(strongestSkill.rating)}% evidence rating` : "Awaiting evidence"}</small>
            </article>
            <article className="metric-card">
              <span>Competency Readiness</span>
              <strong>
                {proficientCompetencies}/{competencyCount}
              </strong>
              <small>Proficient or advanced areas</small>
            </article>
            <article className="donut-card">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(#1554b8 0 ${metEnd}%, #f3b23f ${metEnd}% ${needsWorkEnd}%, #d64545 ${needsWorkEnd}% 100%)`,
                }}
                aria-hidden="true"
              >
                <span>{learningCompletion}%</span>
              </div>
              <div>
                <h2>Learning Target Status</h2>
                <div className="legend">
                  <span><i className="legend-met" />Met</span>
                  <span><i className="legend-work" />Needs work</span>
                  <span><i className="legend-missing" />Missing</span>
                </div>
              </div>
            </article>
          </section>

          <section className="panel wide">
            <div className="section-head">
              <div>
                <h2>Skills Attained During the Year</h2>
                <p className="muted">
                  Formal summary of skills identified from the student's evidence, assessment output, and curriculum mapping.
                </p>
              </div>
              <div className="meta-row">
                <span>{attainedSkillCount} skills</span>
                <span>{dashboard.student?.sparsity ?? "Unknown"} evidence profile</span>
              </div>
            </div>
            <div className="learning-progress compact-learning skills-progress" aria-label="Skills attained progress">
              <div className="progress-summary">
                <div className="progress-number">
                  <strong>{averageSkillRating}%</strong>
                  <span>average</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${averageSkillRating}%` }} />
                </div>
                {hiddenSkillCount > 0 ? (
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setShowAllSkills((current) => !current)}
                  >
                    {showAllSkills ? "Show fewer skills" : `Show ${hiddenSkillCount} more skills`}
                  </button>
                ) : null}
              </div>

              {attainedSkillCount ? (
                <div className="skill-summary-grid compact-skill-grid">
                  {skillBuckets.map(([bucket, skills]) => {
                    const sortedSkills = skills
                      .slice()
                      .sort((a, b) => scorePercent(b.rating) - scorePercent(a.rating));
                    const visibleSkills = showAllSkills ? sortedSkills : sortedSkills.slice(0, compactSkillLimit);
                    return (
                      <article className="skill-panel" key={bucket}>
                        <div className="skill-panel-head">
                          <div>
                            <h3>{skillBucketLabel(bucket)}</h3>
                            <ExpandableText>{skillBucketDescription(bucket)}</ExpandableText>
                          </div>
                          <span>{skills.length}</span>
                        </div>
                        {visibleSkills.length ? (
                          <div className="skill-list">
                            {visibleSkills.map((skill) => {
                              const rating = scorePercent(skill.rating);
                              return (
                                <div className="skill-row" key={`${bucket}-${skill.name}`}>
                                  <div>
                                    <strong>{skill.name}</strong>
                                    <small>{rating}% attained</small>
                                  </div>
                                  <div className="progress-track small" aria-hidden="true">
                                    <span style={{ width: `${rating}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="muted">No skills recorded in this category.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">No skills recorded for this student yet.</p>
              )}
            </div>
          </section>

          <section className="panel wide">
            <h2>Competencies</h2>
            <div className="cards">
              {(dashboard.competencies ?? []).map((item) => (
                <article className="card" key={item.name}>
                  <div className="card-title">
                    <h3>{item.name}</h3>
                    <span>{item.level}</span>
                  </div>
                  <ExpandableText>{item.diagnosis}</ExpandableText>
                  {item.evidence?.length ? (
                    <ul>
                      {item.evidence.slice(0, 3).map((evidence) => (
                        <ExpandableText as="li" key={evidence}>{evidence}</ExpandableText>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel compact-panel">
            <h2>Quick Fixes</h2>
            <ul className="clean-list">
              {(dashboard.overview?.quickFixes ?? []).map((fix) => (
                <ExpandableText as="li" key={fix}>{fix}</ExpandableText>
              ))}
            </ul>
          </section>

          <section className="panel compact-panel">
            <h2>Top Issues</h2>
            <ul className="clean-list">
              {(dashboard.overview?.topIssues ?? []).map((issue) => (
                <ExpandableText as="li" key={issue}>{issue}</ExpandableText>
              ))}
            </ul>
          </section>

          <section className="panel compact-panel">
            <h2>Strengths</h2>
            <div className="stack">
              {(dashboard.strengths ?? []).map((strength) => (
                <article key={strength.area}>
                  <h3>{strength.area}</h3>
                  <ExpandableText>{strength.evidence?.join(" ")}</ExpandableText>
                </article>
              ))}
            </div>
          </section>

          <section className="panel compact-panel">
            <h2>Gaps</h2>
            <div className="stack">
              {(dashboard.gaps ?? []).map((gap) => (
                <article key={gap.area}>
                  <h3>{gap.area}</h3>
                  <ExpandableText>{gap.reason}</ExpandableText>
                  <ExpandableText as="strong">{gap.recommendation}</ExpandableText>
                </article>
              ))}
            </div>
          </section>

          <section className="panel wide">
            <div className="section-head">
              <div>
                <h2>Learning Map</h2>
                <p className="muted">
                  {dashboard.learningMap?.summary || "No curriculum learning map returned."}
                </p>
              </div>
              <div className="meta-row">
                <span>{dashboard.learningMap?.programCode || "No program"}</span>
                <span>Target {dashboard.learningMap?.targetScore ?? ideal}%</span>
                <span>{learningStats.missing} missing</span>
                <span>{learningStats.needsWork} needs work</span>
                <span>{learningStats.met} met</span>
              </div>
            </div>

            {learningSkillCount ? (
              <div className="learning-progress compact-learning" aria-label="Learning map progress">
                <div className="progress-summary">
                  <div className="progress-number">
                    <strong>{learningCompletion}%</strong>
                    <span>complete</span>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <span style={{ width: `${learningCompletion}%` }} />
                  </div>
                  {hiddenMetCount > 0 ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setShowMetLearning((current) => !current)}
                    >
                      {showMetLearning ? "Hide met skills" : `Show ${hiddenMetCount} met skills`}
                    </button>
                  ) : null}
                </div>
                <div className="progress-list">
                  {visibleLearningSkills.map((skill, index) => {
                    const itemProgress = progressPercent(skill.currentRating, skill.targetRating ?? dashboard.learningMap?.targetScore ?? ideal);
                    const skillMessage = learningSkillMessage(skill);
                    const skillKey = `${skill.courseCode ?? "course"}-${skill.name ?? "skill"}-${index}`;
                    return (
                      <article className="progress-item" key={skillKey}>
                        <div>
                          <ExpandableText as="h3">{skill.courseTitle}</ExpandableText>
                          {skillMessage ? <ExpandableText>{skillMessage}</ExpandableText> : null}
                        </div>
                        <div className="progress-item-meter">
                          <span className={`mini-status mini-status-${skill.status ?? "unknown"}`}>
                            {statusLabel(skill.status)}
                          </span>
                          <div className="progress-track small" aria-hidden="true">
                            <span style={{ width: `${itemProgress}%` }} />
                          </div>
                          <small>
                            {skill.currentRating ?? 0}% / {skill.targetRating ?? dashboard.learningMap?.targetScore ?? ideal}%
                          </small>
                          <ResourceLinks
                            coursewareUrl={skill.coursewareUrl}
                            linkedinLearningUrl={skill.linkedinLearningUrl}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!visibleLearningSkills.length ? (
                  <p className="muted">
                    All listed learning targets are currently marked met. Use the button above to review completed skills.
                  </p>
                ) : null}
              </div>
            ) : null}

            {!learningSkillCount ? (
              <p className="muted">
                No main-course skill targets were found for this exact year level.
              </p>
            ) : null}
          </section>

          <section className="panel wide">
            <h2>Recommendations</h2>
            <div className="cards recommendations">
              {(dashboard.recommendations ?? []).map((item) => (
                <article className="card" key={item.title}>
                  <div className="card-title">
                    <h3>{item.title}</h3>
                    <span>{item.provider}</span>
                  </div>
                  <ExpandableText>{item.reason}</ExpandableText>
                  <div className="card-footer">
                    <small>{item.relatedCompetency}</small>
                    <ResourceLinks linkedinLearningUrl={item.url} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel wide narrative-panel">
            <div className="section-head">
              <div>
                <h2>Student Narrative Summary</h2>
                <p className="muted">
                  Detailed written interpretation of the student's yearly skills, evidence, and development priorities.
                </p>
              </div>
            </div>
            <NarrativeText text={dashboard.narrative} />
          </section>

          <details className="raw-json wide">
            <summary>Raw API Response</summary>
            <pre>{payload ? asJson(payload) : rawText || "Waiting for API response..."}</pre>
          </details>
        </div>
      )}
    </main>
  );
}
