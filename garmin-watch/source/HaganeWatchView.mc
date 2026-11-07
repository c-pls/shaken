import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

class HaganeWatchView extends WatchUi.View {
    private var _state as HaganeWorkoutState;

    function initialize(state as HaganeWorkoutState) {
        View.initialize();
        _state = state;
    }

    function onShow() as Void {
        // Ensure timer resumes if app regained focus mid-workout
        _state.ensureTimerIfActive();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        // Clear screen to deep black for maximum MIP contrast
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            drawRoutineList(dc);
        } else if (st == HaganeWorkoutState.STATE_ACTIVE_SET) {
            drawActiveSet(dc);
        } else if (st == HaganeWorkoutState.STATE_REST) {
            drawRestTimer(dc);
        } else if (st == HaganeWorkoutState.STATE_PAUSE_MENU) {
            drawPauseMenu(dc);
        } else if (st == HaganeWorkoutState.STATE_SUMMARY) {
            drawSummary(dc);
        }
    }

    // -------------------------------------------------------------------------
    // 1. ROUTINE LIST SCREEN
    // -------------------------------------------------------------------------
    private function drawRoutineList(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        // Top Header
        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 16, Graphics.FONT_XTINY, "HAGANE", Graphics.TEXT_JUSTIFY_CENTER);

        var routines = _state.routines;
        if (routines.size() == 0) {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 78, Graphics.FONT_SMALL, "No Routines Yet", Graphics.TEXT_JUSTIFY_CENTER);

            if (_state.syncStatusText.length() > 0) {
                dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, 114, Graphics.FONT_XTINY, _state.syncStatusText, Graphics.TEXT_JUSTIFY_CENTER);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
                dc.drawText(cx, 114, Graphics.FONT_XTINY, "Sync via Garmin Connect", Graphics.TEXT_JUSTIFY_CENTER);
            }

            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 152, Graphics.FONT_XTINY, "Press START to Sync", Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }

        var sel = _state.selectedRoutineIdx;
        var total = routines.size();

        // Previous item preview (above center)
        if (sel > 0 && (routines[sel - 1] instanceof Dictionary)) {
            var prev = routines[sel - 1] as Dictionary;
            var prevNmObj = prev.get("n");
            var prevName = (prevNmObj instanceof String) ? (prevNmObj as String) : "Workout";
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 54, Graphics.FONT_XTINY, truncateText(prevName, 22), Graphics.TEXT_JUSTIFY_CENTER);
        } else if (_state.syncStatusText.length() > 0) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 54, Graphics.FONT_XTINY, _state.syncStatusText, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Selected item card in center
        var curr = routines[sel] as Dictionary;
        var currNmObj  = curr.get("n");
        var currTagObj = curr.get("t");
        var currName   = (currNmObj instanceof String) ? (currNmObj as String) : "Workout";
        var currTag    = (currTagObj instanceof String) ? (currTagObj as String) : "GYM";
        var exListObj  = curr.get("e");
        var exCount    = (exListObj instanceof Array) ? (exListObj as Array).size() : 0;

        // Highlight box
        dc.setColor(Graphics.COLOR_DK_BLUE, Graphics.COLOR_DK_BLUE);
        dc.fillRoundedRectangle(20, 84, w - 40, 82, 12);
        dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
        dc.drawRoundedRectangle(20, 84, w - 40, 82, 12);

        // Tag & Index
        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        var badgeStr = "[" + currTag.toUpper() + "]  " + (sel + 1) + "/" + total;
        dc.drawText(cx, 90, Graphics.FONT_XTINY, badgeStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Routine Name
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 112, Graphics.FONT_SMALL, truncateText(currName, 19), Graphics.TEXT_JUSTIFY_CENTER);

        // Exercise Count
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 140, Graphics.FONT_XTINY, exCount + " Exercises", Graphics.TEXT_JUSTIFY_CENTER);

        // Next item preview (below center)
        if (sel + 1 < total && (routines[sel + 1] instanceof Dictionary)) {
            var next = routines[sel + 1] as Dictionary;
            var nextNmObj = next.get("n");
            var nextName = (nextNmObj instanceof String) ? (nextNmObj as String) : "Workout";
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 176, Graphics.FONT_XTINY, truncateText(nextName, 22), Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 176, Graphics.FONT_XTINY, "Hold UP: Sync Routines", Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Bottom prompt anchored relative to screen height
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h - 42, Graphics.FONT_XTINY, "START to Begin", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // -------------------------------------------------------------------------
    // 2. ACTIVE SET SCREEN
    // -------------------------------------------------------------------------
    private function drawActiveSet(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        if (_state.currentStepIdx >= _state.steps.size()) {
            return;
        }
        var step = _state.steps[_state.currentStepIdx] as Dictionary;
        var label       = step.get("label") as String;
        var name        = step.get("name") as String;
        var isWarmup    = step.get("isWarmup") as Boolean;
        var setNum      = step.get("setNum") as Number;
        var setTotal    = step.get("setTotal") as Number;
        var weight      = step.get("weight");
        var reps        = step.get("reps") as Number;
        var isWarmupSet = step.get("isWarmupSet") as Boolean;
        var note        = step.get("note") as String;

        var topColor = Graphics.COLOR_BLUE;
        var topText = "EX " + label + "  •  SET " + setNum + "/" + setTotal;
        if (isWarmup || isWarmupSet) {
            topColor = Graphics.COLOR_ORANGE;
            topText = "WARMUP " + label + " • SET " + setNum + "/" + setTotal;
        } else if (label.length() >= 2) {
            var lastCh = label.substring(label.length() - 1, label.length());
            if (!lastCh.equals("0") && !lastCh.equals("1") && !lastCh.equals("2") &&
                !lastCh.equals("3") && !lastCh.equals("4") && !lastCh.equals("5") &&
                !lastCh.equals("6") && !lastCh.equals("7") && !lastCh.equals("8") &&
                !lastCh.equals("9")) {
                topColor = Graphics.COLOR_PURPLE;
                topText = "SUPERSET " + label + " • SET " + setNum + "/" + setTotal;
            }
        }

        dc.setColor(topColor, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 18, Graphics.FONT_XTINY, topText, Graphics.TEXT_JUSTIFY_CENTER);

        // Exercise Name (split into up to 2 lines if long)
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        var lines = splitTwoLines(name, 19);
        if (lines.size() == 1) {
            dc.drawText(cx, 54, Graphics.FONT_SMALL, lines[0] as String, Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.drawText(cx, 43, Graphics.FONT_SMALL, lines[0] as String, Graphics.TEXT_JUSTIFY_CENTER);
            dc.drawText(cx, 69, Graphics.FONT_SMALL, lines[1] as String, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Divider line
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawLine(34, 102, w - 34, 102);

        // Target Weight x Reps
        var weightStr = formatWeight(weight);
        var targetStr = weightStr + " kg  x  " + reps;
        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 110, Graphics.FONT_MEDIUM, targetStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Optional Exercise Note (if present) or Next Exercise hint
        if (note != null && note.length() > 0) {
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 152, Graphics.FONT_XTINY, truncateText(note, 24), Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            var restSec = step.get("restSeconds") as Number;
            dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            if (restSec <= 0 && (_state.currentStepIdx + 1) < _state.steps.size()) {
                var nextStep = _state.steps[_state.currentStepIdx + 1] as Dictionary;
                var nextLbl = nextStep.get("label") as String;
                var nextNm = nextStep.get("name") as String;
                dc.drawText(cx, 152, Graphics.FONT_XTINY, "Next -> " + nextLbl + " " + truncateText(nextNm, 14), Graphics.TEXT_JUSTIFY_CENTER);
            } else {
                dc.drawText(cx, 152, Graphics.FONT_XTINY, "Rest after set: " + formatMmSs(restSec), Graphics.TEXT_JUSTIFY_CENTER);
            }
        }

        // Bottom Bar: Live HR + Active Set Elapsed Time
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawLine(44, 184, w - 44, 184);

        var hrStr = _state.heartRate > 0 ? (_state.heartRate.toString() + " bpm") : "-- bpm";
        var durStr = formatMmSs(_state.setElapsedSec);

        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx - 42, 192, Graphics.FONT_XTINY, "HR " + hrStr, Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx + 46, 192, Graphics.FONT_XTINY, durStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Action Prompt at bottom
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h - 40, Graphics.FONT_XTINY, "START: Done Set", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // -------------------------------------------------------------------------
    // 3. REST TIMER SCREEN (Countdown -> Vibrate at 00:00 -> Overtime +00:01)
    // -------------------------------------------------------------------------
    private function drawRestTimer(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;

        var target = _state.restTargetSec;
        var elapsed = _state.restElapsedSec;
        var isOvertime = (elapsed >= target);

        // Draw 360-degree circular progress gauge around the 260x260 bezel
        dc.setPenWidth(8);
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, cx - 6);

        if (!isOvertime && target > 0) {
            var remainingRatio = (target - elapsed).toFloat() / target.toFloat();
            var sweepDeg = (remainingRatio * 360.0).toNumber();
            if (sweepDeg > 0) {
                dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
                var startDeg = 90;
                var endDeg = 90 - sweepDeg;
                if (endDeg < 0) {
                    endDeg += 360;
                }
                dc.drawArc(cx, cy, cx - 6, Graphics.ARC_CLOCKWISE, startDeg, endDeg);
            }
        } else {
            // Overtime ring in bright Amber/Orange
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(cx, cy, cx - 6);
        }
        dc.setPenWidth(1);

        // Header
        if (!isOvertime) {
            dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 22, Graphics.FONT_XTINY, "REST TIMER", Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.setColor(Graphics.COLOR_ORANGE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 22, Graphics.FONT_XTINY, "REST COMPLETE!", Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Huge Timer Number in Center
        var timerStr = "";
        if (!isOvertime) {
            timerStr = formatMmSs(target - elapsed);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        } else {
            timerStr = "+" + formatMmSs(elapsed - target);
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        }
        dc.drawText(cx, 50, Graphics.FONT_NUMBER_HOT, timerStr, Graphics.TEXT_JUSTIFY_CENTER);

        // UP/DOWN +/-15s & HR sub-row
        var hrStr = _state.heartRate > 0 ? (_state.heartRate.toString() + " bpm") : "-- bpm";
        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 126, Graphics.FONT_XTINY, "UP/DN +/-15s  •  HR " + hrStr, Graphics.TEXT_JUSTIFY_CENTER);

        // Divider
        dc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawLine(36, 150, w - 36, 150);

        // NEXT SET PREVIEW
        if (_state.currentStepIdx < _state.steps.size()) {
            var nextStep = _state.steps[_state.currentStepIdx] as Dictionary;
            var nextLabel  = nextStep.get("label") as String;
            var nextName   = nextStep.get("name") as String;
            var nextSetNum = nextStep.get("setNum") as Number;
            var nextSetTot = nextStep.get("setTotal") as Number;
            var nextWeight = formatWeight(nextStep.get("weight"));
            var nextReps   = nextStep.get("reps") as Number;

            dc.setColor(Graphics.COLOR_BLUE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 156, Graphics.FONT_XTINY, "NEXT: [" + nextLabel + "] SET " + nextSetNum + "/" + nextSetTot, Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 176, Graphics.FONT_XTINY, truncateText(nextName, 21), Graphics.TEXT_JUSTIFY_CENTER);

            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 196, Graphics.FONT_XTINY, nextWeight + " kg x " + nextReps, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Bottom prompt
        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h - 40, Graphics.FONT_XTINY, "START: Begin Set", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // -------------------------------------------------------------------------
    // 4. PAUSE / OPTIONS MENU
    // -------------------------------------------------------------------------
    private function drawPauseMenu(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 18, Graphics.FONT_XTINY, "WORKOUT PAUSED", Graphics.TEXT_JUSTIFY_CENTER);

        var items = HaganeWorkoutState.PAUSE_MENU_ITEMS;
        var sel = _state.pauseMenuIdx;

        for (var i = 0; i < items.size(); i += 1) {
            var y = 48 + (i * 32);
            if (i == sel) {
                dc.setColor(Graphics.COLOR_DK_BLUE, Graphics.COLOR_DK_BLUE);
                dc.fillRoundedRectangle(28, y - 2, w - 56, 28, 8);
                dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            } else {
                dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
            }
            dc.drawText(cx, y + 2, Graphics.FONT_XTINY, items[i] as String, Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    // -------------------------------------------------------------------------
    // 5. WORKOUT SUMMARY SCREEN
    // -------------------------------------------------------------------------
    private function drawSummary(dc as Graphics.Dc) as Void {
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;

        dc.setColor(Graphics.COLOR_GREEN, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 32, Graphics.FONT_SMALL, "WORKOUT SAVED!", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 82, Graphics.FONT_MEDIUM, _state.completedSetsCount + " Sets Done", Graphics.TEXT_JUSTIFY_CENTER);

        dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, 126, Graphics.FONT_SMALL, "Time: " + formatMmSs(_state.workoutTotalSec), Graphics.TEXT_JUSTIFY_CENTER);

        if (_state.heartRate > 0) {
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, 162, Graphics.FONT_XTINY, "HR: " + _state.heartRate + " bpm", Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h - 50, Graphics.FONT_XTINY, "Press START or BACK", Graphics.TEXT_JUSTIFY_CENTER);
    }

    // -------------------------------------------------------------------------
    // Formatting Helpers
    // -------------------------------------------------------------------------
    private function formatMmSs(totalSeconds as Number) as String {
        if (totalSeconds < 0) {
            totalSeconds = 0;
        }
        var mins = totalSeconds / 60;
        var secs = totalSeconds % 60;
        return mins.format("%02d") + ":" + secs.format("%02d");
    }

    private function formatWeight(val as Object?) as String {
        if (val == null) {
            return "0";
        }
        if (val instanceof Number) {
            return (val as Number).toString();
        }
        if (val instanceof Float || val instanceof Double) {
            // Convert safely via Numeric.toFloat() without throwing InvalidValueException on Double
            var f = (val as Float or Double).toFloat();
            var i = f.toNumber();
            if ((f - i.toFloat()).abs() < 0.05f) {
                return i.toString();
            }
            return f.format("%.1f");
        }
        return val.toString();
    }

    private function truncateText(str as String, maxLen as Number) as String {
        if (str.length() <= maxLen) {
            return str;
        }
        return str.substring(0, maxLen - 1) + ".";
    }

    private function splitTwoLines(str as String, maxLineLen as Number) as Array {
        if (str.length() <= maxLineLen) {
            return [str];
        }
        var splitIdx = -1;
        for (var i = 0; i < maxLineLen && i < str.length(); i += 1) {
            if (str.substring(i, i + 1).equals(" ")) {
                splitIdx = i;
            }
        }
        if (splitIdx <= 0) {
            var line1 = str.substring(0, maxLineLen);
            var line2 = truncateText(str.substring(maxLineLen, str.length()), maxLineLen);
            return [line1, line2];
        }
        var first = str.substring(0, splitIdx);
        var rest = str.substring(splitIdx + 1, str.length());
        return [first, truncateText(rest, maxLineLen)];
    }
}
