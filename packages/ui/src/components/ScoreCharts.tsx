import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentDashboardDto } from "../types/dashboard";

const shortLabels: Record<string, string> = {
  "Computing Foundations": "Computing",
  "Systems & Infrastructure": "Systems",
  "Data & Information Management": "Data",
  "Security, Ethics & Professional Responsibility": "Security",
  "Professional Communication": "Comms",
  "Collaboration & Teamwork": "Collab",
  "Self-Directed Learning & Innovation": "Self-learn",
};

const shortLabel = (name: string): string =>
  shortLabels[name] ?? name.split(/[,&]/)[0].trim().split(" ").slice(0, 2).join(" ");

const wrapLabel = (name: string): string => name.replace(" & ", "\n& ");

export function ScoreCharts({ data }: { data: StudentDashboardDto }) {
  const chart = data.competencies.map((item) => ({
    name: item.name,
    score: item.score,
    ideal: item.idealScore,
    gap: Math.max(0, item.idealScore - item.score),
  }));
  const gapChart = [...chart].sort((a, b) => b.gap - a.gap);

  return (
    <section className="panel score-grid">
      <div className="section-kicker">Score vs target analytics</div>
      <div className="chart-card wide">
        <h3>Largest gaps to year-level target</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={gapChart} layout="vertical" margin={{ left: 18, right: 26, top: 12, bottom: 12 }}>
            <CartesianGrid horizontal={false} stroke="rgba(15,23,42,.08)" />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={104}
              tick={{ fontSize: 11, fill: "#475569" }}
              tickFormatter={shortLabel}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              labelFormatter={(label) => String(label)}
              formatter={(value) => [`${value} points`, "Gap to target"]}
            />
            <Bar dataKey="gap" name="Gap to target" fill="#b45309" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card wide">
        <h3>Competency shape</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={chart}>
            <PolarGrid stroke="rgba(15,23,42,.14)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#334155" }} tickFormatter={wrapLabel} />
            <Tooltip formatter={(value, name) => [`${value}/100`, String(name)]} />
            <Radar dataKey="ideal" name="Ideal score" stroke="#b45309" fill="#f59e0b" fillOpacity={0.18} />
            <Radar dataKey="score" name="Student score" stroke="#0f766e" fill="#14b8a6" fillOpacity={0.36} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-card">
        <h3>Per-competency score</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chart} margin={{ left: -12, right: 12, top: 12, bottom: 0 }} barGap={4}>
            <CartesianGrid vertical={false} stroke="rgba(15,23,42,.08)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#475569" }}
              tickFormatter={shortLabel}
              tickLine={false}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={64}
            />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(label) => String(label)}
              formatter={(value, name) => [`${value}/100`, name === "score" ? "Student score" : "Ideal score"]}
            />
            <Bar dataKey="ideal" name="Ideal score" fill="#f59e0b" fillOpacity={0.34} radius={[6, 6, 0, 0]} />
            <Bar dataKey="score" name="Student score" fill="#0f766e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
