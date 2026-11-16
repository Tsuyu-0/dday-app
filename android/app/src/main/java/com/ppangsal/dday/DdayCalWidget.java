package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.List;

/** 이번 달 달력: 오늘 동그라미 + 기념일(분홍) · 일정(파랑) 점. 그림 한 장으로 그려서 넣어요 */
public class DdayCalWidget extends WidgetBase {
    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_cal);
        float dp = ctx.getResources().getDisplayMetrics().density;
        Bundle opt = m.getAppWidgetOptions(id);
        int wd = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : 250;
        int hd = opt != null ? opt.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 250) : 250;
        if (wd < 120) wd = 250; if (hd < 120) hd = 250;
        float k = Math.min(dp, 2.5f);
        int W = (int) (Math.min(wd, 420) * k), H = (int) (Math.min(hd, 420) * k);
        v.setImageViewBitmap(R.id.cal_img, paint(ctx, W, H, k));
        v.setOnClickPendingIntent(R.id.cal_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }

    static Bitmap paint(Context ctx, int W, int H, float k) {
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Calendar t = Calendar.getInstance();
        int y = t.get(Calendar.YEAR), mo = t.get(Calendar.MONTH), today = t.get(Calendar.DAY_OF_MONTH);

        // 이번 달 표시할 날: 1=일정, 2=기념일, 3=둘 다
        int[] mark = new int[32];
        List<JSONObject> list = DdayWidget.upcoming(ctx);
        String pre = y + "-" + String.format("%02d", mo + 1) + "-";
        for (JSONObject o : list) {
            String d = o.optString("d");
            if (!d.startsWith(pre)) continue;
            try { int dd = Integer.parseInt(d.substring(8, 10)); mark[dd] |= "a".equals(o.optString("k")) ? 2 : 1; } catch (Exception e) { }
        }

        float pad = 12 * k, top = pad;
        p.setTypeface(Typeface.DEFAULT_BOLD);
        p.setTextSize(15 * k); p.setColor(0xFF1B2230);
        cv.drawText((mo + 1) + "월", pad, top + 15 * k, p);
        p.setTextSize(11 * k); p.setColor(0xFF7A8494);
        cv.drawText(String.valueOf(y), pad + p.measureText("00") + 30 * k, top + 15 * k, p);
        // 오른쪽 위: 다음 D-day
        if (!list.isEmpty()) {
            JSONObject f = list.get(0);
            String s = DdayWidget.dd(f.optLong("_n"));
            p.setTextSize(13 * k); p.setColor(f.optLong("_n") == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
            cv.drawText(s, W - pad - p.measureText(s), top + 15 * k, p);
        }
        top += 26 * k;

        Calendar c = Calendar.getInstance(); c.set(y, mo, 1);
        int first = c.get(Calendar.DAY_OF_WEEK) - 1, last = c.getActualMaximum(Calendar.DAY_OF_MONTH);
        int rows = (first + last + 6) / 7;
        float cw = (W - pad * 2) / 7f;
        String[] wdn = { "일", "월", "화", "수", "목", "금", "토" };
        p.setTypeface(Typeface.DEFAULT); p.setTextSize(10 * k); p.setTextAlign(Paint.Align.CENTER);
        for (int i = 0; i < 7; i++) {
            p.setColor(i == 0 ? 0xFFE06C8C : i == 6 ? 0xFF6C8CE0 : 0xFF9AA3B2);
            cv.drawText(wdn[i], pad + cw * i + cw / 2, top + 10 * k, p);
        }
        top += 16 * k;
        float ch = (H - top - pad * 0.6f) / rows;
        float r = Math.min(cw, ch) * 0.40f;
        p.setTextSize(Math.min(12 * k, ch * 0.42f));
        for (int d = 1; d <= last; d++) {
            int idx = first + d - 1, col = idx % 7, row = idx / 7;
            float cx = pad + cw * col + cw / 2, cy = top + ch * row + ch * 0.42f;
            boolean isT = d == today;
            if (isT) { p.setColor(0xFF4F7CFF); cv.drawCircle(cx, cy, r, p); }
            p.setTypeface(isT ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            p.setColor(isT ? 0xFFFFFFFF : d < today ? 0xFFB8BFCC : col == 0 ? 0xFFE06C8C : col == 6 ? 0xFF6C8CE0 : 0xFF3A4354);
            cv.drawText(String.valueOf(d), cx, cy - (p.descent() + p.ascent()) / 2, p);
            int mk = mark[d];
            if (mk != 0) {
                float dy = cy + r + 2.5f * k, dr = 2.2f * k;
                if (mk == 3) {
                    p.setColor(0xFFFF7FAE); cv.drawCircle(cx - dr * 1.5f, dy, dr, p);
                    p.setColor(0xFF4F7CFF); cv.drawCircle(cx + dr * 1.5f, dy, dr, p);
                } else { p.setColor(mk == 2 ? 0xFFFF7FAE : 0xFF4F7CFF); cv.drawCircle(cx, dy, dr, p); }
            }
        }
        return bm;
    }
}
