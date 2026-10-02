"""Hard input limits that protect the API from oversized computations.

These are domain guards, not deployment settings, so they live in code
rather than in environment variables.
"""

MAX_ASSETS = 50
MAX_HISTORY_ROWS = 5_000
MIN_MC_SIMS = 1_000
MAX_MC_SIMS = 100_000
# n_sims * n_assets cap: 100k sims x 50 assets is ~40 MB of float64.
MAX_MC_CELLS = 5_000_000
MAX_HORIZON_DAYS = 250
MIN_CONFIDENCE = 0.90
MAX_CONFIDENCE = 0.999
MAX_FRONTIER_POINTS = 100  # ~0.6s worst case at MAX_ASSETS (long-only QP per point)
MAX_BOOTSTRAP_INSTRUMENTS = 60
MAX_BOND_MATURITY_YEARS = 100
MAX_STRESS_POSITIONS = 200
