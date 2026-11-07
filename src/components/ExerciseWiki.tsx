import React, { useMemo, useState } from 'react';
import { Exercise, Language } from '../types/gym';
import {
  translateEquipment,
  translateMuscle,
  UI_TEXT,
} from '../i18n/translations';
import { searchAndRankExercises } from '../utils/search';

interface ExerciseWikiProps {
  exercises: Exercise[];
  lang: Language;
  onSelectExercise: (exerciseId: string) => void;
  onAddCustomExercise: (newExercise: Exercise) => void;
  search: string;
  onSearchChange: (search: string) => void;
  muscleFilter: string;
  onMuscleFilterChange: (muscle: string) => void;
  equipmentFilter: string;
  onEquipmentFilterChange: (eq: string) => void;
}

const MUSCLE_CATEGORIES = [
  'All',
  'Quads',
  'Glutes',
  'Hamstrings',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Calves',
];

const EQUIPMENT_CATEGORIES = [
  'All',
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'EZ-Bar',
  'Kettlebell',
  'Bodyweight',
];

const ANATOMY_CHOICES: { label: string; slug: string }[] = [
  { label: 'Quads', slug: 'quadriceps' },
  { label: 'Glutes', slug: 'gluteal' },
  { label: 'Adductors', slug: 'adductors' },
  { label: 'Hamstrings', slug: 'hamstring' },
  { label: 'Calves', slug: 'calves' },
  { label: 'Chest', slug: 'chest' },
  { label: 'Lats', slug: 'upper-back' },
  { label: 'Lower Back', slug: 'lower-back' },
  { label: 'Traps', slug: 'trapezius' },
  { label: 'Shoulders', slug: 'deltoids' },
  { label: 'Biceps', slug: 'biceps' },
  { label: 'Triceps', slug: 'triceps' },
  { label: 'Forearms', slug: 'forearm' },
  { label: 'Abs', slug: 'abs' },
  { label: 'Obliques', slug: 'obliques' },
];

