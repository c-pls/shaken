import { Exercise } from '../types/gym';
import { translateEquipment, translateMuscle } from '../i18n/translations';

export interface ExerciseAlternative {
  exercise: Exercise;
  score: number;
  isSameEquip: boolean;
  reasonEn: string;
  reasonVi: string;
}

interface MovementPattern {
  id: string;
  en: string;
  vi: string;
}

/**
 * Detects the core functional movement pattern of an exercise.
 */
function detectPattern(name: string): MovementPattern | null {
  const n = name.toLowerCase();
  if (n.includes('lateral raise'))
    return { id: 'lat_raise', en: 'Lateral Raise', vi: 'Dang tạ ngang vai' };
  if (
    n.includes('rear delt') ||
    n.includes('reverse fly') ||
    n.includes('face pull')
  )
    return { id: 'rear_delt', en: 'Rear Delt Fly', vi: 'Bay vai sau' };
  if (n.includes('front raise'))
    return { id: 'front_raise', en: 'Front Raise', vi: 'Nâng vai trước' };
  if (n.includes('calf raise'))
    return { id: 'calf_raise', en: 'Calf Raise', vi: 'Nhón bắp chuối' };
  if (n.includes('incline') && (n.includes('press') || n.includes('bench')))
    return {
      id: 'incline_press',
      en: 'Incline Chest Press',
      vi: 'Đẩy ngực trên',
    };
  if (n.includes('decline') && (n.includes('press') || n.includes('bench')))
    return {
      id: 'decline_press',
      en: 'Decline Chest Press',
      vi: 'Đẩy ngực dưới',
    };
  if (
    n.includes('press') &&
    (n.includes('bench') ||
      n.includes('chest') ||
      n.includes('push up') ||
      n.includes('pushup'))
  )
    return { id: 'chest_press', en: 'Chest Press', vi: 'Đẩy ngực ngang' };
  if (
    n.includes('overhead press') ||
    n.includes('shoulder press') ||
    n.includes('military press') ||
    n.includes('arnold press')
  )
    return {
      id: 'overhead_press',
      en: 'Overhead Press',
      vi: 'Đẩy vai qua đầu',
    };
  if (
    n.includes('fly') ||
    n.includes('flye') ||
    n.includes('pec deck') ||
    n.includes('crossover')
  )
    return { id: 'chest_fly', en: 'Chest Fly', vi: 'Ép ngực' };
  if (
    n.includes('pulldown') ||
    n.includes('pull-up') ||
    n.includes('pull up') ||
    n.includes('chin-up') ||
    n.includes('chin up')
  )
    return { id: 'pulldown', en: 'Vertical Pull', vi: 'Kéo xô dọc' };
  if (n.includes('row'))
    return { id: 'row', en: 'Row', vi: 'Chèo lưng xô' };
  if (n.includes('shrug'))
    return { id: 'shrug', en: 'Shrug', vi: 'Nhún cầu vai' };
  if (
    n.includes('squat') ||
    n.includes('leg press') ||
    n.includes('hack squat')
  )
    return {
      id: 'squat',
      en: 'Squat / Leg Press',
      vi: 'Đạp đùi & Squat',
    };
  if (n.includes('leg extension'))
    return { id: 'leg_ext', en: 'Leg Extension', vi: 'Đá đùi trước' };
  if (n.includes('leg curl'))
    return { id: 'leg_curl', en: 'Leg Curl', vi: 'Cuốn đùi sau' };
  if (
    n.includes('deadlift') ||
    n.includes('rdl') ||
    n.includes('good morning')
  )
    return {
      id: 'hinge',
      en: 'Hip Hinge & Deadlift',
      vi: 'Gập hông & Deadlift',
    };
  if (n.includes('curl'))
    return { id: 'curl', en: 'Arm Curl', vi: 'Cuốn tay trước' };
  if (
    n.includes('pushdown') ||
    n.includes('kickback') ||
    n.includes('skull crusher') ||
    (n.includes('extension') && !n.includes('back') && !n.includes('leg'))
  )
    return {
      id: 'tricep_ext',
      en: 'Triceps Extension',
      vi: 'Duỗi tay sau',
    };
  return null;
}

