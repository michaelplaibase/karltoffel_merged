"""Send an approved customer-service reply from kristian@karltoffel.dk,
in the same Gmail thread, and record it in state so we never re-send.

Called by Karl AFTER Michael approves a draft ("OK, send").

Usage:
    python send_reply.py --msg-id <original_message_id> --body-file draft.txt
    # or pass the body inline (UTF-8):
    python send_reply.py --msg-id <id> --body "Hej ..."
"""
from __future__ import annotations

import argparse
import json
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import gmail_client as gc
import state as st


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--msg-id", required=True,
                    help="Gmail id of the customer's message being replied to")
    ap.add_argument("--body", default=None)
    ap.add_argument("--body-file", default=None)
    args = ap.parse_args()

    if not args.body and not args.body_file:
        print(json.dumps({"ok": False, "error": "no body provided"}))
        return
    body = args.body
    if args.body_file:
        with open(args.body_file, "r", encoding="utf-8") as f:
            body = f.read()

    svc = gc.service()
    orig = gc.get(svc, args.msg_id, fmt="full")
    to_addr = gc.sender_email(orig["from"])
    if not to_addr:
        print(json.dumps({"ok": False, "error": "could not parse recipient",
                          "from": orig["from"]}, ensure_ascii=False))
        return

    result = gc.send_reply(
        svc,
        to_addr=to_addr,
        subject=orig["subject"],
        body_text=body,
        thread_id=orig["threadId"],
        in_reply_to=orig["message_id_header"],
        references=orig["references"],
    )

    state = st.load()
    if args.msg_id not in state["sent_ids"]:
        state["sent_ids"].append(args.msg_id)
    st.save(state)

    print(json.dumps({
        "ok": True, "to": to_addr, "threadId": result.get("threadId"),
        "sent_message_id": result.get("id"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
