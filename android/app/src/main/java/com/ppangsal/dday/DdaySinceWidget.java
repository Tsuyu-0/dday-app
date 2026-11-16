package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** 함께한 지 N일째: 시작 날짜가 있는 기념일을 오늘 기준으로 세요 + 다음 100일 단위까지 진행 막대 */
public class DdaySinceWidget extends WidgetBase {
    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_since);
        JSONArray arr = data(ctx).optJSONArray("since");
        JSONObject o = arr != null && arr.length() > 0 ? arr.optJSONObject(0) : null;
        if (o == null) {
            v.setTextViewText(R.id.n_title, "함께한 날");
            v.setTextViewText(R.id.n_days, "♥");
            v.setTextViewText(R.id.n_next, "앱에서 시작한 날(연도까지)을 넣은 기념일이 여기 떠요");
            v.setViewVisibility(R.id.n_bar, View.GONE);
        } else {
            long days = -DdayWidget.daysUntil(o.optString("s")) + 1;
            v.setTextViewText(R.id.n_title, o.optString("t"));
            if (days < 1) {
                v.setTextViewText(R.id.n_days, "D-" + (1 - days));
                v.setTextViewText(R.id.n_next, "시작하는 날까지");
                v.setViewVisibility(R.id.n_bar, View.GONE);
            } else {
                long goal = (days / 100 + 1) * 100, prev = goal - 100;
                v.setTextViewText(R.id.n_days, days + "일째");
                v.setTextViewText(R.id.n_next, days % 100 == 0 ? "오늘 " + days + "일!" : goal + "일까지 D-" + (goal - days));
                v.setViewVisibility(R.id.n_bar, View.VISIBLE);
                v.setProgressBar(R.id.n_bar, 100, (int) (days - prev), false);
            }
        }
        v.setOnClickPendingIntent(R.id.n_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
