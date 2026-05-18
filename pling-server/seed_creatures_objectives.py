#!/usr/bin/env python3
"""
POST objectives for "I've Never Seen A Real One!" trophy.
Usage: python3 seed_creatures_objectives.py <bearer_token>
"""

import sys
import json
import urllib.request
import urllib.error
import ssl
import time

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE_URL = "https://pling-server-997771527995.us-central1.run.app/api"
ACHIEVEMENT_ID = "7b734bd4-78cd-456c-800d-7d547a0cdc32"

OBJECTIVES = [
    {
        "title": "Ride the Fathier",
        "method": "Go to Cantonica (Canto Bight) in open world. Find the Fathier — a large horse-like creature — roaming the streets of Canto Bight and press interact to mount it.",
        "sort_order": 0,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Bantha",
        "method": "Go to Tatooine (Jundland Wastes) in open world. Find the Bantha — a large woolly beast — wandering the Jundland Wastes and press interact to mount it.",
        "sort_order": 1,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Ronto",
        "method": "Go to Tatooine (Jundland Wastes) in open world. Find the Ronto — a large dinosaur-like creature with big ears — near the Bantha in Jundland Wastes and press interact to mount it.",
        "sort_order": 2,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Dewback",
        "method": "Go to Tatooine (Mos Eisley) in open world. Find the Dewback — a green reptilian creature — near the landing pad in Mos Eisley and press interact to mount it.",
        "sort_order": 3,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Kaadu",
        "method": "Go to Naboo (Gungan City) in open world. Find the Kaadu — a duck-billed Gungan mount — in Gungan City and press interact to mount it.",
        "sort_order": 4,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Tauntaun",
        "method": "Go to Hoth (Echo Base) in open world. Find the Tauntaun near the landing pad at Echo Base and press interact to mount it.",
        "sort_order": 5,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Orbak",
        "method": "Go to Kef Bir (Crash Site) in open world. Find the Orbak — a horse-like creature — at the Crash Site and press interact to mount it.",
        "sort_order": 6,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Orray",
        "method": "Play Episode II story level 'Petranaki Panic' (the arena battle). During the fight, mount an Orray being ridden by a Geonosian — this creature is only accessible during this specific story level, not in open world.",
        "sort_order": 7,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Reek",
        "method": "Play Episode II story level 'Petranaki Panic' (the arena battle). During the fight, mount the Reek creature in the arena — this creature is only accessible during this specific story level, not in open world.",
        "sort_order": 8,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
    {
        "title": "Ride the Luggabeast",
        "method": "Go to Jakku (Niima Outpost) in open world. Find the Luggabeast near the landing pad at Niima Outpost and press interact to mount it.",
        "sort_order": 9,
        "is_counter": False,
        "counter_target": None,
        "parent_objective_id": None,
    },
]


def post_objective(objective, token):
    url = f"{BASE_URL}/objectives/achievement/{ACHIEVEMENT_ID}"
    data = json.dumps(objective).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.msg


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 seed_creatures_objectives.py <bearer_token>")
        sys.exit(1)

    token = sys.argv[1]
    print(f"Posting {len(OBJECTIVES)} objectives for \"I've Never Seen A Real One!\"...\n")

    for obj in OBJECTIVES:
        status, resp = post_objective(obj, token)
        if status in (200, 201):
            print(f"  ✅ {obj['title']}")
        else:
            print(f"  ❌ {obj['title']} — {status}: {resp}")
        time.sleep(0.1)

    print("\nDone!")


if __name__ == "__main__":
    main()
