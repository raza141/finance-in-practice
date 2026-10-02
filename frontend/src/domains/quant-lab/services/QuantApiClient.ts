import { BaseApiClient, type ApiClientOptions, type RequestOptions } from "@/core/http/BaseApiClient";
import type {
  BlackScholesRequest,
  BlackScholesResponse,
  BondRequest,
  BondResponse,
  BootstrapRequest,
  BootstrapResponse,
  FrontierRequest,
  FrontierResponse,
  HealthResponse,
  HistoricalVaRRequest,
  ImpliedVolRequest,
  ImpliedVolResponse,
  MonteCarloVaRRequest,
  OptimizeRequest,
  ParametricVaRRequest,
  PortfolioResponse,
  StressScenario,
  StressTestRequest,
  StressTestResponse,
  VaRResponse,
} from "../types";

/** Client for the FastAPI quant backend (`quant-backend/`). */
export class QuantApiClient extends BaseApiClient {
  static readonly API_PREFIX = "/api/v1";
  static readonly DEFAULT_ORIGIN = "http://localhost:8000";

  private static instance: QuantApiClient | null = null;

  constructor(options: Partial<ApiClientOptions> = {}) {
    super({
      ...options,
      baseUrl:
        options.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? QuantApiClient.DEFAULT_ORIGIN,
    });
  }

  /** Shared instance for application code; construct directly in tests. */
  static shared(): QuantApiClient {
    QuantApiClient.instance ??= new QuantApiClient();
    return QuantApiClient.instance;
  }

  health(options?: RequestOptions): Promise<HealthResponse> {
    return this.get("/health", options);
  }

  // --- Pricing -------------------------------------------------------------

  blackScholes(body: BlackScholesRequest, options?: RequestOptions) {
    return this.post<BlackScholesResponse>(this.v1("/pricing/black-scholes"), body, options);
  }

  impliedVolatility(body: ImpliedVolRequest, options?: RequestOptions) {
    return this.post<ImpliedVolResponse>(this.v1("/pricing/implied-volatility"), body, options);
  }

  bond(body: BondRequest, options?: RequestOptions) {
    return this.post<BondResponse>(this.v1("/pricing/bond"), body, options);
  }

  bootstrapZeroCurve(body: BootstrapRequest, options?: RequestOptions) {
    return this.post<BootstrapResponse>(this.v1("/pricing/yield-curve/bootstrap"), body, options);
  }

  // --- Risk ----------------------------------------------------------------

  parametricVaR(body: ParametricVaRRequest, options?: RequestOptions) {
    return this.post<VaRResponse>(this.v1("/risk/var/parametric"), body, options);
  }

  historicalVaR(body: HistoricalVaRRequest, options?: RequestOptions) {
    return this.post<VaRResponse>(this.v1("/risk/var/historical"), body, options);
  }

  monteCarloVaR(body: MonteCarloVaRRequest, options?: RequestOptions) {
    return this.post<VaRResponse>(this.v1("/risk/var/monte-carlo"), body, options);
  }

  stressScenarios(options?: RequestOptions) {
    return this.get<StressScenario[]>(this.v1("/stress-test/scenarios"), options);
  }

  runStressTest(body: StressTestRequest, options?: RequestOptions) {
    return this.post<StressTestResponse>(this.v1("/stress-test"), body, options);
  }

  // --- Portfolio -----------------------------------------------------------

  optimizePortfolio(body: OptimizeRequest, options?: RequestOptions) {
    return this.post<PortfolioResponse>(this.v1("/portfolio/optimize"), body, options);
  }

  efficientFrontier(body: FrontierRequest, options?: RequestOptions) {
    return this.post<FrontierResponse>(this.v1("/portfolio/frontier"), body, options);
  }

  private v1(path: string): string {
    return `${QuantApiClient.API_PREFIX}${path}`;
  }
}
