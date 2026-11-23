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
import com.getcapacitor.annotation.ActivityCallback;
import androidx.activity.result.ActivityResult;
import android.app.Activity;
import android.database.Cursor;
import android.provider.OpenableColumns;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
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
        // 페어 같이 띄우기: 사람마다 그림 (최대 5장)
        String oj = call.getString("ovImgs", null);
        if (oj != null) {
            try {
                org.json.JSONArray arr = new org.json.JSONArray(oj);
                for (int i = 0; i < 5; i++) {
                    File f = new File(ctx.getFilesDir(), "ov_m_" + i + ".png");
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

    /* 페어 대화 들어 보기 (i: 몇 번째 대화, -1이면 아무거나) */
    @PluginMethod
    public void overlayTalk(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject(); r.put("ok", OverlayService.running);
        if (OverlayService.running) { try { ctx.startService(new Intent(ctx, OverlayService.class).setAction(OverlayService.ACT_TALK).putExtra("i", call.getInt("i", -1))); } catch (Exception e) { } }
        call.resolve(r);
    }

    /* 파일 저장: 안드로이드 '저장 위치 고르기' 창 (다운로드 · 드라이브 등). 권한이 필요 없어요 */
    @PluginMethod
    public void saveDoc(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/octet-stream");
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "file.json"));
        startActivityForResult(call, i, "saveDocDone");
    }
    @ActivityCallback
    private void saveDocDone(PluginCall call, ActivityResult r) {
        if (call == null) return;
        JSObject o = new JSObject();
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { o.put("ok", false); call.resolve(o); return; }
        Uri u = r.getData().getData();
        try (OutputStream os = getContext().getContentResolver().openOutputStream(u, "wt")) {
            if (os == null) throw new Exception("no stream");
            os.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            o.put("ok", true); call.resolve(o);
        } catch (Exception e) { call.reject("저장하지 못했어요: " + e.getMessage()); }
    }

    /* 파일 불러오기: 모든 파일을 고를 수 있는 창 (.ddchar · .ddtalk · 백업 파일이 흐리게 막히지 않게) */
    @PluginMethod
    public void openDoc(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(call, i, "openDocDone");
    }
    @ActivityCallback
    private void openDocDone(PluginCall call, ActivityResult r) {
        if (call == null) return;
        JSObject o = new JSObject();
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null || r.getData().getData() == null) { o.put("ok", false); call.resolve(o); return; }
        Uri u = r.getData().getData();
        String name = "file";
        try (Cursor c = getContext().getContentResolver().query(u, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) { String n = c.getString(0); if (n != null) name = n; }
        } catch (Exception e) { }
        try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
            if (in == null) throw new Exception("no stream");
            ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            o.put("ok", true); o.put("name", name); o.put("text", new String(bo.toByteArray(), StandardCharsets.UTF_8));
            call.resolve(o);
        } catch (Exception e) { call.reject("불러오지 못했어요: " + e.getMessage()); }
    }

    @PluginMethod
    public void overlayStop(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).edit().putBoolean("overlayOn", false).apply();
        ctx.stopService(new Intent(ctx, OverlayService.class));
        call.resolve(new JSObject());
    }
}
