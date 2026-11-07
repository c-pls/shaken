import Toybox.Activity;
import Toybox.ActivityRecording;
import Toybox.Application.Storage;
import Toybox.Attention;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.Sensor;
import Toybox.Timer;
import Toybox.WatchUi;

class HaganeSyncConnectListener extends Communications.ConnectionListener {
    private var _state as HaganeWorkoutState;

    function initialize(state as HaganeWorkoutState) {
        ConnectionListener.initialize();
        _state = state;
    }

    function onComplete() as Void {
        // Request transmitted to phone; now awaiting onPhoneMessage callback
    }

    function onError() as Void {
        _state.onSyncRequestFailed();
    }
}

class HaganeWorkoutState {
    // Screens / States
    public static const STATE_ROUTINE_LIST = 0;
    public static const STATE_ACTIVE_SET   = 1;
    public static const STATE_REST         = 2;
    public static const STATE_PAUSE_MENU   = 3;
    public static const STATE_SUMMARY      = 4;

    public var screenState as Number = STATE_ROUTINE_LIST;
    public var previousWorkoutState as Number = STATE_ACTIVE_SET;

    // Synced routines array
    public var routines as Array = [];
    public var selectedRoutineIdx as Number = 0;

    // Flattened execution steps for the active routine
    public var steps as Array = [];
    public var currentStepIdx as Number = 0;

    // Timers (in seconds)
    public var setElapsedSec as Number = 0;
    public var restTargetSec as Number = 90;
    public var restElapsedSec as Number = 0;
    public var hasVibratedForRest as Boolean = false;
    public var workoutTotalSec as Number = 0;
    public var completedSetsCount as Number = 0;

    // Pause menu selection (0 = Resume, 1 = Next Step, 2 = Prev Step, 3 = Finish & Save, 4 = Discard)
    public var pauseMenuIdx as Number = 0;
    public static const PAUSE_MENU_ITEMS = [
        "Resume Workout",
        "Skip Current Set",
        "Previous Set",
        "Finish & Save",
        "Discard Workout"
    ];

    // Live Heart Rate & FIT Activity Recording Session
    public var heartRate as Number = 0;
    public var syncStatusText as String = "";
    private var _session as ActivityRecording.Session?;
    private var _timer as Timer.Timer?;

    function initialize() {
        try {
            Sensor.setEnabledSensors([Sensor.SENSOR_HEARTRATE]);
            Sensor.enableSensorEvents(method(:onSensorEvent));
        } catch (ex) {
            // Ignore on simulator if sensor unsupported
        }
    }

    function onSensorEvent(sensorInfo as Sensor.Info) as Void {
        if (sensorInfo != null && sensorInfo.heartRate != null) {
            heartRate = sensorInfo.heartRate as Number;
        }
    }

    // Safely validates and normalizes routines array from storage or phone sync
    public static function sanitizeRoutines(raw as Array) as Array {
        var clean = [] as Array;
        for (var i = 0; i < raw.size(); i += 1) {
            var r = raw[i];
            if (r != null && (r instanceof Dictionary)) {
                var rDict = r as Dictionary;
                var exArr = rDict.get("e");
                if (exArr != null && (exArr instanceof Array)) {
                    clean.add(rDict);
                }
            }
        }
        return clean;
    }

    function loadFromStorage() as Void {
        try {
            var saved = Storage.getValue("hagane_routines");
            if (saved != null && (saved instanceof Array)) {
                routines = sanitizeRoutines(saved as Array);
            } else {
                routines = [];
            }
        } catch (ex) {
            routines = [];
        }
        if (selectedRoutineIdx >= routines.size()) {
            selectedRoutineIdx = 0;
        }
    }

    function setRoutines(newRoutines as Array) as Void {
        // Preserve currently selected routine ID across syncs/reorders if possible
        var prevSelectedId = null as String?;
        if (selectedRoutineIdx >= 0 && selectedRoutineIdx < routines.size()) {
            var prevR = routines[selectedRoutineIdx] as Dictionary;
            if (prevR.get("id") instanceof String) {
                prevSelectedId = prevR.get("id") as String;
            }
        }

        routines = sanitizeRoutines(newRoutines);

        if (prevSelectedId != null) {
            for (var i = 0; i < routines.size(); i += 1) {
                var r = routines[i] as Dictionary;
                var rid = r.get("id");
                if (rid != null && (rid instanceof String) && (rid as String).equals(prevSelectedId)) {
                    selectedRoutineIdx = i;
                    return;
                }
            }
        }
        if (selectedRoutineIdx >= routines.size()) {
            selectedRoutineIdx = 0;
        }
    }

