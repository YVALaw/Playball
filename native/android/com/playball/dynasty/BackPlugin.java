package com.playball.dynasty;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The system back gesture, handed to the page — but only while the page has
 * something to close.
 *
 * Stage 18b. Measured on an Android 16 emulator on September 6 2026: with
 * Capacitor 8 alone, nothing native ever called `goBack()`, the WebView did
 * not claim the gesture on its own, and the system classified every press as
 * TYPE_RETURN_TO_HOME — the app left from any depth, and the page's own
 * History-based handler was unreachable in the APK.
 *
 * One callback, disabled until the page arms it. Armed, the system routes
 * the gesture here and we tell the page, which peels one layer exactly as it
 * does in a browser. Disarmed — HOME with nothing open — the system's own
 * default runs, which is the predictive return-to-home preview and the exit.
 * That is the whole reason this is a toggle rather than an always-on handler
 * like @capacitor/app's: an enabled callback tells Android the app will
 * consume the gesture, and Android then never previews the exit.
 */
@CapacitorPlugin(name = "Back")
public class BackPlugin extends Plugin {

    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                notifyListeners("back", new JSObject(), true);
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback);
    }

    /** `{ armed: boolean }` — whether the page currently has a layer to close. */
    @PluginMethod
    public void arm(PluginCall call) {
        final boolean armed = Boolean.TRUE.equals(call.getBoolean("armed", false));
        getActivity().runOnUiThread(() -> callback.setEnabled(armed));
        call.resolve();
    }
}
