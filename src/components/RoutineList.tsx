import React, { useEffect, useState } from 'react';
import { Exercise, Language, Routine } from '../types/gym';
import {
  ROUTINE_TAG_PRESETS,
  translateRoutineText,
  UI_TEXT,
} from '../i18n/translations';

interface CategoryTagPickerProps {
  value: string;
  onChange: (nextTag: string) => void;
  lang: Language;
}

export const CategoryTagPicker: React.FC<CategoryTagPickerProps> = ({
  value,
  onChange,
  lang,
}) => {
  const t = UI_TEXT[lang];
  const isPreset = (ROUTINE_TAG_PRESETS as readonly string[]).includes(value);
  const [showCustomInput, setShowCustomInput] = useState<boolean>(
    Boolean(value && !isPreset)
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 block">
        {t.categoryLabel}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {ROUTINE_TAG_PRESETS.map((preset) => {
          const active = !showCustomInput && value === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setShowCustomInput(false);
                onChange(active ? '' : preset);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                active
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {translateRoutineText(preset, lang)}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (showCustomInput) {
              setShowCustomInput(false);
              onChange('');
            } else {
              setShowCustomInput(true);
              if (isPreset) {
                onChange('');
              }
            }
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
            showCustomInput
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          {t.customTagChip}
        </button>
      </div>

      {showCustomInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.routineTagPlaceholder}
          autoFocus
          className="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );
};

interface RoutineListProps {
  routines: Routine[];
  lang: Language;
  exercisesMap: Record<string, Exercise>;
  onOpenRoutine: (routineId: string) => void;
  onCreateRoutine: (name: string, tag: string) => void;
  onDeleteRoutine: (routineId: string) => void;
  onReorderRoutines: (fromIdx: number, toIdx: number) => void;
  onUpdateRoutineMeta: (routineId: string, name: string, tag: string) => void;
}

export const RoutineList: React.FC<RoutineListProps> = ({
  routines,
  lang,
  exercisesMap,
  onOpenRoutine,
  onCreateRoutine,
  onDeleteRoutine,
  onReorderRoutines,
  onUpdateRoutineMeta,
}) => {
  const t = UI_TEXT[lang];
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');

  // Edit mode & menu state
  const [isEditMode, setIsEditMode] = useState(false);
  const [openMenuRoutineId, setOpenMenuRoutineId] = useState<string | null>(
    null
  );
  const [confirmDeleteRoutine, setConfirmDeleteRoutine] =
    useState<Routine | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editNameDraft, setEditNameDraft] = useState('');
  const [editTagDraft, setEditTagDraft] = useState('');

  // Drag-and-drop state for reordering routines
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (routines.length === 0 && isEditMode) {
      setIsEditMode(false);
      setOpenMenuRoutineId(null);
    }
  }, [routines.length, isEditMode]);

  useEffect(() => {
    document.body.dataset.dragging = draggedIdx !== null ? 'true' : '';
    return () => {
      document.body.dataset.dragging = '';
    };
  }, [draggedIdx]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim() || `Workout #${routines.length + 1}`;
    onCreateRoutine(trimmed, newTag.trim());
    setNewName('');
    setNewTag('');
    setShowNewModal(false);
  };

  const handleStartEditMeta = (routine: Routine) => {
    setEditingRoutine(routine);
    setEditNameDraft(routine.name);
    setEditTagDraft(routine.tag || '');
    setOpenMenuRoutineId(null);
  };

  const handleSaveEditMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoutine) return;
    const trimmedName = editNameDraft.trim() || editingRoutine.name;
    onUpdateRoutineMeta(editingRoutine.id, trimmedName, editTagDraft.trim());
    setEditingRoutine(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isEditMode || draggedIdx === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = el?.closest('[data-routine-list-idx]');
    if (cardEl) {
      const overIdx = Number(cardEl.getAttribute('data-routine-list-idx'));
      if (!Number.isNaN(overIdx) && overIdx !== dragOverIdx) {
        setDragOverIdx(overIdx);
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      draggedIdx !== null &&
      dragOverIdx !== null &&
      draggedIdx !== dragOverIdx
    ) {
      onReorderRoutines(draggedIdx, dragOverIdx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-4">
      {/* Backdrop for closing active ⋮ menu */}
      {openMenuRoutineId && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpenMenuRoutineId(null)}
        />
      )}

      <div className="flex items-center justify-between px-1 gap-2">
        <div className="min-w-0">
          <h2 className="font-bold text-lg text-slate-900">{t.myRoutines}</h2>
          <p className="text-xs text-slate-500 truncate">
            {t.selectOrCreateRoutine}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {routines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsEditMode(!isEditMode);
                setOpenMenuRoutineId(null);
              }}
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition shadow-xs cursor-pointer ${
                isEditMode
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200/80 hover:bg-slate-300 text-slate-800'
              }`}
            >
              {isEditMode ? t.doneEditingBtn : t.editRoutineBtn}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setNewName('');
              setNewTag('');
              setShowNewModal(true);
            }}
            className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            {t.newRoutineBtn}
          </button>
        </div>
      </div>

      {/* Edit Mode Hint Banner */}
      {isEditMode && routines.length > 1 && (
        <div className="flex items-center justify-between px-3.5 py-2 text-xs text-blue-700 bg-blue-50/80 rounded-2xl border border-blue-200/80 font-medium select-none">
          <span>{t.dragRoutineHint}</span>
        </div>
      )}

      {/* Create Routine Inline Card */}
      {showNewModal && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-[24px] p-5 shadow-xs space-y-3.5 border border-blue-100"
        >
          <h3 className="font-bold text-sm text-slate-900">
            {t.createNewRoutineTitle}
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t.routineNamePlaceholder}
              autoFocus
              className="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <CategoryTagPicker
              value={newTag}
              onChange={setNewTag}
              lang={lang}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              {t.createAndOpen}
            </button>
          </div>
        </form>
      )}

      {/* Empty State when no routines exist yet */}
      {routines.length === 0 && !showNewModal && (
        <div className="bg-white rounded-[24px] p-8 text-center shadow-xs space-y-3 border border-slate-100">
          <p className="font-bold text-base text-slate-900">
            {t.noRoutinesYetTitle}
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            {t.noRoutinesYetDesc}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setNewName('');
                setNewTag('');
                setShowNewModal(true);
              }}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {t.newRoutineBtn}
            </button>
          </div>
        </div>
      )}

      {/* Routines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {routines.map((routine, idx) => {
          const isBeingDragged = draggedIdx === idx;
          const isDragTarget =
            dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;
          const isMenuOpen = openMenuRoutineId === routine.id;
          const tagText = routine.tag?.trim()
            ? translateRoutineText(routine.tag, lang)
            : '';

          return (
            <div
              key={routine.id}
              data-routine-list-idx={idx}
              draggable={isEditMode}
              onDragStart={(e) => {
                if (!isEditMode) return;
                setDraggedIdx(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                if (!isEditMode || draggedIdx === null) return;
                e.preventDefault();
                if (dragOverIdx !== idx) {
                  setDragOverIdx(idx);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  onReorderRoutines(draggedIdx, idx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              role={!isEditMode ? 'button' : undefined}
              tabIndex={!isEditMode ? 0 : undefined}
              onKeyDown={(e) => {
                if (!isEditMode && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onOpenRoutine(routine.id);
                }
              }}
              onClick={() => {
                if (!isEditMode) {
                  onOpenRoutine(routine.id);
                }
              }}
              className={`bg-white rounded-[24px] p-5 shadow-xs transition space-y-3 flex flex-col justify-between relative ${
                isMenuOpen ? 'z-30' : 'z-10'
              } ${
                !isEditMode ? 'hover:shadow-md cursor-pointer' : ''
              } ${isBeingDragged ? 'opacity-50 scale-[0.98]' : ''} ${
                isDragTarget ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isEditMode && (
                      <div
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          setDraggedIdx(idx);
                        }}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        title={t.dragRoutineHint}
                        className="mt-0.5 px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-grab active:cursor-grabbing select-none touch-none shrink-0 font-bold text-xs leading-none"
                      >
                        ⋮⋮
                      </div>
                    )}
                    <div
                      className="min-w-0 cursor-pointer"
                      onClick={(e) => {
                        if (isEditMode) {
                          e.stopPropagation();
                          onOpenRoutine(routine.id);
                        }
                      }}
                    >
                      {tagText && (
                        <span className="text-xs font-semibold text-blue-600 block">
                          {tagText}
                        </span>
                      )}
                      <h3 className="font-bold text-base text-slate-900 mt-0.5 truncate">
                        {translateRoutineText(routine.name, lang)}
                      </h3>
                    </div>
                  </div>

                  {/* ⋮ Menu Button — ONLY visible in Edit Mode */}
                  {isEditMode && (
                    <div
                      className="relative shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuRoutineId(isMenuOpen ? null : routine.id)
                        }
                        aria-label="Routine options"
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                      >
                        ⋮
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-9 z-30 w-48 bg-white rounded-2xl shadow-lg border border-slate-200/90 py-1.5 text-xs font-semibold text-slate-700 overflow-hidden">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                onReorderRoutines(idx, idx - 1);
                                setOpenMenuRoutineId(null);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                            >
                              <span className="text-slate-400">↑</span>
                              <span>{t.moveUpBtn}</span>
                            </button>
                          )}
                          {idx < routines.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                onReorderRoutines(idx, idx + 1);
                                setOpenMenuRoutineId(null);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                            >
                              <span className="text-slate-400">↓</span>
                              <span>{t.moveDownBtn}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleStartEditMeta(routine)}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                          >
                            <span>✏️</span>
                            <span>{t.editRoutineInfoBtn}</span>
                          </button>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteRoutine(routine);
                              setOpenMenuRoutineId(null);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 font-bold cursor-pointer"
                          >
                            <span>🗑️</span>
                            <span>{t.deleteRoutineBtn}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  {routine.exercises.length === 0 ? (
                    <p className="text-slate-400 italic">{t.noExercisesYet}</p>
                  ) : (
                    routine.exercises.map((item, exIdx) => {
                      const ex = exercisesMap[item.exerciseId];
                      const previewSet =
                        item.sets.find((s) => s.type !== 'warmup') ||
                        item.sets[0] || { weight: 0, reps: 0 };
                      const displayName =
                        ex && lang === 'vi' && ex.nameVi
                          ? ex.nameVi
                          : ex
                            ? ex.name
                            : item.exerciseId;
                      return (
                        <div key={exIdx} className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800 truncate pr-2">
                              {displayName}
                            </span>
                            <span className="text-slate-400 font-medium shrink-0">
                              {item.sets.length} {t.setsLabel} •{' '}
                              {previewSet.weight}kg × {previewSet.reps}
                            </span>
                          </div>
                          {item.note && (
                            <p className="text-[11px] text-blue-600 truncate">
                              📌 {item.note}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Routine Name & Category Modal */}
      {editingRoutine && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingRoutine(null)}
        >
          <form
            onSubmit={handleSaveEditMeta}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] p-5 w-full max-w-sm shadow-xl space-y-3.5 border border-slate-100"
          >
            <h3 className="font-bold text-base text-slate-900">
              {t.editRoutineInfoBtn}
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={editNameDraft}
                onChange={(e) => setEditNameDraft(e.target.value)}
                placeholder={t.routineNamePlaceholder}
                autoFocus
                className="w-full rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <CategoryTagPicker
                value={editTagDraft}
                onChange={setEditTagDraft}
                lang={lang}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingRoutine(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe In-App Delete Routine Confirmation Modal */}
      {confirmDeleteRoutine && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteRoutine(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] p-5 w-full max-w-sm shadow-xl space-y-3.5 border border-red-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {t.deleteRoutineConfirmTitle}
                </h3>
                <p className="text-xs font-semibold text-red-600">
                  “{translateRoutineText(confirmDeleteRoutine.name, lang)}”
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.deleteRoutineConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteRoutine(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRoutine(confirmDeleteRoutine.id);
                  setConfirmDeleteRoutine(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {t.confirmDeleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
