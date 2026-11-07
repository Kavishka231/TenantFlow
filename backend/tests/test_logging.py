import json
import logging

from app.core.logging import JsonFormatter, valid_request_id


def test_request_ids_are_bounded_and_log_safe() -> None:
    assert valid_request_id("request-123:abc") == "request-123:abc"
    assert valid_request_id("contains spaces") is None
    assert valid_request_id("line\nbreak") is None
    assert valid_request_id("x" * 129) is None


def test_json_formatter_emits_structured_http_fields() -> None:
    record = logging.LogRecord(
        "tenantflow.access",
        logging.INFO,
        __file__,
        1,
        "HTTP request completed",
        (),
        None,
    )
    record.request_id = "request-123"
    record.http_method = "GET"
    record.http_path = "/api/v1/health"
    record.http_status = 200
    record.duration_ms = 1.25

    payload = json.loads(JsonFormatter().format(record))

    assert payload == {
        "duration_ms": 1.25,
        "http_method": "GET",
        "http_path": "/api/v1/health",
        "http_status": 200,
        "level": "INFO",
        "logger": "tenantflow.access",
        "message": "HTTP request completed",
        "request_id": "request-123",
        "timestamp": payload["timestamp"],
    }
