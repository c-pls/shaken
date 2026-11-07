import Toybox.Lang;
import Toybox.System;
import Toybox.WatchUi;

class HaganeWatchDelegate extends WatchUi.BehaviorDelegate {
    private var _state as HaganeWorkoutState;
    private var _lastSelectTickMs as Number = 0;

    function initialize(state as HaganeWorkoutState) {
        BehaviorDelegate.initialize();
        _state = state;
    }

    // Physical START / ENTER button (top-right button on Forerunner 255 Music)
    function onSelect() as Boolean {
        // 500ms debounce guard to prevent accidental double-presses from skipping a set
        var nowMs = System.getTimer();
        if (_lastSelectTickMs > 0 && (nowMs - _lastSelectTickMs).abs() < 500) {
            return true;
        }
        _lastSelectTickMs = nowMs;

        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            if (_state.routines.size() == 0) {
                // No routines yet -> request sync from phone via Garmin Connect
                _state.requestSyncFromPhone(false);
                return true;
            }
            return _state.startSelectedRoutine();
        } else if (st == HaganeWorkoutState.STATE_ACTIVE_SET) {
            _state.completeCurrentSet();
            return true;
        } else if (st == HaganeWorkoutState.STATE_REST) {
            // Works both BEFORE 00:00 (early set start) and AFTER 00:00 (overtime)
            _state.startNextSetFromRest();
            return true;
        } else if (st == HaganeWorkoutState.STATE_PAUSE_MENU) {
            _state.executePauseMenuAction();
            return true;
        } else if (st == HaganeWorkoutState.STATE_SUMMARY) {
            _state.screenState = HaganeWorkoutState.STATE_ROUTINE_LIST;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // Physical BACK / LAP button (bottom-right button on Forerunner 255 Music)
    function onBack() as Boolean {
        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            // Allow normal exit back to watch face / Activities list
            return false;
        } else if (st == HaganeWorkoutState.STATE_ACTIVE_SET || st == HaganeWorkoutState.STATE_REST) {
            _state.openPauseMenu();
            return true;
        } else if (st == HaganeWorkoutState.STATE_PAUSE_MENU) {
            // Resume workout on BACK (also restarts paused FIT session)
            _state.resumeFromPauseMenu();
            return true;
        } else if (st == HaganeWorkoutState.STATE_SUMMARY) {
            _state.screenState = HaganeWorkoutState.STATE_ROUTINE_LIST;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // Physical UP button (middle-left button on Forerunner 255 Music)
    function onPreviousPage() as Boolean {
        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            if (_state.routines.size() > 0) {
                _state.selectedRoutineIdx = (_state.selectedRoutineIdx - 1 + _state.routines.size()) % _state.routines.size();
                WatchUi.requestUpdate();
            }
            return true;
        } else if (st == HaganeWorkoutState.STATE_REST) {
            // Add +15 seconds to current rest timer
            _state.adjustRestTarget(15);
            return true;
        } else if (st == HaganeWorkoutState.STATE_PAUSE_MENU) {
            var count = HaganeWorkoutState.PAUSE_MENU_ITEMS.size();
            _state.pauseMenuIdx = (_state.pauseMenuIdx - 1 + count) % count;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // Physical DOWN button (bottom-left button on Forerunner 255 Music)
    function onNextPage() as Boolean {
        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            if (_state.routines.size() > 0) {
                _state.selectedRoutineIdx = (_state.selectedRoutineIdx + 1) % _state.routines.size();
                WatchUi.requestUpdate();
            }
            return true;
        } else if (st == HaganeWorkoutState.STATE_REST) {
            // Subtract 15 seconds from current rest timer
            _state.adjustRestTarget(-15);
            return true;
        } else if (st == HaganeWorkoutState.STATE_PAUSE_MENU) {
            var count = HaganeWorkoutState.PAUSE_MENU_ITEMS.size();
            _state.pauseMenuIdx = (_state.pauseMenuIdx + 1) % count;
            WatchUi.requestUpdate();
            return true;
        }
        return false;
    }

    // Long-press UP (Menu) -> on Routine List triggers Sync from Phone; during workout opens Pause Menu
    function onMenu() as Boolean {
        var st = _state.screenState;
        if (st == HaganeWorkoutState.STATE_ROUTINE_LIST) {
            _state.requestSyncFromPhone(false);
            return true;
        } else if (st == HaganeWorkoutState.STATE_ACTIVE_SET || st == HaganeWorkoutState.STATE_REST) {
            _state.openPauseMenu();
            return true;
        }
        return false;
    }
}
