package com.hagane.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.garmin.android.connectiq.ConnectIQ;
import com.garmin.android.connectiq.IQApp;
import com.garmin.android.connectiq.IQDevice;
import com.garmin.android.connectiq.exception.InvalidStateException;
import com.garmin.android.connectiq.exception.ServiceUnavailableException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "GarminSync")
public class GarminSyncPlugin extends Plugin {

    private static final String TAG = "HaganeGarminSync";

    // Shared App UUID with garmin-watch/manifest.xml
    public static final String HAGANE_WATCH_APP_ID = "a3f5c8d2-7b1e-4f9a-8c2d-5e6f7a8b9c0d";
    private static final String PREFS_NAME = "hagane_garmin_bridge";
    private static final String KEY_CACHED_PAYLOAD = "cached_english_payload";

    private ConnectIQ connectIQ;
    private boolean sdkReady = false;
    private boolean sdkInitializing = false;
    private final Set<Long> registeredDeviceIds = new HashSet<>();

    @Override
    public void load() {
        super.load();
        if (getActivity() != null) {
            getActivity().runOnUiThread(this::initGarminPassiveListener);
        }
    }

    /**
     * Caches the latest English workout payload in SharedPreferences and, if a paired
     * Garmin watch is connected, registers for watch pull requests ("SYNC_ROUTINES")
     * and pushes the updated payload to connected watches.
     */
    @PluginMethod
    public void cacheRoutinesForWatch(final PluginCall call) {
        final JSObject payloadObj = call.getObject("payload");
        if (payloadObj == null) {
            call.reject("Missing workout payload.");
            return;
        }

        final Context context = getContext();
        if (context == null) {
            call.reject("Android context unavailable.");
            return;
        }

        final String jsonStr = payloadObj.toString();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_CACHED_PAYLOAD, jsonStr).apply();

