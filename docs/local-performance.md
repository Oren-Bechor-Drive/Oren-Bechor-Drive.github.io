# Local performance baseline

This command measures the checked-in website and disposable synthetic learning journeys. Its result has `scope: "local"`. It does not establish hosted capacity, provider quotas, real media egress, physical-phone playback or permission to open accounts.

Run from this checkout after installing the [local test dependencies](../README.md#local-checks), including PostgreSQL fixture binaries and Playwright Chromium:

```bash
node scripts/benchmark-local.mjs
node scripts/benchmark-local.mjs --iterations 5 > /tmp/oren-local-benchmark.json
node --test tests/unit/local-benchmark.test.mjs
```

The integration command `npm run benchmark:local` invokes the same script. Only `--iterations` with an integer from 1 to 20 is accepted. The module's `runLocalBenchmark({ iterations = 5 })` accepts no other options. Remote URLs, deployment arguments, credentials and environment-based target selection are rejected or unused. The script never loads an environment file or connects to a supplied database. Keep raw synthetic output outside the checkout or in an ignored temporary location.

## Fixture and measurement contract

The [benchmark](../scripts/benchmark-local.mjs) owns a loopback HTTP gateway, the existing [PostgreSQL-backed lesson fixture](../tests/helpers/test-lessons.mjs), Chromium and a temporary private-media directory. The database fixture applies the checked-in migrations and test Auth bootstrap only to its own disposable cluster. Ten synthetic learners receive explicit fixture-only paid grants; one learner stays free. Auth, grants, 80-paragraph lessons, 20-question quizzes and the generated silent 320x180 WebM contain no real learner or protected driving material. No billing occurs. All owners close after success or a scenario/setup failure, and the temporary media directory is removed.

The report identifies the checkout, revision, dirty-working-tree status, timestamp and iteration count. Its required environment fields describe the desktop profile; `environment.profiles` records both profiles, and scenario names identify which was used:

| Profile | Viewport | Device scale | Renderer CPU | Network |
| --- | --- | ---: | ---: | --- |
| Desktop | 1440x900 | 1 | 1x | CDP 20 ms latency, 20 Mbps download, 8 Mbps upload |
| Mobile viewport | 390x844, touch/mobile emulation | 1 | 4x slowdown | Same fixed CDP settings |

Reduced motion is enabled for repeatability. Chromium blocks non-fixture HTTP/HTTPS destinations through CDP without Playwright routing, preserving the browser's normal cache behaviour. These profiles are emulation settings, not representative-device measurements. The CPU setting affects Chromium's renderer, not the Node gateway or PostgreSQL. Node concurrency requests use native loopback with no browser network or CPU throttle.

- Public cold/warm homepage, course library and right-of-way quiz: wall time from navigation through the page load event, visible baseline element and font readiness. Each cold sample clears the HTTP cache, then its warm sample navigates to the same page in the same context. JavaScript and viewport-visible resources are included. Deferred gallery traversal and every topic's full practice interaction are outside this measurement.
- Free/paid reader: navigation through visible synthetic reading content. The paid lesson includes the authorized synthetic media descriptor. Static resources can already be warm; these are reader journeys rather than paired cold/warm trials.
- Position save: a fresh CSRF/session read and authenticated revision-aware position POST, checked for the saved position. The existing position/version is read before the timed operation.
- Quiz save/submit: fresh CSRF/session read plus the respective POST. Attempt creation is untimed setup; save records all synthetic answers, and submit must return a submitted score of 20. These timings include real local server/database grading and response bodies.
- Private media: authenticated first/tail byte ranges must return 206 with the expected total size, followed by native video decoding, a seek to 0.5 seconds and a rendered playback frame. Timings and transfer include these operations together. The short generated clip does not represent course-media size or long playback.
- Gateway concurrency: 1, 5 and 10 distinct already-provisioned paid readers request the paid section concurrently, for the chosen number of rounds. Each request gets its own latency sample; the phase also records elapsed time and successful requests per second. This is bounded read traffic, not a sustained saturation test.

Fixture admission allows up to 10,000 requests and the fixture mutation limit is 10,000, so ordinary measurement is not constrained by production defaults. A separate phase deliberately returns 429. It has its own count and no successful latency samples. Runtime/provider defaults are unchanged.

## Read the report

Each scenario reports successful `count`, nearest-rank `medianMs`/`p95Ms`, `errorCount`, `rateLimitedCount`, `attemptedCount` and total `transferredBytes`. Errors and 429 responses are excluded from successful-request latency summaries. A phase with no successes has count and percentiles zero; zero here does not mean a fast successful response. With five successes, nearest-rank p95 is the maximum observed sample. No latency/capacity threshold is imposed on this first run.

Browser transfer is CDP `encodedDataLength`, including encoded HTTP delivery in the measurement window. Gateway transfer counts response-body bytes. The `transferMeasurement` field keeps those units visible; do not combine them as if they measured identical transport overhead. Transfers include observed failed/limited responses. Cancelled navigation/media requests are not themselves errors. The local static server uses `Cache-Control: no-cache`; warm navigation still follows that policy and is not guaranteed to avoid network transfer.

Resources include Node RSS/heap/peak RSS and CPU elapsed time, plus owned PostgreSQL/Chromium process-count, RSS and lifetime CPU-percentage snapshots before/after measurement when `ps` is available. Setup is included in total process resources. Snapshot RSS sums may share memory pages and do not identify peak database/browser memory. These observations are not a memory or throughput budget. Process arguments, environment values, cookies, tokens, synthetic emails, answer bodies and credentials are absent from the report.

The fixture provider opens local PostgreSQL connections for learner RPCs and uses deterministic Auth and in-memory gateway sessions. Production Supabase HTTP transport, durable session leases, hosted request limits, private-bucket requests and edge asset delivery are not reproduced. Provider/network performance and capacity require separately authorized hosted measurement.

## First measured baseline

Measured 2026-10-08T14:06:08.330Z on revision `c9a3b430cc6bddb6bf908db172b801f418286d88` with uncommitted benchmark/integration files present (`workingTreeDirty: true`). The application suite was paused for the final sample; this is still a shared local host, not an isolated capacity laboratory. `npm run benchmark:local` exited 0 with five iterations: 200 successful samples, zero errors and five deliberate 429 responses across 28 scenarios. Raw sanitized output was kept at `/tmp/oren-local-benchmark-final-2026-10-08.json`, outside Git. The later full-suite/final-checkout run remains a separate integration check.

Environment: v26.10.0, Chromium 153.0.8010.12, linux/x64, 24 logical CPUs, 62.60 GiB host memory. Profile/network settings are exactly those above. The generated video was 19,785 bytes. Each browser row has five successes; transfer is the total across the five samples, not one-page weight. Browser figures below use encoded HTTP bytes.

| Journey | Desktop p50 ms | Desktop p95 ms | Desktop total bytes | Mobile p50 ms | Mobile p95 ms | Mobile total bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| homepage/cold | 202.14 | 214.41 | 1,418,930 | 365.02 | 376.94 | 1,005,495 |
| homepage/warm | 214.16 | 230.89 | 1,418,930 | 356.42 | 362.04 | 1,005,495 |
| course/cold | 134.64 | 155.25 | 544,170 | 173.21 | 174.37 | 537,023 |
| course/warm | 140.59 | 157.59 | 546,418 | 171.07 | 175.12 | 537,695 |
| public-quiz/cold | 158.85 | 182.61 | 746,587 | 240.62 | 276.57 | 748,951 |
| public-quiz/warm | 160.23 | 183.42 | 747,375 | 226.13 | 247.92 | 746,587 |
| reader/free | 195.05 | 197.68 | 480,888 | 237.84 | 242.89 | 480,100 |
| reader/paid | 196.42 | 198.59 | 583,200 | 247.72 | 249.03 | 583,615 |
| position/save | 48.85 | 50.04 | 4,455 | 52.53 | 53.08 | 4,456 |
| quiz/save | 50.55 | 51.30 | 21,735 | 55.67 | 58.04 | 21,735 |
| quiz/submit | 51.78 | 54.07 | 31,865 | 55.94 | 57.16 | 31,864 |
| private-media/range-and-playback | 66.66 | 75.49 | 167,955 | 83.81 | 84.46 | 167,955 |

Gateway figures use response-body bytes and native loopback, without CDP throttling. There are five rounds per concurrency level; successful requests per second describe the bounded measured phase only.

| Concurrent paid readers | Successful requests | p50 ms | p95 ms | Total body bytes | Requests/second | Errors | 429 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5 | 22.35 | 25.61 | 49,125 | 44.22 | 0 | 0 |
| 5 | 25 | 24.97 | 27.14 | 243,945 | 178.34 | 0 | 0 |
| 10 | 50 | 25.52 | 29.75 | 487,470 | 338.94 | 0 | 0 |

The deliberate limit phase returned 5 responses and 120 body bytes. It had zero successful samples and zero errors; its zero percentile fields were excluded from the latency tables.

Total wall time including setup: 23.68 seconds. Node CPU: 2025.23 ms user and 316.27 ms system. End Node RSS: 214.01 MiB; heap used: 58.74 MiB; process peak RSS: 224.70 MiB.

| Owned process snapshot | Before count | Before RSS KiB | After count | After RSS KiB | After lifetime CPU percent |
| --- | ---: | ---: | ---: | ---: | ---: |
| postgres | 7 | 80,704 | 7 | 85,532 | 0.40 |
| chromium | 5 | 310,736 | 5 | 332,484 | 20.80 |

The largest individual encoded public response was the desktop instructor WebP at 44,755 bytes including HTTP overhead, followed by the public quiz document at 40,149 bytes and the Latin font at 30,021 bytes. Homepage warm/cold transfer was unchanged at 283,786 bytes per desktop sample and 201,099 per mobile sample, consistent with the local server's `no-cache` policy. This identifies repeated local delivery; it does not establish a hosted caching regression. The instructor response is within the existing 1x 50 KiB image budget, but the initial-load run does not cover the gallery's aggregate/higher-density budgets. No measured image violation or before/after regression was established, so no optimization or new budget was added.

Verification: `node --test tests/unit/local-benchmark.test.mjs` passed five checks, including sorted/empty/invalid aggregation, remote/CLI rejection, real browser/gateway/temp-directory cleanup after setup failure, and all-scenario success with separate 429 aggregation. The default command passed after replacing a desktop-only readiness selector with a visible page heading. Local documentation references, ASCII punctuation and `git diff --check` were checked. Full application checks belong to the integrated final verification.

## Comparison and delivery investigation

Compare runs with the same iterations, profiles, fixture definitions, cache procedure and host conditions. Preserve the revision/dirty status and distinguish a changed scenario from a changed implementation. A first baseline alone cannot establish a regression. Concurrent local processes and host scheduling can change these small samples.

Use `largestPublicResources` to locate actual delivery before proposing an optimization. The [existing browser delivery checks](../tests/browser/image-delivery-browser.test.mjs) already own responsive-image, original-byte preservation, per-image compression and aggregate gallery budgets. They exercise higher densities and gallery traversal that this initial-load baseline does not cover. The [gallery loading checks](../tests/browser/road-carousel-loading-browser.test.mjs) own progressive loading. Keep those budgets and the existing [optimizer workflow](../README.md#optimize-delivery-images); do not invent a new pass/fail limit from noisy timings. Optimize a measured offender only with before/after evidence, sequential optimizer execution and the required media/gallery verification.

No assets or supplied original bytes are changed by this benchmark. Further production evidence needs representative approved media, real hosted workloads, actual quota/egress monitoring and physical-device testing through the existing [pilot procedure](hosting.md#private-pilot-and-public-opening).
