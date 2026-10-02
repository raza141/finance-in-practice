/**
 * Friendly aliases over the types generated from the FastAPI OpenAPI schema.
 * Regenerate with `npm run gen:api` whenever the backend contract changes.
 */
import type { components } from "./api.generated";

type Schemas = components["schemas"];

export type BlackScholesRequest = Schemas["BlackScholesRequest"];
export type BlackScholesResponse = Schemas["BlackScholesResponse"];
export type ImpliedVolRequest = Schemas["ImpliedVolRequest"];
export type ImpliedVolResponse = Schemas["ImpliedVolResponse"];
export type BondRequest = Schemas["BondRequest"];
export type BondResponse = Schemas["BondResponse"];
export type BootstrapRequest = Schemas["BootstrapRequest"];
export type BootstrapResponse = Schemas["BootstrapResponse"];

export type ParametricVaRRequest = Schemas["ParametricVaRRequest"];
export type HistoricalVaRRequest = Schemas["HistoricalVaRRequest"];
export type MonteCarloVaRRequest = Schemas["MonteCarloVaRRequest"];
export type VaRResponse = Schemas["VaRResponse"];

export type StressTestRequest = Schemas["StressTestRequest"];
export type StressTestResponse = Schemas["StressTestResponse"];
export type StressScenario = Schemas["ScenarioOut"];

export type OptimizeRequest = Schemas["OptimizeRequest"];
export type FrontierRequest = Schemas["FrontierRequest"];
export type PortfolioResponse = Schemas["PortfolioOut"];
export type FrontierResponse = Schemas["FrontierResponse"];

export interface HealthResponse {
  status: "ok";
  version: string;
}
