"""Poll kristian@karltoffel.dk inbox for NEW messages that are plausible
customer inquiries, and emit them as JSON for Karl to classify + draft.

Design: this is a cheap PRE-FILTER only. It drops obvious bulk mail
(promotions / social / forums, or classic no-reply / newsletter senders).
Everything that survives is handed to Karl (the LLM) for the real
"customer inquiry vs. not" decision, CRM lookup and drafting.

Usage:
    python poll.py            # emit new candidates as JSON, update state
    python poll.py --peek     # emit candidates but DO NOT update state
    python poll.py --limit 40 # how many recent inbox msgs to scan
"""
from __future__ import annotations

import argparse
import json
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import gmail_client as gc
import state as st

BULK_CATEGORIES = {"CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS"}

# Senders / patterns that are essentially never a customer writing in.
NOREPLY_RE = re.compile(
    r"(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|newsletter|mailer|notifications?|"
    r"support@(slack|dropbox|google|meta|canva|q8)|billing@|info@meta|@facebookmail|"
    r"@e\.|@em\.|@mail\.|@news\.|@marketing\.)",
    re.I,
)


def is_bulk(meta: dict) -> bool:
    labels = set(meta.get("label_ids", []))
    if labels & BULK_CATEGORIES:
        return True
    frm = (meta.get("from") or "").lower()
    if NOREPLY_RE.search(frm):
        return True
    # List-Unsubscribe is a strong bulk signal
    if meta.get("list_unsubscribe"):
        return True
    return False


def get_meta(svc, msg_id: str) -> dict:
    msg = svc.users().messages().get(
        userId="me", id=msg_id, format="metadata",
        metadataHeaders=["From", "Subject", "Date", "List-Unsubscribe"],
    ).execute()
    payload = msg["payload"]
    return {
        "id": msg["id"],
        "threadId": msg["threadId"],
        "internalDate": int(msg.get("internalDate", 0)),
        "label_ids": msg.get("labelIds", []),
        "from": gc._header(payload, "From"),
        "subject": gc._header(payload, "Subject"),
        "date": gc._header(payload, "Date"),
        "list_unsubscribe": gc._header(payload, "List-Unsubscribe"),
        "snippet": msg.get("snippet", ""),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--peek", action="store_true")
    ap.add_argument("--limit", type=int, default=30)
    args = ap.parse_args()

    svc = gc.service()
    state = st.load()
    seen = set(state["seen_ids"])
    last_epoch = state["last_epoch_ms"]

    ids = gc.list_inbox(svc, max_results=args.limit)
    candidates = []
    max_epoch = last_epoch

    for mid in ids:
        if mid in seen:
            continue
        meta = get_meta(svc, mid)
        max_epoch = max(max_epoch, meta["internalDate"])
        # only consider genuinely new mail (after the last epoch we recorded),
        # unless this is the very first run (last_epoch == 0)
        if last_epoch and meta["internalDate"] <= last_epoch:
            seen.add(mid)
            continue
        seen.add(mid)
        if is_bulk(meta):
            continue
        full = gc.get(svc, mid, fmt="full")
        candidates.append({
            "id": full["id"],
            "threadId": full["threadId"],
            "from": full["from"],
            "sender_email": gc.sender_email(full["from"]),
            "subject": full["subject"],
            "date": full["date"],
            "snippet": full["snippet"],
            "body": full["body"],
            "already_replied": "SENT" in full["label_ids"],
        })

    if not args.peek:
        state["seen_ids"] = list(seen)
        state["last_epoch_ms"] = max_epoch
        st.save(state)

    print(json.dumps({"count": len(candidates), "candidates": candidates},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
