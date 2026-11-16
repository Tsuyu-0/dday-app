package com.ppangsal.dday;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

/** 웹 화면 → 홈 화면 위젯: 다음 기념일 목록과 캐릭터 그림을 저장하고 위젯을 새로 그려요. */
@CapacitorPlugin(name = "DdayWidget")
public class DdayWidgetPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        Context ctx = getContext();
        String data = call.getString("data", "{}");
        String png = call.getString("image", null);
        SharedPreferences.Editor ed = ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).edit();
        ed.putString("data", data);
        ed.apply();
        if (png != null && png.length() > 0) {
            try {
                int comma = png.indexOf(',');
                byte[] bytes = Base64.decode(comma >= 0 ? png.substring(comma + 1) : png, Base64.DEFAULT);
                File f = new File(ctx.getFilesDir(), "widget_char.png");
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
            } catch (Exception e) { /* 그림이 없어도 위젯은 그려요 */ }
        }
        DdayWidget.updateAll(ctx);
        call.resolve(new JSObject());
    }
}
