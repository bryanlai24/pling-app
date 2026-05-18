#!/usr/bin/env python3
"""
Patch platform_achievement_id onto existing achievements by matching trophy titles.

Usage:
  python3 patch_platform_achievement_ids.py <bearer_token> <game_id> <np_communication_id>

Example:
  python3 patch_platform_achievement_ids.py eyJ... abc-123 NPWR12345_00
"""

import sys
import json
import ssl
import urllib.request
import urllib.error
import time

BASE_URL = "https://pling-server-997771527995.us-central1.run.app/api"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def get(path, token):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
        return json.loads(resp.read())


def patch(path, token, data):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(data).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    if len(sys.argv) < 4:
        print("Usage: python3 patch_platform_achievement_ids.py <token> <game_id> <np_communication_id>")
        sys.exit(1)

    token = sys.argv[1]
    game_id = sys.argv[2]
    np_communication_id = sys.argv[3]

    # 1. Fetch existing achievements from Pling
    print(f"Fetching existing achievements for game {game_id}...")
    achievements = get(f"/achievements/game/{game_id}", token)
    print(f"  Found {len(achievements)} achievements")

    # Build title -> achievement map (lowercase for fuzzy match)
    pling_map = {a["title"].lower().strip(): a for a in achievements}

    # 2. Fetch trophy list from PSN via admin endpoint
    print(f"\nFetching PSN trophies for {np_communication_id}...")
    psn_data = get(f"/admin/psn/trophies?np_communication_id={np_communication_id}", token)
    trophies = psn_data.get("trophies", [])
    print(f"  Found {len(trophies)} trophies on PSN")

    # 3. Match and patch
    matched = 0
    unmatched = []

    for trophy in trophies:
        psn_title = trophy["title"].lower().strip() if trophy["title"] else ""
        psn_id = trophy["platform_achievement_id"]

        achievement = pling_map.get(psn_title)
        if not achievement:
            unmatched.append(trophy["title"])
            continue

        if achievement.get("platform_achievement_id"):
            print(f"  ⏭  Already has ID: {achievement['title']}")
            continue

        status, resp = patch(f"/achievements/{achievement['id']}", token, {
            "platform_achievement_id": psn_id
        })
        if status in (200, 201):
            print(f"  ✅ Patched: {achievement['title']} → {psn_id}")
            matched += 1
        else:
            print(f"  ❌ Failed: {achievement['title']} — {status}: {resp}")
        time.sleep(0.1)

    print(f"\n{'='*50}")
    print(f"Patched: {matched}, Unmatched: {len(unmatched)}")
    if unmatched:
        print("\nUnmatched trophies (title mismatch):")
        for t in unmatched:
            print(f"  - {t}")


if __name__ == "__main__":
    main()
