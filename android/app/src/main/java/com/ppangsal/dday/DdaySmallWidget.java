package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.List;

/** 작은 위젯: 가장 가까운 날 하나 */
public class DdaySmallWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) { for (int id : ids) draw(ctx, m, id); }
    @Override public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (Intent.ACTION_DATE_CHANGED.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) DdayWidget.updateAll(ctx);
    }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_small);
        List<JSONObject> list = DdayWidget.upcoming(ctx);
        if (list.isEmpty()) {
            v.setTextViewText(R.id.s_title, "기념일을 넣어 주세요");
            v.setTextViewText(R.id.s_dd, "♥");
        } else {
            JSONObject o = list.get(0);
            long n = o.optLong("_n");
            v.setTextViewText(R.id.s_title, o.optString("t"));
            v.setTextViewText(R.id.s_dd, DdayWidget.dd(n));
            v.setTextColor(R.id.s_dd, n == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
        }
        v.setOnClickPendingIntent(R.id.s_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
