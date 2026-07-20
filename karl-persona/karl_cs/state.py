"""Persistent state for the Karl customer-service loop.

Tracks which inbox messages have already been seen/posted so we never
double-post a draft to Slack, and where we are in time.
"""
from __future__ import annotations

import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(_HERE, "state.json")

_DEFAULT = {
    "last_epoch_ms": 0,     # internalDate of newest message we have examined
    "seen_ids": [],         # message ids we have already examined (pre-filtered)
    "posted_ids": [],       # message ids we have posted a draft for
    "sent_ids": [],         # message ids we have sent an approved reply for
}


def load() -> dict:
    if not os.path.exists(STATE_FILE):
        return dict(_DEFAULT)
    with open(STATE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for k, v in _DEFAULT.items():
        data.setdefault(k, v if not isinstance(v, list) else list(v))
    return data


def save(state: dict) -> None:
    # keep the id lists bounded so state.json does not grow forever
    for key in ("seen_ids", "posted_ids", "sent_ids"):
        if len(state.get(key, [])) > 500:
            state[key] = state[key][-500:]
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)
