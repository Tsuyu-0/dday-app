package com.ppangsal.dday;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.io.File;
import java.util.List;

/** 캐릭터 크게: 캐릭터 + 한마디 말풍선 + D-day */
public class DdayCharWidget extends WidgetBase {
    @Override void render(Context c, AppWidgetManager m, int id) { draw(c, m, id); }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_char);
        List<JSONObject> list = DdayWidget.upcoming(ctx);
        JSONObject d = data(ctx);
        if (list.isEmpty()) {
            v.setTextViewText(R.id.c_line, "기념일을 알려 주면 내가 챙겨 줄게!");
            v.setTextViewText(R.id.c_title, "앱을 열어 기념일 넣기");
            v.setTextViewText(R.id.c_dd, "♥");
        } else {
            JSONObject f = list.get(0);
            long n = f.optLong("_n");
            String line = d.optString("line", "");
            // 저장된 한마디가 오래됐으면(날이 바뀌었으면) 숫자를 다시 세서 말해요
            if (line.isEmpty() || !line.contains(n == 0 ? "오늘" : String.valueOf(n))) line = n == 0 ? "오늘이야! " + f.optString("t") : f.optString("t") + "까지 " + n + "일 남았어";
            v.setTextViewText(R.id.c_line, line);
            v.setTextViewText(R.id.c_title, f.optString("t"));
            v.setTextViewText(R.id.c_dd, DdayWidget.dd(n));
            v.setTextColor(R.id.c_dd, n == 0 ? 0xFFFF5C9A : 0xFF4F7CFF);
        }
        String name = d.optString("name", "");
        v.setTextViewText(R.id.c_name, name);
        v.setViewVisibility(R.id.c_name, name.isEmpty() ? View.GONE : View.VISIBLE);
        File img = new File(ctx.getFilesDir(), "widget_char.png");
        Bitmap bm = img.exists() ? BitmapFactory.decodeFile(img.getAbsolutePath()) : null;
        if (bm != null) v.setImageViewBitmap(R.id.c_img, bm); else v.setImageViewResource(R.id.c_img, R.mipmap.ic_launcher_foreground);
        v.setOnClickPendingIntent(R.id.c_root, DdayWidget.openApp(ctx));
        m.updateAppWidget(id, v);
    }
}
