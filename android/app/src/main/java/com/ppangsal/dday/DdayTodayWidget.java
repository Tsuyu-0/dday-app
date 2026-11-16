package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/** 오늘 · 내일: 오늘과 내일 있는 기념일 · 일정을 시간 순으로 */
public class DdayTodayWidget extends WidgetBase {
    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);
        Calendar now = Calendar.getInstance();
        String[] wd = { "일", "월", "화", "수", "목", "금", "토" };
        v.setTextViewText(R.id.t_date, (now.get(Calendar.MONTH) + 1) + "월 " + now.get(Calendar.DAY_OF_MONTH) + "일 " + wd[now.get(Calendar.DAY_OF_WEEK) - 1] + "요일");

        List<JSONObject> all = DdayWidget.upcoming(ctx), pick = new ArrayList<>();
        for (JSONObject o : all) if (o.optLong("_n") <= 1) pick.add(o);
        pick.sort((a, b) -> {
            int c = Long.compare(a.optLong("_n"), b.optLong("_n"));
            if (c != 0) return c;
            String ta = a.optString("tm", ""), tb = b.optString("tm", "");
            return (ta.isEmpty() ? "00" : ta).compareTo(tb.isEmpty() ? "00" : tb);
        });

        int[] rows = { R.id.t_row1, R.id.t_row2, R.id.t_row3, R.id.t_row4 };
        int[] rw = { R.id.t_row1_w, R.id.t_row2_w, R.id.t_row3_w, R.id.t_row4_w };
        int[] rt = { R.id.t_row1_t, R.id.t_row2_t, R.id.t_row3_t, R.id.t_row4_t };
        int[] rk = { R.id.t_row1_k, R.id.t_row2_k, R.id.t_row3_k, R.id.t_row4_k };
        for (int i = 0; i < 4; i++) {
            if (i < pick.size()) {
                JSONObject o = pick.get(i);
                boolean today = o.optLong("_n") == 0, ann = "a".equals(o.optString("k"));
                String tm = o.optString("tm", "");
                v.setViewVisibility(rows[i], View.VISIBLE);
                v.setTextViewText(rw[i], (today ? "오늘" : "내일") + (tm.isEmpty() ? "" : " " + tm));
                v.setTextColor(rw[i], today ? 0xFFFF5C9A : 0xFF7A8494);
                v.setTextViewText(rt[i], o.optString("t"));
                v.setTextViewText(rk[i], ann ? "♥" : "●");
                v.setTextColor(rk[i], ann ? 0xFFFF7FAE : 0xFF4F7CFF);
            } else v.setViewVisibility(rows[i], View.GONE);
        }
        v.setViewVisibility(R.id.t_empty, pick.isEmpty() ? View.VISIBLE : View.GONE);
        if (pick.isEmpty()) {
            String next = all.isEmpty() ? "앱에서 일정을 넣어 보세요" : "다음: " + all.get(0).optString("t") + " · " + DdayWidget.dd(all.get(0).optLong("_n"));
            v.setTextViewText(R.id.t_empty, "오늘 · 내일은 비어 있어요\n" + next);
        }
        v.setOnClickPendingIntent(R.id.t_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