    function onSyncReceived(newRoutines as Array) as Void {
        setRoutines(newRoutines);
        syncStatusText = "Synced " + routines.size() + " Routines!";
        WatchUi.requestUpdate();
    }

    function onSyncRequestFailed() as Void {
        syncStatusText = "Connect Phone & Retry";
        WatchUi.requestUpdate();
    }

    // Watch-initiated pull request: asks the phone / Garmin Connect to send the latest routines
    function requestSyncFromPhone(silent as Boolean) as Void {
        if (!silent) {
            syncStatusText = "Syncing with Phone...";
            vibrateShort();
            WatchUi.requestUpdate();
        }
        try {
            Communications.transmit(
                { "cmd" => "SYNC_ROUTINES" },
                null,
                new HaganeSyncConnectListener(self)
            );
        } catch (ex) {
            if (!silent) {
                syncStatusText = "Bluetooth Offline";
                WatchUi.requestUpdate();
            }
        }
    }

    function startTimer() as Void {
        if (_timer == null) {
            _timer = new Timer.Timer();
            _timer.start(method(:onTick), 1000, true);
        }
    }

    function stopTimer() as Void {
        if (_timer != null) {
            _timer.stop();
            _timer = null;
        }
    }

    function ensureTimerIfActive() as Void {
        if (screenState == STATE_ACTIVE_SET || screenState == STATE_REST) {
            startTimer();
        }
    }

    // Best-effort cleanup if the watch OS terminates the app mid-workout
    function cleanupOnAppStop() as Void {
        stopTimer();
        if (_session != null) {
            try {
                if (_session.isRecording()) {
                    _session.stop();
                }
                if (completedSetsCount > 0) {
                    _session.save();
                } else {
                    _session.discard();
                }
            } catch (ex) {}
            _session = null;
        }
    }

    function onTick() as Void {
        var info = Activity.getActivityInfo();
        if (info != null && info.currentHeartRate != null) {
            heartRate = info.currentHeartRate as Number;
        }

        if (screenState == STATE_ACTIVE_SET) {
            setElapsedSec += 1;
            workoutTotalSec += 1;
            WatchUi.requestUpdate();
        } else if (screenState == STATE_REST) {
            restElapsedSec += 1;
            workoutTotalSec += 1;

            // Fire rest-complete vibration once when elapsed >= target (safe against +/-15s adjustments)
            if (!hasVibratedForRest && restTargetSec > 0 && restElapsedSec >= restTargetSec) {
                hasVibratedForRest = true;
                vibrateRestComplete();
            }
            WatchUi.requestUpdate();
        }
    }

    // Build flattened step queue for a routine, interleaving superset rounds (e.g., 3A Set 1 -> 3B Set 1 -> Rest -> 3A Set 2 -> 3B Set 2)
    function buildStepsForRoutine(routine as Dictionary) as Array {
        var result = [] as Array;
        var exListObj = routine.get("e");
        if (exListObj == null || !(exListObj instanceof Array)) {
            return result;
        }
        var exList = exListObj as Array;
        if (exList.size() == 0) {
            return result;
        }

        var totalEx = exList.size();
        var i = 0;
        while (i < totalEx) {
            if (!(exList[i] instanceof Dictionary)) {
                i += 1;
                continue;
            }
            // Collect a contiguous superset chain where sn == 1 links to the next exercise
            var groupIndices = [i] as Array;
            var curr = exList[i] as Dictionary;
            while (curr.get("sn") == 1 && (i + 1) < totalEx && (exList[i + 1] instanceof Dictionary)) {
                i += 1;
                groupIndices.add(i);
                curr = exList[i] as Dictionary;
            }

            // Find max set count across exercises in this group
            var maxSets = 0;
            for (var g = 0; g < groupIndices.size(); g += 1) {
                var exDict = exList[groupIndices[g] as Number] as Dictionary;
                var sArrObj = exDict.get("s");
                if (sArrObj != null && (sArrObj instanceof Array)) {
                    var sArr = sArrObj as Array;
                    if (sArr.size() > maxSets) {
                        maxSets = sArr.size();
                    }
                }
            }

            // Interleave sets round by round
            for (var sIdx = 0; sIdx < maxSets; sIdx += 1) {
                for (var g = 0; g < groupIndices.size(); g += 1) {
                    var exIdx = groupIndices[g] as Number;
                    var exDict = exList[exIdx] as Dictionary;
                    var sArrObj = exDict.get("s");
                    if (sArrObj != null && (sArrObj instanceof Array)) {
                        var sArr = sArrObj as Array;
                        if (sIdx < sArr.size() && (sArr[sIdx] instanceof Array)) {
                            var setTuple = sArr[sIdx] as Array;
                            var weightVal = setTuple.size() > 0 ? setTuple[0] : 0;
                            var repsVal = (setTuple.size() > 1 && (setTuple[1] instanceof Number))
                                ? (setTuple[1] as Number)
                                : 10;
                            var isWarmupSet = (setTuple.size() > 2 && setTuple[2] == 1);

                            var isLastInGroup = (g == groupIndices.size() - 1);
                            var restSec = 90;
                            if (!isLastInGroup) {
                                restSec = 0; // Superset transition (e.g., 3A -> 3B has 0s rest)
                            } else if (exDict.get("r") instanceof Number) {
                                restSec = exDict.get("r") as Number;
                            }

                            var lblObj = exDict.get("l");
                            var nmObj = exDict.get("n");
                            var ntObj = exDict.get("nt");

                            var step = {
                                "exIdx"       => exIdx + 1,
                                "exTotal"     => totalEx,
                                "label"       => (lblObj instanceof String) ? (lblObj as String) : (exIdx + 1).toString(),
                                "name"        => (nmObj instanceof String) ? (nmObj as String) : "Exercise",
                                "isWarmup"    => (exDict.get("w") == 1),
                                "setNum"      => sIdx + 1,
                                "setTotal"    => sArr.size(),
                                "weight"      => weightVal,
                                "reps"        => repsVal,
                                "isWarmupSet" => isWarmupSet,
                                "restSeconds" => restSec,
                                "note"        => (ntObj instanceof String) ? (ntObj as String) : ""
                            };
                            result.add(step);
                        }
                    }
                }
            }
            i += 1;
        }
        return result;
    }

