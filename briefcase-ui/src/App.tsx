import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";
const ENDPOINT = "/api/dashboard/latest";

type LoadState = "loading" | "ready" | "error";

type Dashboard = {
  dashboard?: {
    run?: { id?: string; status?: string; frameworkVersion?: string };
    student?: {
      id?: string;
      name?: string;
      program?: string;
      yearLevel?: number | null;
      sparsity?: string;
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
    recommendations?: {
      title?: string;
      provider?: string;
      reason?: string;
      relatedCompetency?: string;
      url?: string;
    }[];
    narrative?: string;
  } | null;
};

function asJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function scorePercent(score?: number, ideal?: number) {
  if (!score || !ideal) return 0;
  return Math.round((score / ideal) * 100);
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState<LoadState>("loading");
  const [payload, setPayload] = useState<Dashboard | null>(null);
  const [rawText, setRawText] = useState("");

  async function loadApiText() {
    setState("loading");

    try {
      const response = await fetch(`${API_BASE}${ENDPOINT}`);
      const body = await response.text();
      setRawText(body);

      try {
        setPayload(JSON.parse(body) as Dashboard);
      } catch {
        setPayload(null);
      }

      setState(response.ok ? "ready" : "error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach API.";
      setRawText(message);
      setPayload(null);
      setState("error");
    }
  }

  useEffect(() => {
    void loadApiText();
  }, []);

  const dashboard = payload?.dashboard ?? null;
  const percent = useMemo(
    () => scorePercent(dashboard?.overview?.overallScore, dashboard?.overview?.idealScore),
    [dashboard],
  );

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Briefcase API Viewer</p>
          <h1>{dashboard?.student?.name ?? "Student Profile Report"}</h1>
          <p className="subtitle">
            {dashboard
              ? `${dashboard.student?.program ?? "Unknown program"}${dashboard.student?.yearLevel ? ` · Year ${dashboard.student.yearLevel}` : ""}`
              : `${API_BASE}${ENDPOINT}`}
          </p>
        </div>
        <button type="button" onClick={() => void loadApiText()}>
          Refresh
        </button>
      </header>

      <section className="summary-band">
        <div className="score-box">
          <span>{percent}</span>
          <small>%</small>
        </div>
        <div>
          <div className="meta-row">
            <span className={`status status-${state}`}>{state}</span>
            <span>{dashboard?.run?.id ?? "No run loaded"}</span>
            <span>{dashboard?.run?.frameworkVersion ?? "No framework version"}</span>
          </div>
          <h2>{dashboard?.overview?.ratingLabel ?? "Waiting for API response"}</h2>
          <p>{dashboard?.overview?.summary ?? rawText}</p>
        </div>
      </section>

      {!dashboard ? (
        <EmptyPanel title="No dashboard payload" text="Start the API, then refresh this page." />
      ) : (
        <div className="grid">
          <section className="panel wide">
            <h2>Competencies</h2>
            <div className="cards">
              {(dashboard.competencies ?? []).map((item) => (
                <article className="card" key={item.name}>
                  <div className="card-title">
                    <h3>{item.name}</h3>
                    <span>{item.level}</span>
                  </div>
                  <p>{item.diagnosis}</p>
                  {item.evidence?.length ? (
                    <ul>
                      {item.evidence.slice(0, 3).map((evidence) => (
                        <li key={evidence}>{evidence}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Quick Fixes</h2>
            <ul className="clean-list">
              {(dashboard.overview?.quickFixes ?? []).map((fix) => (
                <li key={fix}>{fix}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Top Issues</h2>
            <ul className="clean-list">
              {(dashboard.overview?.topIssues ?? []).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Strengths</h2>
            <div className="stack">
              {(dashboard.strengths ?? []).map((strength) => (
                <article key={strength.area}>
                  <h3>{strength.area}</h3>
                  <p>{strength.evidence?.join(" ")}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Gaps</h2>
            <div className="stack">
              {(dashboard.gaps ?? []).map((gap) => (
                <article key={gap.area}>
                  <h3>{gap.area}</h3>
                  <p>{gap.reason}</p>
                  <strong>{gap.recommendation}</strong>
                </article>
              ))}
            </div>
          </section>

          <section className="panel wide">
            <h2>Narrative</h2>
            <p className="narrative">{dashboard.narrative || "No narrative returned."}</p>
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
                  <p>{item.reason}</p>
                  <small>{item.relatedCompetency}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      <details className="raw-json">
        <summary>Raw API Response</summary>
        <pre>{payload ? asJson(payload) : rawText || "Waiting for API response..."}</pre>
      </details>
    </main>
  );
}
