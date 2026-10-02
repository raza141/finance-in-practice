"""Convex quadratic programming via Clarabel (interior point).

Solves  min ½ x'Px + q'x  s.t.  A_eq x = b_eq,  A_ub x <= b_ub.

Unlike SLSQP, this is built for constrained QPs: it stays fast at 50+
assets and handles corner solutions (e.g. the maximum-return portfolio).
"""

from __future__ import annotations

import clarabel
import numpy as np
from scipy import sparse

from app.core.exceptions import ConvergenceError, InfeasibleProblemError

_SOLVED = {clarabel.SolverStatus.Solved, clarabel.SolverStatus.AlmostSolved}
_INFEASIBLE = {
    clarabel.SolverStatus.PrimalInfeasible,
    clarabel.SolverStatus.AlmostPrimalInfeasible,
}


class QuadraticProgram:
    def __init__(
        self,
        p: np.ndarray,
        q: np.ndarray | None = None,
        *,
        a_eq: np.ndarray | None = None,
        b_eq: np.ndarray | None = None,
        a_ub: np.ndarray | None = None,
        b_ub: np.ndarray | None = None,
    ) -> None:
        self.n = p.shape[0]
        self.p = p
        self.q = np.zeros(self.n) if q is None else q
        self.a_eq = np.empty((0, self.n)) if a_eq is None else np.atleast_2d(a_eq)
        self.b_eq = np.empty(0) if b_eq is None else np.atleast_1d(b_eq)
        self.a_ub = np.empty((0, self.n)) if a_ub is None else np.atleast_2d(a_ub)
        self.b_ub = np.empty(0) if b_ub is None else np.atleast_1d(b_ub)

    def solve(self) -> np.ndarray:
        # Clarabel form: A x + s = b with s in (zero cone) x (non-negative cone).
        a = sparse.csc_matrix(np.vstack([self.a_eq, self.a_ub]))
        b = np.concatenate([self.b_eq, self.b_ub])
        cones = []
        if len(self.b_eq):
            cones.append(clarabel.ZeroConeT(len(self.b_eq)))
        if len(self.b_ub):
            cones.append(clarabel.NonnegativeConeT(len(self.b_ub)))

        settings = clarabel.DefaultSettings()
        settings.verbose = False
        settings.tol_gap_abs = settings.tol_gap_rel = settings.tol_feas = 1e-10
        solver = clarabel.DefaultSolver(
            sparse.triu(sparse.csc_matrix(self.p), format="csc"), self.q, a, b, cones, settings
        )
        solution = solver.solve()

        if solution.status in _SOLVED:
            return np.asarray(solution.x)
        if solution.status in _INFEASIBLE:
            raise InfeasibleProblemError("portfolio constraints cannot be satisfied")
        raise ConvergenceError(f"quadratic program did not converge: {solution.status}")
