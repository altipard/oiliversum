import httpx
import pytest
import respx

from ingest.http import MAX_ATTEMPTS, SourceError, get_json

URL = "https://example.test/api/data"


@respx.mock
def test_retries_on_429_and_5xx_then_succeeds():
    route = respx.get(URL).mock(
        side_effect=[
            httpx.Response(429),
            httpx.Response(503),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    with httpx.Client() as client:
        assert get_json(client, URL) == {"ok": True}
    assert route.call_count == 3


@respx.mock
def test_gives_up_after_max_attempts():
    route = respx.get(URL).mock(return_value=httpx.Response(500))
    with httpx.Client() as client, pytest.raises(SourceError):
        get_json(client, URL)
    assert route.call_count == MAX_ATTEMPTS


@respx.mock
def test_no_retry_on_client_error():
    route = respx.get(URL).mock(return_value=httpx.Response(403))
    with httpx.Client() as client, pytest.raises(SourceError):
        get_json(client, URL)
    assert route.call_count == 1


@respx.mock
@pytest.mark.parametrize("mode", ["status", "exhausted", "transport", "json"])
def test_errors_never_contain_api_key(mode):
    secret = "SECRETKEY123"
    if mode == "status":
        respx.get(URL).mock(return_value=httpx.Response(403))
    elif mode == "exhausted":
        respx.get(URL).mock(return_value=httpx.Response(502))
    elif mode == "transport":
        respx.get(URL).mock(
            side_effect=httpx.ConnectError("boom " + URL + "?api_key=" + secret)
        )
    else:
        respx.get(URL).mock(return_value=httpx.Response(200, text="<html>"))
    with httpx.Client() as client, pytest.raises(SourceError) as info:
        get_json(client, URL, {"api_key": secret})
    assert secret not in str(info.value)
    assert secret not in repr(info.value)
    assert info.value.__cause__ is None
