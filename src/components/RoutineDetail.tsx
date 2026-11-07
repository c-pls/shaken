import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Exercise,
  Language,
  Routine,
  RoutineExerciseItem,
  WorkoutSet,
} from '../types/gym';
import {
  translateMuscle,
  UI_TEXT,
} from '../i18n/translations';
import {
  formatRestTime,
  getDefaultRestSeconds,
  REST_TIME_PRESETS,
} from '../services/storage';

interface SetNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  isDecimal?: boolean;
  className?: string;
  min?: number;
  max?: number;
  ariaLabel?: string;
}

/**
 * Mobile-friendly numeric input for weights and reps.
 * - Allows clearing the field completely without forcing an unwanted '0'.
 * - Auto-selects existing text on tap so typing immediately replaces the number.
 * - Opens the phone's native numeric keypad with decimal dot support.
 */
const SetNumberInput: React.FC<SetNumberInputProps> = ({
  value,
  onChange,
  isDecimal = false,
  className = '',
  min = 0,
  max,
  ariaLabel,
}) => {
  const [draft, setDraft] = useState<string>(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const selectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (selectTimerRef.current) {
        clearTimeout(selectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value.toString());
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Filter characters: allow digits and optional single decimal point
    if (isDecimal) {
      if (!/^\d*\.?\d*$/.test(raw)) return;
    } else {
      if (!/^\d*$/.test(raw)) return;
    }

    setDraft(raw);
    // Keep draft local while typing to prevent full app re-renders and storage writes on every keystroke.
    // Parent receives updated value onBlur or Enter key.
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    const target = e.target;
    // Auto-select entire number on tap so typing immediately overwrites old number
    // Timeout defeats Android WebView touch-release caret placement
    if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    selectTimerRef.current = window.setTimeout(() => {
      try {
        target.select();
      } catch {
        // ignore
      }
    }, 25);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const ceiling = max ?? 1000;
    if (draft === '' || draft === '.') {
      onChange(min);
      setDraft(min.toString());
    } else {
      const parsed = parseFloat(draft);
      const safe = Number.isNaN(parsed)
        ? min
        : Math.min(ceiling, Math.max(min, parsed));
      onChange(safe);
      setDraft(safe.toString());
    }
  };

  return (
    <input
      type="text"
      inputMode={isDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={ariaLabel}
      value={isFocused ? draft : value.toString()}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};

interface RoutineDetailProps {
  routine: Routine;
  lang: Language;
  exercisesMap: Record<string, Exercise>;
  allExercises: Exercise[];
  isEditMode?: boolean;
  scrollToIndex?: number;
  onUpdateRoutine: (updated: Routine) => void;
  onOpenExerciseInfo: (exerciseId: string, routineExIndex: number) => void;
  onOpenPicker: (params: {
    asWarmup: boolean;
    replacingExIdx: number | null;
    fromEditMode?: boolean;
  }) => void;
}

export const RoutineDetail: React.FC<RoutineDetailProps> = ({
  routine,
  lang,
  exercisesMap,
  isEditMode = false,
  scrollToIndex,
  onUpdateRoutine,
  onOpenExerciseInfo,
  onOpenPicker,
}) => {
  const t = UI_TEXT[lang];
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [highlightedCardIdx, setHighlightedCardIdx] = useState<number | null>(
    null
  );
  const lastScrolledKeyRef = useRef<string | null>(null);

  // When adding or swapping an exercise, automatically scroll to it and highlight it once
  useEffect(() => {
    const targetExId =
      scrollToIndex !== undefined
        ? routine.exercises[scrollToIndex]?.exerciseId
        : undefined;
    const scrollKey =
      scrollToIndex !== undefined && targetExId
        ? `${scrollToIndex}-${targetExId}`
        : null;

    if (
      scrollToIndex !== undefined &&
      scrollToIndex >= 0 &&
      scrollKey &&
      lastScrolledKeyRef.current !== scrollKey
    ) {
      lastScrolledKeyRef.current = scrollKey;
      setHighlightedCardIdx(scrollToIndex);

      const timer = setTimeout(() => {
        const targetCard = document.querySelector(
          `[data-routine-card-idx="${scrollToIndex}"]`
        );
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);

      const highlightTimer = setTimeout(() => {
        setHighlightedCardIdx(null);
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearTimeout(highlightTimer);
      };
    }
  }, [scrollToIndex, routine.exercises]);

  // Drag-and-drop state (supports both desktop drag & mobile touch)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [openMenuExIdx, setOpenMenuExIdx] = useState<number | null>(null);
  const [editingRestIdx, setEditingRestIdx] = useState<number | null>(null);
  const [confirmRemoveExIdx, setConfirmRemoveExIdx] = useState<number | null>(
    null
  );

  useEffect(() => {
    if (!isEditMode) {
      setOpenMenuExIdx(null);
      setEditingRestIdx(null);
      setConfirmRemoveExIdx(null);
    }
  }, [isEditMode]);

  useEffect(() => {
    document.body.dataset.dragging = draggedIdx !== null ? 'true' : '';
    return () => {
      document.body.dataset.dragging = '';
    };
  }, [draggedIdx]);

  const warmupIndices = useMemo(
    () =>
      routine.exercises
        .map((item, idx) => (item.isWarmup ? idx : -1))
        .filter((idx) => idx !== -1),
    [routine.exercises]
  );

  const mainIndices = useMemo(
    () =>
      routine.exercises
        .map((item, idx) => (!item.isWarmup ? idx : -1))
        .filter((idx) => idx !== -1),
    [routine.exercises]
  );

  // Map of exercise index to superset group info and section order numbering (e.g. 1, 2, 6A, 6B)
  const { supersetInfoMap, exerciseOrderMap } = useMemo(() => {
    const supersetInfo: Record<
      number,
      {
        groupLetter: string;
        isFirst: boolean;
        isLast: boolean;
        groupSize: number;
      }
    > = {};

    const orderMap: Record<
      number,
      {
        orderLabel: string;
        isSuperset: boolean;
        groupLetter?: string;
      }
    > = {};

    const groups: Record<string, number[]> = {};
    routine.exercises.forEach((item, idx) => {
      if (item.supersetId) {
        const scopedKey = `${item.isWarmup ? 'W' : 'M'}:${item.supersetId}`;
        if (!groups[scopedKey]) groups[scopedKey] = [];
        groups[scopedKey].push(idx);
      }
    });

    const groupIdToLetter: Record<string, string> = {};
    let groupIdx = 0;
    Object.keys(groups).forEach((scopedKey) => {
      const indices = groups[scopedKey];
      if (indices.length >= 2) {
        const letter =
          groupIdx < 26
            ? String.fromCharCode(65 + groupIdx)
            : `S${groupIdx + 1}`;
        groupIdx++;
        groupIdToLetter[scopedKey] = letter;
        indices.forEach((idx, pos) => {
          supersetInfo[idx] = {
            groupLetter: letter,
            isFirst: pos === 0,
            isLast: pos === indices.length - 1,
            groupSize: indices.length,
          };
        });
      }
    });

    // Compute sequential numbering for each section (e.g. 1, 2, 3, 4A, 4B, 5)
    const computeSectionOrders = (indices: number[]) => {
      let currentNum = 1;
      const seenGroupNum: Record<string, number> = {};
      const seenGroupCount: Record<string, number> = {};

      indices.forEach((idx) => {
        const item = routine.exercises[idx];
        const sId = item.supersetId;
        const scopedKey = sId ? `${item.isWarmup ? 'W' : 'M'}:${sId}` : '';
        const isRealSuperset = Boolean(scopedKey && groupIdToLetter[scopedKey]);

        if (isRealSuperset && scopedKey) {
          if (seenGroupNum[scopedKey] === undefined) {
            seenGroupNum[scopedKey] = currentNum;
            currentNum++;
          }
          const count = seenGroupCount[scopedKey] || 0;
          seenGroupCount[scopedKey] = count + 1;
          const subLetter = count < 26 ? String.fromCharCode(65 + count) : `${count + 1}`;

          orderMap[idx] = {
            orderLabel: `${seenGroupNum[scopedKey]}${subLetter}`,
            isSuperset: true,
            groupLetter: groupIdToLetter[scopedKey],
          };
        } else {
          orderMap[idx] = {
            orderLabel: `${currentNum}`,
            isSuperset: false,
          };
          currentNum++;
        }
      });
    };

    computeSectionOrders(warmupIndices);
    computeSectionOrders(mainIndices);

    return { supersetInfoMap: supersetInfo, exerciseOrderMap: orderMap };
  }, [routine.exercises, warmupIndices, mainIndices]);

  const handleLinkSupersetWithNext = (exIndex: number) => {
    const current = routine.exercises[exIndex];
    const nextIdx = exIndex + 1;
    if (!current || nextIdx >= routine.exercises.length) return;
    const next = routine.exercises[nextIdx];
    if (!next || Boolean(current.isWarmup) !== Boolean(next.isWarmup)) return;

    const oldCurrentGroup = current.supersetId;
    const oldNextGroup = next.supersetId;

    // Guard against silent mass merge of two existing distinct superset groups (M4)
    if (oldCurrentGroup && oldNextGroup && oldCurrentGroup !== oldNextGroup) {
      const confirmMerge = window.confirm(
        lang === 'vi'
          ? 'Cả hai bài tập đều đang thuộc 2 nhóm Superset khác nhau. Bạn có muốn gộp chung thành một nhóm lớn?'
          : 'Both exercises belong to different Superset groups. Do you want to merge them into a single group?'
      );
      if (!confirmMerge) return;
    }

    const isWarmupSection = Boolean(current.isWarmup);
    const groupId = current.supersetId || next.supersetId || `ss-${Date.now()}`;

    const nextExercises = routine.exercises.map((item, idx) => {
      if (Boolean(item.isWarmup) !== isWarmupSection) return item;
      if (
        idx === exIndex ||
        idx === nextIdx ||
        (oldCurrentGroup && item.supersetId === oldCurrentGroup) ||
        (oldNextGroup && item.supersetId === oldNextGroup)
      ) {
        return { ...item, supersetId: groupId };
      }
      return item;
    });

    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleUnlinkSuperset = (exIndex: number) => {
    const target = routine.exercises[exIndex];
    if (!target.supersetId) return;

    const targetGroupId = target.supersetId;
    const remainingInGroup = routine.exercises.filter(
      (item, idx) => idx !== exIndex && item.supersetId === targetGroupId
    );

    const nextExercises = routine.exercises.map((item, idx) => {
      if (idx === exIndex) {
        const copy = { ...item };
        delete copy.supersetId;
        return copy;
      }
      if (item.supersetId === targetGroupId && remainingInGroup.length < 2) {
        const copy = { ...item };
        delete copy.supersetId;
        return copy;
      }
      return item;
    });

    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleSetChange = (
    exIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: number
  ) => {
    const clampedValue =
      field === 'weight'
        ? Math.min(1000, Math.max(0, Math.round(value * 10) / 10))
        : Math.min(500, Math.max(1, Math.round(value)));

    const nextExercises = routine.exercises.map((item, idx) => {
      if (idx !== exIndex) return item;
      const nextSets = item.sets.map((s, sIdx) =>
        sIdx === setIndex ? { ...s, [field]: clampedValue } : s
      );
      return { ...item, sets: nextSets };
    });
    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleToggleSetType = (exIndex: number, setIndex: number) => {
    if (!isEditMode) return;
    const nextExercises = routine.exercises.map((item, idx) => {
      if (idx !== exIndex) return item;
      const nextSets: WorkoutSet[] = item.sets.map((s, sIdx) => {
        if (sIdx !== setIndex) return s;
        // Cycle: normal -> warmup -> drop -> normal
        const nextType: 'normal' | 'warmup' | 'drop' =
          s.type === 'normal'
            ? 'warmup'
            : s.type === 'warmup'
              ? 'drop'
              : 'normal';
        return { ...s, type: nextType };
      });
      return { ...item, sets: nextSets };
    });
    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleSaveExerciseNote = (exIndex: number, text: string) => {
    const nextExercises = routine.exercises.map((item, idx) =>
      idx === exIndex ? { ...item, note: text.trim() } : item
    );
    onUpdateRoutine({ ...routine, exercises: nextExercises });
    setEditingNoteIdx(null);
  };

  const handleRestTimeChange = (exIndex: number, restSeconds: number) => {
    const nextExercises = routine.exercises.map((item, idx) =>
      idx === exIndex ? { ...item, restSeconds } : item
    );
    onUpdateRoutine({ ...routine, exercises: nextExercises });
    setEditingRestIdx(null);
  };

  const handleAddSet = (exIndex: number) => {
    const nextExercises = routine.exercises.map((item, idx) => {
      if (idx !== exIndex) return item;
      let nextType: 'normal' | 'warmup' | 'drop' = 'normal';
      if (item.isWarmup) {
        nextType = 'warmup';
      } else if (item.sets.length > 0) {
        const last = item.sets[item.sets.length - 1];
        nextType = last.type === 'drop' ? 'drop' : 'normal';
      }

      const lastSet =
        item.sets.length > 0
          ? {
              weight: item.sets[item.sets.length - 1].weight,
              reps: item.sets[item.sets.length - 1].reps,
              type: nextType,
            }
          : {
              weight: item.isWarmup ? 20 : 60,
              reps: item.isWarmup ? 15 : 10,
              type: item.isWarmup ? ('warmup' as const) : ('normal' as const),
            };
      return { ...item, sets: [...item.sets, lastSet] };
    });
    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleRemoveLastSet = (exIndex: number) => {
    const nextExercises = routine.exercises.map((item, idx) => {
      if (idx !== exIndex || item.sets.length <= 1) return item;
      return { ...item, sets: item.sets.slice(0, -1) };
    });
    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleRemoveExercise = (exIndex: number) => {
    const nextExercises = routine.exercises.filter((_, idx) => idx !== exIndex);
    onUpdateRoutine({ ...routine, exercises: nextExercises });
    setConfirmRemoveExIdx(null);
  };

  // Partition a section's exercise indices into logical blocks (a superset 3A+3B is 1 single block)
  const getSectionIndexBlocks = (sectionIndices: number[]): number[][] => {
    const blocks: number[][] = [];
    let i = 0;
    while (i < sectionIndices.length) {
      const idx = sectionIndices[i];
      const sId = routine.exercises[idx]?.supersetId;
      if (!sId || !supersetInfoMap[idx]) {
        blocks.push([idx]);
        i++;
        continue;
      }
      const groupBlock: number[] = [idx];
      let j = i + 1;
      while (
        j < sectionIndices.length &&
        routine.exercises[sectionIndices[j]]?.supersetId === sId
      ) {
        groupBlock.push(sectionIndices[j]);
        j++;
      }
      blocks.push(groupBlock);
      i = j;
    }
    return blocks;
  };

  const handleReorderExercises = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const fromItem = routine.exercises[fromIdx];
    const toItem = routine.exercises[toIdx];
    if (!fromItem || !toItem) return;

    const fromIsWarmup = Boolean(fromItem.isWarmup);
    const toIsWarmup = Boolean(toItem.isWarmup);
    // Strict isolation: warm-up and main exercises can never be dragged or swapped across sections
    if (fromIsWarmup !== toIsWarmup) return;

    // Case 1: Reordering within the exact same superset (e.g. swapping 3A and 3B with each other)
    if (
      fromItem.supersetId &&
      fromItem.supersetId === toItem.supersetId &&
      supersetInfoMap[fromIdx]
    ) {
      const nextExercises = [...routine.exercises];
      const [moved] = nextExercises.splice(fromIdx, 1);
      nextExercises.splice(toIdx, 0, moved);
      onUpdateRoutine({ ...routine, exercises: nextExercises });
      return;
    }

    // Case 2: Moving across blocks — treat an entire superset (e.g. 3A + 3B) as 1 single block!
    const sectionIndices = fromIsWarmup ? warmupIndices : mainIndices;
    const blocks = getSectionIndexBlocks(sectionIndices);
    const fromBlockIdx = blocks.findIndex((b) => b.includes(fromIdx));
    const toBlockIdx = blocks.findIndex((b) => b.includes(toIdx));
    if (
      fromBlockIdx === -1 ||
      toBlockIdx === -1 ||
      fromBlockIdx === toBlockIdx
    ) {
      return;
    }

    const nextBlocks = [...blocks];
    const [movedBlock] = nextBlocks.splice(fromBlockIdx, 1);
    nextBlocks.splice(toBlockIdx, 0, movedBlock);

    const reorderedSectionItems = nextBlocks
      .flat()
      .map((i) => routine.exercises[i]);
    const otherSectionItems = (fromIsWarmup ? mainIndices : warmupIndices).map(
      (i) => routine.exercises[i]
    );

    const nextExercises = fromIsWarmup
      ? [...reorderedSectionItems, ...otherSectionItems]
      : [...otherSectionItems, ...reorderedSectionItems];

    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  const handleMoveBlock = (exIdx: number, direction: -1 | 1) => {
    const item = routine.exercises[exIdx];
    if (!item) return;
    const isWarmupSection = Boolean(item.isWarmup);
    const sectionIndices = isWarmupSection ? warmupIndices : mainIndices;
    const blocks = getSectionIndexBlocks(sectionIndices);
    const blockIdx = blocks.findIndex((b) => b.includes(exIdx));
    const targetBlockIdx = blockIdx + direction;
    if (
      blockIdx === -1 ||
      targetBlockIdx < 0 ||
      targetBlockIdx >= blocks.length
    ) {
      return;
    }

    const nextBlocks = [...blocks];
    const [movedBlock] = nextBlocks.splice(blockIdx, 1);
    nextBlocks.splice(targetBlockIdx, 0, movedBlock);

    const reorderedSectionItems = nextBlocks
      .flat()
      .map((i) => routine.exercises[i]);
    const otherSectionItems = (
      isWarmupSection ? mainIndices : warmupIndices
    ).map((i) => routine.exercises[i]);

    const nextExercises = isWarmupSection
      ? [...reorderedSectionItems, ...otherSectionItems]
      : [...otherSectionItems, ...reorderedSectionItems];

    onUpdateRoutine({ ...routine, exercises: nextExercises });
  };

  // Touch drag support for mobile / Samsung Galaxy
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isEditMode || draggedIdx === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardEl = el?.closest('[data-routine-card-idx]');
    if (cardEl) {
      const overIdx = Number(cardEl.getAttribute('data-routine-card-idx'));
      if (!Number.isNaN(overIdx) && overIdx !== dragOverIdx) {
        const draggedIsWarmup = Boolean(routine.exercises[draggedIdx]?.isWarmup);
        const overIsWarmup = Boolean(routine.exercises[overIdx]?.isWarmup);
        // Only allow drag hover within the same section
        if (draggedIsWarmup === overIsWarmup) {
          setDragOverIdx(overIdx);
        } else {
          setDragOverIdx(null);
        }
      }
    }
  };

  const handleTouchEnd = () => {
    if (
      draggedIdx !== null &&
      dragOverIdx !== null &&
      draggedIdx !== dragOverIdx
    ) {
      const draggedIsWarmup = Boolean(routine.exercises[draggedIdx]?.isWarmup);
      const overIsWarmup = Boolean(routine.exercises[dragOverIdx]?.isWarmup);
      if (draggedIsWarmup === overIsWarmup) {
        handleReorderExercises(draggedIdx, dragOverIdx);
      }
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const renderExerciseCard = (item: RoutineExerciseItem, exIdx: number) => {
    const ex = exercisesMap[item.exerciseId];
    if (!ex) {
      return (
        <div
          key={`missing-${item.exerciseId}-${exIdx}`}
          data-routine-card-idx={exIdx}
          className="bg-white rounded-[24px] p-4 shadow-xs border border-amber-200 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-bold text-sm text-slate-900 truncate">
              {t.unknownExerciseTitle} ({item.exerciseId})
            </h3>
            <p className="text-xs text-slate-500">{t.unknownExerciseDesc}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                onOpenPicker({
                  asWarmup: Boolean(item.isWarmup),
                  replacingExIdx: exIdx,
                  fromEditMode: isEditMode,
                })
              }
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold cursor-pointer"
            >
              {t.changeExerciseBtn}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemoveExIdx(exIdx)}
              className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold cursor-pointer"
            >
              {t.confirmDeleteBtn}
            </button>
          </div>
        </div>
      );
    }
    const note = item.note || '';
    const displayName = lang === 'vi' && ex.nameVi ? ex.nameVi : ex.name;
    const isWarmupEx = Boolean(item.isWarmup);
    const supersetInfo = supersetInfoMap[exIdx];
    const isSuperset = Boolean(supersetInfo);
    const orderInfo = exerciseOrderMap[exIdx];
    const isMenuOpen = openMenuExIdx === exIdx;

    // Highlight the entire superset block together when dragging or hovering over a superset
    const draggedItem =
      draggedIdx !== null ? routine.exercises[draggedIdx] : null;
    const isBeingDragged =
      draggedIdx === exIdx ||
      Boolean(
        isSuperset &&
          item.supersetId &&
          draggedItem?.supersetId === item.supersetId
      );

    const dragOverItem =
      dragOverIdx !== null ? routine.exercises[dragOverIdx] : null;
    const isDragTarget =
      draggedIdx !== null &&
      draggedIdx !== exIdx &&
      Boolean(draggedItem?.isWarmup) === isWarmupEx &&
      (dragOverIdx === exIdx ||
        Boolean(
          isSuperset &&
            item.supersetId &&
            dragOverItem?.supersetId === item.supersetId &&
            draggedItem?.supersetId !== item.supersetId
        ));

    const sectionIndices = isWarmupEx ? warmupIndices : mainIndices;
    const blocks = getSectionIndexBlocks(sectionIndices);
    const blockIdx = blocks.findIndex((b) => b.includes(exIdx));
    const canMoveUp = blockIdx > 0;
    const canMoveDown = blockIdx >= 0 && blockIdx < blocks.length - 1;
    const canLinkWithBelow =
      exIdx + 1 < routine.exercises.length &&
      Boolean(routine.exercises[exIdx + 1].isWarmup) === isWarmupEx &&
      (!item.supersetId ||
        routine.exercises[exIdx + 1].supersetId !== item.supersetId);

    return (
      <div
        key={`${ex.id}-${exIdx}`}
        data-routine-card-idx={exIdx}
        draggable={isEditMode && editingNoteIdx === null}
        onDragStart={(e) => {
          if (!isEditMode) return;
          setDraggedIdx(exIdx);
          setOpenMenuExIdx(null);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(exIdx));
        }}
        onDragOver={(e) => {
          if (!isEditMode || draggedIdx === null) return;
          const draggedIsWarmup = Boolean(routine.exercises[draggedIdx]?.isWarmup);
          if (draggedIsWarmup !== isWarmupEx) return;
          e.preventDefault();
          if (dragOverIdx !== exIdx) {
            setDragOverIdx(exIdx);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedIdx !== null && draggedIdx !== exIdx) {
            const draggedIsWarmup = Boolean(routine.exercises[draggedIdx]?.isWarmup);
            if (draggedIsWarmup === isWarmupEx) {
              handleReorderExercises(draggedIdx, exIdx);
            }
          }
          setDraggedIdx(null);
          setDragOverIdx(null);
        }}
        onDragEnd={() => {
          setDraggedIdx(null);
          setDragOverIdx(null);
        }}
        className={`bg-white rounded-[24px] p-4 shadow-xs space-y-3 transition duration-500 relative ${
          isMenuOpen ? 'z-30' : 'z-10'
        } ${
          highlightedCardIdx === exIdx
            ? 'ring-2 ring-blue-500 bg-blue-50/20'
            : ''
        } ${
          isSuperset
            ? 'border-l-4 border-l-purple-500 shadow-purple-500/5'
            : isWarmupEx
            ? 'border-l-4 border-l-amber-500'
            : 'border border-slate-200/80'
        } ${isBeingDragged ? 'opacity-50 scale-[0.98]' : ''} ${
          isDragTarget ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {/* Drag Handle in Edit Mode */}
            {isEditMode && (
              <div
                onTouchStart={() => {
                  setOpenMenuExIdx(null);
                  setDraggedIdx(exIdx);
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                title={t.dragHint}
                className="mt-0.5 px-1.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-grab active:cursor-grabbing select-none touch-none shrink-0 font-bold text-xs leading-none"
              >
                ⋮⋮
              </div>
            )}

            {/* Compact Exercise Order Number / Superset Badge (no bulky icon) */}
            {orderInfo && (
              orderInfo.isSuperset ? (
                <div
                  title={`Superset ${orderInfo.groupLetter}`}
                  className="mt-0.5 px-1.5 h-6 min-w-[24px] rounded-lg bg-purple-100 text-purple-800 border border-purple-200 text-xs font-black flex items-center justify-center shrink-0 shadow-2xs select-none"
                >
                  <span className="leading-none">{orderInfo.orderLabel}</span>
                </div>
              ) : isWarmupEx ? (
                <div
                  className="mt-0.5 px-1.5 h-6 min-w-[24px] rounded-lg bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-black flex items-center justify-center shrink-0 shadow-2xs select-none"
                >
                  <span className="leading-none">{orderInfo.orderLabel}</span>
                </div>
              ) : (
                <div
                  className="mt-0.5 px-1.5 h-6 min-w-[24px] rounded-lg bg-slate-100 text-slate-700 border border-slate-200/70 text-xs font-black flex items-center justify-center shrink-0 shadow-2xs select-none"
                >
                  <span className="leading-none">{orderInfo.orderLabel}</span>
                </div>
              )
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenExerciseInfo(ex.id, exIdx)}
                  className="text-left hover:text-blue-600 transition cursor-pointer"
                >
                  <h3 className="font-bold text-base text-slate-900 leading-snug">
                    {displayName}
                  </h3>
                </button>
                {isWarmupEx && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200">
                    🔥 {t.warmupBadge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-slate-400 font-medium">
                  {ex.primaryMuscles
                    .map((m) => translateMuscle(m, lang))
                    .join(', ')}
                </span>
                {(() => {
                  const restSecs =
                    item.restSeconds ?? getDefaultRestSeconds(ex, isWarmupEx);
                  const isSupersetNotLast = Boolean(
                    supersetInfo && !supersetInfo.isLast
                  );
                  if (isSupersetNotLast) {
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/70 select-none">
                        <span>⚡ → next</span>
                      </span>
                    );
                  }
                  return isEditMode ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingRestIdx(
                          editingRestIdx === exIdx ? null : exIdx
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                        editingRestIdx === exIdx
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200/80'
                      }`}
                      title={t.restTimeLabel}
                    >
                      <span>⏱</span>
                      <span>{formatRestTime(restSecs)}</span>
                    </button>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 select-none"
                      title={t.restTimeLabel}
                    >
                      <span>⏱</span>
                      <span>{formatRestTime(restSecs)}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Right Action Icons: Always (i), and (⋮) ONLY in Edit Mode */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenExerciseInfo(ex.id, exIdx)}
              aria-label="View exercise details"
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white font-serif italic font-bold text-sm flex items-center justify-center transition cursor-pointer"
            >
              i
            </button>

            {isEditMode && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenuExIdx(isMenuOpen ? null : exIdx)}
                  aria-label="Exercise options"
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                >
                  ⋮
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 top-9 z-30 w-52 bg-white rounded-2xl shadow-lg border border-slate-200/90 py-1.5 text-xs font-semibold text-slate-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuExIdx(null);
                        onOpenPicker({
                          asWarmup: isWarmupEx,
                          replacingExIdx: exIdx,
                          fromEditMode: isEditMode,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                    >
                      <span>🔄</span>
                      <span>{t.changeExerciseBtn}</span>
                    </button>

                    {(!supersetInfo || supersetInfo.isLast) && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuExIdx(null);
                          setEditingRestIdx(
                            editingRestIdx === exIdx ? null : exIdx
                          );
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 text-blue-600 flex items-center gap-2.5 cursor-pointer"
                      >
                        <span>⏱</span>
                        <span>{t.restTimeLabel}</span>
                      </button>
                    )}

                    {canLinkWithBelow && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuExIdx(null);
                          handleLinkSupersetWithNext(exIdx);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-purple-50 text-purple-700 flex items-center gap-2.5 cursor-pointer"
                      >
                        <span>⚡</span>
                        <span>{t.linkSupersetBtn}</span>
                      </button>
                    )}

                    {isSuperset && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuExIdx(null);
                          handleUnlinkSuperset(exIdx);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-purple-50 text-purple-700 flex items-center gap-2.5 cursor-pointer"
                      >
                        <span>✕</span>
                        <span>{t.unlinkSupersetBtn}</span>
                      </button>
                    )}

                    {canMoveUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuExIdx(null);
                          handleMoveBlock(exIdx, -1);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                      >
                        <span className="text-slate-400">↑</span>
                        <span>{t.moveUpBtn}</span>
                      </button>
                    )}

                    {canMoveDown && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuExIdx(null);
                          handleMoveBlock(exIdx, 1);
                        }}
                        className="w-full px-3.5 py-2.5 text-left hover:bg-slate-100 flex items-center gap-2.5 cursor-pointer"
                      >
                        <span className="text-slate-400">↓</span>
                        <span>{t.moveDownBtn}</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuExIdx(null);
                        setConfirmRemoveExIdx(exIdx);
                      }}
                      className="w-full px-3.5 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2.5 font-bold cursor-pointer"
                    >
                      <span>🗑️</span>
                      <span>{t.removeExerciseBtn}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Rest Time Picker (shown in Edit mode when ⏱ badge or menu option is tapped) */}
        {isEditMode &&
          editingRestIdx === exIdx &&
          (!supersetInfo || supersetInfo.isLast) && (
            <div className="mb-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <span>⏱</span>
                <span>{t.restTimeLabel}:</span>
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {REST_TIME_PRESETS.map((presetSec) => {
                  const currentSec =
                    item.restSeconds ?? getDefaultRestSeconds(ex, isWarmupEx);
                  const isActive = currentSec === presetSec;
                  return (
                    <button
                      key={presetSec}
                      type="button"
                      onClick={() => handleRestTimeChange(exIdx, presetSec)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200'
                      }`}
                    >
                      {formatRestTime(presetSec)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {/* Set Rows */}
        <div className="divide-y divide-slate-100">
          {item.sets.map((set, setIdx) => {
            const isWarmupSet = set.type === 'warmup';
            const isDropSet = set.type === 'drop';
            const workingSetNum =
              item.sets
                .slice(0, setIdx)
                .filter((s) => s.type !== 'warmup' && s.type !== 'drop').length + 1;
            const setBadgeLabel = isWarmupSet ? t.warmupSetTag : isDropSet ? 'D' : workingSetNum;

            return (
              <div
                key={setIdx}
                className="grid grid-cols-12 items-center py-2.5"
              >
                {/* Set Badge */}
                <div className="col-span-2 flex items-center">
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => handleToggleSetType(exIdx, setIdx)}
                      aria-label={
                        isWarmupSet
                          ? `${t.warmupBadge} (Click to toggle drop set)`
                          : isDropSet
                            ? 'Drop Set (Click to toggle working set)'
                            : 'Working Set (Click to toggle warmup set)'
                      }
                      title={
                        isWarmupSet
                          ? `${t.warmupBadge} (Click to toggle drop set)`
                          : isDropSet
                            ? 'Drop Set (Click to toggle working set)'
                            : 'Working Set (Click to toggle warmup set)'
                      }
                      className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-xs ${
                        isWarmupSet
                          ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                          : isDropSet
                            ? 'bg-purple-600 hover:bg-purple-700 text-white ring-2 ring-purple-300'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {setBadgeLabel}
                    </button>
                  ) : (
                    <span
                      className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center ${
                        isWarmupSet
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold'
                          : isDropSet
                            ? 'bg-purple-100 text-purple-800 border border-purple-300 font-extrabold'
                            : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {setBadgeLabel}
                    </span>
                  )}
                </div>

                {/* Weight (kg) */}
                {isEditMode ? (
                  <div className="col-span-5 flex items-center justify-center">
                    <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 rounded-xl px-2.5 py-1.5 transition">
                      <SetNumberInput
                        value={set.weight}
                        isDecimal
                        max={1000}
                        ariaLabel={`${displayName} set ${setIdx + 1} weight kg`}
                        onChange={(newWeight) =>
                          handleSetChange(exIdx, setIdx, 'weight', newWeight)
                        }
                        className="w-12 text-center font-bold text-sm text-slate-900 bg-transparent focus:outline-none"
                      />
                      <span className="text-xs text-slate-400 font-semibold select-none">
                        kg
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-5 flex items-baseline justify-center gap-1">
                    <span className="font-bold text-sm text-slate-900">
                      {set.weight}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      kg
                    </span>
                  </div>
                )}

                {/* Reps */}
                {isEditMode ? (
                  <div className="col-span-5 flex items-center justify-end pr-1">
                    <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/70 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500 rounded-xl px-2.5 py-1.5 transition">
                      <SetNumberInput
                        value={set.reps}
                        min={1}
                        max={500}
                        ariaLabel={`${displayName} set ${setIdx + 1} reps`}
                        onChange={(newReps) =>
                          handleSetChange(exIdx, setIdx, 'reps', newReps)
                        }
                        className="w-10 text-center font-bold text-sm text-slate-900 bg-transparent focus:outline-none"
                      />
                      <span className="text-xs text-slate-400 font-semibold select-none">
                        {t.repsLabel}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="col-span-5 flex items-baseline justify-end gap-1 pr-1">
                    <span className="font-bold text-sm text-slate-900">
                      {set.reps}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {t.repsLabel}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Inline Routine Note Editor (only in Edit Mode) */}
        {isEditMode && editingNoteIdx === exIdx && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveExerciseNote(exIdx, noteDraft);
                } else if (e.key === 'Escape') {
                  setEditingNoteIdx(null);
                }
              }}
              placeholder={t.commentPlaceholder}
              className="flex-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => handleSaveExerciseNote(exIdx, noteDraft)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
            >
              {t.saveNoteBtn}
            </button>
          </div>
        )}

        {/* Card Footer */}
        {isEditMode ? (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setNoteDraft(note);
                setEditingNoteIdx(editingNoteIdx === exIdx ? null : exIdx);
              }}
              className="text-xs text-blue-600 hover:underline truncate max-w-[55%] text-left cursor-pointer font-medium"
            >
              {note ? (
                <span>📌 {note}</span>
              ) : (
                <span className="text-slate-400 font-normal">
                  {t.addNotePlaceholder}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {item.sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveLastSet(exIdx)}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                >
                  {t.minusSet}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleAddSet(exIdx)}
                className="px-3 py-1 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
              >
                {t.addSet}
              </button>
            </div>
          </div>
        ) : (
          note && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-blue-600 font-medium">📌 {note}</p>
            </div>
          )
        )}
      </div>
    );
  };

  const confirmRemoveEx =
    confirmRemoveExIdx !== null
      ? exercisesMap[routine.exercises[confirmRemoveExIdx]?.exerciseId]
      : null;
  const confirmRemoveExName =
    confirmRemoveEx && lang === 'vi' && confirmRemoveEx.nameVi
      ? confirmRemoveEx.nameVi
      : confirmRemoveEx?.name || 'Exercise';

  return (
    <div className="space-y-4">
      {/* Backdrop for closing active ⋮ menu */}
      {openMenuExIdx !== null && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setOpenMenuExIdx(null)}
        />
      )}

      {/* Drag Hint (Only in edit mode if more than 1 exercise) */}
      {isEditMode && routine.exercises.length > 1 && (
        <div className="flex items-center justify-between px-3.5 py-2 text-xs text-blue-700 bg-blue-50/80 rounded-2xl border border-blue-200/80 font-medium select-none">
          <span>{t.dragHint}</span>
        </div>
      )}

      {/* Empty State */}
      {routine.exercises.length === 0 && (
        <div className="bg-white rounded-[24px] p-8 text-center shadow-xs space-y-3">
          <p className="text-sm text-slate-500">{t.emptyRoutineText}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                onOpenPicker({
                  asWarmup: true,
                  replacingExIdx: null,
                  fromEditMode: isEditMode,
                });
              }}
              className="px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer shadow-xs"
            >
              {t.addWarmupExerciseBtn}
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenPicker({
                  asWarmup: false,
                  replacingExIdx: null,
                  fromEditMode: isEditMode,
                });
              }}
              className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
            >
              {t.addFirstExerciseBtn}
            </button>
          </div>
        </div>
      )}

      {/* Routine Sections */}
      {routine.exercises.length > 0 && (
        <div className="space-y-6">
          {/* 1. Warm-up Exercises Section (Dedicated Warm-up Zone) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="font-bold text-sm text-slate-900 tracking-wide uppercase">
                  {t.warmupSectionTitle}
                </h3>
                {warmupIndices.length > 0 && (
                  <span className="text-xs text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    {warmupIndices.length}
                  </span>
                )}
              </div>
            </div>

            {warmupIndices.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {warmupIndices.map((idx, pos) => {
                    const nextSectionIdx = warmupIndices[pos + 1];
                    const showConnector = Boolean(
                      supersetInfoMap[idx] &&
                        nextSectionIdx !== undefined &&
                        routine.exercises[idx]?.supersetId &&
                        routine.exercises[idx]?.supersetId ===
                          routine.exercises[nextSectionIdx]?.supersetId
                    );
                    return (
                      <React.Fragment
                        key={`${routine.exercises[idx].exerciseId}-${idx}`}
                      >
                        {renderExerciseCard(routine.exercises[idx], idx)}
                        {showConnector && (
                          <div className="flex items-center pl-6 -my-3.5 py-0.5 col-span-full md:hidden pointer-events-none">
                            <div className="w-1 h-3.5 rounded-full bg-purple-400" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                {/* Button to add more warm-up exercises inside the warm-up zone */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenPicker({
                      asWarmup: true,
                      replacingExIdx: null,
                      fromEditMode: isEditMode,
                    });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-100/60 text-amber-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>🔥</span>
                  <span>{t.addWarmupExerciseBtn}</span>
                </button>
              </div>
            ) : (
              /* Clean dashed button to add warm-up exercises directly into this zone */
              <button
                type="button"
                onClick={() => {
                  onOpenPicker({
                    asWarmup: true,
                    replacingExIdx: null,
                    fromEditMode: isEditMode,
                  });
                }}
                className="w-full py-3 px-4 rounded-[20px] border-2 border-dashed border-amber-300/80 bg-amber-50/40 hover:bg-amber-50/80 text-amber-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>🔥</span>
                <span>{t.addWarmupExerciseBtn}</span>
              </button>
            )}
          </div>

          {/* 2. Main Workout Section */}
          {mainIndices.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <h3 className="font-bold text-sm text-slate-900 tracking-wide uppercase">
                    {t.mainSectionTitle}
                  </h3>
                  <span className="text-xs text-blue-800 font-semibold bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                    {mainIndices.length}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {mainIndices.map((idx, pos) => {
                  const nextSectionIdx = mainIndices[pos + 1];
                  const showConnector = Boolean(
                    supersetInfoMap[idx] &&
                      nextSectionIdx !== undefined &&
                      routine.exercises[idx]?.supersetId &&
                      routine.exercises[idx]?.supersetId ===
                        routine.exercises[nextSectionIdx]?.supersetId
                  );
                  return (
                    <React.Fragment
                      key={`${routine.exercises[idx].exerciseId}-${idx}`}
                    >
                      {renderExerciseCard(routine.exercises[idx], idx)}
                      {showConnector && (
                        <div className="flex items-center pl-6 -my-3.5 py-0.5 col-span-full md:hidden pointer-events-none">
                          <div className="w-1 h-3.5 rounded-full bg-purple-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Bottom Action: Add Exercise to Main Workout (Single + icon, no warmup mixed in) */}
          <div className="pt-3 pb-8">
            <button
              type="button"
              onClick={() => {
                onOpenPicker({
                  asWarmup: false,
                  replacingExIdx: null,
                  fromEditMode: isEditMode,
                });
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <span>{t.addExerciseBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* Safe In-App Remove Exercise Confirmation Modal */}
      {confirmRemoveExIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setConfirmRemoveExIdx(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] p-5 w-full max-w-sm shadow-xl space-y-3.5 border border-red-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-lg shrink-0">
                🗑️
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900">
                  {t.removeExerciseConfirmTitle}
                </h3>
                <p className="text-xs font-semibold text-red-600 truncate">
                  “{confirmRemoveExName}”
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.removeExerciseConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmRemoveExIdx(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveExercise(confirmRemoveExIdx)}
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
