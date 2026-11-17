package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

/** 사진 카드 위젯 (1장) */
public class DdayPhotoWidget extends WidgetBase {
    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_photo);
        float dp = ctx.getResources().getDisplayMetrics().density, k = Math.min(dp, 2.4f);
        Bundle o = m.getAppWidgetOptions(id);
        int wd = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0) : 0;
        int hd = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) : 0;
        if (wd < 100) wd = 1 == 1 ? 180 : 320; if (hd < 80) hd = 1 == 1 ? 110 : 200;
        wd = Math.min(wd, 460); hd = Math.min(hd, 460);
        v.setImageViewBitmap(R.id.ph_img, PhotoCards.draw(ctx, (int) (wd * k), (int) (hd * k), k, 1));
        v.setOnClickPendingIntent(R.id.ph_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
