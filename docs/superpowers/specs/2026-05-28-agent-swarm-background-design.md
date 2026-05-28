# Background Agent Swarm Design

Date: 2026-05-28
Project: OfferGuard AI

## Purpose

OfferGuard AI already runs eight specialist analysis agents in parallel inside `runAnalysis`. The current user experience still waits for every agent and the final orchestrator before showing a report. This design changes the analysis flow into a background swarm that returns a report ID immediately, stores partial results as each agent finishes, shows live progress on the report page, and runs a critic pass before the final verdict.

The goal is faster perceived output, fewer request-timeout risks, and higher quality final recommendations without turning the app into a full distributed agent platform.

## Current Flow

The current `/analyze` page calls `runAnalysis` and waits for the server function to complete. `runAnalysis` builds shared context, starts eight agent calls with `Promise.all`, runs a final orchestrator, persists the completed analysis row, and returns the row ID. The report page only has data after all work is done.

This means the app has real parallelism internally, but no background execution and no partial output.

## Proposed Flow

1. The user submits text, PDF-extracted text, screenshot OCR text, or company lookup text from `/analyze`.
2. The server creates an `analyses` row immediately with `status: "running"`, source metadata, an empty or partial `result`, and a `progress` object.
3. The UI navigates to `/report/$id` immediately.
4. A background processor starts the swarm and updates the same row as each agent completes.
5. The report page polls `getAnalysis` every 1 to 2 seconds while `status` is `queued` or `running`.
6. Completed sections render immediately. Running sections show stable loading states. Failed non-critical sections show a recoverable failure state.
7. After specialist agents finish or fail, a critic agent reviews all usable specialist outputs.
8. The final orchestrator merges specialist outputs plus critic feedback into the final recommendation.
9. The row is marked `status: "complete"` when the final verdict is available, or `status: "partial"` if enough useful output exists but one or more agents failed.

## Architecture

### Database

Extend the `analyses` table with job-oriented state:

- `status`: supports `queued`, `running`, `complete`, `partial`, and `failed`.
- `progress`: JSON object keyed by agent ID, with each value containing `status`, timestamps, and optional error text.
- `result`: JSON object that can be partially populated while the swarm runs.
- `started_at`: timestamp for when background processing begins.
- `completed_at`: timestamp for when final or partial output is ready.
- `error`: top-level fatal error message, only set when the whole job fails.

The existing `result` shape stays compatible with `AnalysisResult` once complete. During processing, the app treats sections as optional and uses progress state to decide what to render.

### Server Functions

Replace the current synchronous submit behavior with two server responsibilities:

- `createAnalysisJob`: validates input, inserts an analysis row, starts background execution, and returns `{ id }` immediately.
- `getAnalysis`: returns the current row, including partial `result`, `progress`, and `status`.

The existing `runAnalysis` implementation should be split so orchestration logic can be reused by the background processor instead of living inside the submit request path.

### Background Processor

For the first implementation, use an in-process background task triggered after the row is created. This is the smallest change that enables the new UX in the current TanStack Start app.

The implementation should isolate the background logic behind a clear function, for example:

```ts
startAnalysisSwarm({ analysisId, input });
```

That function should:

1. Mark the job `running`.
2. Start all specialist agents concurrently.
3. Persist each result as soon as its promise resolves.
4. Mark individual agent failures without cancelling the whole job unless the failure is fatal.
5. Run the critic agent after specialist results settle.
6. Run the final orchestrator with all available outputs and critic feedback.
7. Mark the job `complete`, `partial`, or `failed`.

This keeps the door open for moving the same processor to Cloudflare Queues later without redesigning the app flow.

### Agent Set

Keep the existing eight specialist agents:

- Culture Agent
- Burnout Agent
- Salary Agent
- Ghost Hiring Agent
- Negotiation Agent
- Reverse Interview Agent
- HR Claim Verifier Agent
- Career Simulation Agent

Add one quality agent:

- Critic Agent: reviews specialist outputs for unsupported claims, contradictions, weak evidence, missing confidence qualifiers, and overconfident language.

Keep one final synthesis agent:

- Final Orchestrator: produces the overall recommendation, truth score, top risks, top greens, company, and role title.

## Data Model

Use stable agent IDs in code and database state:

```ts
type AgentId =
  | "culture"
  | "burnout"
  | "salary"
  | "ghost"
  | "negotiation"
  | "reverse"
  | "lie"
  | "simulation"
  | "critic"
  | "orchestrator";

type AgentStatus = "pending" | "running" | "complete" | "failed" | "skipped";

type AgentProgress = {
  status: AgentStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

type AnalysisProgress = Record<AgentId, AgentProgress>;
```

Partial `result` should use `Partial<AnalysisResult>` during processing. The final report should only assume `AnalysisResult` completeness when `status === "complete"`.

## Error Handling

Agent calls should settle independently. Use `Promise.allSettled` or equivalent wrappers so one specialist failure does not discard successful outputs.

Failure policy:

- If the source text is invalid or the row cannot be created, fail before navigation.
- If all specialist agents fail, mark the job `failed`.
- If some specialist agents fail but at least three meaningful outputs exist, run critic and orchestrator with available data and mark the result `partial`.
- If critic fails, continue to final orchestrator and mark critic as failed.
- If final orchestrator fails but specialist outputs exist, mark the job `partial`.
- Store sanitized error messages in `progress`, not full provider stack traces.

The final report should explicitly show when a section failed instead of hiding it.

## UI Behavior

The analyze page should submit and navigate quickly. Button copy should change from "Analyzing - 8 agents running" to a shorter queued state, because the long-running work moves to the report page.

The report page should support three states:

- `queued` or `running`: show the report shell with per-agent progress.
- `partial`: show available sections and a visible note that some agents did not complete.
- `complete`: show the full report as today, plus any critic-informed confidence notes.

Each report section should render from the matching partial result when available. Loading placeholders should have stable dimensions so the layout does not jump as agents finish.

## Performance

Parallel specialist execution remains the main speed improvement. The user sees the report page immediately, then completed sections appear as soon as their agent finishes. This improves perceived latency even when total processing time stays similar.

The critic pass adds one extra model call after the specialist phase. That should not block partial rendering. It only gates the final verdict.

## Security And Privacy

The existing source text handling should remain server-side. Do not expose provider errors or internal prompts to the client. Store only the submitted source text, structured input, partial outputs, progress state, and sanitized errors in Supabase.

The background processor must use the server Supabase client only. Client code should only read job state through server functions.

## Testing

Add tests or focused verification for:

- Creating an analysis row returns an ID before agent completion.
- Agent progress updates independently.
- One specialist failure does not prevent other sections from completing.
- Critic receives only available specialist outputs.
- Orchestrator can produce a `partial` final state when some agents fail.
- Report page renders running, partial, failed-section, and complete states without crashes.

Manual verification should include submitting the demo job description and confirming that `/report/$id` appears quickly while sections fill in over time.

## Migration Path

Phase 1 should use the in-process background task because it fits the current repo and can be shipped quickly.

Phase 2 can move `startAnalysisSwarm` to Cloudflare Queues or another worker runtime if deployment needs stronger durability. The database schema, progress contract, and UI polling flow should remain the same.

