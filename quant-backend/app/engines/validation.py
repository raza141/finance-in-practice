"""Shared numeric validation used by engines and request schemas."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from app.core.exceptions import InvalidInputError


class MatrixValidator:
    """Static checks for covariance and returns matrices."""

    SYMMETRY_RTOL = 1e-8
    SYMMETRY_ATOL = 1e-12
    EIGEN_TOL = 1e-10

    @classmethod
    def covariance(
        cls, cov: np.ndarray | Sequence[Sequence[float]], n: int, *, strict: bool = False
    ) -> np.ndarray:
        """Return ``cov`` as an array, or raise unless it is n x n, symmetric and PSD.

        With ``strict=True`` the matrix must be positive definite.
        """
        if not isinstance(cov, np.ndarray) and any(len(row) != n for row in cov):
            raise InvalidInputError(f"covariance must be a {n}x{n} matrix")
        m = np.asarray(cov, dtype=float)
        if m.shape != (n, n):
            raise InvalidInputError(f"covariance must be a {n}x{n} matrix, got {m.shape}")
        if not np.isfinite(m).all():
            raise InvalidInputError("covariance contains NaN or infinite values")
        if not np.allclose(m, m.T, atol=cls.SYMMETRY_ATOL, rtol=cls.SYMMETRY_RTOL):
            raise InvalidInputError("covariance must be symmetric")
        if (np.diag(m) < 0).any():
            raise InvalidInputError("covariance diagonal (variances) must be non-negative")
        min_eig = float(np.linalg.eigvalsh(m).min())
        tol = cls.EIGEN_TOL * max(1.0, float(np.abs(m).max()))
        if strict and min_eig <= tol:
            raise InvalidInputError("covariance must be positive definite (no redundant assets)")
        if min_eig < -tol:
            raise InvalidInputError("covariance must be positive semi-definite")
        return m

    @staticmethod
    def returns(returns: np.ndarray | Sequence[Sequence[float]], n: int) -> np.ndarray:
        """Return a T x n returns array, or raise on ragged/non-finite input."""
        if not isinstance(returns, np.ndarray) and any(len(row) != n for row in returns):
            raise InvalidInputError(f"every returns row must have {n} columns (one per asset)")
        r = np.asarray(returns, dtype=float)
        if r.ndim != 2 or r.shape[1] != n:
            raise InvalidInputError(f"returns must be a T x {n} matrix")
        if not np.isfinite(r).all():
            raise InvalidInputError("returns contain NaN or infinite values")
        return r

    @staticmethod
    def vector(values: Sequence[float] | np.ndarray, n: int, name: str) -> np.ndarray:
        v = np.asarray(values, dtype=float)
        if v.shape != (n,):
            raise InvalidInputError(f"{name} must have {n} entries")
        if not np.isfinite(v).all():
            raise InvalidInputError(f"{name} contains NaN or infinite values")
        return v
