class RepoError(Exception):
    """Base error for repos"""

    pass


class InputError(RepoError):
    """Exception raised for errors in the input."""

    pass


class EventRepoError(RepoError):
    """Base class for exceptions in this module."""

    pass


class NotFoundError(EventRepoError):
    pass


class EventNotFoundError(NotFoundError):
    pass


class CalendarNotFoundError(NotFoundError):
    pass
