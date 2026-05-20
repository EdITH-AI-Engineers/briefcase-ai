import { Popover } from "./Popover";

type FrameworkRef = { id: string; title: string; url: string };

export function ReferenceChip({ reference, label }: { reference: FrameworkRef; label?: string }) {
  return (
    <Popover
      trigger={
        <span className="ref-chip" aria-label={reference.title}>
          {label ?? reference.id}
        </span>
      }
    >
      <strong>{reference.title}</strong>
      {reference.url && reference.url.startsWith("http") ? (
        <a href={reference.url} target="_blank" rel="noreferrer">{reference.url}</a>
      ) : (
        <span style={{ color: "#94a3b8" }}>{reference.url}</span>
      )}
    </Popover>
  );
}
