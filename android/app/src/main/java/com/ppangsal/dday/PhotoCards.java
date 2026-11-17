package com.ppangsal.dday;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/** 사진 카드 위젯 그리기: 앱의 기념일 카드처럼 사진 위에 하트 · 이름 · 날짜 · 큰 숫자 */
public class PhotoCards {
    static List<JSONObject> cards(Context ctx) {
        List<JSONObject> out = new ArrayList<>();
        JSONArray a = WidgetBase.data(ctx).optJSONArray("cards");
        if (a != null) for (int i = 0; i < a.length() && i < 4; i++) { JSONObject o = a.optJSONObject(i); if (o != null) { try { o.put("_i", i); } catch (Exception e) { } out.add(o); } }
        return out;
    }

    static String bigText(JSONObject c) {
        if ("since".equals(c.optString("mode"))) {
            long n = -DdayWidget.daysUntil(c.optString("s")) + 1;
            if (n >= 1) return n + "일";
        }
        long d = DdayWidget.daysUntil(c.optString("d"));
        return d < 0 ? "♥" : DdayWidget.dd(d);
    }

    static Bitmap img(Context ctx, int i) {
        File f = new File(ctx.getFilesDir(), "widget_card_" + i + ".img");
        return f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
    }

    static int tint(int c, float t) { // 흰색과 섞기
        return Color.rgb((int) (Color.red(c) * t + 255 * (1 - t)), (int) (Color.green(c) * t + 255 * (1 - t)), (int) (Color.blue(c) * t + 255 * (1 - t)));
    }

    static void heart(Canvas cv, float x, float y, float s, boolean pin) {
        Path p = new Path();
        p.moveTo(x + s * .5f, y + s * .92f);
        p.cubicTo(x - s * .05f, y + s * .55f, x + s * .02f, y + s * .05f, x + s * .5f, y + s * .28f);
        p.cubicTo(x + s * .98f, y + s * .05f, x + s * 1.05f, y + s * .55f, x + s * .5f, y + s * .92f);
        p.close();
        Paint f = new Paint(Paint.ANTI_ALIAS_FLAG); f.setColor(pin ? 0xFFFFD45C : 0xFFFFB3D0);
        f.setShadowLayer(s * .08f, 0, s * .04f, 0x40000000); cv.drawPath(p, f);
        Paint st = new Paint(Paint.ANTI_ALIAS_FLAG); st.setStyle(Paint.Style.STROKE); st.setStrokeWidth(s * .07f); st.setColor(0xFF3A3F4C); cv.drawPath(p, st);
    }

    static String fit(Paint p, String s, float w) {
        if (p.measureText(s) <= w) return s;
        while (s.length() > 1 && p.measureText(s + "…") > w) s = s.substring(0, s.length() - 1);
        return s + "…";
    }

