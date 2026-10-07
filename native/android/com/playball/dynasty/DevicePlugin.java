package com.playball.dynasty;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What the page cannot read about the phone for itself.
 *
 * `fontScale` is Android's font size setting (1 is the default). MainActivity
 * turns the WebView's own text zoom off, so the app seeds its Text size from
 * this once, on first launch, and from then on its own setting is the only
 * multiplier (audit 17, L59).
 */
@CapacitorPlugin(name = "Device")
public class DevicePlugin extends Plugin {
    @PluginMethod
    public void fontScale(PluginCall call) {
        JSObject out = new JSObject();
        out.put("scale", getContext().getResources().getConfiguration().fontScale);
        call.resolve(out);
    }
}
