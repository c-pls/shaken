import { Capacitor, registerPlugin } from '@capacitor/core';
import { Exercise, Routine } from '../types/gym';
import { getDefaultRestSeconds, sortRoutineExercisesBySection } from './storage';

export interface GarminCacheResult {
  success: boolean;
  cachedBytes?: number;
  pushedDevices?: number;
  status?: string;
}

export interface GarminSyncPluginInterface {
  cacheRoutinesForWatch(options: {
    payload: GarminSyncPayload;
  }): Promise<GarminCacheResult>;
}

const GarminSyncNative = registerPlugin<GarminSyncPluginInterface>('GarminSync');

/**
 * Maximum safe JSON byte budget for a single Connect IQ BLE message (~10 KB).
 * Stay comfortably under Garmin's ~16 KB mailbox/object-store ceiling.
 */
export const GARMIN_MAX_PAYLOAD_BYTES = 10240;

/**
 * Compact English-only payload served to the Garmin Forerunner 255 Music watch app
 * whenever the watch or Garmin Connect requests a sync.
 */
export interface GarminExercisePayload {
  /** Order label such as "W1", "W1A", "W1B", "1", "3A", "3B" */
  l: string;
  /** English exercise name (ASCII normalized) */
  n: string;
  /** 1 if warm-up section exercise, 0 otherwise */
  w: number;
  /** 1 if part of a superset AND NOT the last exercise in that superset (so 0s rest -> jump to next), 0 otherwise */
  sn: number;
  /** Target rest time in seconds after each set (or after completing a superset round) */
  r: number;
  /** Short ASCII note (max 50 chars) */
  nt: string;
  /** Array of sets: [weightKg, reps, isWarmupSet (1|0)] */
  s: [number, number, number][];
}

export interface GarminRoutinePayload {
  id: string;
  /** English / ASCII routine name */
  n: string;
  /** English / ASCII category tag */
  t: string;
  /** Exercises in execution order */
  e: GarminExercisePayload[];
}

export interface GarminSyncPayload {
  v: number;
  routines: GarminRoutinePayload[];
}

const VIETNAMESE_ROUTINE_DICT: Record<string, string> = {
  'ngực': 'Chest',
  'lưng': 'Back',
  'xô': 'Lats',
  'chân': 'Legs',
  'vai': 'Shoulders',
  'tay': 'Arms',
  'tay trước': 'Biceps',
  'tay sau': 'Triceps',
  'bụng': 'Core',
  'mông': 'Glutes',
  'đẩy': 'Push',
  'kéo': 'Pull',
  'thân trên': 'Upper',
  'thân dưới': 'Lower',
  'toàn thân': 'Full Body',
  'buổi': 'Day',
  'ngày': 'Day',
  'lịch tập': 'Workout',
};

/**
 * Ensures all text sent to the Garmin watch is clean ASCII / English-only.
 * Garmin Forerunner 255 Music built-in MIP bitmap fonts do not include Vietnamese
 * diacritics and would render missing glyphs as boxes (□).
 */
