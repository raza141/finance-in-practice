# Finance in Practice

Source for **financeinpractice.me**, a finance education and consulting platform that connects quantitative theory with working systems. It serves CFA and FRM candidates, university students, and the consultancy's clients.

```
finance-in-practice/
├── frontend/          # Next.js 16 (App Router, Tailwind v4, anime.js v4, R3F)  [Phase 2 ✓]
├── quant-backend/     # FastAPI quant engine (NumPy, pandas, SciPy)           [Phase 1 ✓]
├── docker-compose.yml
└── .env.example
```

## Frontend

```
frontend/src/
├── app/                       # routes: / (landing), /consulting, robots, sitemap, 404, icon
│   └── _sections/             # landing-page sections (private folder, not routed)
├── core/
│   ├── animations/            # LandingAnimationController (anime.js v4), ScrollManager, React adapter
│   ├── http/                  # BaseApiClient (abstract: timeout, cancellation, FastAPI error mapping), ApiError
│   ├── components/            # layout (Header, Footer, [F|P] Logo), ui, 3d (HeroScene -> HeroCanvas)
│   └── config/site.ts         # brand facts, credentials, metrics, disclosures (single source)
└── domains/
    ├── education/             # CurriculumCatalog, TrackCard
    ├── quant-lab/             # QuantApiClient + types generated from the backend's OpenAPI schema
    └── booking/               # QuantBookingWidget: terminal-style scheduler (tabs -> liquidity curve -> L2 book -> execute)
                               #   AvailabilityProvider (Mock now; Cal.com /v2/slots in Phase 3), TerminalAnimator,
                               #   LiquidityCurveGeometry (monotone cubic), BookingCatalog
```

```bash
cd frontend
cp .env.example .env.local     # NEXT_PUBLIC_CAL_LINK enables the 'Confirm on Cal.com' hand-off
npm install
npm run dev                    # http://localhost:3000
npm run build                  # production build (static prerender)
npm test && npm run typecheck && npm run lint
npm run gen:api                # regenerate API types after backend changes
```

## Quant backend

### Architecture

```
quant-backend/app/
├── main.py                    # ApplicationFactory: middleware, error mapping, routes
├── core/                      # config (pydantic-settings), limits, exceptions, rate limiting
├── engines/                   # PURE MATH: no FastAPI, no I/O
│   ├── validation.py          #   MatrixValidator (covariance / returns checks)
│   ├── pricing/               #   BlackScholesModel, FixedRateBond, ZeroCurveBootstrapper
│   ├── risk/                  #   VaRModel -> Parametric / Historical / MonteCarlo VaR,
│   │                          #   ScenarioLibrary, StressTester
│   └── portfolio/             #   MeanVarianceOptimizer, EfficientFrontier
├── schemas/                   # Pydantic request/response contracts + input limits
├── services/                  # PricingService, VaRService, StressTestService, PortfolioService
└── api/
    ├── deps.py                # dependency providers (override in tests)
    └── v1/endpoints/          # thin routers: validate -> service -> response
```

Each layer depends only on the layers below it: **endpoints → services → engines**. Schemas sit at the boundary. Engines raise `DomainError` subclasses, and the app turns these into HTTP 422 responses with a `type` field.

### Endpoints (`/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/pricing/black-scholes` | European option price and Greeks (with dividend yield) |
| POST | `/pricing/implied-volatility` | Implied volatility via Brent's method |
| POST | `/pricing/bond` | Price ↔ YTM, Macaulay/modified duration, convexity, cash flows |
| POST | `/pricing/yield-curve/bootstrap` | Zero curve from zero-coupon and coupon instruments |
| POST | `/risk/var/parametric` | Delta-normal VaR and ES |
| POST | `/risk/var/historical` | Historical-simulation VaR and ES (k-th worst loss; ES = mean of k worst) |
| POST | `/risk/var/monte-carlo` | Normal or Student-t Monte Carlo VaR and ES |
| GET | `/stress-test/scenarios` | Preset scenarios (GFC, COVID, +200bp, stagflation) |
| POST | `/stress-test` | Preset or custom asset-class shocks |
| POST | `/portfolio/optimize` | Min-variance, max-Sharpe, or target-return portfolio |
| POST | `/portfolio/frontier` | Efficient frontier with MVP and tangency portfolio |

Interactive docs are at `http://localhost:8000/docs` (turned off when `ENVIRONMENT=production`).

### Input limits

These limits protect the server from oversized requests. They live in `app/core/limits.py`.

- Monte Carlo: 1,000 to 100,000 simulations, and at most 5M simulation × asset cells
- At most 50 assets; at most 5,000 rows of return history; horizon of 1 to 250 days; at most 100 frontier points
  (a long-only 100-point frontier on 50 assets solves in about 0.6s using the Clarabel QP solver)
- Confidence from 90% to 99.9%; historical VaR rejects samples too small for the chosen confidence
- Covariance matrices must be square, symmetric and PSD (PD for optimisation); NaN and Inf are rejected; unknown fields are rejected
- Rate limit per client IP: `RATE_LIMIT`, default `60/minute`. Use `RATE_LIMIT_STORAGE_URI=redis://…` when running several workers.
  Behind a load balancer, set `FORWARDED_ALLOW_IPS` so the real client IP is used.

### Verification

The engines are tested against published textbook values:

| Source | Check |
|---|---|
| Hull, *OFOD*, Ex. 15.6 | BSM call 4.76, put 0.81, d1 0.7693, d2 0.6278 |
| Hull, *OFOD*, Greeks chapter | Δ 0.522, Γ 0.066, vega 12.1, Θ −4.31/yr, ρ 8.91 |
| Hull, *OFOD*, §4.4 / §4.8 | Bond yield 6.76%; price 94.213, duration 2.653 |
| Hull, *OFOD*, Table 4.4 | Bootstrapped zeros 10.127% … 10.808% |
| Hull, *RMFI* | VaR $465,300 / $1,471,300 / $1,620,100; diversification benefit $219,000 |
| Bodie, Kane & Marcus, ch. 7 | MVP wD = 0.82 (8.9%, 11.45%); tangency wD = 0.40 (11%, 14.2%, Sharpe 0.42) |

The suite also checks Greeks against finite differences, put-call parity, IV round trips, duration and convexity against numerical derivatives, Monte Carlo convergence to the analytic VaR, long-only optimality against 2,000 random portfolios, a 50-asset / 100-point frontier at the input caps, and the API contracts, limits and rate limiting.

### Run locally

```bash
cd quant-backend
uv sync                              # creates .venv with runtime + dev deps
uv run pytest                        # 132 tests
uv run ruff check app tests
uv run uvicorn app.main:app --reload # http://localhost:8000/docs
```

### Run with Docker

```bash
cp .env.example .env
docker compose up --build
```
