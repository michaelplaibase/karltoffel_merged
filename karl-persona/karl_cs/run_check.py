"""Scheduled entrypoint for the Karl customer-service loop.

Runs every few minutes (Windows Task Scheduler). Cheaply polls Gmail; only
when there are NEW candidate messages does it wake Karl (via `openclaw agent`)
to classify, look up the CRM, draft, and post to #karltoffel-ai for approval.

This keeps token cost near zero on quiet intervals.

Exit codes: 0 always (so the scheduler never marks it failed on "no mail").
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import gmail_client as gc
import state as st
import poll as pl

_HERE = os.path.dirname(os.path.abspath(__file__))
QUEUE_FILE = os.path.join(_HERE, "queue.json")
KARLTOFFEL_AI_CHANNEL = "channel:C0BHPSY9U49"  # #karltoffel-ai

AGENT_MSG = (
    "Karl kundeservice-tjek. Der er nye mails i kristian@karltoffel.dk. "
    "Læs karltoffel/karl_cs/queue.json, og følg karltoffel/karl_cs/PLAYBOOK.md: "
    "klassificer hver kandidat (kun ægte kundehenvendelser), slå kunden op i "
    "CRM'et, skriv udkast som 'Kristian', og post udkastet i #karltoffel-ai via "
    "KARL-kontoen (message action=send accountId='karl' "
    "target='channel:C0BHPSY9U49') og tag Michael til godkendelse. "
    "Ignorer alt der ikke er en kundehenvendelse."
)


def _collect_candidates():
    """Run the same pre-filter poll as poll.py, advancing state, and return
    the list of new candidates."""
    svc = gc.service()
    state = st.load()
    seen = set(state["seen_ids"])
    last_epoch = state["last_epoch_ms"]

    ids = gc.list_inbox(svc, max_results=30)
    candidates = []
    max_epoch = last_epoch
    for mid in ids:
        if mid in seen:
            continue
        meta = pl.get_meta(svc, mid)
        max_epoch = max(max_epoch, meta["internalDate"])
        if last_epoch and meta["internalDate"] <= last_epoch:
            seen.add(mid)
            continue
        seen.add(mid)
        if pl.is_bulk(meta):
            continue
        full = gc.get(svc, mid, fmt="full")
        candidates.append({
            "id": full["id"], "threadId": full["threadId"],
            "from": full["from"], "sender_email": gc.sender_email(full["from"]),
            "subject": full["subject"], "date": full["date"],
            "snippet": full["snippet"], "body": full["body"],
        })
    state["seen_ids"] = list(seen)
    state["last_epoch_ms"] = max_epoch
    # NOTE: caller decides when to persist, so a failed agent-wake does not
    # silently consume mail.
    return candidates, state


def _wake_agent() -> bool:
    """Wake Karl to process queue.json. Returns True on success.
    Resolves the openclaw launcher explicitly (on Windows it is a .cmd, which
    CreateProcess cannot start without shell resolution)."""
    exe = shutil.which("openclaw") or shutil.which("openclaw.cmd")
    # Wake Karl in the #karltoffel-ai channel session (karl account). Fresh
    # isolated sessions get killed by the gateway ("deleted while starting"),
    # but this existing channel session is stable. Karl reads queue.json +
    # PLAYBOOK.md and posts the draft to #karltoffel-ai.
    args = ["agent", "--agent", "main",
            "--session-key", "slack:channel:c0bhpsy9u49",
            "--reply-account", "karl", "--timeout", "300", "-m", AGENT_MSG]
    cwd = os.path.join(_HERE, "..", "..")
    try:
        if exe:
            r = subprocess.run([exe] + args, cwd=cwd, check=False)
        else:
            # last resort: let the shell resolve it
            r = subprocess.run("openclaw " + subprocess.list2cmdline(args),
                               cwd=cwd, check=False, shell=True)
        return r.returncode == 0
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"wake_error": str(e)}))
        return False


def main():
    dry = "--dry" in sys.argv
    candidates, new_state = _collect_candidates()
    if not candidates:
        st.save(new_state)  # still advance past bulk mail we examined
        print(json.dumps({"count": 0, "woke_agent": False}))
        return

    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump({"candidates": candidates}, f, ensure_ascii=False, indent=2)

    if dry:
        print(json.dumps({"count": len(candidates), "woke_agent": False,
                          "dry": True}, ensure_ascii=False))
        return

    woke = _wake_agent()
    if woke:
        # only advance state once Karl has been handed the work
        st.save(new_state)
    print(json.dumps({"count": len(candidates), "woke_agent": woke},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
