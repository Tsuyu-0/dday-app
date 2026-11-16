package com.ppangsal.dday;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.io.File;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 도장 카드: 다음 기념일까지 30칸. 날마다 위젯을 눌러 오늘 칸에 도장을 찍어요.
 * 도장은 캐릭터 얼굴(없으면 분홍 하트). 마지막 칸은 기념일 당일.
 */
public class DdayStampWidget extends WidgetBase {
    static final String ACT = "com.ppangsal.dday.STAMP";
    static final int CELLS = 30;

    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    @Override public void onReceive(Context ctx, Intent intent) {
        if (ACT.equals(intent.getAction())) {
            JSONObject f = target(ctx);
            if (f != null) {
                SharedPreferences sp = ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE);
                String key = key(f), today = ymd(Calendar.getInstance());
                Set<String> got = new HashSet<>(sp.getStringSet(key, new HashSet<>()));
                if (!got.contains(today) && f.optLong("_n") < CELLS) {
                    got.add(today);
                    sp.edit().putStringSet(key, got).apply();
                }
            }
            AppWidgetManager m = AppWidgetManager.getInstance(ctx);
            for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayStampWidget.class))) draw(ctx, m, id);
            return;
        }
        super.onReceive(ctx, intent);
    }

    static String ymd(Calendar c) { return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH)); }
    static String key(JSONObject f) { return "stamp:" + f.optString("t") + "|" + f.optString("d"); }

    /** 도장 카드에 쓸 기념일: 가장 가까운 기념일 (일정은 빼요) */
    static JSONObject target(Context ctx) {
        List<JSONObject> list = DdayWidget.upcoming(ctx);
        for (JSONObject o : list) if ("a".equals(o.optString("k"))) return o;
        return null;
    }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_stamp);
        float dp = ctx.getResources().getDisplayMetrics().density, k = Math.min(dp, 2.5f);
        Bundle opt = m.getAppWidgetOptions(id);
        int wd = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : 250;
        int hd = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 230) : 230;
        if (wd < 120) wd = 250; if (hd < 120) hd = 230;
        v.setImageViewBitmap(R.id.st_img, paint(ctx, (int) (Math.min(wd, 420) * k), (int) (Math.min(hd, 420) * k), k));
        Intent i = new Intent(ctx, DdayStampWidget.class).setAction(ACT);
        v.setOnClickPendingIntent(R.id.st_root, PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        v.setOnClickPendingIntent(R.id.st_head, DdayWidget.openApp(ctx)); // 위쪽 제목 줄을 누르면 앱 열기
        m.updateAppWidget(id, v);
    }

    static Bitmap paint(Context ctx, int W, int H, float k) {
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        float pad = 12 * k;
        JSONObject f = target(ctx);

        p.setTypeface(Typeface.DEFAULT_BOLD);
        if (f == null) {
            p.setTextAlign(Paint.Align.CENTER); p.setTextSize(14 * k); p.setColor(0xFF1B2230);
            cv.drawText("도장 카드", W / 2f, H / 2f - 8 * k, p);
            p.setTypeface(Typeface.DEFAULT); p.setTextSize(11 * k); p.setColor(0xFF7A8494);
            cv.drawText("앱에서 기념일을 넣으면 카드가 생겨요", W / 2f, H / 2f + 12 * k, p);
            return bm;
        }
        long n = f.optLong("_n");
        Set<String> got = ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).getStringSet(key(f), new HashSet<>());
        String today = ymd(Calendar.getInstance());

        // 머리: 제목 + D-day
        String dd = DdayWidget.dd(n);
        p.setTextSize(15 * k); p.setColor(n == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
        float ddw = p.measureText(dd);
        cv.drawText(dd, W - pad - ddw, pad + 14 * k, p);
        p.setTextSize(13 * k); p.setColor(0xFF1B2230);
        String title = f.optString("t");
        float maxw = W - pad * 2 - ddw - 8 * k;
        while (title.length() > 1 && p.measureText(title) > maxw) title = title.substring(0, title.length() - 1);
        if (!title.equals(f.optString("t"))) title = title.substring(0, Math.max(1, title.length() - 1)) + "…";
        cv.drawText(title, pad, pad + 14 * k, p);

        // 칸: 6 × 5, 마지막 칸 = 기념일 당일
        float top = pad + 24 * k, foot = 18 * k;
        int cols = 6, rows = CELLS / cols;
        float cw = (W - pad * 2) / cols, ch = (H - top - pad - foot) / rows;
        float r = Math.min(cw, ch) * 0.40f;
        Bitmap face = stampFace(ctx, (int) (r * 2));
        Calendar ann = Calendar.getInstance(); ann.add(Calendar.DAY_OF_MONTH, (int) n);
        int count = 0;
        Paint dash = new Paint(Paint.ANTI_ALIAS_FLAG);
        dash.setStyle(Paint.Style.STROKE); dash.setStrokeWidth(1.2f * k); dash.setPathEffect(new DashPathEffect(new float[] { 3 * k, 3 * k }, 0));
        for (int i = 0; i < CELLS; i++) {
            int before = CELLS - 1 - i; // 기념일 며칠 전 칸인지
            Calendar day = (Calendar) ann.clone(); day.add(Calendar.DAY_OF_MONTH, -before);
            String ds = ymd(day);
            int cmp = ds.compareTo(today);
            float cx = pad + cw * (i % cols) + cw / 2, cy = top + ch * (i / cols) + ch / 2;
            boolean stamped = got.contains(ds);
            if (stamped) count++;
            if (before == 0) { // 기념일 칸
                p.setStyle(Paint.Style.FILL); p.setColor(0xFFFFE3EE); cv.drawCircle(cx, cy, r, p);
                p.setColor(0xFFFF5C9A); p.setTextAlign(Paint.Align.CENTER); p.setTypeface(Typeface.DEFAULT_BOLD);
                p.setTextSize(r * 1.1f); cv.drawText("♥", cx, cy - (p.descent() + p.ascent()) / 2, p);
                if (stamped && face != null) cv.drawBitmap(face, cx - r, cy - r, null);
                continue;
            }
            if (stamped) {
                if (face != null) cv.drawBitmap(face, cx - r, cy - r, null);
                else { p.setStyle(Paint.Style.FILL); p.setColor(0xFFFF7FAE); cv.drawCircle(cx, cy, r, p);
                    p.setColor(0xFFFFFFFF); p.setTextAlign(Paint.Align.CENTER); p.setTextSize(r); cv.drawText("♥", cx, cy - (p.descent() + p.ascent()) / 2, p); }
                Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG); ring.setStyle(Paint.Style.STROKE); ring.setStrokeWidth(2 * k); ring.setColor(0xCCFF5C9A);
                cv.drawCircle(cx, cy, r, ring);
            } else if (cmp == 0) { // 오늘 칸: 찍어 달라고 반짝
                p.setStyle(Paint.Style.FILL); p.setColor(0xFFEAF0FF); cv.drawCircle(cx, cy, r, p);
                dash.setColor(0xFF4F7CFF); cv.drawCircle(cx, cy, r, dash);
                p.setColor(0xFF4F7CFF); p.setTextAlign(Paint.Align.CENTER); p.setTypeface(Typeface.DEFAULT_BOLD);
                p.setTextSize(r * 0.62f); cv.drawText("오늘", cx, cy - (p.descent() + p.ascent()) / 2, p);
            } else {
                dash.setColor(cmp < 0 ? 0xFFE3E7EE : 0xFFC9D2E0); cv.drawCircle(cx, cy, r, dash);
                p.setStyle(Paint.Style.FILL); p.setTypeface(Typeface.DEFAULT); p.setTextAlign(Paint.Align.CENTER);
                p.setColor(cmp < 0 ? 0xFFD3D8E0 : 0xFFA8B2C2); p.setTextSize(r * 0.55f);
                cv.drawText(String.valueOf(before), cx, cy - (p.descent() + p.ascent()) / 2, p);
            }
        }

        // 아래 한 줄
        p.setStyle(Paint.Style.FILL); p.setTypeface(Typeface.DEFAULT_BOLD); p.setTextAlign(Paint.Align.CENTER); p.setTextSize(11 * k);
        String msg;
        if (n >= CELLS) { msg = (n - CELLS + 1) + "일 뒤부터 도장을 찍을 수 있어요"; p.setColor(0xFF7A8494); }
        else if (got.contains(today)) { msg = n == 0 ? "오늘이에요! 도장 " + count + "개 모았어요" : "오늘 도장 쾅! · " + count + "개 모았어요"; p.setColor(0xFFFF5C9A); }
        else { msg = "눌러서 오늘 도장 찍기 · " + count + "개"; p.setColor(0xFF4F7CFF); }
        cv.drawText(msg, W / 2f, H - pad + 2 * k, p);
        return bm;
    }

    /** 도장 모양: 캐릭터 그림을 동그랗게 (얼굴 쪽 위를 크게) */
    static Bitmap stampFace(Context ctx, int size) {
        if (size < 4) return null;
        File img = new File(ctx.getFilesDir(), "widget_char.png");
        if (!img.exists()) return null;
        Bitmap src = BitmapFactory.decodeFile(img.getAbsolutePath());
        if (src == null) return null;
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setColor(0xFFFFF1F6);
        c.drawCircle(size / 2f, size / 2f, size / 2f, bg);
        // 그림 위쪽 60%(얼굴 부분)를 동그라미에 채워요
        float cropH = src.getHeight() * 0.6f, cropW = Math.min(src.getWidth(), cropH);
        float sc = size / cropW;
        Matrix mx = new Matrix();
        mx.setScale(sc, sc);
        mx.postTranslate(-(src.getWidth() - cropW) / 2f * sc, -src.getHeight() * 0.02f * sc);
        BitmapShader sh = new BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
        sh.setLocalMatrix(mx);
        Paint pp = new Paint(Paint.ANTI_ALIAS_FLAG); pp.setShader(sh);
        c.drawOval(new RectF(0, 0, size, size), pp);
        return out;
    }
}
