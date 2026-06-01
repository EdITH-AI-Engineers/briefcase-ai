import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, PlayCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { fetchDashboard, fetchRuns, fetchStudentDashboard, fetchStudents, type RunSummary, type StudentSummary } from "./lib/api";
import type { StudentDashboardDto } from "./types/dashboard";
import { Popover } from "./components/Popover";
import { Drawer } from "./components/Drawer";
import { ReferenceChip } from "./components/ReferenceChip";

type RoadmapNode = StudentDashboardDto["roadmap"]["nodes"][number];

const ScoreCharts = lazy(() => import("./components/ScoreCharts").then((module) => ({ default: module.ScoreCharts })));
const Roadmap = lazy(() => import("./components/Roadmap").then((module) => ({ default: module.Roadmap })));

function Progress({ value }: { value: number }) {
  return <div className="progress"><span style={{ width: `${value}%` }} /></div>;
}

function ProfilePicker({
  runs,
  students,
  selectedRunId,
  selectedStudentId,
  onRunChange,
  onStudentChange,
}: {
  runs: RunSummary[];
  students: StudentSummary[];
  selectedRunId: string;
  selectedStudentId: string;
  onRunChange: (runId: string) => void;
  onStudentChange: (studentId: string) => void;
}) {
  return (
    <div className="profile-picker">
      <label>
        <span>Run</span>
        <select value={selectedRunId} onChange={(event) => onRunChange(event.target.value)}>
          {runs.map((run) => <option key={run.id} value={run.id}>{run.id} · {run.status}</option>)}
        </select>
      </label>
      <label>
        <span>Fake profile</span>
        <select value={selectedStudentId} onChange={(event) => onStudentChange(event.target.value)}>
          {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.program} Y{student.yearLevel ?? "?"}</option>)}
        </select>
      </label>
    </div>
  );
}

