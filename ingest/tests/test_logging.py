import logging
from datetime import date

import httpx
import pytest
import respx

from ingest.logging_setup import QUIET_LOGGERS, RedactSecretsFilter, configure_logging
from ingest.sources.crude import FRED_URL, FredCrude

FAKE_KEY = "FAKEKEY0123456789abcdef"


@pytest.fixture
def restore_logging():
    root = logging.getLogger()
    levels = {n: logging.getLogger(n).level for n in QUIET_LOGGERS}
    yield
    for name, level in levels.items():
        logging.getLogger(name).setLevel(level)
    for handler in root.handlers:
        for f in [f for f in handler.filters if isinstance(f, RedactSecretsFilter)]:
            handler.removeFilter(f)


def _fetch_fred(load_fixture):
    respx.get(FRED_URL).mock(
        return_value=httpx.Response(200, json=load_fixture("fred_brent.json"))
    )
    with httpx.Client() as client:
        FredCrude(FAKE_KEY, client).fetch("brent", date(2026, 8, 1))


@respx.mock
def test_fred_request_does_not_log_key(restore_logging, caplog, load_fixture):
    configure_logging()
    caplog.set_level(logging.DEBUG)
    _fetch_fred(load_fixture)
    assert FAKE_KEY not in caplog.text
    assert all(FAKE_KEY not in r.getMessage() for r in caplog.records)


@respx.mock
def test_filter_catches_verbose_httpx(restore_logging, caplog, load_fixture):
    configure_logging()
    caplog.set_level(logging.DEBUG)
    # simuliert einen spaeter wieder gespraechigen Logger: nur der Filter schuetzt
    for name in QUIET_LOGGERS:
        caplog.set_level(logging.DEBUG, logger=name)
    _fetch_fred(load_fixture)
    assert "HTTP Request" in caplog.text
    assert "api_key=***" in caplog.text
    assert FAKE_KEY not in caplog.text


def _record(msg, args):
    return logging.LogRecord("t", logging.INFO, __file__, 1, msg, args, None)


def test_filter_redacts_msg():
    record = _record(f"GET https://x.test/a?series_id=A&api_key={FAKE_KEY}&x=1", None)
    RedactSecretsFilter().filter(record)
    assert record.getMessage() == "GET https://x.test/a?series_id=A&api_key=***&x=1"


@pytest.mark.parametrize("param", ["api_key", "apikey", "key", "token", "API_KEY"])
def test_filter_redacts_args(param):
    url = httpx.URL(f"https://x.test/a?{param}={FAKE_KEY}&page=2")
    record = _record("HTTP Request: %s %s", ("GET", url))
    RedactSecretsFilter().filter(record)
    assert FAKE_KEY not in record.getMessage()
    assert f"{param}=***&page=2" in record.getMessage()


def test_filter_redacts_dict_args():
    record = _record("url=%(url)s", ({"url": f"https://x.test/?token={FAKE_KEY}"},))
    RedactSecretsFilter().filter(record)
    assert record.getMessage() == "url=https://x.test/?token=***"


def test_filter_keeps_unrelated_params():
    record = _record("GET %s", ("https://x.test/?monkey=1&keys=2",))
    RedactSecretsFilter().filter(record)
    assert record.getMessage() == "GET https://x.test/?monkey=1&keys=2"
