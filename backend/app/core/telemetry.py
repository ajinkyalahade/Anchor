"""OpenTelemetry setup — traces and LLM call instrumentation."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def setup_telemetry(app: Any, *, otlp_endpoint: str, service_name: str) -> None:
    """Configure OpenTelemetry for FastAPI. No-op if otlp_endpoint is empty."""
    if not otlp_endpoint:
        logger.info("telemetry otlp_endpoint not set — tracing disabled")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create({"service.name": service_name})
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{otlp_endpoint}/v1/traces"))
        )
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument()
        logger.info(
            "telemetry configured endpoint=%s service=%s", otlp_endpoint, service_name
        )
    except ImportError:
        logger.warning("opentelemetry packages not installed — tracing disabled")


def get_tracer() -> Any:
    """Return a tracer for manual spans. Safe to call even without OTel configured."""
    try:
        from opentelemetry import trace

        return trace.get_tracer("anchor")
    except ImportError:
        return _NoopTracer()


class _NoopTracer:
    def start_as_current_span(self, name: str, **kwargs: Any) -> Any:
        from contextlib import nullcontext

        return nullcontext()