    /** 카드 한 장 */
    static void card(Context ctx, Canvas cv, RectF r, JSONObject c, float k) {
        float rad = 16 * k;
        Path clip = new Path(); clip.addRoundRect(r, rad, rad, Path.Direction.CW);
        cv.save(); cv.clipPath(clip);
        int col; try { col = Color.parseColor(c.optString("color", "#4f7cff")); } catch (Exception e) { col = 0xFF4F7CFF; }
        Bitmap b = img(ctx, c.optInt("_i"));
        boolean photo = c.optBoolean("img") && b != null;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        if (photo) {
            float sc = Math.max(r.width() / b.getWidth(), r.height() / b.getHeight());
            float w = b.getWidth() * sc, h = b.getHeight() * sc;
            cv.drawBitmap(b, null, new RectF(r.centerX() - w / 2, r.centerY() - h / 2, r.centerX() + w / 2, r.centerY() + h / 2), p);
            Paint g = new Paint(); g.setShader(new LinearGradient(0, r.top, 0, r.bottom, new int[] { 0x88000000, 0x10000000, 0x10000000, 0x80000000 }, new float[] { 0, .42f, .55f, 1 }, Shader.TileMode.CLAMP));
            cv.drawRect(r, g);
        } else {
            Paint g = new Paint(); g.setShader(new LinearGradient(r.left, r.top, r.right, r.bottom, tint(col, .38f), tint(col, .14f), Shader.TileMode.CLAMP));
            cv.drawRect(r, g);
            if (b != null) { // 캐릭터 그림을 오른쪽 아래에
                float h = r.height() * .98f, w = h * b.getWidth() / b.getHeight();
                cv.drawBitmap(b, null, new RectF(r.right - w * .92f, r.bottom - h * .9f, r.right + w * .08f, r.bottom + h * .1f), p);
            }
        }
        int fg = photo ? Color.WHITE : 0xFF1B2230;
        float pad = 11 * k, hs = 22 * k;
        heart(cv, r.left + pad, r.top + pad, hs, c.optBoolean("pin"));
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(fg); t.setTypeface(Typeface.DEFAULT_BOLD);
        float tsz = Math.min(15 * k, r.height() * .13f); t.setTextSize(tsz);
        if (photo) t.setShadowLayer(3 * k, 0, 1 * k, 0x99000000);
        float tx = r.left + pad + hs + 6 * k, tw = r.right - tx - pad;
        String who = c.optString("who", ""), title = (who.isEmpty() ? "" : who + " ") + c.optString("t");
        cv.drawText(fit(t, title, tw), tx, r.top + pad + tsz * .95f, t);
        Paint d = new Paint(t); d.setTypeface(Typeface.DEFAULT); d.setTextSize(tsz * .74f); d.setColor(photo ? 0xE6FFFFFF : 0xFF5A6273);
        String sub = c.optString("date") + (c.optString("label").isEmpty() ? "" : " · " + c.optString("label"));
        cv.drawText(fit(d, sub, tw), tx, r.top + pad + tsz * 1.95f, d);
        Paint n = new Paint(t); n.setTextSize(Math.min(30 * k, r.height() * .27f)); n.setTextAlign(Paint.Align.RIGHT);
        if (!photo) n.setShadowLayer(4 * k, 0, 0, 0xCCFFFFFF);
        cv.drawText(bigText(c), r.right - pad, r.bottom - pad - n.descent() * .3f, n);
        cv.restore();
    }

    /** 위젯 그림 전체: 1장이면 크게, 여러 장이면 칸으로 */
    static Bitmap draw(Context ctx, int W, int H, float k, int max) {
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        List<JSONObject> cs = cards(ctx);
        if (cs.size() > max) cs = cs.subList(0, max);
        if (max > 1) { // 바탕 판
            Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setColor(0xF2FFFFFF);
            cv.drawRoundRect(new RectF(0, 0, W, H), 22 * k, 22 * k, bg);
        }
        if (cs.isEmpty()) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG); p.setColor(0xFF7A8494); p.setTextAlign(Paint.Align.CENTER); p.setTextSize(13 * k);
            if (max == 1) { Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setColor(0xF2FFFFFF); cv.drawRoundRect(new RectF(0, 0, W, H), 18 * k, 18 * k, bg); }
            cv.drawText("앱에서 기념일을 넣으면 카드가 생겨요", W / 2f, H / 2f, p);
            return bm;
        }
        float g = max > 1 ? 7 * k : 0, pad = max > 1 ? 8 * k : 0;
        int n = cs.size();
        int cols = n == 1 ? 1 : 2, rows = n <= 2 ? 1 : 2;
        float cw = (W - pad * 2 - g * (cols - 1)) / cols, ch = (H - pad * 2 - g * (rows - 1)) / rows;
        for (int i = 0; i < n; i++) {
            int cx = i % cols, cy = i / cols;
            float w = (n == 3 && i == 2) ? W - pad * 2 : cw; // 3장이면 마지막은 가로로 길게
            RectF r = new RectF(pad + cx * (cw + g), pad + cy * (ch + g), pad + cx * (cw + g) + w, pad + cy * (ch + g) + ch);
            card(ctx, cv, r, cs.get(i), k);
        }
        return bm;
    }
}
