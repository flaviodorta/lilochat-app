# ADR-011: OpenTelemetry + Collector Pipeline; Grafana Stack Default, Datadog Switchable

- **Status:** Accepted
- **Date:** 2026-07-10

## Context

A choreographed system (ADR-002) is only debuggable if a single user action can be followed across
HTTP hops and RabbitMQ messages. Observability is also product-critical here: sync drift — the
product-defining SLI — is measured from sampled client telemetry and needs its own histogram,
dashboard panel, and alert. Two backend pulls compete: a self-hosted stack costs nothing and
operating it is itself portfolio material, while Datadog is what many international teams use and
produces recognizable APM evidence — at roughly US$31+/host/month for always-on APM.

## Decision Drivers

- Correlated traces across the event bus, not just across HTTP.
- Zero license cost for the always-on production baseline.
- Backend portability: swapping or adding vendors must not touch service code.
- Local development parity: observability must be a first-class local feature, not a production
  afterthought.

## Considered Options

1. **Datadog SDK/agent directly** — the best out-of-the-box experience, but instrumentation code
   becomes vendor-coupled, and the always-on cost is disproportionate for this deployment.
2. **Grafana stack with native clients** (prom-client, pino-to-Loki, Tempo-specific tracing) —
   free, but each signal couples to its backend in code; adding Datadog later would mean touching
   every service.
3. **OpenTelemetry SDK in every service, exporting OTLP to an OTel Collector** — the backend
   becomes an exporter configuration in the Collector, not a code decision. Default exporters
   feed the self-hosted Grafana stack (Prometheus, Loki, Tempo, Grafana); a documented `datadog:`
   exporter block can be enabled on demand for demo or interview evidence.

## Decision

Option 3. W3C `traceparent` propagates through HTTP and through RabbitMQ message headers, so
choreographed flows produce single correlated traces — the practical answer to "how do you debug
event-driven systems". Metrics follow RED per endpoint and event handler plus product metrics
(sync-drift histogram, active rooms, vote pass rate, DLQ depth, outbox lag); logs are structured
pino JSON carrying the traceId. The dev compose ships the full pipeline behind an `obs` profile.

## Consequences

### Positive

- Vendor swaps and additions are Collector config edits; service code never changes.
- Traces cross the event bus, keeping choreography (ADR-002) debuggable end to end.
- Zero license cost by default, with a credible, cheap on-demand path to Datadog evidence.

### Negative

- The Collector is one more container — and a single funnel — to run, size, and upgrade.
- Self-hosting Prometheus, Loki, and Tempo means owning retention, storage, and upgrades on the
  same VPS as the product.
- OpenTelemetry maturity is uneven across signals in Node.js (logs are the newest); some SDK
  churn is expected and accepted.