    function startSelectedRoutine() as Boolean {
        if (routines.size() == 0 || selectedRoutineIdx >= routines.size()) {
            return false;
        }
        var routine = routines[selectedRoutineIdx] as Dictionary;
        steps = buildStepsForRoutine(routine);
        if (steps.size() == 0) {
            syncStatusText = "Routine is Empty";
            WatchUi.requestUpdate();
            return false;
        }

        currentStepIdx = 0;
        setElapsedSec = 0;
        restElapsedSec = 0;
        hasVibratedForRest = false;
        workoutTotalSec = 0;
        completedSetsCount = 0;
        screenState = STATE_ACTIVE_SET;

        // Start Garmin FIT Strength Training Recording Session
        var nmObj = routine.get("n");
        var routineName = (nmObj instanceof String) ? (nmObj as String) : "Hagane";
        try {
            if (Toybox has :ActivityRecording) {
                _session = ActivityRecording.createSession({
                    :name => routineName,
                    :sport => Activity.SPORT_TRAINING,
                    :subSport => Activity.SUB_SPORT_STRENGTH_TRAINING
                });
                _session.start();
            }
        } catch (ex) {
            _session = null;
        }

        vibrateShort();
        startTimer();
        WatchUi.requestUpdate();
        return true;
    }

    // Called when user presses START while performing an active set
    function completeCurrentSet() as Void {
        if (currentStepIdx >= steps.size()) {
            finishAndSaveWorkout();
            return;
        }

        completedSetsCount += 1;
        // Record 1 FIT lap per completed set
        if (_session != null && _session.isRecording()) {
            try {
                _session.addLap();
            } catch (ex) {}
        }

        // If this was the very last set of the entire routine, go straight to summary/finish
        if (currentStepIdx + 1 >= steps.size()) {
            finishAndSaveWorkout();
            return;
        }

        var step = steps[currentStepIdx] as Dictionary;
        var restSec = step.get("restSeconds") as Number;

        // Advance pointer to the upcoming set
        currentStepIdx += 1;
        setElapsedSec = 0;

        // If restSeconds == 0 (e.g. Superset 3A -> 3B), jump directly to 3B Active Set!
        if (restSec <= 0) {
            vibrateShort();
            screenState = STATE_ACTIVE_SET;
        } else {
            vibrateShort();
            restTargetSec = restSec;
            restElapsedSec = 0;
            hasVibratedForRest = false;
            screenState = STATE_REST;
        }
        WatchUi.requestUpdate();
    }

    // Called when user presses START during Rest Timer (either early before 00:00, or during +00:xx overtime)
    function startNextSetFromRest() as Void {
        vibrateShort();
        setElapsedSec = 0;
        screenState = STATE_ACTIVE_SET;
        WatchUi.requestUpdate();
    }

