package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import org.json.JSONObject;

/** 새 위젯들이 같이 쓰는 뼈대: 날짜가 바뀌면 전부 다시 그려요 */
public abstract class WidgetBase extends AppWidgetProvider {
    abstract void render(Context ctx, AppWidgetManager m, int id);

    @Override public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) { for (int id : ids) render(ctx, m, id); }
    @Override public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) { render(ctx, m, id); }
    @Override public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) DdayWidget.updateAll(ctx);
    }

    static JSONObject data(Context ctx) {
        try {
            String raw = ctx.getSharedPreferences(DdayWidget.PREFS, Context.MODE_PRIVATE).getString("data", null);
            return raw == null ? new JSONObject() : new JSONObject(raw);
        } catch (Exception e) { return new JSONObject(); }
    }
}
