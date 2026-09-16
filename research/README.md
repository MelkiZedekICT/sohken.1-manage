# Sohken research package

Prepared 16 September 2026 from the supplied three-page problem statement and 20 public primary sources. Tailored to the user's choice: solo builder, lowest-cost deployment.

Start with [the build and deployment plan](SOHKEN_BUILD_AND_DEPLOYMENT_PLAN.pdf), then use [the problems list](SOHKEN_PROBLEMS_LIST.pdf) as the implementation backlog.

- **SOHKEN_PROBLEMS_LIST.pdf** — 32 prioritized problems, evidence labels, mitigation proposals and acceptance tests; 9 pages.
- **SOHKEN_BUILD_AND_DEPLOYMENT_PLAN.pdf** — architecture, invariants, experiments, metrics, a 20–24 week part-time schedule, deployment/recovery runbooks and illustrative costs; 11 pages.
- **SOHKEN_PROBLEMS_LIST.csv** — sortable spreadsheet version of all 32 entries, UTF-8 encoded.
- **SOURCES.pdf / SOURCES.md** — linked source register, dates, evidence limits and research method.
- **Matching Markdown files** — editable source documents for the two main deliverables.

Important findings: a model proxy alone does not enforce tool execution; current NVIDIA documentation includes tool guardrails; rollback and replay need precise boundaries; the first product should prove authorization and final-state correctness in one bounded workflow.

The platform has not been implemented or deployed. Performance targets, budgets and schedule are proposals; reported external findings are distinguished from hypothetical Sohken scenarios. PDF layout, text extraction, source IDs and CSV completeness were checked.
