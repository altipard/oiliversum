"""Zentrales Logging. API-Keys stehen bei FRED/EIA in der Query und duerfen nie ins Log."""

import logging
import re

# httpx loggt jede Request-URL samt Query auf INFO
QUIET_LOGGERS = ("httpx", "httpcore")

_SECRET_PARAM = re.compile(r"(?i)\b(api_key|apikey|key|token)=[^&\s#'\"]+")


def redact(text: str) -> str:
    return _SECRET_PARAM.sub(r"\1=***", text)


def _redact_arg(arg: object) -> object:
    if isinstance(arg, str):
        return redact(arg)
    if isinstance(arg, (int, float, bool)) or arg is None:
        return arg
    # URL-Objekte u.ae. als Text redigieren, sonst landet der Key per str() im Log
    text = str(arg)
    cleaned = redact(text)
    return arg if cleaned == text else cleaned


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, dict):
            record.args = {k: _redact_arg(v) for k, v in record.args.items()}
        elif isinstance(record.args, tuple):
            record.args = tuple(_redact_arg(a) for a in record.args)
        return True


def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(level=level, format="%(levelname)s %(message)s")
    for name in QUIET_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    for handler in logging.getLogger().handlers:
        if not any(isinstance(f, RedactSecretsFilter) for f in handler.filters):
            handler.addFilter(RedactSecretsFilter())
