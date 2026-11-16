package com.ppangsal.dday;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DdayWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /** 화면 위 캐릭터를 켜 둔 상태인데 꺼져 있으면(폰이 정리했으면) 앱을 열 때 다시 띄워요 */
    @Override
    public void onResume() {
        super.onResume();
        try {
            boolean on = getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).getBoolean("overlayOn", false);
            if (on && !OverlayService.running && OverlayService.canDraw(this))
                ContextCompat.startForegroundService(this, new Intent(this, OverlayService.class));
        } catch (Exception e) { }
    }
}