    // Adjust rest timer target on the fly with UP (+15s) or DOWN (-15s)
    function adjustRestTarget(deltaSec as Number) as Void {
        restTargetSec += deltaSec;
        if (restTargetSec < 15) {
            restTargetSec = 15;
        } else if (restTargetSec > 600) {
            restTargetSec = 600;
        }
        // If user lowered target at or below current elapsed time and hasn't vibrated yet, trigger immediately
        if (!hasVibratedForRest && restElapsedSec >= restTargetSec) {
            hasVibratedForRest = true;
            vibrateRestComplete();
        }
        WatchUi.requestUpdate();
    }

    function openPauseMenu() as Void {
        previousWorkoutState = screenState;
        pauseMenuIdx = 0;
        screenState = STATE_PAUSE_MENU;
        // Pause the underlying FIT recording session while in Pause Menu
        if (_session != null && _session.isRecording()) {
            try {
                _session.stop();
            } catch (ex) {}
        }
        WatchUi.requestUpdate();
    }

    function resumeFromPauseMenu() as Void {
        if (_session != null && !_session.isRecording()) {
            try {
                _session.start();
            } catch (ex) {}
        }
        screenState = previousWorkoutState;
        WatchUi.requestUpdate();
    }

    function executePauseMenuAction() as Void {
        if (pauseMenuIdx == 0) {
            // Resume Workout
            resumeFromPauseMenu();
            return;
        } else if (pauseMenuIdx == 1) {
            // Skip Current Set
            if (_session != null && !_session.isRecording()) {
                try {
                    _session.start();
                } catch (ex) {}
            }
            if (previousWorkoutState == STATE_REST) {
                setElapsedSec = 0;
                screenState = STATE_ACTIVE_SET;
            } else if (currentStepIdx + 1 < steps.size()) {
                currentStepIdx += 1;
                setElapsedSec = 0;
                screenState = STATE_ACTIVE_SET;
            } else {
                finishAndSaveWorkout();
                return;
            }
        } else if (pauseMenuIdx == 2) {
            // Previous Set
            if (_session != null && !_session.isRecording()) {
                try {
                    _session.start();
                } catch (ex) {}
            }
            if (currentStepIdx > 0) {
                currentStepIdx -= 1;
            }
            setElapsedSec = 0;
            screenState = STATE_ACTIVE_SET;
        } else if (pauseMenuIdx == 3) {
            // Finish & Save
            finishAndSaveWorkout();
            return;
        } else if (pauseMenuIdx == 4) {
            // Discard Workout
            discardWorkout();
            return;
        }
        WatchUi.requestUpdate();
    }

    function finishAndSaveWorkout() as Void {
        stopTimer();
        if (_session != null) {
            try {
                if (_session.isRecording()) {
                    _session.stop();
                }
                _session.save();
            } catch (ex) {}
            _session = null;
        }
        vibrateWorkoutSaved();
        screenState = STATE_SUMMARY;
        WatchUi.requestUpdate();
    }

    function discardWorkout() as Void {
        stopTimer();
        if (_session != null) {
            try {
                if (_session.isRecording()) {
                    _session.stop();
                }
                _session.discard();
            } catch (ex) {}
            _session = null;
        }
        screenState = STATE_ROUTINE_LIST;
        WatchUi.requestUpdate();
    }

    function vibrateShort() as Void {
        if (Attention has :vibrate) {
            try {
                Attention.vibrate([new Attention.VibeProfile(75, 160)]);
            } catch (ex) {}
        }
    }

    function vibrateRestComplete() as Void {
        if (Attention has :vibrate) {
            try {
                var pulses = [
                    new Attention.VibeProfile(100, 350),
                    new Attention.VibeProfile(0, 150),
                    new Attention.VibeProfile(100, 350),
                    new Attention.VibeProfile(0, 150),
                    new Attention.VibeProfile(100, 600)
                ];
                Attention.vibrate(pulses);
            } catch (ex) {}
        }
        if (Attention has :playTone) {
            try {
                Attention.playTone(Attention.TONE_TIME_ALERT);
            } catch (ex) {}
        }
    }

    function vibrateWorkoutSaved() as Void {
        if (Attention has :vibrate) {
            try {
                var pulses = [
                    new Attention.VibeProfile(90, 180),
                    new Attention.VibeProfile(0, 100),
                    new Attention.VibeProfile(100, 450)
                ];
                Attention.vibrate(pulses);
            } catch (ex) {}
        }
        if (Attention has :playTone) {
            try {
                Attention.playTone(Attention.TONE_SUCCESS);
            } catch (ex) {}
        }
    }
}
