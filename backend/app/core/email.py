"""Pluggable email delivery.

A tiny provider-agnostic seam so the app can send transactional email
(password resets) without committing to a vendor. In development, or whenever
SMTP is not configured, emails are logged instead of sent. In production, set
the SMTP_* settings and any provider that speaks SMTP (SES, SendGrid, Postmark,
Resend, …) works unchanged.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

from app.core.config import Settings, get_settings

logger = logging.getLogger("anchor.email")


class EmailSender(Protocol):
    async def send(self, *, to: str, subject: str, body: str) -> None: ...


class ConsoleEmailSender:
    """Logs the email instead of sending it. Default for dev/tests."""

    async def send(self, *, to: str, subject: str, body: str) -> None:
        logger.info(
            "email_console to=%s subject=%s body=%s",
            to,
            subject,
            body.replace("\n", " ⏎ "),
        )


class SMTPEmailSender:
    """Sends via SMTP. Blocking smtplib work is pushed to a worker thread so
    the event loop is never blocked."""

    def __init__(self, settings: Settings) -> None:
        self._s = settings

    async def send(self, *, to: str, subject: str, body: str) -> None:
        await asyncio.to_thread(self._send_sync, to, subject, body)

    def _send_sync(self, to: str, subject: str, body: str) -> None:
        s = self._s
        message = EmailMessage()
        message["From"] = f"{s.email_from_name} <{s.email_from}>"
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            if s.smtp_starttls:
                smtp.starttls()
            if s.smtp_username:
                smtp.login(s.smtp_username, s.smtp_password)
            smtp.send_message(message)


def get_email_sender(settings: Settings | None = None) -> EmailSender:
    settings = settings or get_settings()
    if settings.smtp_host:
        return SMTPEmailSender(settings)
    return ConsoleEmailSender()
