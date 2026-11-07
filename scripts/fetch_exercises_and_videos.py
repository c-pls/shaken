#!/usr/bin/env python3
"""
Fetches and downloads ALL Barbell, Dumbbell, Machine (Leverage, Sled, Smith),
Cable, EZ-Bar, and Kettlebell strength exercises (plus core bodyweight gym
staples like Pull-Ups, Chin-Ups, Dips, Push-Ups, Hanging Leg Raises) from
the free-exercise-db-with-videos dataset, downloads their 1080p 30fps male
MP4 videos into public/videos/, and generates src/data/exercises.json.
"""

import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VIDEOS_DIR = ROOT / "public" / "videos"
DATA_DIR = ROOT / "src" / "data"

VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"

# Friendly gym display name overrides so common gym searches ("Chest Supported Row", "Skullcrusher", etc.) appear right in the title
DISPLAY_NAME_OVERRIDES = {
    "0327": "Dumbbell Chest-Supported Row (Incline Row)",
    "1330": "Dumbbell Chest-Supported Hammer Row",
    "1349": "Machine Chest-Supported Row (Reverse T-Bar)",
    "drv-lever-t-bar-row": "Machine Chest-Supported T-Bar Row",
    "0248": "Barbell Chest-Supported Lying Row (Seal Row)",
    "0061": "EZ-Bar Skullcrusher (Lying Triceps Extension)",
    "drv-lever-pec-deck-fly": "Machine Pec Deck Fly",
    "0585": "Machine Leg Extension",
    "0586": "Machine Lying Leg Curl",
    "0599": "Machine Seated Leg Curl",
    "0582": "Machine Kneeling Leg Curl",
    "0581": "Machine High Row (Plate-Loaded)",
    "0584": "Machine Lateral Raise",
    "0592": "Machine Preacher Curl",
    "0602": "Machine Rear Delt Reverse Fly (Pec Deck)",
    "1299": "Machine Incline Chest Press (Hammer Grip)",
    "0577": "Machine Chest Press",
    "0597": "Machine Seated Hip Abduction",
    "0598": "Machine Seated Hip Adduction",
    "0594": "Machine Seated Calf Raise",
    "0605": "Machine Standing Calf Raise",
    "1451": "Machine Seated Triceps Dip",
    "0607": "Machine Triceps Extension",
    "0743": "Machine Hack Squat (Sled)",
    "0740": "Machine 45° Wide Leg Press (Sled)",
    "2611": "Machine Horizontal Leg Press",
    "drv-close-feet-leg-press": "Machine Close-Stance Leg Press",
}