/**
 * Finds the top similar & alternative exercises for a given exercise.
 * Provides a smart, balanced mix of:
 * 1) Same equipment alternatives (e.g. Incline DB Curl <-> Standing DB Curl, DB Hammer Curl)
 * 2) Different equipment substitutes (e.g. Dumbbell to Cable, Barbell, or Machine)
 */
export function getSimilarExercises(
  target: Exercise,
  all: Exercise[],
  limit = 6
): ExerciseAlternative[] {
  if (!target || !all || all.length === 0) return [];

  const pattern = detectPattern(target.name);
  const targetPrimary = new Set(
    target.primaryMuscles.map((m) => m.toLowerCase())
  );
  const targetCategory = (target.category || '').toLowerCase();
  const targetEquip = (target.equipment || '').toLowerCase();

  const scored: ExerciseAlternative[] = all
    .filter((e) => e.id !== target.id)
    .map((e) => {
      let score = 0;
      const ePattern = detectPattern(e.name);
      const ePrimary = e.primaryMuscles.map((m) => m.toLowerCase());
      const eCategory = (e.category || '').toLowerCase();
      const eEquip = (e.equipment || '').toLowerCase();

      // 1. Functional pattern match
      const hasPatternMatch =
        pattern && ePattern && pattern.id === ePattern.id;
      if (hasPatternMatch) {
        score += 70;
      }

      // 2. Primary muscle match
      let primaryMatches = 0;
      for (const m of ePrimary) {
        if (targetPrimary.has(m)) {
          score += 40;
          primaryMatches++;
        }
      }

      // 3. Category match
      if (targetCategory && eCategory === targetCategory) {
        score += 25;
      }

      // 4. Word overlap in names
      const targetWords = target.name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .split(' ')
        .filter((w) => w.length > 3);
      const eWords = new Set(
        e.name
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, '')
          .split(' ')
          .filter((w) => w.length > 3)
      );
      for (const tw of targetWords) {
        if (eWords.has(tw)) score += 8;
      }

      // 5. Construct user-friendly reasons
      const isSameEquip = eEquip === targetEquip;
      let reasonEn = '';
      let reasonVi = '';

      if (hasPatternMatch) {
        reasonEn = isSameEquip
          ? `Same movement (${pattern.en})`
          : `${e.equipment} alternative`;
        reasonVi = isSameEquip
          ? `Cùng chuyển động (${pattern.vi})`
          : `Thay thế bằng ${translateEquipment(e.equipment, 'vi')}`;
      } else if (primaryMatches > 0) {
        reasonEn = `Targets ${target.primaryMuscles[0]}`;
        reasonVi = `Tác động ${translateMuscle(target.primaryMuscles[0], 'vi')}`;
      } else {
        reasonEn = 'Alternative variation';
        reasonVi = 'Biến thể tương đương';
      }

      return {
        exercise: e,
        score,
        isSameEquip,
        reasonEn,
        reasonVi,
      };
    })
    .filter((c) => c.score >= 50)
    .sort((a, b) => b.score - a.score);

  // Balanced picking: interleave same equipment & different equipment
  const sameEquip = scored.filter((s) => s.isSameEquip);
  const diffEquip = scored.filter((s) => !s.isSameEquip);

  const balanced: ExerciseAlternative[] = [];
  let i = 0;
  let j = 0;
  while (
    balanced.length < limit &&
    (i < sameEquip.length || j < diffEquip.length)
  ) {
    if (
      i < sameEquip.length &&
      (balanced.length % 2 === 0 || j >= diffEquip.length)
    ) {
      balanced.push(sameEquip[i++]);
    } else if (j < diffEquip.length) {
      balanced.push(diffEquip[j++]);
    } else if (i < sameEquip.length) {
      balanced.push(sameEquip[i++]);
    }
  }

  return balanced;
}
