#!/usr/bin/env python3
"""
Hagane — Exercise Wiki & Vietnamese Translation Restore Script.
Restores and verifies curated bilingual data in src/data/exercises.json
using scripts/curated_vi_snapshot.json as the canonical source.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, "curated_vi_snapshot.json")
EXERCISES_PATH = os.path.join(PROJECT_ROOT, "src", "data", "exercises.json")


def restore():
    if not os.path.isfile(SNAPSHOT_PATH):
        print(f"❌ Error: Snapshot file not found at {SNAPSHOT_PATH}")
        sys.exit(1)

    with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    if not isinstance(snapshot, dict) or len(snapshot) == 0:
        print("❌ Error: Invalid snapshot format (expected non-empty dict).")
        sys.exit(1)

    print(f"📦 Loaded {len(snapshot)} curated exercises from snapshot.")

    existing_exercises = []
    if os.path.isfile(EXERCISES_PATH):
        with open(EXERCISES_PATH, "r", encoding="utf-8") as f:
            try:
                existing_exercises = json.load(f)
            except Exception:
                existing_exercises = []

    # Map existing by ID
    existing_map = {ex["id"]: ex for ex in existing_exercises if "id" in ex}
    merged_list = []

    for ex_id, snap_data in snapshot.items():
        base = existing_map.get(ex_id, {})
        # Merge fields
        merged = {
            "id": ex_id,
            "slug": base.get("slug", snap_data.get("name", ex_id).lower().replace(" ", "-")),
            "name": snap_data.get("name", base.get("name", "")),
            "nameVi": snap_data.get("nameVi", base.get("nameVi", "")),
            "aliases": snap_data.get("aliases", base.get("aliases", [])),
            "category": snap_data.get("category", base.get("category", "")),
            "equipment": snap_data.get("equipment", base.get("equipment", "")),
            "videoUrl": base.get("videoUrl", f"/videos/{ex_id}.mp4"),
            "primaryMuscles": snap_data.get("primaryMuscles", base.get("primaryMuscles", [])),
            "secondaryMuscles": snap_data.get("secondaryMuscles", base.get("secondaryMuscles", [])),
            "primarySlugs": snap_data.get("primarySlugs", base.get("primarySlugs", [])),
            "secondarySlugs": snap_data.get("secondarySlugs", base.get("secondarySlugs", [])),
            "shortDescription": base.get("shortDescription", f"Master the {snap_data.get('name', '')} with proper form."),
            "steps": snap_data.get("steps", base.get("steps", {})),
            "stepsVi": snap_data.get("stepsVi", base.get("stepsVi", {}))
        }
        merged_list.append(merged)

    # Sort numerically/lexicographically by ID
    merged_list.sort(key=lambda x: (len(x["id"]), x["id"]))

    os.makedirs(os.path.dirname(EXERCISES_PATH), exist_ok=True)
    with open(EXERCISES_PATH, "w", encoding="utf-8") as f:
        json.dump(merged_list, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"✅ Successfully restored {len(merged_list)} exercises into {EXERCISES_PATH}!")


if __name__ == "__main__":
    restore()