function Dashboard({
  data,
  runs,
  students,
  selectedRunId,
  selectedStudentId,
  onRunChange,
  onStudentChange,
}: {
  data: StudentDashboardDto;
  runs: RunSummary[];
  students: StudentSummary[];
  selectedRunId: string;
  selectedStudentId: string;
  onRunChange: (runId: string) => void;
  onStudentChange: (studentId: string) => void;
}) {
  const [drawerNode, setDrawerNode] = useState<RoadmapNode | null>(null);
  const referenceById = useMemo(
    () => new Map(data.references.map((reference) => [reference.id, reference])),
    [data.references],
  );
  const drawerCourses = drawerNode
    ? data.recommendations.filter((rec) => rec.relatedCompetency === drawerNode.competency)
    : [];
  const competencyGaps = [...data.competencies]
    .map((competency) => ({ ...competency, gap: Math.max(0, competency.idealScore - competency.score) }))
    .sort((a, b) => b.gap - a.gap);
  const evidenceSnippetCount = data.competencies.reduce((count, competency) => count + competency.evidence.length, 0);
  const citationCount = data.competencies.reduce((count, competency) => count + competency.citations.length, 0)
    + data.overview.topIssues.reduce((count, issue) => count + issue.citations.length, 0);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-chart">
          <div className="hero-chart-head">
            <div className="hero-chart-label">
              <div className="eyebrow"><BriefcaseBusiness size={16} /> Briefcase AI</div>
              <span className="hero-score-label">Overall Score</span>
              <strong className="hero-score-number">{data.overview.overallScore}</strong>
              <em className="hero-rating-pill">{data.overview.ratingLabel}</em>
            </div>
            <div className="hero-stats" aria-label="Score per competency">
              {data.competencies.map((competency) => (
                <div className="hero-stat" key={competency.name}>
                  <span className="hero-stat-name" title={competency.name}>{competency.name}</span>
                  <div
                    className="score-bar score-bar-sm"
                    role="progressbar"
                    aria-valuenow={competency.score}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${competency.name} ${competency.score} of 100`}
                  >
                    <span className="fill" style={{ width: `${competency.score}%` }} />
                    <span
                      className="ideal-marker"
                      style={{ left: `${competency.idealScore}%` }}
                      aria-label={`Ideal ${competency.idealScore}`}
                    />
                  </div>
                  <span className="hero-stat-score">{competency.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-overall-row">
            <span className="hero-overall-name">Overall</span>
            <div
              className="score-bar score-bar-lg"
              role="progressbar"
              aria-valuenow={data.overview.overallScore}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Overall ${data.overview.overallScore} of 100`}
            >
              <span className="fill" style={{ width: `${data.overview.overallScore}%` }} />
              <span
                className="ideal-marker"
                style={{ left: `${data.overview.idealScore}%` }}
                aria-label={`Ideal ${data.overview.idealScore}`}
              />
            </div>
            <span className="hero-overall-value">{data.overview.overallScore}</span>
          </div>
          <div className="score-legend" aria-label="Score chart legend">
            <span><i className="legend-swatch legend-bar" />Your score</span>
            <span><i className="legend-swatch legend-marker" />Ideal year-level score {data.overview.idealScore}</span>
          </div>
        </div>
        <footer className="hero-footer">
          <div className="hero-identity">
            <h1>{data.student.name}</h1>
            <span className="hero-meta">{data.student.program}-Y{data.student.yearLevel ?? "?"} · sparsity {data.student.sparsity} · framework {data.run.frameworkVersion}</span>
          </div>
          <ProfilePicker
            runs={runs}
            students={students}
            selectedRunId={selectedRunId}
            selectedStudentId={selectedStudentId}
            onRunChange={onRunChange}
            onStudentChange={onStudentChange}
          />
        </footer>
      </section>

      <section className="overview-grid">
        <div className="panel summary-panel">
          <div>
            <div className="section-kicker">Assessment summary</div>
            <h2>Gap-first portfolio diagnosis</h2>
            <p>{data.overview.summary}</p>
          </div>
          <div className="basis-grid" aria-label="Assessment basis">
            <span><b>{data.run.status}</b><small>Run status</small></span>
            <span><b>{data.run.frameworkVersion}</b><small>Framework</small></span>
            <span><b>{data.student.sparsity}</b><small>Profile sparsity</small></span>
            <span><b>{evidenceSnippetCount}</b><small>Evidence snippets</small></span>
            <span><b>{citationCount}</b><small>Citations</small></span>
            <span><b>{data.references.length}</b><small>References</small></span>
          </div>
        </div>
        <div className="panel gap-priority-panel">
          <div className="section-kicker">Largest competency gaps</div>
          {competencyGaps.map((competency) => (
            <article key={competency.name} className={competency.gap > 0 ? "gap-row" : "gap-row gap-row-ok"}>
              <div>
                <h3>{competency.name}</h3>
                <span>{competency.score}/100 actual · {competency.idealScore}/100 target</span>
              </div>
              <div className="gap-track" aria-label={`${competency.name} gap ${competency.gap}`}>
                <span style={{ width: `${competency.gap}%` }} />
              </div>
              <b>{competency.gap > 0 ? `-${competency.gap}` : "+0"}</b>
            </article>
          ))}
        </div>
        <div className="panel issues-panel">
          <div>
            <h2>Top evidence gaps</h2>
            {data.overview.topIssues.length > 0
              ? data.overview.topIssues.map((issue) => (
                <article className="issue-card" key={issue.competency}>
                  <AlertTriangle size={15} />
                  <div>
                    <h3>{issue.competency}</h3>
                    <p className="issue-summary">{issue.summary}</p>
                    {issue.status !== issue.summary && (
                      <p className="issue-status">{issue.status}</p>
                    )}
                    {issue.citations.length > 0 && (
                      <div className="citation-chips">
                        {issue.citations.map((citation) => {
                          const reference = referenceById.get(citation.doc);
                          const label = `${citation.doc}:${citation.clause}`;
                          return reference
                            ? <ReferenceChip key={label} reference={reference} label={label} />
                            : <span className="ref-chip" key={label}>{label}</span>;
                        })}
                      </div>
                    )}
                  </div>
                </article>
              ))
              : <p><CheckCircle2 size={15} />No top issues available for this profile.</p>}
          </div>
          <div>
            <h2>Portfolio actions</h2>
            {data.overview.quickFixes.length > 0
              ? data.overview.quickFixes.map((fix) => <p key={fix}><CheckCircle2 size={15} />{fix}</p>)
              : <p><CheckCircle2 size={15} />No portfolio actions generated yet.</p>}
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="panel loading-panel">Loading score charts...</div>}>
        <ScoreCharts data={data} />
      </Suspense>

      <section className="panel competency-list">
        <div className="section-kicker">Diagnosis per competency</div>
        {data.competencies.map((competency) => {
          const delta = competency.score - competency.idealScore;
          return (
          <article key={competency.name}>
            <div className="competency-main">
              <h3>{competency.name}</h3>
              <p>{competency.diagnosis}</p>
              <div className="score-marker-row">
                <span>Score {competency.score}</span>
                <span>Target {competency.idealScore}</span>
                <b className={delta < 0 ? "delta-badge negative" : "delta-badge positive"}>{delta > 0 ? `+${delta}` : delta}</b>
              </div>
              {competency.evidence.length > 0 ? (
                <details className="evidence-details">
                  <summary>{competency.evidence.length} evidence snippet{competency.evidence.length === 1 ? "" : "s"}</summary>
                  <ul>{competency.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              ) : (
                <p className="empty-evidence">No portfolio evidence cited for this competency.</p>
              )}
            </div>
            <strong>{competency.level}</strong>
            <div className="competency-progress">
              <Progress value={competency.score} />
              <i style={{ left: `${competency.idealScore}%` }} aria-label={`Target ${competency.idealScore}`} />
            </div>
            {competency.citations.length > 0 && (
              <div className="citation-chips">
                {competency.citations.map((citation) => {
                  const reference = referenceById.get(citation.doc);
                  const label = `${citation.doc} §${citation.clause}`;
                  if (!reference) {
                    return <span key={`${citation.doc}-${citation.clause}`} className="ref-chip">{label}</span>;
                  }
                  return (
                    <Popover
                      key={`${citation.doc}-${citation.clause}`}
                      trigger={<span className="ref-chip" aria-label={reference.title}>{label}</span>}
                    >
                      <strong>{reference.title}</strong>
                      <span style={{ color: "#94a3b8" }}>Clause {citation.clause}</span>
                      {reference.url.startsWith("http") ? (
                        <a href={reference.url} target="_blank" rel="noreferrer">{reference.url}</a>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>{reference.url}</span>
                      )}
                    </Popover>
                  );
                })}
              </div>
            )}
          </article>
          );
        })}
      </section>

      <section className="panel skills-panel">
        <div className="section-kicker">Portfolio evidence gaps and red flags</div>
        <div className="skill-columns">
          {Object.entries({ Hard: data.skills.hard, Soft: data.skills.soft, Tools: data.skills.tools, Domains: data.skills.domains }).map(([label, skills]) => (
            <div key={label}><h3>{label}</h3>{skills.map((skill) => <span className="tag" key={skill.name}>{skill.name}<b>{skill.rating}</b></span>)}</div>
          ))}
        </div>
        <h3 className="missing-title">Evidence your profile does not yet show</h3>
        <div className="missing-tags">{data.skills.missing.map((item) => <span key={item}>{item}</span>)}</div>
        <div className="red-flags">{data.skills.redFlags.map((flag) => <p key={flag}><AlertTriangle size={15} />{flag}</p>)}</div>
      </section>

      <Suspense fallback={<div className="panel loading-panel">Loading roadmap...</div>}>
        <Roadmap data={data} onNodeClick={setDrawerNode} />
      </Suspense>

      <section className="recommendation-grid" aria-label="Portfolio action searches">
        {data.recommendations.map((rec) => (
          <a className="course-card" href={rec.url} key={`${rec.relatedCompetency}-${rec.title}-${rec.url ?? ""}`} target="_blank" rel="noreferrer">
            <span>Learning search</span>
            <em className="source-badge">{rec.source.replace(/_/g, " ")}</em>
            <h3>{rec.title}</h3>
            <p>{rec.reason}</p>
            <small>{rec.relatedCompetency} resource discovery <ExternalLink size={13} /></small>
          </a>
        ))}
      </section>

      <section className="panel narrative-panel">
        <details>
          <summary>Full assessment narrative</summary>
          <ReactMarkdown>{data.narrative || "No narrative available for this profile."}</ReactMarkdown>
        </details>
      </section>

      <section className="panel references-panel">
        <div className="section-kicker"><FileText size={15} /> Framework references</div>
        <div className="chip-row">
          {data.references.map((reference) => <ReferenceChip key={reference.id} reference={reference} />)}
        </div>
      </section>

      <Drawer
        open={!!drawerNode}
        onClose={() => setDrawerNode(null)}
        title={drawerNode?.label ?? ""}
      >
        {drawerNode && (
          <>
            <p className="drawer-detail">{drawerNode.detail}</p>
            {drawerNode.objectives && drawerNode.objectives.length > 0 && (
              <>
                <h3>Goals & objectives</h3>
                <ul>{drawerNode.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
              </>
            )}
            <h3>Learning searches</h3>
            {drawerCourses.length > 0 ? (
              drawerCourses.map((rec) => (
                <a key={rec.title} className="drawer-course" href={rec.url} target="_blank" rel="noreferrer">
                  <span>Resource discovery</span>
                  <h3>{rec.title}</h3>
                  <p>{rec.reason}</p>
                </a>
              ))
            ) : (
              <p className="drawer-empty">No learning searches tied to this competency yet.</p>
            )}
          </>
        )}
      </Drawer>
    </main>
  );
}

function EmptyState() {
  return (
    <main className="shell">
      <section className="empty-state panel">
        <div className="empty-icon"><PlayCircle size={28} /></div>
        <p className="eyebrow">No analysis run found</p>
        <h1>Run the pipeline to populate the dashboard.</h1>
        <p>The API is pointed at real analysis output. Once developers generate synthetic users and analyze them, the latest run appears here automatically.</p>
        <pre>make pipeline</pre>
      </section>
    </main>
  );
}

export function App() {
  const [data, setData] = useState<StudentDashboardDto | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchDashboard()])
      .then(async ([nextRuns, latestDashboard]) => {
        setRuns(nextRuns);
        setData(latestDashboard);
        const runId = latestDashboard?.run.id ?? nextRuns[0]?.id ?? "";
        setSelectedRunId(runId);
        setSelectedStudentId(latestDashboard?.student.id ?? "");
        if (runId) setStudents(await fetchStudents(runId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleRunChange = (runId: string) => {
    setSelectedRunId(runId);
    setLoading(true);
    fetchStudents(runId)
      .then(async (nextStudents) => {
        setStudents(nextStudents);
        const firstStudent = nextStudents[0];
        setSelectedStudentId(firstStudent?.id ?? "");
        setData(firstStudent ? await fetchStudentDashboard(runId, firstStudent.id) : null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  const handleStudentChange = (studentId: string) => {
    setSelectedStudentId(studentId);
    setLoading(true);
    fetchStudentDashboard(selectedRunId, studentId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  };

  if (error) return <main className="shell"><div className="panel error">{error}</div></main>;
  if (loading && !data) return <main className="shell"><div className="skeleton hero-skeleton" /><div className="skeleton block-skeleton" /></main>;
  if (!data) return <EmptyState />;
  return (
    <Dashboard
      data={data}
      runs={runs}
      students={students}
      selectedRunId={selectedRunId}
      selectedStudentId={selectedStudentId || data.student.id}
      onRunChange={handleRunChange}
      onStudentChange={handleStudentChange}
    />
  );
}
