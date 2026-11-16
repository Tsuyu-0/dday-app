package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.List;

/** 큰 위젯: 다가오는 기념일 · 일정 4개 */
public class DdayListWidget extends AppWidgetProvider {
    static final int[] ROWS = { R.id.l_row1, R.id.l_row2, R.id.l_row3, R.id.l_row4 };
    static final int[] T = { R.id.l_row1_t, R.id.l_row2_t, R.id.l_row3_t, R.id.l_row4_t };
    static final int[] D = { R.id.l_row1_d, R.id.l_row2_d, R.id.l_row3_d, R.id.l_row4_d };

    @Override public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) { for (int id : ids) draw(ctx, m, id); }
    @Override public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager m, int id, Bundle o) { draw(ctx, m, id); }
    @Override public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) DdayWidget.updateAll(ctx);
    }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_list);
        List<JSONObject> list = DdayWidget.upcoming(ctx);
        v.setViewVisibility(R.id.l_empty, list.isEmpty() ? View.VISIBLE : View.GONE);
        for (int i = 0; i < 4; i++) {
            if (i < list.size()) {
                JSONObject o = list.get(i);
                long n = o.optLong("_n");
                v.setViewVisibility(ROWS[i], View.VISIBLE);
                v.setTextViewText(T[i], o.optString("t"));
                v.setTextViewText(D[i], DdayWidget.dd(n));
                v.setTextColor(D[i], n == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
            } else v.setViewVisibility(ROWS[i], View.GONE);
        }
        v.setOnClickPendingIntent(R.id.l_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
