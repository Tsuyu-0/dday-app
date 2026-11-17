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

    static String style(Context ctx) { return "photo"; }

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

    /** 카드 한 장 (꾸미기 모양에 따라) */
    static void card(Context ctx, Canvas cv, RectF r, JSONObject c, float k, String st, int idx) {
        switch (st) {
            case "polaroid": cardPolaroid(ctx, cv, r, c, k, idx); break;
            case "sticker": cardSticker(ctx, cv, r, c, k, idx); break;
            case "minimal": cardMinimal(ctx, cv, r, c, k); break;
            case "night": cardNight(ctx, cv, r, c, k); break;
            default: cardPhoto(ctx, cv, r, c, k);
        }
    }

    static int colorOf(JSONObject c) { try { return Color.parseColor(c.optString("color", "#4f7cff")); } catch (Exception e) { return 0xFF4F7CFF; } }
    static String titleOf(JSONObject c) { String who = c.optString("who", ""); return (who.isEmpty() ? "" : who + " ") + c.optString("t"); }
    static String subOf(JSONObject c) { return c.optString("date") + (c.optString("label").isEmpty() ? "" : " · " + c.optString("label")); }
    static void cover(Canvas cv, Bitmap b, RectF r, Paint p) {
        float sc = Math.max(r.width() / b.getWidth(), r.height() / b.getHeight()), w = b.getWidth() * sc, h = b.getHeight() * sc;
        cv.save(); cv.clipRect(r); cv.drawBitmap(b, null, new RectF(r.centerX() - w / 2, r.centerY() - h / 2, r.centerX() + w / 2, r.centerY() + h / 2), p); cv.restore();
    }
    static void contain(Canvas cv, Bitmap b, RectF r, Paint p) {
        float sc = Math.min(r.width() / b.getWidth(), r.height() / b.getHeight()), w = b.getWidth() * sc, h = b.getHeight() * sc;
        cv.drawBitmap(b, null, new RectF(r.centerX() - w / 2, r.bottom - h, r.centerX() + w / 2, r.bottom), p);
    }

    /** 폴라로이드: 하얀 테두리 사진 + 아래 글씨 + 마스킹테이프, 살짝 기울어짐 */
    static void cardPolaroid(Context ctx, Canvas cv, RectF r0, JSONObject c, float k, int idx) {
        float ang = (idx % 2 == 0 ? -1.6f : 1.8f);
        RectF r = new RectF(r0.left + 4 * k, r0.top + 6 * k, r0.right - 4 * k, r0.bottom - 3 * k);
        cv.save(); cv.rotate(ang, r.centerX(), r.centerY());
        Paint w = new Paint(Paint.ANTI_ALIAS_FLAG); w.setColor(0xFFFFFFFF); w.setShadowLayer(5 * k, 0, 2 * k, 0x38000000);
        cv.drawRoundRect(r, 4 * k, 4 * k, w);
        float m = 7 * k, capH = Math.max(r.height() * .3f, 30 * k);
        RectF ph = new RectF(r.left + m, r.top + m, r.right - m, r.bottom - capH);
        Bitmap b = img(ctx, c.optInt("_i")); int col = colorOf(c);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        if (c.optBoolean("img") && b != null) cover(cv, b, ph, p);
        else { Paint g = new Paint(); g.setShader(new LinearGradient(ph.left, ph.top, ph.right, ph.bottom, tint(col, .3f), tint(col, .12f), Shader.TileMode.CLAMP)); cv.drawRect(ph, g); if (b != null) { cv.save(); cv.clipRect(ph); contain(cv, b, new RectF(ph.left, ph.top + ph.height() * .05f, ph.right, ph.bottom + ph.height() * .05f), p); cv.restore(); } }
        // 마스킹테이프
        Paint tp = new Paint(Paint.ANTI_ALIAS_FLAG); tp.setColor((tint(col, .45f) & 0x00FFFFFF) | 0xB0000000);
        cv.save(); cv.rotate(-ang * 2.5f, r.centerX(), r.top);
        cv.drawRect(r.centerX() - 22 * k, r.top - 7 * k, r.centerX() + 22 * k, r.top + 7 * k, tp); cv.restore();
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xFF2A2F3A); t.setTypeface(Typeface.DEFAULT_BOLD);
        float tsz = Math.min(13 * k, capH * .3f); t.setTextSize(tsz);
        Paint n = new Paint(Paint.ANTI_ALIAS_FLAG); n.setColor(0xFF1B2230); n.setTypeface(Typeface.DEFAULT_BOLD); n.setTextSize(Math.min(22 * k, capH * .55f)); n.setTextAlign(Paint.Align.RIGHT);
        String big = bigText(c); float bw = n.measureText(big);
        float cy = ph.bottom + (r.bottom - ph.bottom) / 2;
        cv.drawText(fit(t, titleOf(c), r.width() - m * 2 - bw - 8 * k), r.left + m, cy - 1 * k, t);
        Paint d = new Paint(t); d.setTypeface(Typeface.DEFAULT); d.setTextSize(tsz * .78f); d.setColor(0xFF8A90A0);
        cv.drawText(fit(d, subOf(c), r.width() - m * 2 - bw - 8 * k), r.left + m, cy + tsz * .95f, d);
        n.setColor(c.optBoolean("pin") ? 0xFFE0457B : 0xFF1B2230);
        cv.drawText(big, r.right - m, cy + n.getTextSize() * .35f, n);
        cv.restore();
    }

    /** 다꾸 스티커: 파스텔 바탕 + 점선 테두리 + 동그란 사진 + 숫자 말랑 배지 */
    static void cardSticker(Context ctx, Canvas cv, RectF r0, JSONObject c, float k, int idx) {
        RectF r = new RectF(r0.left + 2 * k, r0.top + 2 * k, r0.right - 2 * k, r0.bottom - 2 * k);
        int col = colorOf(c); float rad = 18 * k;
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setColor(tint(col, .16f)); cv.drawRoundRect(r, rad, rad, bg);
        // 땡땡이
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG); dot.setColor((tint(col, .32f) & 0x00FFFFFF) | 0x66000000);
        cv.save(); Path cl = new Path(); cl.addRoundRect(r, rad, rad, Path.Direction.CW); cv.clipPath(cl);
        for (float y = r.top + 6 * k; y < r.bottom; y += 14 * k) for (float x = r.left + ((int) ((y - r.top) / (14 * k)) % 2 == 0 ? 6 : 13) * k; x < r.right; x += 14 * k) cv.drawCircle(x, y, 1.6f * k, dot);
        cv.restore();
        Paint ds = new Paint(Paint.ANTI_ALIAS_FLAG); ds.setStyle(Paint.Style.STROKE); ds.setStrokeWidth(1.6f * k); ds.setColor(tint(col, .7f));
        ds.setPathEffect(new android.graphics.DashPathEffect(new float[] { 5 * k, 4 * k }, 0));
        RectF in = new RectF(r.left + 4 * k, r.top + 4 * k, r.right - 4 * k, r.bottom - 4 * k); cv.drawRoundRect(in, rad - 4 * k, rad - 4 * k, ds);
        float d = Math.min(r.height() * .62f, r.width() * .42f), cx = r.left + 10 * k + d / 2, cy = r.centerY() + 2 * k;
        Bitmap b = img(ctx, c.optInt("_i"));
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG); ring.setColor(0xFFFFFFFF); ring.setShadowLayer(3 * k, 0, 1 * k, 0x30000000); cv.drawCircle(cx, cy, d / 2 + 3 * k, ring);
        if (b != null) { cv.save(); Path cc = new Path(); cc.addCircle(cx, cy, d / 2, Path.Direction.CW); cv.clipPath(cc);
            Paint fill = new Paint(); fill.setColor(tint(col, .25f)); cv.drawCircle(cx, cy, d / 2, fill);
            if (c.optBoolean("img")) cover(cv, b, new RectF(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2), p); else contain(cv, b, new RectF(cx - d / 2, cy - d / 2, cx + d / 2, cy + d * .62f), p);
            cv.restore(); }
        icon(ctx, cv, c, cx + d * .22f, cy - d / 2 - 4 * k, 16 * k);
        float tx = cx + d / 2 + 10 * k, tw = r.right - tx - 10 * k;
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xFF2A2F3A); t.setTypeface(Typeface.DEFAULT_BOLD); float tsz = Math.min(13.5f * k, r.height() * .13f); t.setTextSize(tsz);
        cv.drawText(fit(t, titleOf(c), tw), tx, r.top + r.height() * .3f, t);
        Paint s2 = new Paint(t); s2.setTypeface(Typeface.DEFAULT); s2.setTextSize(tsz * .78f); s2.setColor(0xFF7A8092);
        cv.drawText(fit(s2, subOf(c), tw), tx, r.top + r.height() * .3f + tsz * 1.2f, s2);
        Paint n = new Paint(Paint.ANTI_ALIAS_FLAG); n.setTypeface(Typeface.DEFAULT_BOLD); n.setTextSize(Math.min(19 * k, r.height() * .2f)); n.setColor(0xFFFFFFFF);
        String big = bigText(c); float bw = n.measureText(big) + 18 * k, bh = n.getTextSize() * 1.45f;
        RectF pill = new RectF(r.right - 10 * k - bw, r.bottom - 10 * k - bh, r.right - 10 * k, r.bottom - 10 * k);
        if (pill.left < tx) pill.offset(tx - pill.left, 0);
        Paint pb = new Paint(Paint.ANTI_ALIAS_FLAG); pb.setColor(c.optBoolean("pin") ? 0xFFFF6FA0 : darker(col)); pb.setShadowLayer(3 * k, 0, 1.5f * k, 0x30000000);
        cv.drawRoundRect(pill, bh / 2, bh / 2, pb);
        n.setTextAlign(Paint.Align.CENTER); cv.drawText(big, pill.centerX(), pill.centerY() + n.getTextSize() * .35f, n);
    }
    static int darker(int c) { return Color.rgb((int) (Color.red(c) * .82f), (int) (Color.green(c) * .82f), (int) (Color.blue(c) * .82f)); }

    /** 미니멀: 하얀 카드 + 왼쪽 색 띠 + 큰 숫자, 사진은 작게 */
    static void cardMinimal(Context ctx, Canvas cv, RectF r, JSONObject c, float k) {
        int col = colorOf(c); float rad = 14 * k;
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG); bg.setColor(0xFFFFFFFF); bg.setShadowLayer(3 * k, 0, 1 * k, 0x1A000000);
        cv.drawRoundRect(r, rad, rad, bg);
        cv.save(); Path cl = new Path(); cl.addRoundRect(r, rad, rad, Path.Direction.CW); cv.clipPath(cl);
        Paint bar = new Paint(); bar.setColor(c.optBoolean("pin") ? 0xFFFF6FA0 : col); cv.drawRect(r.left, r.top, r.left + 4 * k, r.bottom, bar);
        cv.restore();
        float pad = 12 * k, th = Math.min(r.height() - pad * 2, 46 * k);
        Bitmap b = img(ctx, c.optInt("_i")); float right = r.right - pad;
        if (b != null) {
            RectF tb = new RectF(r.right - pad - th, r.top + pad, r.right - pad, r.top + pad + th);
            cv.save(); Path cc = new Path(); cc.addRoundRect(tb, 10 * k, 10 * k, Path.Direction.CW); cv.clipPath(cc);
            Paint f = new Paint(); f.setColor(tint(col, .15f)); cv.drawRect(tb, f);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            if (c.optBoolean("img")) cover(cv, b, tb, p); else contain(cv, b, new RectF(tb.left, tb.top, tb.right, tb.bottom + th * .25f), p);
            cv.restore(); right = tb.left - 8 * k;
        }
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xFF8A90A0); float tsz = Math.min(12 * k, r.height() * .12f); t.setTextSize(tsz);
        cv.drawText(fit(t, titleOf(c), right - r.left - pad), r.left + pad + 2 * k, r.top + pad + tsz, t);
        Paint n = new Paint(Paint.ANTI_ALIAS_FLAG); n.setTypeface(Typeface.create("sans-serif-black", Typeface.NORMAL)); n.setColor(0xFF15181F);
        n.setTextSize(Math.min(32 * k, r.height() * .34f)); n.setLetterSpacing(-.02f);
        cv.drawText(bigText(c), r.left + pad, r.bottom - pad - tsz * 1.3f, n);
        Paint d = new Paint(t); d.setTextSize(tsz * .85f); d.setColor(0xFFA8AEBB);
        cv.drawText(fit(d, subOf(c), r.width() - pad * 2), r.left + pad + 2 * k, r.bottom - pad, d);
    }

    /** 밤하늘: 어두운 카드 + 흐린 사진 + 반짝이는 숫자 */
    static void cardNight(Context ctx, Canvas cv, RectF r, JSONObject c, float k) {
        int col = colorOf(c); float rad = 18 * k;
        cv.save(); Path cl = new Path(); cl.addRoundRect(r, rad, rad, Path.Direction.CW); cv.clipPath(cl);
        Paint bg = new Paint(); bg.setShader(new LinearGradient(r.left, r.top, r.right, r.bottom, 0xFF1C2033, 0xFF2B2346, Shader.TileMode.CLAMP)); cv.drawRect(r, bg);
        Bitmap b = img(ctx, c.optInt("_i"));
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG); p.setAlpha(c.optBoolean("img") ? 110 : 200);
        if (b != null) { if (c.optBoolean("img")) cover(cv, b, r, p); else { float h = r.height() * .95f, w = h * b.getWidth() / b.getHeight(); cv.drawBitmap(b, null, new RectF(r.right - w * .9f, r.bottom - h * .88f, r.right + w * .1f, r.bottom + h * .12f), p); } }
        Paint star = new Paint(Paint.ANTI_ALIAS_FLAG); star.setColor(0xCCFFFFFF);
        java.util.Random rnd = new java.util.Random(c.optString("t").hashCode());
        for (int i = 0; i < 14; i++) cv.drawCircle(r.left + rnd.nextFloat() * r.width(), r.top + rnd.nextFloat() * r.height() * .6f, (rnd.nextFloat() * 1.2f + .5f) * k, star);
        cv.restore();
        Paint ln = new Paint(Paint.ANTI_ALIAS_FLAG); ln.setStyle(Paint.Style.STROKE); ln.setStrokeWidth(1 * k); ln.setColor(0x40FFFFFF); cv.drawRoundRect(r, rad, rad, ln);
        float pad = 12 * k;
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(0xFFEDEBFF); t.setTypeface(Typeface.DEFAULT_BOLD); float tsz = Math.min(13.5f * k, r.height() * .13f); t.setTextSize(tsz);
        cv.drawText((c.optBoolean("pin") ? "★ " : "✦ ") + fit(t, titleOf(c), r.width() - pad * 2 - tsz), r.left + pad, r.top + pad + tsz, t);
        Paint d = new Paint(t); d.setTypeface(Typeface.DEFAULT); d.setTextSize(tsz * .76f); d.setColor(0xB3EDEBFF);
        cv.drawText(fit(d, subOf(c), r.width() - pad * 2), r.left + pad, r.top + pad + tsz * 2.05f, d);
        Paint n = new Paint(Paint.ANTI_ALIAS_FLAG); n.setTypeface(Typeface.DEFAULT_BOLD); n.setTextSize(Math.min(28 * k, r.height() * .27f)); n.setTextAlign(Paint.Align.RIGHT);
        n.setColor(0xFFFFFFFF); n.setShadowLayer(9 * k, 0, 0, (tint(col, .9f) & 0x00FFFFFF) | 0xEE000000);
        cv.drawText(bigText(c), r.right - pad, r.bottom - pad, n);
    }

    static Bitmap res(Context ctx, String name) {
        int id = ctx.getResources().getIdentifier(name, "drawable", ctx.getPackageName());
        if (id == 0) return null;
        BitmapFactory.Options o = new BitmapFactory.Options(); o.inScaled = false;
        return BitmapFactory.decodeResource(ctx.getResources(), id, o);
    }
    static void icon(Context ctx, Canvas cv, JSONObject c, float x, float y, float s) {
        Bitmap ic = res(ctx, "ic_rel_" + c.optString("icon", "heart"));
        if (ic == null) ic = res(ctx, "ic_rel_heart");
        if (ic == null) { heart(cv, x, y, s, false); return; }
        RectF dst = new RectF(x - s * .1f, y - s * .1f, x + s * 1.1f, y + s * 1.1f);
        // 선 없는 아이콘이라 사진 위에서도 보이게 은은한 그림자
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG); bp.setMaskFilter(new android.graphics.BlurMaskFilter(Math.max(2, ic.getWidth() * .06f), android.graphics.BlurMaskFilter.Blur.NORMAL));
        int[] off = new int[2]; Bitmap sh = ic.extractAlpha(bp, off);
        Paint sp = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG); sp.setColor(0x55000000);
        float sc = dst.width() / ic.getWidth();
        cv.drawBitmap(sh, null, new RectF(dst.left + off[0] * sc, dst.top + off[1] * sc + s * .05f, dst.left + (off[0] + sh.getWidth()) * sc, dst.top + (off[1] + sh.getHeight()) * sc + s * .05f), sp);
        cv.drawBitmap(ic, null, dst, new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG));
    }

    /** 사진 카드: 넣은 사진, 없으면 예시 그림 + 캐릭터 */
    static void cardPhoto(Context ctx, Canvas cv, RectF r, JSONObject c, float k) {
        float rad = 16 * k;
        Path clip = new Path(); clip.addRoundRect(r, rad, rad, Path.Direction.CW);
        cv.save(); cv.clipPath(clip);
        Bitmap b = img(ctx, c.optInt("_i"));
        boolean photo = c.optBoolean("img") && b != null;
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        if (photo) cover(cv, b, r, p);
        else {
            Bitmap ex = res(ctx, "sample_bg_" + c.optInt("bg", 0));
            if (ex != null) cover(cv, ex, r, p);
            else { int col = colorOf(c); Paint g = new Paint(); g.setShader(new LinearGradient(r.left, r.top, r.right, r.bottom, tint(col, .38f), tint(col, .14f), Shader.TileMode.CLAMP)); cv.drawRect(r, g); }
            if (b != null) { // 캐릭터를 오른쪽 아래에
                float h = r.height() * .92f, w = h * b.getWidth() / b.getHeight();
                Paint cs = new Paint(p); cs.setShadowLayer(6 * k, 0, 2 * k, 0x33000000);
                cv.drawBitmap(b, null, new RectF(r.right - w * .95f, r.bottom - h * .86f, r.right + w * .05f, r.bottom + h * .14f), cs);
            }
        }
        Paint g = new Paint(); g.setShader(new LinearGradient(0, r.top, 0, r.bottom, new int[] { 0x80000000, 0x0A000000, 0x0A000000, 0x70000000 }, new float[] { 0, .42f, .58f, 1 }, Shader.TileMode.CLAMP));
        cv.drawRect(r, g);
        float pad = 11 * k, hs = 22 * k;
        icon(ctx, cv, c, r.left + pad, r.top + pad, hs);
        Paint t = new Paint(Paint.ANTI_ALIAS_FLAG); t.setColor(Color.WHITE); t.setTypeface(Typeface.DEFAULT_BOLD);
        float tsz = Math.min(15 * k, r.height() * .13f); t.setTextSize(tsz); t.setShadowLayer(3 * k, 0, 1 * k, 0x99000000);
        float tx = r.left + pad + hs + 7 * k, tw = r.right - tx - pad;
        cv.drawText(fit(t, titleOf(c), tw), tx, r.top + pad + tsz * .95f, t);
        Paint d = new Paint(t); d.setTypeface(Typeface.DEFAULT); d.setTextSize(tsz * .74f); d.setColor(0xEEFFFFFF);
        cv.drawText(fit(d, subOf(c), tw), tx, r.top + pad + tsz * 1.95f, d);
        Paint n = new Paint(t); n.setTextSize(Math.min(30 * k, r.height() * .27f)); n.setTextAlign(Paint.Align.RIGHT); n.setShadowLayer(4 * k, 0, 1.5f * k, 0xAA000000);
        cv.drawText(bigText(c), r.right - pad, r.bottom - pad - n.descent() * .3f, n);
        cv.restore();
    }

    /** 위젯 그림 전체: 1장이면 크게, 여러 장이면 칸으로 */
    static Bitmap draw(Context ctx, int W, int H, float k, int max) {
        Bitmap bm = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        List<JSONObject> cs = cards(ctx);
        if (cs.size() > max) cs = cs.subList(0, max);
        String st = style(ctx);
        if (max > 1) { // 바탕 판
            Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
            bg.setColor("night".equals(st) ? 0xEE141726 : "sticker".equals(st) ? 0xF7FFFDF7 : "minimal".equals(st) ? 0xF2F3F5F9 : "polaroid".equals(st) ? 0xF0F4EFE6 : 0xF2FFFFFF);
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
            card(ctx, cv, r, cs.get(i), k, st, i);
        }
        return bm;
    }
}