export function toGarminEnglishText(input: string | undefined, maxLen = 40): string {
  if (!input) return '';
  let text = input.trim();

  const lower = text.toLowerCase();
  if (VIETNAMESE_ROUTINE_DICT[lower]) {
    text = VIETNAMESE_ROUTINE_DICT[lower];
  } else {
    // Tokenize composite titles like "Ngực + Vai" or "Lưng - Tay sau"
    const tokens = text.split(/([+\-–/&,])/);
    if (tokens.length > 1) {
      text = tokens
        .map((tok) => {
          const trimmed = tok.trim();
          const tLower = trimmed.toLowerCase();
          if (VIETNAMESE_ROUTINE_DICT[tLower]) {
            return ` ${VIETNAMESE_ROUTINE_DICT[tLower]} `;
          }
          return tok;
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    }

    text = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  text = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (text.length > maxLen) {
    return text.slice(0, maxLen - 1).trimEnd() + '.';
  }
  return text;
}

function getSupersetLetter(idx: number): string {
  if (idx < 26) return String.fromCharCode(65 + idx);
  const first = String.fromCharCode(65 + Math.floor(idx / 26) - 1);
  const second = String.fromCharCode(65 + (idx % 26));
  return `${first}${second}`;
}

/**
 * Builds the compact, English-only workout payload for the Garmin watch,
 * enforcing `GARMIN_MAX_PAYLOAD_BYTES` so large routine libraries never overflow
 * the Connect IQ Bluetooth message buffer or watch storage.
 */
export function buildGarminPayload(
  routines: Routine[],
  exercisesMap: Record<string, Exercise>
): GarminSyncPayload {
  const payloadRoutines: GarminRoutinePayload[] = routines.map((routine, rIdx) => {
    const orderedItems = sortRoutineExercisesBySection(routine.exercises || []);

    let warmupGroupOrder = 0;
    let prevWarmupSupersetId: string | undefined = undefined;
    let warmupSupersetMemberIdx = 0;

    let mainGroupOrder = 0;
    let prevMainSupersetId: string | undefined = undefined;
    let mainSupersetMemberIdx = 0;

    const exercises: GarminExercisePayload[] = orderedItems.map((item, idx) => {
      const ex = exercisesMap[item.exerciseId];
      // Always use the English exercise name (`ex.name`), never `ex.nameVi`
      const fallbackLabel = item.exerciseId
        .replace(/^custom-[0-9a-fA-F-]+/, '')
        .replace(/^custom-\d+-?/, '')
        .replace(/^custom-/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      const englishName = toGarminEnglishText(
        ex ? ex.name : fallbackLabel || 'Exercise',
        36
      );

      let orderLabel = '';
      let isSupersetNext = 0;
      const supId = item.supersetId;
      const nextItem = orderedItems[idx + 1];
      const prevItem = idx > 0 ? orderedItems[idx - 1] : undefined;

      if (item.isWarmup) {
        const hasSameNext = Boolean(
          supId && nextItem && nextItem.isWarmup && nextItem.supersetId === supId
        );
        const hasSamePrev = Boolean(
          supId && prevItem && prevItem.isWarmup && prevItem.supersetId === supId
        );

        if (supId && (hasSameNext || hasSamePrev)) {
          if (supId !== prevWarmupSupersetId) {
            warmupGroupOrder++;
            prevWarmupSupersetId = supId;
            warmupSupersetMemberIdx = 0;
          } else {
            warmupSupersetMemberIdx++;
          }
          const letter = getSupersetLetter(warmupSupersetMemberIdx);
          orderLabel = `W${warmupGroupOrder}${letter}`;
          isSupersetNext = hasSameNext ? 1 : 0;
        } else {
          warmupGroupOrder++;
          prevWarmupSupersetId = undefined;
          warmupSupersetMemberIdx = 0;
          orderLabel = `W${warmupGroupOrder}`;
          isSupersetNext = 0;
        }
      } else {
        const hasSameNext = Boolean(
          supId && nextItem && !nextItem.isWarmup && nextItem.supersetId === supId
        );
        const hasSamePrev = Boolean(
          supId && prevItem && !prevItem.isWarmup && prevItem.supersetId === supId
        );

        if (supId && (hasSameNext || hasSamePrev)) {
          if (supId !== prevMainSupersetId) {
            mainGroupOrder++;
            prevMainSupersetId = supId;
            mainSupersetMemberIdx = 0;
          } else {
            mainSupersetMemberIdx++;
          }
          const letter = getSupersetLetter(mainSupersetMemberIdx);
          orderLabel = `${mainGroupOrder}${letter}`;
          isSupersetNext = hasSameNext ? 1 : 0;
        } else {
          mainGroupOrder++;
          prevMainSupersetId = undefined;
          mainSupersetMemberIdx = 0;
          orderLabel = `${mainGroupOrder}`;
          isSupersetNext = 0;
        }
      }

      const restSeconds =
        item.restSeconds ?? getDefaultRestSeconds(ex, Boolean(item.isWarmup));

      const isBodyweight = (ex?.equipment || '').toLowerCase() === 'bodyweight';
      const defaultWeight = isBodyweight ? 0 : 20;

      const sets: [number, number, number][] = (
        item.sets.length > 0
          ? item.sets
          : [{ weight: defaultWeight, reps: 10, type: item.isWarmup ? 'warmup' : 'normal' }]
      ).map((s) => [
        Number(s.weight) || 0,
        Number(s.reps) || 0,
        s.type === 'warmup' ? 1 : 0,
      ]);

      return {
        l: orderLabel,
        n: englishName || 'Exercise',
        w: item.isWarmup ? 1 : 0,
        sn: isSupersetNext,
        r: restSeconds,
        nt: toGarminEnglishText(item.note, 50),
        s: sets,
      };
    });

    const englishRoutineName =
      toGarminEnglishText(routine.name, 28) || `Workout ${rIdx + 1}`;
    const englishTag = toGarminEnglishText(routine.tag, 16) || 'GYM';

    return {
      id: routine.id,
      n: englishRoutineName,
      t: englishTag,
      e: exercises,
    };
  });

  const payload: GarminSyncPayload = {
    v: 1,
    routines: payloadRoutines,
  };

  // Enforce BLE / Storage payload budget (~10 KB)
  let serialized = JSON.stringify(payload);
  if (serialized.length > GARMIN_MAX_PAYLOAD_BYTES) {
    // Step 1: Strip per-exercise notes to save space
    for (const r of payload.routines) {
      for (const ex of r.e) {
        ex.nt = '';
      }
    }
    serialized = JSON.stringify(payload);
  }

  // Step 2: If still over budget, trim trailing routines until within GARMIN_MAX_PAYLOAD_BYTES
  while (
    payload.routines.length > 1 &&
    JSON.stringify(payload).length > GARMIN_MAX_PAYLOAD_BYTES
  ) {
    payload.routines.pop();
  }

  // Step 3: If a single giant routine still exceeds budget, trim trailing exercises/sets so it never overflows BLE
  if (
    payload.routines.length === 1 &&
    JSON.stringify(payload).length > GARMIN_MAX_PAYLOAD_BYTES
  ) {
    const firstRoutine = payload.routines[0];
    for (const ex of firstRoutine.e) {
      if (ex.s.length > 20) {
        ex.s = ex.s.slice(0, 20);
      }
    }
    while (
      firstRoutine.e.length > 1 &&
      JSON.stringify(payload).length > GARMIN_MAX_PAYLOAD_BYTES
    ) {
      firstRoutine.e.pop();
    }
  }

  return payload;
}

let garminDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingGarminArgs: {
  routines: Routine[];
  exercisesMap: Record<string, Exercise>;
} | null = null;
let lastSentPayloadJson = '';

async function executeGarminCacheUpdate(
  routines: Routine[],
  exercisesMap: Record<string, Exercise>
): Promise<void> {
  try {
    const payload = buildGarminPayload(routines, exercisesMap);
    const jsonStr = JSON.stringify(payload);
    if (jsonStr === lastSentPayloadJson) {
      return;
    }
    const res = await GarminSyncNative.cacheRoutinesForWatch({ payload });
    if (res && res.success) {
      lastSentPayloadJson = jsonStr;
    } else {
      console.warn('[GarminSync] Cache/push returned non-success:', res);
    }
  } catch (err) {
    console.warn('[GarminSync] Failed to update watch cache:', err);
  }
}

/**
 * Debounced (2.5s) passive cache & background push to the Android Garmin bridge.
 * Avoids BLE / SharedPreferences spam on every keystroke while editing weights/reps,
 * and skips native calls when the effective watch payload has not changed.
 */
export function debouncedUpdateGarminWatchCache(
  routines: Routine[],
  exercisesMap: Record<string, Exercise>,
  delayMs = 2500
): void {
  if (!Capacitor.isNativePlatform()) return;

  pendingGarminArgs = { routines, exercisesMap };
  if (garminDebounceTimer) {
    clearTimeout(garminDebounceTimer);
  }

  garminDebounceTimer = setTimeout(async () => {
    garminDebounceTimer = null;
    if (!pendingGarminArgs) return;
    const args = pendingGarminArgs;
    pendingGarminArgs = null;
    await executeGarminCacheUpdate(args.routines, args.exercisesMap);
  }, delayMs);
}

/**
 * Immediately flushes any pending Garmin watch cache update when the app enters background
 * or the screen is locked before the 2.5s debounce timer fires.
 */
export function flushGarminWatchCache(): void {
  if (!Capacitor.isNativePlatform() || !pendingGarminArgs) return;
  if (garminDebounceTimer) {
    clearTimeout(garminDebounceTimer);
    garminDebounceTimer = null;
  }
  const args = pendingGarminArgs;
  pendingGarminArgs = null;
  void executeGarminCacheUpdate(args.routines, args.exercisesMap);
}