# Mapping from raw dataset muscle names to (Display Name, SVG Anatomy Slug, Category Filter)
MUSCLE_MAP = {
    "quads": ("Quads", "quadriceps", "Quads"),
    "quadriceps": ("Quads", "quadriceps", "Quads"),
    "quadriceps femoris": ("Quads", "quadriceps", "Quads"),
    "glutes": ("Glutes", "gluteal", "Glutes"),
    "gluteus maximus": ("Glutes", "gluteal", "Glutes"),
    "gluteus medius": ("Glutes", "gluteal", "Glutes"),
    "gluteus minimus": ("Glutes", "gluteal", "Glutes"),
    "abductors": ("Glutes", "gluteal", "Glutes"),
    "hamstrings": ("Hamstrings", "hamstring", "Hamstrings"),
    "adductors": ("Adductors", "adductors", "Quads"),
    "adductor group": ("Adductors", "adductors", "Quads"),
    "hip adductors": ("Adductors", "adductors", "Quads"),
    "adductor muscles": ("Adductors", "adductors", "Quads"),
    "calves": ("Calves", "calves", "Calves"),
    "gastrocnemius": ("Calves", "calves", "Calves"),
    "soleus": ("Calves", "calves", "Calves"),
    "tibialis anterior": ("Tibialis", "tibialis", "Calves"),
    "pectorals": ("Chest", "chest", "Chest"),
    "pectoralis major": ("Chest", "chest", "Chest"),
    "chest": ("Chest", "chest", "Chest"),
    "upper chest": ("Upper Chest", "chest", "Chest"),
    "lower chest": ("Lower Chest", "chest", "Chest"),
    "serratus anterior": ("Serratus", "obliques", "Chest"),
    "lats": ("Lats", "upper-back", "Back"),
    "latissimus dorsi": ("Lats", "upper-back", "Back"),
    "upper back": ("Upper Back", "upper-back", "Back"),
    "rhomboids": ("Upper Back", "upper-back", "Back"),
    "middle back": ("Upper Back", "upper-back", "Back"),
    "teres major": ("Upper Back", "upper-back", "Back"),
    "traps": ("Traps", "trapezius", "Back"),
    "trapezius": ("Traps", "trapezius", "Back"),
    "levator scapulae": ("Traps", "trapezius", "Back"),
    "lower back": ("Lower Back", "lower-back", "Back"),
    "erector spinae": ("Lower Back", "lower-back", "Back"),
    "spine": ("Lower Back", "lower-back", "Back"),
    "delts": ("Delts", "deltoids", "Shoulders"),
    "deltoids": ("Delts", "deltoids", "Shoulders"),
    "deltoideus": ("Delts", "deltoids", "Shoulders"),
    "deltoid": ("Delts", "deltoids", "Shoulders"),
    "shoulders": ("Shoulders", "deltoids", "Shoulders"),
    "anterior deltoid": ("Front Delts", "deltoids", "Shoulders"),
    "deltoid anterior": ("Front Delts", "deltoids", "Shoulders"),
    "front delts": ("Front Delts", "deltoids", "Shoulders"),
    "lateral deltoid": ("Side Delts", "deltoids", "Shoulders"),
    "posterior deltoid": ("Rear Delts", "deltoids", "Shoulders"),
    "rear delts": ("Rear Delts", "deltoids", "Shoulders"),
    "rotator cuff": ("Shoulders", "deltoids", "Shoulders"),
    "biceps": ("Biceps", "biceps", "Biceps"),
    "biceps brachii": ("Biceps", "biceps", "Biceps"),
    "brachialis": ("Biceps", "biceps", "Biceps"),
    "triceps": ("Triceps", "triceps", "Triceps"),
    "triceps brachii": ("Triceps", "triceps", "Triceps"),
    "forearms": ("Forearms", "forearm", "Forearms"),
    "brachioradialis": ("Forearms", "forearm", "Forearms"),
    "wrist flexors": ("Forearms", "forearm", "Forearms"),
    "wrist extensors": ("Forearms", "forearm", "Forearms"),
    "forearm flexors": ("Forearms", "forearm", "Forearms"),
    "forearm extensors": ("Forearms", "forearm", "Forearms"),
    "abs": ("Abs", "abs", "Core"),
    "abdominals": ("Abs", "abs", "Core"),
    "rectus abdominis": ("Abs", "abs", "Core"),
    "core": ("Core", "abs", "Core"),
    "transverse abdominis": ("Core", "abs", "Core"),
    "obliques": ("Obliques", "obliques", "Core"),
    "external obliques": ("Obliques", "obliques", "Core"),
    "hip flexors": ("Hip Flexors", "abs", "Core"),
    "iliopsoas": ("Hip Flexors", "abs", "Core"),
    "ankle stabilizers": ("Tibialis", "tibialis", "Calves"),
    "ankles": ("Tibialis", "tibialis", "Calves"),
    "cardiovascular system": ("Full Body", "deltoids", "Core"),
    "anconeus": ("Triceps", "triceps", "Triceps"),
    "flexor carpi radialis": ("Forearms", "forearm", "Forearms"),
    "flexor carpi ulnaris": ("Forearms", "forearm", "Forearms"),
}

