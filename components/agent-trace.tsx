export type TraceStep = {
  id: string; title: string; detail: string; source: string;
  status: "working" | "done" | "warning"; at: number;
};
export type SponsorResearch = {
  summary: string; sources: { title: string; url: string }[];
  queries: string[]; searchSuggestions: string;
};

export function AgentTrace({ steps, research }: { steps: TraceStep[]; research: SponsorResearch | null }) {
  return <section className="agent-trace" aria-label="Agent activity trace">
    <div className="trace-heading"><span className="eyebrow">AGENT ACTIVITY</span><span className="trace-live">LIVE TRACE</span></div>
    <p className="trace-intro">Observations, tool calls, and generation events as they happen.</p>
    {!steps.length ? <p className="trace-empty">Start the demo to watch the agent follow the match.</p> : null}
    <ol aria-live="polite" aria-relevant="additions text">{steps.map(step => <li key={step.id} data-status={step.status}>
      <span className="trace-dot" aria-label={step.status}>{step.status === "done" ? "✓" : step.status === "warning" ? "!" : "•"}</span>
      <div><div className="trace-label"><strong>{step.title}</strong><time>{step.at.toFixed(1)}s</time></div>
        <p>{step.detail}</p><small>{step.source}</small>
      </div>
    </li>)}</ol>
    {research ? <details className="sponsor-research"><summary>View sponsor research & sources</summary>
      <p>{research.summary}</p>
      <ul>{research.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noreferrer">[{index + 1}] {source.title}</a></li>)}</ul>
      {research.queries.length ? <p>Searches: {research.queries.join(" · ")}</p> : null}
      {research.searchSuggestions ? <iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={research.searchSuggestions} /> : null}
    </details> : null}
  </section>;
}
