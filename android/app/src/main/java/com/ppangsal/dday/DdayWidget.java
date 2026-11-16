package com.ppangsal.dday;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/** 홈 화면 위젯: 캐릭터 + 다음 기념일 D-day + 그다음 두 개. 날짜가 바뀌면 숫자도 다시 세요. */
public class DdayWidget extends AppWidgetProvider {
    static final String PREFS = "dday_widget";

    /** 모든 종류의 위젯을 다시 그려요 */
    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayWidget.class))) draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayListWidget.class))) DdayListWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdaySmallWidget.class))) DdaySmallWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayCharWidget.class))) DdayCharWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayTodayWidget.class))) DdayTodayWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayCalWidget.class))) DdayCalWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdaySinceWidget.class))) DdaySinceWidget.draw(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, DdayStampWidget.class))) DdayStampWidget.draw(ctx, m, id);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) draw(ctx, m, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle opts) {
        draw(ctx, m, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) updateAll(ctx);
    }

    static long daysUntil(String ymd) {
        try {
            String[] p = ymd.split("-");
            Calendar t = Calendar.getInstance();
            t.set(Calendar.HOUR_OF_DAY, 0); t.set(Calendar.MINUTE, 0); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
            Calendar d = (Calendar) t.clone();
            d.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
            return Math.round((d.getTimeInMillis() - t.getTimeInMillis()) / 86400000.0);
        } catch (Exception e) { return Long.MIN_VALUE; }
    }

    static String dd(long n) { return n == 0 ? "D-DAY" : "D-" + n; }

    /** 저장된 목록에서 오늘 이후 것만, 가까운 순으로 */
    static List<JSONObject> upcoming(Context ctx) {
        List<JSONObject> list = new ArrayList<>();
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", null);
            if (raw != null) {
                JSONArray arr = new JSONObject(raw).optJSONArray("items");
                if (arr != null) for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    long n = daysUntil(o.optString("d"));
                    if (n >= 0 && n != Long.MIN_VALUE) { o.put("_n", n); list.add(o); }
                }
            }
        } catch (Exception e) { /* 비어 있으면 안내 문구 */ }
        list.sort((a, b) -> Long.compare(a.optLong("_n"), b.optLong("_n")));
        return list;
    }

    static PendingIntent openApp(Context ctx) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_dday);
        List<JSONObject> list = upcoming(ctx);

        if (list.isEmpty()) {
            v.setTextViewText(R.id.w_label, "다음 기념일");
            v.setTextViewText(R.id.w_title, "앱을 열어 기념일을 넣어 주세요");
            v.setTextViewText(R.id.w_dd, "♥");
        } else {
            JSONObject f = list.get(0);
            long n = f.optLong("_n");
            v.setTextViewText(R.id.w_label, n == 0 ? "오늘이에요!" : "다음 기념일");
            v.setTextViewText(R.id.w_title, f.optString("t"));
            v.setTextViewText(R.id.w_dd, dd(n));
            v.setTextColor(R.id.w_dd, n == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
        }
        int[] rows = { R.id.w_row1, R.id.w_row2 }, rt = { R.id.w_row1_t, R.id.w_row2_t }, rd = { R.id.w_row1_d, R.id.w_row2_d };
        for (int i = 0; i < 2; i++) {
            if (list.size() > i + 1) {
                JSONObject o = list.get(i + 1);
                v.setViewVisibility(rows[i], View.VISIBLE);
                v.setTextViewText(rt[i], o.optString("t"));
                v.setTextViewText(rd[i], dd(o.optLong("_n")));
            } else v.setViewVisibility(rows[i], View.GONE);
        }
        // 위젯이 작으면 아래 줄은 숨겨요
        Bundle opt = m.getAppWidgetOptions(id);
        int h = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120) : 120;
        if (h < 100) { v.setViewVisibility(R.id.w_row1, View.GONE); v.setViewVisibility(R.id.w_row2, View.GONE); }

        File img = new File(ctx.getFilesDir(), "widget_char.png");
        Bitmap bm = img.exists() ? BitmapFactory.decodeFile(img.getAbsolutePath()) : null;
        if (bm != null) { v.setImageViewBitmap(R.id.w_char, bm); v.setViewVisibility(R.id.w_char, View.VISIBLE); }
        else v.setViewVisibility(R.id.w_char, View.GONE);

        v.setOnClickPendingIntent(R.id.w_root, openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