export const ExerciseWiki: React.FC<ExerciseWikiProps> = ({
  exercises,
  lang,
  onSelectExercise,
  onAddCustomExercise,
  search,
  onSearchChange,
  muscleFilter,
  onMuscleFilterChange,
  equipmentFilter,
  onEquipmentFilterChange,
}) => {
  const t = UI_TEXT[lang];
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Custom Exercise Form State
  const [customName, setCustomName] = useState('');
  const [customEquipment, setCustomEquipment] = useState('Barbell');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customPrimaryIdx, setCustomPrimaryIdx] = useState(0);
  const [customPrepare, setCustomPrepare] = useState('');
  const [customExecution, setCustomExecution] = useState('');
  const [customBreathing, setCustomBreathing] = useState('');

  const filtered = useMemo(() => {
    return searchAndRankExercises(
      exercises,
      search,
      muscleFilter,
      equipmentFilter,
      lang
    );
  }, [exercises, search, muscleFilter, equipmentFilter, lang]);

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const chosen = ANATOMY_CHOICES[customPrimaryIdx] || ANATOMY_CHOICES[0];
    const uniqueSuffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newId = `custom-${uniqueSuffix}`;
    const prepList = customPrepare
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const execList = customExecution
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const breathList = customBreathing
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const stepsObj = {
      prepare:
        prepList.length > 0 ? prepList : ['Set up in starting position.'],
      execution:
        execList.length > 0
          ? execList
          : ['Execute movement with full range of motion.'],
      breathing:
        breathList.length > 0
          ? breathList
          : ['Inhale on eccentric, exhale on concentric.'],
    };
    const asciiSlug = customName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const validVideoUrl =
      customVideoUrl.trim().startsWith('http://') ||
      customVideoUrl.trim().startsWith('https://') ||
      customVideoUrl.trim().startsWith('/')
        ? customVideoUrl.trim()
        : '';

    const newEx: Exercise = {
      id: newId,
      slug: asciiSlug || `custom-${Date.now()}`,
      name: customName.trim(),
      nameVi: customName.trim(),
      aliases: [],
      category: chosen.label,
      equipment: customEquipment,
      videoUrl: validVideoUrl,
      primaryMuscles: [chosen.label],
      secondaryMuscles: [],
      primarySlugs: [chosen.slug],
      secondarySlugs: [],
      shortDescription: 'Custom user exercise',
      steps: stepsObj,
      stepsVi: stepsObj,
    };
    onAddCustomExercise(newEx);
    setCustomName('');
    setCustomVideoUrl('');
    setCustomPrepare('');
    setCustomExecution('');
    setCustomBreathing('');
    setShowAddCustom(false);
    onSelectExercise(newId);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Card (Clean — no redundant header banner) */}
      <div className="bg-white rounded-[24px] p-4 shadow-xs space-y-3">
        {/* Search Input with 1-click Clear Button & No Cache */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="wiki-search-clean"
            placeholder={t.searchExercisePlaceholder}
            className="w-full rounded-2xl bg-slate-100 pl-4 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold text-xs flex items-center justify-center cursor-pointer transition"
              title="Clear search"
              aria-label="Clear search"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Active search or filter reset bar */}
        {(search || muscleFilter !== 'All' || equipmentFilter !== 'All') && (
          <div className="flex items-center justify-between px-1 pt-0.5">
            <span className="text-xs text-blue-600 font-medium truncate">
              {search && <span>"{search}" </span>}
              {muscleFilter !== 'All' && (
                <span>• {translateMuscle(muscleFilter, lang)} </span>
              )}
              {equipmentFilter !== 'All' && (
                <span>• {translateEquipment(equipmentFilter, lang)} </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onMuscleFilterChange('All');
                onEquipmentFilterChange('All');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 transition cursor-pointer underline shrink-0 ml-2"
            >
              {lang === 'vi' ? 'Đặt lại bộ lọc' : 'Clear all'}
            </button>
          </div>
        )}

        {/* Muscle Filter Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {MUSCLE_CATEGORIES.map((m) => (
              <button
                key={m}
                onClick={() => onMuscleFilterChange(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
                  muscleFilter === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {translateMuscle(m, lang)}
              </button>
            ))}
          </div>

          {/* Equipment Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {EQUIPMENT_CATEGORIES.map((eq) => (
              <button
                key={eq}
                onClick={() => onEquipmentFilterChange(eq)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
                  equipmentFilter === eq
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-200 border border-slate-200/70'
                }`}
              >
                {translateEquipment(eq, lang)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Custom Exercise Drawer */}
      {showAddCustom && (
        <form
          onSubmit={handleCreateCustom}
          className="bg-white rounded-[24px] p-5 shadow-xs space-y-3 border border-blue-100"
        >
          <h3 className="font-bold text-sm text-slate-900">
            {t.addCustomExerciseTitle}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={t.customNamePlaceholder}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-900 focus:outline-none"
            />
            <select
              value={customEquipment}
              onChange={(e) => setCustomEquipment(e.target.value)}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              {EQUIPMENT_CATEGORIES.filter((e) => e !== 'All').map((eq) => (
                <option key={eq} value={eq}>
                  {translateEquipment(eq, lang)}
                </option>
              ))}
            </select>
            <select
              value={customPrimaryIdx}
              onChange={(e) => setCustomPrimaryIdx(Number(e.target.value))}
              className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-900 focus:outline-none"
            >
              {ANATOMY_CHOICES.map((ch, idx) => (
                <option key={ch.slug} value={idx}>
                  {t.primaryLabel}: {translateMuscle(ch.label, lang)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={customVideoUrl}
            onChange={(e) => setCustomVideoUrl(e.target.value)}
            placeholder={t.customVideoPlaceholder}
            className="w-full rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-900 focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <textarea
              rows={2}
              value={customPrepare}
              onChange={(e) => setCustomPrepare(e.target.value)}
              placeholder={t.customPrepPlaceholder}
              className="rounded-xl bg-slate-100 p-2.5 text-xs text-slate-900 focus:outline-none"
            />
            <textarea
              rows={2}
              value={customExecution}
              onChange={(e) => setCustomExecution(e.target.value)}
              placeholder={t.customExecPlaceholder}
              className="rounded-xl bg-slate-100 p-2.5 text-xs text-slate-900 focus:outline-none"
            />
            <textarea
              rows={2}
              value={customBreathing}
              onChange={(e) => setCustomBreathing(e.target.value)}
              placeholder={t.customBreathPlaceholder}
              className="rounded-xl bg-slate-100 p-2.5 text-xs text-slate-900 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="px-4 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              {t.saveExerciseBtn}
            </button>
          </div>
        </form>
      )}

      {/* Exercise Cards Grid (Clean Wiki — no routine comment pins) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((ex) => {
          const displayName =
            lang === 'vi' && ex.nameVi ? ex.nameVi : ex.name;
          return (
            <div
              key={ex.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectExercise(ex.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectExercise(ex.id);
                }
              }}
              className="bg-white rounded-[22px] p-4 shadow-xs hover:shadow-md cursor-pointer transition flex items-center justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 truncate">
                    {displayName}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {t.primaryLabel}:{' '}
                  <span className="text-slate-700 font-semibold">
                    {ex.primaryMuscles
                      .map((m) => translateMuscle(m, lang))
                      .join(', ')}
                  </span>
                </p>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-serif italic font-bold text-sm flex items-center justify-center shrink-0">
                i
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center space-y-3 bg-white rounded-[24px]">
            <p className="text-sm font-semibold text-slate-700">
              {lang === 'vi'
                ? 'Không tìm thấy bài tập nào phù hợp'
                : 'No exercises found matching your search'}
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onMuscleFilterChange('All');
                onEquipmentFilterChange('All');
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {lang === 'vi' ? 'Đặt lại bộ lọc' : 'Clear search & filters'}
            </button>
          </div>
        )}
      </div>

      {/* Subtle Custom Exercise Action at Bottom */}
      <div className="py-4 flex justify-center">
        <button
          type="button"
          onClick={() => {
            setShowAddCustom(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
        >
          <span>+</span>
          <span>{t.customExerciseBtn}</span>
        </button>
      </div>
    </div>
  );
};
