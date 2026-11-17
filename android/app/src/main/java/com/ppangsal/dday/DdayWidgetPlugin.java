package com.ppangsal.dday;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
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
        // 사진 카드 위젯용 그림 (최대 4장)
        String cj = call.getString("cardImgs", null);
        if (cj != null) {
            try {
                org.json.JSONArray arr = new org.json.JSONArray(cj);
                for (int i = 0; i < 4; i++) {
                    File f = new File(ctx.getFilesDir(), "widget_card_" + i + ".img");
                    String s = i < arr.length() ? arr.optString(i, "") : "";
                    if (s.isEmpty()) { f.delete(); continue; }
                    int comma = s.indexOf(',');
                    byte[] bytes = Base64.decode(comma >= 0 ? s.substring(comma + 1) : s, Base64.DEFAULT);
                    try (FileOutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                }
            } catch (Exception e) { }
        }
        DdayWidget.updateAll(ctx);
        if (OverlayService.running) { try { ctx.startService(new Intent(ctx, OverlayService.class).setAction(OverlayService.ACT_REFRESH)); } catch (Exception e) { } }
        call.resolve(new JSObject());
    }

    /* ---- 폰 화면 위 캐릭터 ---- */
    @PluginMethod
    public void overlayStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", OverlayService.canDraw(getContext()));
        r.put("running", OverlayService.running);
        call.resolve(r);
    }

    @PluginMethod
    public void overlayPermission(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { ctx.startActivity(i); } catch (Exception e) { }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void overlayStart(PluginCall call) {
        Context ctx = getContext();
        if (!OverlayService.canDraw(ctx)) { JSObject r = new JSObject(); r.put("ok", false); call.resolve(r); return; }
        ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).edit().putBoolean("overlayOn", true).apply();
        ContextCompat.startForegroundService(ctx, new Intent(ctx, OverlayService.class));
        JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
    }

    @PluginMethod
    public void overlayStop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).edit().putBoolean("overlayOn", false).apply();
        ctx.stopService(new Intent(ctx, OverlayService.class));
        call.resolve(new JSObject());
    }
}
