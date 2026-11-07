# ⚔️ Hagane

> **"Forge your steel"**
> *Offline Gym Workout Tracker, 1080p Exercise Wiki, & Garmin Forerunner Watch Companion for Android and Web*

**Hagane** is a fast, 100% offline-first gym companion engineered for distraction-free workouts. It bundles 197 high-definition 1080p exercise demo videos directly into the app, complete with 1-to-1 bilingual English and natural Vietnamese instructions, custom workout routine tracking with drag-and-drop reordering, per-exercise rest timers, Garmin Forerunner 255 Music watch integration, and smartphone gesture navigation.

---

## ✨ Features

### 🎥 197 Offline HD Exercise Demos
- **Bundled 1080p 30-FPS Videos:** Play instantly without buffering, internet connection, or cellular data in the gym.
- **Gym Staples & Famous Variations:** Romanian Deadlift (RDL), Bulgarian Split Squat, Barbell & Sumo Deadlifts, Hip Thrusts, Flat/Incline Dumbbell Bench Press, Yates Row, Seal Row, Spider Curls, Skullcrushers, Cable Face Pulls, Lat Prayer, Leg Press Calf Raise, Captain's Chair Leg Raise, Hex Press, and more.
- **Smart Filtering:** Filter exclusively by primary target muscle group (Quads, Chest, Back, Shoulders, Biceps, Triceps, Hamstrings, Glutes, Core, Calves, Forearms) and equipment (Barbell, Dumbbell, Machine, Cable, EZ-Bar, Bodyweight).

### 🌐 1-Click Instant Language Switcher (`🇺🇸 EN` / `🇻🇳 VI`)
- Switch instantly between **English** and **Tiếng Việt** with a single tap in the header (no dropdown menus).
- **Pure Vietnamese Translations:** Natural gym terminology (no awkward English parentheses cluttering names).
- **1-to-1 Step Alignment:** Exact step matching across `Prepare & Position`, `Execution`, `Breathing & Cues`, form cues, and common mistakes to avoid.

### 📋 Custom Routine Builder & Tracker
- **Read-Only Mode by Default:** Distraction-free view during training to log weights and reps without accidental edits.
- **🔥 Warm-up Exercises & Primer Sets:**
  - **Dedicated Warm-up Section:** Separate mobility primers, dynamic stretches, and light-weight warm-up movements from your heavy working lifts.
  - **'W' Warm-up Set Badges:** Mark introductory sets as warm-up (`W`), automatically numbering subsequent heavy working sets (`1, 2, 3...`).
  - **1-Tap Toggles:** Tap any set number in Edit Mode to toggle between `W` and working sets, or tap `To Main` / `To Warm-up` to shift exercises between sections.
- **Interactive Edit Mode (`✎ Edit`):**
  - **Drag-and-Drop Reordering (`⋮⋮`):** Touch and drag exercises or superset blocks up or down to customize exercise order.
  - **Per-Exercise Rest Timers (`⏱`):** Smart defaults (`2:30` for compounds, `1:30` for isolation, `1:00` for warm-ups) with 1-tap presets (`0:45` to `4:00`) and `0s` superset transitions (`⚡ → next`).
  - **Flexible Sets & Reps:** Instant `+` / `−` adjustments for weights (`kg`) and reps.
  - **Exercise Swapping:** Swap any exercise in-place with one tap while preserving your set history.
  - **Routine-Scoped Notes (`📌`):** Pinned gym reminders (seat settings, cable pin heights, rack numbers).

### ⌚ Garmin Forerunner 255 Music Watch Companion (`garmin-watch/`)
- **Native Monkey C Watch App (`type="watch-app"`):** Appears directly in your watch's **Activities & Apps** list alongside *Run* and *Jump Rope*.
- **Automatic Background Sync:** Passively caches your latest routines (in clean English/ASCII) on Android and serves them whenever your watch opens **Hagane** or reconnects over Bluetooth.
- **Guided Wrist Workouts:** Step-by-step sets, supersets (`3A` → `3B`), 360° circular rest countdown with wrist vibration at `00:00` + overtime counter (`+00:01`), early set start, live `±15s` rest adjustments, and `.FIT` strength activity recording. See [`garmin-watch/README.md`](garmin-watch/README.md) for details.

### 📱 Native Smartphone Experience (Samsung Galaxy / Android)
- **👈 Edge Swipe-to-Go-Back:** Swipe right from the left screen edge to pop back from Exercise Details to your Routine, or from Routine to your Workouts list.
- **🔙 Native Android Back Navigation:** Full integration with Samsung One UI system navigation gestures and hardware back buttons. Double-tap back on the home screen to safely exit without accidental mid-workout closures.
- **🎨 Edge-to-Edge Status Bar:** Clean status bar styling via `@capacitor/status-bar`.

---

## 📱 Android Installation (Samsung Galaxy & Android Devices)

Download the ready-to-install Android APK directly from the repository's **Releases** page:

👉 **[Download Latest Android APK (`hagane.apk`)](https://github.com/c-pls/hagane/releases/latest)**

### How to Install:
1. Open the release link above in Chrome or Samsung Internet on your phone.
2. Tap **`hagane.apk`** to download.
3. Tap the downloaded file and select **Install** (if prompted, enable *Allow from this source* in your phone settings).
4. Launch **Hagane** — everything works 100% offline!

---

## 🛠️ Tech Stack

- **Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler:** [Vite 6](https://vite.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Mobile Engine:** [Capacitor 8 / Android](https://capacitorjs.com/)
- **Native Plugins:**
  - `@capacitor/app` (System back navigation & lifecycle)
  - `@capacitor/filesystem` (Persistent local storage & backup)
  - `@capacitor/status-bar` (Edge-to-edge system bar appearance)
- **CI / CD:** GitHub Actions (Automated Android APK build & GitHub Releases publishing)

---

## 💻 Local Development

### Prerequisites
- Node.js `>= 22.0.0` (LTS)
- npm `>= 10.0.0`

### Setup & Run
```bash
# Clone the repository
git clone git@github.com:c-pls/hagane.git
cd hagane

# Install dependencies
npm install

# Start Vite local development server
npm run dev

# Open in your browser
# http://localhost:5173/
```

### Production Web Build
```bash
npm run build
```

### Sync Web Assets to Android Project
```bash
npm run build
npx cap sync android
```

### Garmin Watch Companion Build (Local)
```bash
# Sideload binary (Hagane.prg) & Store Package (Hagane.iq)
npm run build:garmin
```

### Exercise Wiki & Vietnamese Translation Recovery
```bash
# Instantly restore or overlay curated Vietnamese data from snapshot
python3 scripts/restore_exercises.py
```

---

## 📄 License

MIT © [c-pls](https://github.com/c-pls)