CARDIO_SKIP_IDS = {
    "drv-cardio-exercises-machine",
    "drv-cardio-exercises-machines",
    "2141",  # Elliptical
    "2138",  # Stationary Bike
    "drv-treadmill-running",
    "drv-walk-wave-machine",
}


def map_muscle(raw_name: str):
    key = raw_name.strip().lower()
    if key in MUSCLE_MAP:
        return MUSCLE_MAP[key]
    for k, val in MUSCLE_MAP.items():
        if k in key or key in k:
            return val
    raise ValueError(
        f"[Hagane] Unknown upstream muscle: '{raw_name}'. Please add it to MUSCLE_MAP explicitly."
    )


def normalize_equipment(eq: str) -> str:
    e = eq.strip().lower()
    if "barbell" in e and "ez" not in e:
        return "Barbell"
    if "ez" in e:
        return "EZ-Bar"
    if "dumbbell" in e:
        return "Dumbbell"
    if "cable" in e or "rope" in e:
        return "Cable"
    if "machine" in e or "sled" in e or "leverage" in e or "smith" in e:
        return "Machine"
    if "kettlebell" in e:
        return "Kettlebell"
    return "Bodyweight"


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def select_all_gym_exercises(all_exercises):
    target_equipments = {
        "barbell",
        "dumbbell",
        "leverage machine",
        "sled machine",
        "smith machine",
        "cable",
        "rope",
        "ez barbell",
        "kettlebell",
    }

    bodyweight_staples = [
        "pull-up",
        "chin-up",
        "dip",
        "push-up",
        "hanging leg raise",
        "inverted row",
    ]

    selected = []
    for ex in all_exercises:
        if ex["id"] in CARDIO_SKIP_IDS:
            continue
        if not (isinstance(ex.get("videos"), dict) and ex["videos"].get("male", "").endswith(".mp4")):
            continue

        eq_l = ex.get("equipment", "").lower()
        name_l = ex.get("name", "").lower()

        if eq_l in target_equipments:
            selected.append(ex)
        elif eq_l in {"body weight", "weighted"} and any(kw in name_l for kw in bodyweight_staples):
            selected.append(ex)

    eq_rank = {
        "barbell": 0,
        "dumbbell": 1,
        "leverage machine": 2,
        "sled machine": 2,
        "smith machine": 3,
        "cable": 4,
        "rope": 4,
        "ez barbell": 5,
        "kettlebell": 6,
        "weighted": 7,
        "body weight": 8,
    }

    selected.sort(key=lambda x: (eq_rank.get(x.get("equipment", "").lower(), 9), x.get("name", "").lower()))
    return selected


def download_video(task):
    ex_id, url, dest_path = task
    if dest_path.exists() and dest_path.stat().st_size > 10000:
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = resp.read()
            dest_path.write_bytes(data)
        return True
    except Exception as exc:
        print(f"Failed downloading {ex_id} ({url}): {exc}")
        return False


