package com.playball.dynasty;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge is built. See BackPlugin.
        registerPlugin(BackPlugin.class);
        registerPlugin(DevicePlugin.class);
        super.onCreate(savedInstanceState);
        /*
          One text scale, the app's own (audit 17, L59). Left alone, the
          WebView turns Android's font size into a text zoom that multiplies
          every font size and line height but no box, on top of the in-app
          Text size: Larger at a system 1.3 was 1.69x, and fixed-height cards
          clipped. The phone's size seeds the in-app one on first launch
          instead (DevicePlugin.fontScale, read in devicePrefs.ts).
        */
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
