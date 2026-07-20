"""Gmail access for Karl customer service, via service account + domain-wide
delegation (impersonates kristian@karltoffel.dk). No browser.

Setup reference: karltoffel/CREDENTIALS.md (Karl Gmail API section).
"""
from __future__ import annotations

import base64
import os
import re
from email.mime.text import MIMEText
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

_HERE = os.path.dirname(os.path.abspath(__file__))
KEY_FILE = os.path.join(_HERE, "..", "secrets", "karl-gmail-sa.json")
SUBJECT = "kristian@karltoffel.dk"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


def service():
    creds = service_account.Credentials.from_service_account_file(
        KEY_FILE, scopes=SCOPES, subject=SUBJECT
    )
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def _header(payload, name):
    for h in payload.get("headers", []):
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def _walk_parts(payload):
    """Yield (mimeType, decoded_text) for text parts."""
    stack = [payload]
    while stack:
        part = stack.pop()
        mt = part.get("mimeType", "")
        body = part.get("body", {})
        data = body.get("data")
        if data and mt in ("text/plain", "text/html"):
            txt = base64.urlsafe_b64decode(data.encode("utf-8")).decode(
                "utf-8", errors="replace"
            )
            yield mt, txt
        for sub in part.get("parts", []) or []:
            stack.append(sub)


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;", " ", html)
    html = re.sub(r"&amp;", "&", html)
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n\s*\n\s*\n+", "\n\n", html)
    return html.strip()


def parse_message(msg) -> dict:
    payload = msg["payload"]
    plain, html = "", ""
    for mt, txt in _walk_parts(payload):
        if mt == "text/plain" and not plain:
            plain = txt
        elif mt == "text/html" and not html:
            html = txt
    body = plain.strip() or _strip_html(html)
    return {
        "id": msg["id"],
        "threadId": msg["threadId"],
        "from": _header(payload, "From"),
        "to": _header(payload, "To"),
        "subject": _header(payload, "Subject"),
        "date": _header(payload, "Date"),
        "message_id_header": _header(payload, "Message-ID"),
        "references": _header(payload, "References"),
        "label_ids": msg.get("labelIds", []),
        "snippet": msg.get("snippet", ""),
        "body": body[:8000],
    }


EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def sender_email(from_header: str) -> str:
    m = EMAIL_RE.search(from_header or "")
    return m.group(0).lower() if m else ""


def list_inbox(svc, max_results: int = 25, q: str = "in:inbox"):
    res = svc.users().messages().list(userId="me", q=q, maxResults=max_results).execute()
    return [m["id"] for m in res.get("messages", [])]


def get(svc, msg_id: str, fmt: str = "full") -> dict:
    msg = svc.users().messages().get(userId="me", id=msg_id, format=fmt).execute()
    return parse_message(msg)


def send_reply(svc, to_addr: str, subject: str, body_text: str,
               thread_id: str, in_reply_to: Optional[str] = None,
               references: Optional[str] = None) -> dict:
    if subject and not subject.lower().startswith("re:"):
        subject = "Re: " + subject
    mime = MIMEText(body_text, "plain", "utf-8")
    mime["To"] = to_addr
    mime["Subject"] = subject
    if in_reply_to:
        mime["In-Reply-To"] = in_reply_to
        mime["References"] = (references + " " + in_reply_to).strip() if references else in_reply_to
    raw = base64.urlsafe_b64encode(mime.as_bytes()).decode("utf-8")
    return svc.users().messages().send(
        userId="me", body={"raw": raw, "threadId": thread_id}
    ).execute()