        if (getActivity() != null) {
            getActivity().runOnUiThread(() -> {
                initGarminPassiveListener();
                int pushedCount = 0;
                if (sdkReady) {
                    pushedCount = pushCachedPayloadToConnectedWatches();
                }
                JSObject res = new JSObject();
                res.put("success", true);
                res.put("cachedBytes", jsonStr.length());
                res.put("pushedDevices", pushedCount);
                res.put("status", sdkReady ? "SDK_READY" : "CACHED_WAITING_FOR_WATCH");
                call.resolve(res);
            });
        } else {
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("cachedBytes", jsonStr.length());
            res.put("pushedDevices", 0);
            res.put("status", "CACHED_ONLY");
            call.resolve(res);
        }
    }

    private void initGarminPassiveListener() {
        final Context context = getContext();
        if (context == null) return;

        try {
            if (connectIQ == null) {
                connectIQ = ConnectIQ.getInstance(context, ConnectIQ.IQConnectType.WIRELESS);
            }

            if (!sdkReady && !sdkInitializing) {
                sdkInitializing = true;
                // autoUI = false so Hagane never pops up intrusive dialogs on the phone
                connectIQ.initialize(context, false, new ConnectIQ.ConnectIQListener() {
                    @Override
                    public void onSdkReady() {
                        sdkReady = true;
                        sdkInitializing = false;
                        registeredDeviceIds.clear();
                        registerWatchRequestListeners();
                        pushCachedPayloadToConnectedWatches();
                    }

                    @Override
                    public void onInitializeError(ConnectIQ.IQSdkErrorStatus status) {
                        sdkReady = false;
                        sdkInitializing = false;
                        registeredDeviceIds.clear();
                        Log.w(TAG, "ConnectIQ SDK init error: " + (status != null ? status.name() : "UNKNOWN"));
                    }

                    @Override
                    public void onSdkShutDown() {
                        sdkReady = false;
                        sdkInitializing = false;
                        registeredDeviceIds.clear();
                    }
                });
            } else if (sdkReady) {
                registerWatchRequestListeners();
            }
        } catch (Exception e) {
            sdkInitializing = false;
            Log.w(TAG, "ConnectIQ init exception: " + e.getMessage());
        }
    }

    private void registerWatchRequestListeners() {
        if (!sdkReady || connectIQ == null) return;
        try {
            List<IQDevice> devices = connectIQ.getKnownDevices();
            if (devices == null || devices.isEmpty()) {
                devices = connectIQ.getConnectedDevices();
            }
            if (devices == null) return;

            final IQApp haganeWatchApp = new IQApp(HAGANE_WATCH_APP_ID);

            for (final IQDevice device : devices) {
                if (device == null) continue;
                final long deviceId = device.getDeviceIdentifier();
                if (registeredDeviceIds.contains(deviceId)) {
                    continue;
                }
                registeredDeviceIds.add(deviceId);

                // 1. Listen for watch reconnects over Bluetooth -> auto-push cached routines
                connectIQ.registerForDeviceEvents(
                    device,
                    new ConnectIQ.IQDeviceEventListener() {
                        @Override
                        public void onDeviceStatusChanged(
                            IQDevice iqDevice,
                            IQDevice.IQDeviceStatus newStatus
                        ) {
                            if (newStatus == IQDevice.IQDeviceStatus.CONNECTED) {
                                Log.d(TAG, "Watch connected (" + iqDevice.getFriendlyName() + "), pushing cached routines.");
                                sendCachedPayloadToDevice(iqDevice);
                            }
                        }
                    }
                );

                // 2. Listen for watch-initiated pull requests ("SYNC_ROUTINES")
                connectIQ.registerForAppEvents(
                    device,
                    haganeWatchApp,
                    new ConnectIQ.IQApplicationEventListener() {
                        @Override
                        public void onMessageReceived(
                            IQDevice iqDevice,
                            IQApp iqApp,
                            List<Object> messageData,
                            ConnectIQ.IQMessageStatus status
                        ) {
                            if (status == ConnectIQ.IQMessageStatus.SUCCESS) {
                                Log.d(TAG, "Received sync pull request from " + iqDevice.getFriendlyName());
                                sendCachedPayloadToDevice(iqDevice);
                            } else {
                                Log.w(TAG, "Watch message received with status: " + status);
                            }
                        }
                    }
                );
            }
        } catch (InvalidStateException e) {
            sdkReady = false;
            registeredDeviceIds.clear();
            Log.w(TAG, "ConnectIQ invalid state during listener registration: " + e.getMessage());
        } catch (ServiceUnavailableException e) {
            Log.w(TAG, "Garmin Connect service unavailable: " + e.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "Error registering watch listeners: " + e.getMessage());
        }
    }

    private int pushCachedPayloadToConnectedWatches() {
        if (!sdkReady || connectIQ == null) return 0;
        int count = 0;
        try {
            List<IQDevice> connected = connectIQ.getConnectedDevices();
            if (connected == null || connected.isEmpty()) return 0;

            // Prefer Forerunner / FR255 devices if multiple Garmin devices are connected
            List<IQDevice> targets = new ArrayList<>();
            for (IQDevice d : connected) {
                if (d == null) continue;
                String name = d.getFriendlyName() != null ? d.getFriendlyName().toLowerCase() : "";
                if (name.contains("forerunner") || name.contains("255") || name.contains("fr")) {
                    targets.add(d);
                }
            }
            if (targets.isEmpty()) {
                targets.addAll(connected);
            }

            for (IQDevice device : targets) {
                if (device != null) {
                    sendCachedPayloadToDevice(device);
                    count++;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error pushing to connected watches: " + e.getMessage());
        }
        return count;
    }

    private void sendCachedPayloadToDevice(final IQDevice targetWatch) {
        final Context context = getContext();
        if (context == null || connectIQ == null || !sdkReady || targetWatch == null) return;

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString(KEY_CACHED_PAYLOAD, null);
        if (jsonStr == null || jsonStr.isEmpty()) return;

        try {
            JSONObject payloadObj = new JSONObject(jsonStr);
            Map<String, Object> ciqMap = jsonObjectToMap(payloadObj);
            IQApp haganeWatchApp = new IQApp(HAGANE_WATCH_APP_ID);

            connectIQ.sendMessage(
                targetWatch,
                haganeWatchApp,
                ciqMap,
                new ConnectIQ.IQSendMessageListener() {
                    @Override
                    public void onMessageStatus(
                        IQDevice device,
                        IQApp app,
                        ConnectIQ.IQMessageStatus status
                    ) {
                        if (status == ConnectIQ.IQMessageStatus.SUCCESS) {
                            Log.d(TAG, "Synced routines to " + device.getFriendlyName());
                        } else {
                            Log.w(
                                TAG,
                                "Send message to " +
                                device.getFriendlyName() +
                                " returned status: " +
                                (status != null ? status.name() : "UNKNOWN")
                            );
                        }
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "Failed to send cached payload to watch: " + e.getMessage());
        }
    }

    private static Map<String, Object> jsonObjectToMap(JSONObject jsonObject) throws JSONException {
        Map<String, Object> map = new HashMap<>();
        Iterator<String> keys = jsonObject.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = jsonObject.get(key);
            if (value == JSONObject.NULL) {
                continue;
            }
            if (value instanceof JSONArray) {
                value = jsonArrayToList((JSONArray) value);
            } else if (value instanceof JSONObject) {
                value = jsonObjectToMap((JSONObject) value);
            }
            map.put(key, value);
        }
        return map;
    }

    private static List<Object> jsonArrayToList(JSONArray array) throws JSONException {
        List<Object> list = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            Object value = array.get(i);
            if (value == JSONObject.NULL) {
                continue;
            }
            if (value instanceof JSONArray) {
                value = jsonArrayToList((JSONArray) value);
            } else if (value instanceof JSONObject) {
                value = jsonObjectToMap((JSONObject) value);
            }
            list.add(value);
        }
        return list;
    }
}