def main():
    out_json = DATA_DIR / "exercises.json"
    if out_json.exists():
        print(f"[FROZEN] {out_json} already exists with curated bilingual content. Overwrite blocked to protect hand-curated translations.")
        return
    print("Fetching exercise dataset...")
    raw_url = "https://raw.githubusercontent.com/harshvishu/free-exercise-db-with-videos/main/data/exercises.json"
    all_exercises = fetch_json(raw_url)

    selected = select_all_gym_exercises(all_exercises)
    print(f"Selected {len(selected)} total Barbell, Dumbbell, Machine, Cable, EZ-Bar, Kettlebell & Staple exercises.")

    download_tasks = []
    formatted_exercises = []

    for ex in selected:
        ex_id = str(ex["id"])
        raw_name = ex["name"]
        display_name = DISPLAY_NAME_OVERRIDES.get(ex_id, raw_name)

        safe_slug = re.sub(r"[^a-z0-9-]+", "-", raw_name.lower()).strip("-")
        video_filename = f"{safe_slug}-{ex_id}.mp4"
        video_dest = VIDEOS_DIR / video_filename
        male_url = ex["videos"]["male"]

        download_tasks.append((ex_id, male_url, video_dest))

        p_disp, p_slug, category = map_muscle(ex.get("target") or ex.get("muscleGroup") or "Core")
        primary_muscles = [p_disp]
        primary_slugs = [p_slug]

        secondary_muscles = []
        secondary_slugs = []
        for sm in ex.get("secondaryMuscles", []):
            s_disp, s_slug, _ = map_muscle(sm)
            if (
                s_disp not in primary_muscles
                and s_disp not in secondary_muscles
                and s_slug not in primary_slugs
                and s_slug not in secondary_slugs
            ):
                secondary_muscles.append(s_disp)
                secondary_slugs.append(s_slug)

        name_l = display_name.lower()
        if "squat" in name_l and "barbell" in name_l:
            for extra_m, extra_s in [("Glutes", "gluteal"), ("Adductors", "adductors"), ("Lower Back", "lower-back")]:
                if extra_m not in primary_muscles:
                    primary_muscles.append(extra_m)
                if extra_s not in primary_slugs:
                    primary_slugs.append(extra_s)
                if extra_m in secondary_muscles:
                    secondary_muscles.remove(extra_m)
                if extra_s in secondary_slugs:
                    secondary_slugs.remove(extra_s)
            if "Calves" not in secondary_muscles:
                secondary_muscles.append("Calves")
            if "calves" not in secondary_slugs:
                secondary_slugs.append("calves")

        raw_steps = ex.get("steps") or []
        form_cues = ex.get("formCues") or []
        mistakes = ex.get("commonMistakes") or []
        breathing_str = ex.get("breathing") or "Inhale on the eccentric (lowering) phase, exhale on the concentric (lifting) phase."

        prepare_steps = raw_steps[:2] if len(raw_steps) >= 2 else (raw_steps or [ex.get("instructions", "")])
        execution_steps = raw_steps[2:] if len(raw_steps) > 2 else raw_steps
        if form_cues:
            execution_steps = list(execution_steps) + [f"Form cue: {c}" for c in form_cues[:3]]

        breathing_steps = [breathing_str]
        if mistakes:
            breathing_steps.extend([f"Avoid: {m}" for m in mistakes[:2]])

        aliases = list(ex.get("aliases", []))
        if raw_name != display_name and raw_name not in aliases:
            aliases.append(raw_name)
        if "chest-supported" in display_name.lower():
            aliases.extend(["chest supported row", "chest-supported row", "incline bench row"])

        formatted_exercises.append({
            "id": ex_id,
            "slug": safe_slug,
            "name": display_name,
            "aliases": aliases,
            "category": category,
            "equipment": normalize_equipment(ex.get("equipment", "Bodyweight")),
            "videoUrl": f"/videos/{video_filename}",
            "primaryMuscles": primary_muscles,
            "secondaryMuscles": secondary_muscles,
            "primarySlugs": primary_slugs,
            "secondarySlugs": secondary_slugs,
            "shortDescription": ex.get("shortDescription", ""),
            "steps": {
                "prepare": prepare_steps,
                "execution": execution_steps,
                "breathing": breathing_steps,
            },
        })

    print(f"Downloading {len(download_tasks)} male 1080p 30fps MP4 videos concurrently...")
    ok_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for ok in pool.map(download_video, download_tasks):
            if ok:
                ok_count += 1
    print(f"Downloaded {ok_count}/{len(download_tasks)} videos into public/videos/")

    out_json = DATA_DIR / "exercises.json"
    out_json.write_text(json.dumps(formatted_exercises, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(formatted_exercises)} exercises to src/data/exercises.json")


if __name__ == "__main__":
    main()
