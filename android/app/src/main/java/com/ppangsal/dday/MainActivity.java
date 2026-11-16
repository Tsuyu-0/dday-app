package com.ppangsal.dday;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DdayWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
