package com.playball.dynasty;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge is built. See BackPlugin.
        registerPlugin(BackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
