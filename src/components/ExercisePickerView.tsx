import React, { useMemo, useState } from 'react';
import { Exercise, Language, Routine } from '../types/gym';
import {
  translateEquipment,
  translateMuscle,
  translateRoutineText,
  UI_TEXT,
} from '../i18n/translations';
import { searchAndRankExercises } from '../utils/search';
import { getSimilarExercises } from '../utils/exerciseAlternatives';

interface ExercisePickerViewProps {
  routine: Routine;
  asWarmup: boolean;
  replacingExIdx: number | null;
  lang: Language;
  allExercises: Exercise[];
  initialSearch?: string;
  initialMuscle?: string;
  initialEquipment?: string;
  onBack: () => void;
  onSelectExercise: (exerciseId: string) => void;
  onDuplicateWarning?: (exerciseName: string) => void;
  onOpenWiki: (
    exerciseId: string,
    currentSearch: string,
    currentMuscle: string,
    currentEquipment: string
  ) => void;
}

const MOST_USED_IDS = [
  '0025', // Barbell Bench Press
  '1435', // Barbell Back Squat
  '0116', // Barbell Romanian Deadlift (RDL)
  '0553', // Overhead Press - OHP (Barbell)
  '0198', // Lat Pulldown - Wide Grip (Cable)
  '0027', // Barbell Bent-Over Row
  '0294', // Dumbbell Biceps Curl
  '0314', // Incline Dumbbell Bench Press
  '0334', // Dumbbell Lateral Raise
  '0605', // Machine Standing Calf Raise
  '0417', // Dumbbell Standing Calf Raise
  '0740', // 45° Wide Leg Press (Machine)
  '0585', // Leg Extension
  '0599', // Seated Leg Curl (Machine)
  '0200', // Rope Triceps Pushdown (Cable)
  '0203', // Face Pull (Cable)
];

const MUSCLE_QUICK_FILTERS = [
  'Quads',
  'Calves',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Hamstrings',
  'Glutes',
  'Core',
];

const EQUIPMENT_QUICK_FILTERS = [
  'All',
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'EZ-Bar',
  'Kettlebell',
  'Bodyweight',
];

