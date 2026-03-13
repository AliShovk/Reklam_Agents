# Growth Layer Roadmap

## Goal
Build the next growth layer on top of the current agent farm so it can become a measurable, experiment-driven, semi-autonomous user acquisition engine for any target site.

## Phase 1 — Measurement Foundation

### Outcomes
- Unified marketing event model
- Attribution-aware links and campaigns
- Baseline analytics summaries in the farm

### Agents
- `analytics`

### Task types
- `track_metrics`
- `analyze_attribution`

### Deliverables
- Event schema for visits, clicks, signups, leads, conversions
- Attribution summary artifacts stored in knowledge base
- Dashboard-ready aggregates per source/channel/campaign

## Phase 2 — Experiment Engine

### Outcomes
- Structured growth hypotheses
- A/B experiment definitions
- Winner selection rules

### Agents
- `experiments`

### Task types
- `design_experiments`
- `evaluate_experiments`

### Deliverables
- Experiment briefs
- Test matrix for headlines, CTA, landing variations
- Roll-forward recommendations

## Phase 3 — Acquisition Operations

### Outcomes
- Channel prioritization by expected ROI
- Repeatable acquisition playbooks
- Campaign generation for organic and hybrid traffic

### Agents
- `acquisition`

### Task types
- `run_acquisition`

### Deliverables
- Channel backlog
- Campaign hypotheses
- Playbooks for SEO, communities, referral loops, parasitic distribution

## Phase 4 — Conversion Optimization

### Outcomes
- Better landing performance
- Better CTA and funnel efficiency
- Return-flow and retention loops

### Dependencies
- analytics + experiments operational

## Phase 5 — Autonomous Growth Loop 2.0

### Outcomes
- Self-optimizing growth loop
- Automatic scaling of winners
- Automatic suppression of weak channels and failing experiments

## Recommended implementation order
1. Add agent and task foundations
2. Add analytics summaries into knowledge base and status surfaces
3. Add experiment planning and evaluation layer
4. Add acquisition planning layer
5. Wire conversion and autonomous optimization decisions into Supervisor
