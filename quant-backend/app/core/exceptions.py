"""Domain exception hierarchy.

Engines raise these instead of bare ``ValueError`` so the API layer can map
them to HTTP responses without catching unrelated errors. ``DomainError``
subclasses ``ValueError`` so Pydantic validators can raise it directly.
"""


class DomainError(ValueError):
    """Base class for mathematically or financially invalid requests."""


class InvalidInputError(DomainError):
    """Inputs violate a model's assumptions (shape, sign, bounds, PSD...)."""


class ConvergenceError(DomainError):
    """A numerical solver failed to find a solution."""


class InfeasibleProblemError(DomainError):
    """An optimisation problem has no feasible solution under its constraints."""