export const ExercisePickerView: React.FC<ExercisePickerViewProps> = ({
  routine,
  asWarmup,
  replacingExIdx,
  lang,
  allExercises,
  initialSearch = '',
  initialMuscle = 'All',
  initialEquipment = 'All',
  onBack,
  onSelectExercise,
  onDuplicateWarning,
  onOpenWiki,
}) => {
  const t = UI_TEXT[lang];
  const [search, setSearch] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState<'most_used' | 'all'>('most_used');
  const [muscleFilter, setMuscleFilter] = useState(initialMuscle);
  const [equipmentFilter, setEquipmentFilter] = useState(initialEquipment);

  const replacedExercise = useMemo(() => {
    if (replacingExIdx === null || !routine.exercises[replacingExIdx])
      return null;
    const exId = routine.exercises[replacingExIdx].exerciseId;
    return allExercises.find((e) => e.id === exId) || null;
  }, [replacingExIdx, routine.exercises, allExercises]);

  // Exercises already present in the current routine (cannot be duplicated)
  const existingExerciseIds = useMemo(() => {
    const set = new Set<string>();
    routine.exercises.forEach((item, idx) => {
      // When swapping/changing an exercise, the one being swapped is allowed
      if (replacingExIdx !== null && idx === replacingExIdx) return;
      set.add(item.exerciseId);
    });
    return set;
  }, [routine.exercises, replacingExIdx]);

  const suggestedAlternatives = useMemo(() => {
    if (!replacedExercise) return [];
    return getSimilarExercises(replacedExercise, allExercises, 6).filter(
      (alt) => !existingExerciseIds.has(alt.exercise.id)
    );
  }, [replacedExercise, allExercises, existingExerciseIds]);

  // If user types a search query or selects a muscle/equipment filter, search across all exercises automatically
  const baseExercises = useMemo(() => {
    if (search.trim() || muscleFilter !== 'All' || equipmentFilter !== 'All') {
      return allExercises;
    }
    if (activeTab === 'most_used') {
      const map = new Map(allExercises.map((e) => [e.id, e]));
      const list = MOST_USED_IDS.map((id) => map.get(id)).filter(
        Boolean
      ) as Exercise[];
      return list.length > 0 ? list : allExercises;
    }
    return allExercises;
  }, [allExercises, search, activeTab, muscleFilter, equipmentFilter]);

  const filtered = useMemo(() => {
    return searchAndRankExercises(
      baseExercises,
      search,
      muscleFilter,
      equipmentFilter,
      lang
    );
  }, [baseExercises, search, muscleFilter, equipmentFilter, lang]);

  const routineDisplayName = translateRoutineText(routine.name, lang);

  return (
    <div className="space-y-3 pb-24">
      {/* 1. TOP SEARCH BAR (HEVY STYLE: [ ← ] [ 🔍 Search exercise... ✕ ]) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold transition cursor-pointer shrink-0"
          title={t.back}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </button>

        <div className="flex-1 h-11 bg-white rounded-full px-3.5 shadow-xs flex items-center gap-2 border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
          <svg
            className="w-4 h-4 text-slate-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => e.target.select()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="picker-search-input"
            placeholder={
              asWarmup
                ? `${t.pickerTitleWarmup}...`
                : `${t.searchExercisePlaceholder}`
            }
            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
              }}
              className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition shrink-0"
              title={lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
              aria-label={lang === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      {/* 2. SUB-HEADER BAR: SEGMENTED TABS (Most used / All exercises + Muscle Pills) */}
      <div className="space-y-1.5 select-none">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {/* Most Used Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('most_used');
              setMuscleFilter('All');
              setEquipmentFilter('All');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs ${
              activeTab === 'most_used' &&
              muscleFilter === 'All' &&
              equipmentFilter === 'All' &&
              !search
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.mostUsedTab}
          </button>

          {/* All Exercises Pill */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setMuscleFilter('All');
              setEquipmentFilter('All');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs ${
              activeTab === 'all' &&
              muscleFilter === 'All' &&
              equipmentFilter === 'All' &&
              !search
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-black'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.allExercisesTab} ({allExercises.length})
          </button>

          {/* Muscle Category Quick Filter Pills */}
          {MUSCLE_QUICK_FILTERS.map((m) => {
            const isSelected = muscleFilter === m;
            return (
              <button
                type="button"
                key={m}
                onClick={() => {
                  setMuscleFilter(isSelected ? 'All' : m);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                {translateMuscle(m, lang)}
              </button>
            );
          })}
        </div>

        {/* Equipment Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {EQUIPMENT_QUICK_FILTERS.map((eq) => {
            const isSelected = equipmentFilter === eq;
            return (
              <button
                type="button"
                key={eq}
                onClick={() => {
                  setEquipmentFilter(isSelected && eq !== 'All' ? 'All' : eq);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'bg-white/80 text-slate-500 hover:bg-slate-200 border border-slate-200/70'
                }`}
              >
                {translateEquipment(eq, lang)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Routine Destination Banner (Compact 1-liner) */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="text-slate-500 font-medium truncate">
          {replacingExIdx !== null
            ? t.pickerTitleSwap
            : asWarmup
            ? `🔥 ${t.pickerTitleWarmup}`
            : t.pickerTitleAdd}
          : <strong className="text-slate-800">{routineDisplayName}</strong>
        </span>
        <span className="text-slate-400 font-semibold shrink-0 ml-2">
          {filtered.length} {t.exercisesAvailable}
        </span>
      </div>

      {/* ⚡ Suggested Alternatives when Swapping an Exercise */}
      {replacingExIdx !== null &&
        search.trim() === '' &&
        muscleFilter === 'All' &&
        suggestedAlternatives.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/70 rounded-[24px] p-4 border border-blue-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{t.suggestedAlternativesTitle}</span>
              </span>
              <span className="text-[11px] font-medium text-blue-600">
                {t.suggestedAlternativesSubtitle}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestedAlternatives.map((alt) => {
                const altEx = alt.exercise;
                const displayName =
                  lang === 'vi' && altEx.nameVi ? altEx.nameVi : altEx.name;
                const reasonText =
                  lang === 'vi' ? alt.reasonVi : alt.reasonEn;

                return (
                  <div
                    key={`swap-alt-${altEx.id}`}
                    onClick={() => {
                      onSelectExercise(altEx.id);
                    }}
                    className="p-3 rounded-2xl bg-white hover:bg-blue-50/80 active:scale-[0.98] border border-blue-100 hover:border-blue-300 shadow-xs transition cursor-pointer flex items-center justify-between gap-2.5 group"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition truncate">
                        {displayName}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        <span className="text-blue-600 font-semibold">
                          {reasonText}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition"
                    >
                      {t.changeExerciseBtn}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* 3. EXERCISE LIST (CLEAN WHITE CARD WITH DIVIDERS & (?) BUTTONS ON RIGHT) */}
      <div className="bg-white rounded-[24px] shadow-xs overflow-hidden divide-y divide-slate-100">
        {filtered.map((ex) => {
          const displayName = lang === 'vi' && ex.nameVi ? ex.nameVi : ex.name;
          const isAlreadyAdded = existingExerciseIds.has(ex.id);

          return (
            <div
              key={ex.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isAlreadyAdded) {
                    onDuplicateWarning?.(displayName);
                    return;
                  }
                  onSelectExercise(ex.id);
                }
              }}
              onClick={() => {
                if (isAlreadyAdded) {
                  onDuplicateWarning?.(displayName);
                  return;
                }
                onSelectExercise(ex.id);
              }}
              className={`flex items-center justify-between px-4 py-3 transition select-none group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl ${
                isAlreadyAdded
                  ? 'bg-amber-50/30 opacity-70 cursor-not-allowed'
                  : 'hover:bg-slate-50 active:bg-blue-50/50 cursor-pointer'
              }`}
            >
              {/* Left Column: Title & Subtitle */}
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={`font-semibold text-[15px] leading-snug truncate ${
                      isAlreadyAdded
                        ? 'text-slate-600'
                        : 'text-slate-900 group-hover:text-blue-600 transition'
                    }`}
                  >
                    {displayName}
                  </h3>
                  {isAlreadyAdded && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0 select-none flex items-center gap-1">
                      <span>⚠️</span>
                      <span>
                        {lang === 'vi' ? 'Đã có trong bài' : 'Already in routine'}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-slate-400 font-medium mt-0.5 truncate">
                  <span className="text-slate-600 font-semibold">
                    {ex.primaryMuscles
                      .map((m) => translateMuscle(m, lang))
                      .join(', ')}
                  </span>
                </p>
              </div>

              {/* Right Column: Circular (?) Button to inspect video/wiki */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWiki(ex.id, search, muscleFilter, equipmentFilter);
                }}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0 -mr-1 cursor-pointer"
                title={t.viewWikiAndVideo}
                aria-label={t.viewWikiAndVideo}
              >
                <span className="w-6 h-6 rounded-full border border-slate-300 group-hover:border-slate-400 text-slate-500 font-bold text-xs flex items-center justify-center">
                  ?
                </span>
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              {lang === 'vi'
                ? 'Không tìm thấy bài tập nào phù hợp'
                : 'No exercises found matching your search'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setMuscleFilter('All');
                setEquipmentFilter('All');
              }}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              {lang === 'vi'
                ? `Xem tất cả ${allExercises.length} bài tập`
                : `View all ${allExercises.length} exercises`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
