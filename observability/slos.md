# Service level objectives

These SLOs are for the Express wrapper, not for Trafikverket’s own API. Targets are starting points: tighten or split by route after a few weeks of real traffic in Grafana.

Window: **30 days rolling**, unless noted. Success events are counted from Prometheus (`http_*`, `trafikverket_*`, `up`).

## What we do and do not count

| Counts as | Examples |
|---|---|
| **Good (availability)** | `/api/*` with status 2xx or 4xx |
| **Bad (availability)** | `/api/*` with status 5xx (almost always 502 when Trafikverket fails or pages incorrectly) |
| **Ignored** | `/`, `/health`, `/metrics`, `/api-docs`, `/openapi.json` (ops/docs, not user API) |
| **Not an SLO (yet)** | Correctness of mapped DTOs vs Trafikverket; 400s from bad `from`/`to` or ambiguous station names |

4xx is treated as a successful *response from this service*: the client sent an unusable request. 5xx is “we could not serve the data.”

## The SLOs

### 1. User-facing availability — 99.5%

**SLI:** fraction of `/api` requests whose status is not 5xx.

**Objective:** ≥ 99.5% over 30 days.

**Error budget:** 0.5% of `/api` requests (~3.6 hours of total outage in 30 days, or a larger number of brief 502 bursts).

This is the customer-facing promise. It *includes* Trafikverket outages, because callers still see 502. If budget burns while `up` is healthy, the cause is almost always upstream, not Railway.

PromQL (30d):

```promql
1 - (
  sum(increase(http_requests_total{job="trafikverket-api",route=~"/api.*",status_code=~"5.."}[30d]))
  /
  sum(increase(http_requests_total{job="trafikverket-api",route=~"/api.*"}[30d]))
)
```

### 2. User-facing latency — 95% ≤ 5s

**SLI:** fraction of `/api` requests that finish in 5 seconds or less (`le="5"` on `http_request_duration_seconds`).

**Objective:** ≥ 95% over 30 days.

Five seconds matches a histogram bucket and leaves room for `postAllPages` (HTTP 206 paging). Cached disruptions (~45s TTL) and `/api/stations` should sit far below this. If p95 is always ~200ms, drop the threshold to 1s (`le="1"`).

PromQL (30d):

```promql
sum(increase(http_request_duration_seconds_bucket{job="trafikverket-api",route=~"/api.*",le="5"}[30d]))
/
sum(increase(http_request_duration_seconds_count{job="trafikverket-api",route=~"/api.*"}[30d]))
```

### 3. Process availability — 99.9%

**SLI:** fraction of scrape intervals where Prometheus sees the API (`up{job="trafikverket-api"} == 1`).

**Objective:** ≥ 99.9% over 30 days (~43 minutes of “cannot scrape” in 30 days).

This isolates *our* process and Railway networking from Trafikverket. A crash, bad deploy, or private-DNS/port mistake burns this budget even if nobody is calling `/api`.

PromQL (30d):

```promql
avg_over_time(up{job="trafikverket-api",instance=~".*:3000"}[30d])
```

### 4. Trafikverket dependency (diagnostic, not a customer promise)

**SLI:** fraction of client calls with `result!="error"` (`success` and `truncated` both count as good; truncated is a partial page, not a hard failure).

**Objective:** ≥ 99% over **7 days**.

We do not control this. Use it to explain SLO 1 burn, not as a commitment to tagkarta users.

PromQL (7d):

```promql
1 - (
  sum(increase(trafikverket_requests_total{job="trafikverket-api",result="error"}[7d]))
  /
  sum(increase(trafikverket_requests_total{job="trafikverket-api"}[7d]))
)
```

## Error-budget burn (when to care)

For SLO 1, a **burn rate** of 1.0 means you are spending budget at exactly the rate that hits 0.5% errors over 30 days.

| Window | Burn | Meaning |
|---|---|---|
| 1 hour | ≥ 14 | Fast burn: ~2 hours to empty a 30-day budget — page / look now |
| 6 hours | ≥ 6 | Slow burn: a bad afternoon, not necessarily a crash |

```promql
(
  sum(rate(http_requests_total{job="trafikverket-api",route=~"/api.*",status_code=~"5.."}[1h]))
  /
  sum(rate(http_requests_total{job="trafikverket-api",route=~"/api.*"}[1h]))
) / 0.005
```

Alertmanager is not deployed; watch these on the **SLOs** Grafana dashboard until you add paging.

## Suggested next splits (after you have traffic)

- Latency SLO for “fast” routes only: `/api/stations` and `/api/disruptions` at 95% ≤ 1s (cache + small payloads).
- Availability SLO excluding 502s that coincide with Trafikverket `result="error"` — only if you want a wrapper-only promise.
- Freshness SLO for positions/disruptions if tagkarta cares that data is not older than N seconds (needs a timestamp gauge; not collected today).
