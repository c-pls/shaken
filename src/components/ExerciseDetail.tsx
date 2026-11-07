import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Exercise, Language } from '../types/gym';
import {
  translateMuscle,
  UI_TEXT,
} from '../i18n/translations';
import { AnatomicalMuscleMap } from './AnatomicalMuscleMap';
import { getSimilarExercises } from '../utils/exerciseAlternatives';

interface ExerciseDetailProps {
  exercise: Exercise;
  lang: Language;
  showComment: boolean;
  comment: string;
  onSaveComment: (comment: string) => void;
  onAddExerciseToRoutine?: (
    routineId: string,
    exerciseId: string,
    asWarmup?: boolean,
    replacingExIdx?: number | null
  ) => void;
  activeRoutineId?: string;
  asWarmup?: boolean;
  replacingExIdx?: number | null;
  allExercises?: Exercise[];
  onSelectExercise?: (exerciseId: string) => void;
  onDeleteCustomExercise?: (exerciseId: string) => void;
}

export const ExerciseDetail: React.FC<ExerciseDetailProps> = ({
  exercise,
  lang,
  showComment,
  comment,
  onSaveComment,
  activeRoutineId,
  asWarmup,
  replacingExIdx,
  onAddExerciseToRoutine,
  allExercises = [],
  onSelectExercise,
  onDeleteCustomExercise,
}) => {
  const t = UI_TEXT[lang];
  const [noteText, setNoteText] = useState(comment);
  const [confirmDeleteCustom, setConfirmDeleteCustom] = useState(false);
  const lastSavedNoteRef = useRef<string>(comment);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const similarAlternatives = useMemo(() => {
    if (!allExercises || allExercises.length === 0) return [];
    return getSimilarExercises(exercise, allExercises, 6);
  }, [exercise, allExercises]);

  useEffect(() => {
    setNoteText(comment);
    lastSavedNoteRef.current = comment;
  }, [exercise.id, comment]);

  const handleSaveNote = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === lastSavedNoteRef.current) return;
    lastSavedNoteRef.current = trimmed;
    onSaveComment(trimmed);
  };

  // Always begin at the beginning (top) of the page when opening any exercise
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [exercise.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [exercise.videoUrl]);

  const activeSteps =
    lang === 'vi' && exercise.stepsVi ? exercise.stepsVi : exercise.steps;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT / TOP COLUMN: 1. Seamless Loop Video -> 2. Instructions */}
      <div className="space-y-4">
        {/* 1. CONTINUOUS LOOP VIDEO CARD (Crisp native 1080p, fits all exercises without clipping or blur) */}
        {exercise.videoUrl && (
          <div className="bg-white rounded-[24px] shadow-xs overflow-hidden flex items-center justify-center p-2.5">
            <video
              ref={videoRef}
              src={exercise.videoUrl}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              className="w-full aspect-[16/9] max-h-[340px] object-contain pointer-events-none select-none rounded-xl"
            />
          </div>
        )}

        {/* 2. STEP-BY-STEP INSTRUCTIONS DIRECTLY BELOW VIDEO */}
        <div className="space-y-2.5">
          <h3 className="text-lg font-bold text-slate-900 px-1">
            {t.instructionsTitle}
          </h3>

          <div className="bg-white rounded-[24px] p-5 shadow-xs space-y-4">
            {/* Step 1: Prepare & Position */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1.5">
                {t.step1Prepare}
              </span>
              <ul className="space-y-1.5 pl-4 list-disc text-sm text-slate-700 leading-relaxed">
                {activeSteps.prepare.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Step 2: Execution */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block mb-1.5">
                {t.step2Execution}
              </span>
              <ul className="space-y-1.5 pl-4 list-disc text-sm text-slate-700 leading-relaxed">
                {activeSteps.execution.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Step 3: Breathing & Cues */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 block mb-1.5">
                {t.step3Breathing}
              </span>
              <ul className="space-y-1.5 pl-4 list-disc text-sm text-slate-700 leading-relaxed">
                {activeSteps.breathing.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 3. ROUTINE-SCOPED COMMENT (Only shown when opened from a Routine) */}
        {showComment && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-bold text-slate-900">
                {t.commentTitle}
              </h3>
              <button
                type="button"
                onClick={() => handleSaveNote(noteText)}
                className="px-3.5 py-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
              >
                {t.saveNoteBtn}
              </button>
            </div>
            <div className="bg-white rounded-[24px] p-4 shadow-xs">
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onBlur={() => handleSaveNote(noteText)}
                placeholder={t.commentPlaceholder}
                className="w-full text-sm text-slate-800 bg-transparent focus:outline-none resize-none placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* 4. OPTIONAL DIRECT ADD-TO-ROUTINE ACTION (When previewing inside a routine flow) */}
        {activeRoutineId && onAddExerciseToRoutine && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onAddExerciseToRoutine(
                  activeRoutineId,
                  exercise.id,
                  asWarmup,
                  replacingExIdx
                );
              }}
              className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer text-white ${
                asWarmup
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <span>
                {replacingExIdx !== null && replacingExIdx !== undefined
                  ? `🔄 ${t.pickerTitleSwap}`
                  : asWarmup
                    ? t.addDirectlyToWarmup
                    : t.addDirectlyToMain}
              </span>
            </button>
          </div>
        )}

        {/* 5. DELETE CUSTOM EXERCISE ACTION (Only for user-created custom exercises) */}
        {exercise.id.startsWith('custom-') && onDeleteCustomExercise && (
          <div className="pt-2">
            {!confirmDeleteCustom ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteCustom(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition cursor-pointer"
              >
                🗑️ {t.deleteCustomExerciseBtn}
              </button>
            ) : (
              <div className="bg-red-50/80 border border-red-200 rounded-2xl p-3.5 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-red-800">
                  {t.deleteCustomConfirmTitle}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCustom(false)}
                    className="px-3 py-1.5 rounded-xl bg-white text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteCustomExercise(exercise.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
                  >
                    {t.confirmDeleteBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT / BOTTOM COLUMN: DYNAMIC STRENGTHLOG MUSCLE MAP & PRIMARY/SECONDARY LIST */}
      <div>
        <AnatomicalMuscleMap exercise={exercise} lang={lang} />
      </div>

      {/* FULL-WIDTH BOTTOM SECTION: ⚡ SIMILAR & ALTERNATIVE EXERCISES */}
      {similarAlternatives.length > 0 && onSelectExercise && (
        <div className="lg:col-span-2 pt-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{t.similarExercisesTitle}</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {t.similarExercisesSubtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {similarAlternatives.map((alt) => {
              const altEx = alt.exercise;
              const displayName =
                lang === 'vi' && altEx.nameVi ? altEx.nameVi : altEx.name;
              const reasonText = lang === 'vi' ? alt.reasonVi : alt.reasonEn;

              return (
                <div
                  key={altEx.id}
                  onClick={() => {
                    onSelectExercise(altEx.id);
                  }}
                  className="p-3 rounded-2xl bg-white hover:bg-blue-50/60 active:scale-[0.98] border border-slate-200/80 hover:border-blue-300 shadow-xs transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-500 transition">
                        {translateMuscle(altEx.category, lang)} • {translateMuscle(altEx.primaryMuscles[0], lang)}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug">
                      {displayName}
                    </h4>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md truncate max-w-full">
                      {reasonText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
