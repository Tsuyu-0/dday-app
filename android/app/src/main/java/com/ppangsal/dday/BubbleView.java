package com.ppangsal.dday;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.Build;
import android.text.Layout;
import android.util.TypedValue;
import android.widget.TextView;

/** 화면 위 캐릭터의 말풍선: PC 말풍선과 같은 모양들.
 *  speech 말풍선 · thought 생각(구름 + 동글동글 꼬리) · shout 놀람(뾰족뾰족) · imagine 상상(점선) · memo 포스트잇 · sfx 효과음 글씨(풍선 없이).
 *  긴 대사는 옆으로 늘어나지 않고 아래로 줄이 바뀌어요. 줄 길이는 고르게, 한국어는 어절 단위로 끊어요. */
public class BubbleView extends TextView {
    final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), dot = new Paint(Paint.ANTI_ALIAS_FLAG), extra = new Paint(Paint.ANTI_ALIAS_FLAG);
    final float d, sh;
    float tail;
    /** 꼬리가 가리킬 x (캐릭터 가운데). 0 이하면 말풍선 가운데 */
    public float tailX = -1;
    String style = "speech";
    static final int[] SFX = { 0xFFFF5C8A, 0xFFFF8A3D, 0xFF4F7CFF, 0xFF9B6BFF, 0xFF22B07D, 0xFFFFB020 };
    static final int[] MEMO = { 0xFFFFF3B0, 0xFFFFD9E4, 0xFFD6F2E4, 0xFFDCE8FF };
    int memoColor = MEMO[0];

    public BubbleView(Context c) {
        super(c);
        d = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, getResources().getDisplayMetrics());
        sh = 7 * d; // 그림자가 잘리지 않게 둘레에 남기는 자리
        fill.setShadowLayer(5 * d, 0, 3 * d, 0x33142240);
        dot.setStyle(Paint.Style.STROKE); dot.setStrokeWidth(2.3f * d); dot.setColor(0xFF6D7888); dot.setStrokeCap(Paint.Cap.ROUND);
        dot.setPathEffect(new DashPathEffect(new float[] { .1f * d, 5.3f * d }, 0));
        setLayerType(LAYER_TYPE_SOFTWARE, null); // 그림자
        setLineSpacing(0, 1.28f);
        setGravity(android.view.Gravity.CENTER);
        setIncludeFontPadding(false);
        if (Build.VERSION.SDK_INT >= 23) { setBreakStrategy(Layout.BREAK_STRATEGY_BALANCED); setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE); }
        if (Build.VERSION.SDK_INT >= 33) setLineBreakWordStyle(android.graphics.text.LineBreakConfig.LINE_BREAK_WORD_STYLE_PHRASE);
        setBubbleStyle("speech");
    }

    /** 말풍선 모양 바꾸기 (글자 크기·여백·색도 모양에 맞게) */
    public void setBubbleStyle(String s) {
        if (s == null || s.isEmpty()) s = "speech";
        style = s;
        setRotation(0);
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14); setTextColor(0xFF18202B);
        setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        setShadowLayer(0, 0, 0, 0);
        int px = (int) (sh + 15 * d), py = (int) (sh + 9 * d);
        switch (s) {
            case "thought": tail = 24 * d; setTextColor(0xFF3A4556); setPadding(px, py, px, (int) (py + tail)); break;
            case "shout": tail = 0; setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)); setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
                setPadding((int) (px + 16 * d), (int) (py + 14 * d), (int) (px + 16 * d), (int) (py + 14 * d)); break;
            case "imagine": tail = 0; setTextColor(0xFF4A5566); setPadding(px, py, px, py + (int) (6 * d)); break;
            case "memo": tail = 0; memoColor = MEMO[(int) (Math.random() * MEMO.length)]; setRotation((float) (Math.random() * 6 - 3));
                setPadding(px, (int) (py + 6 * d), px, py + (int) (4 * d)); break;
            case "sfx": tail = 0; setTypeface(android.graphics.Typeface.create("sans-serif-black", android.graphics.Typeface.BOLD)); setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
                setTextColor(SFX[(int) (Math.random() * SFX.length)]); setShadowLayer(4 * d, 0, 0, 0xFFFFFFFF); setRotation((float) (Math.random() * 14 - 7));
                setPadding((int) (10 * d), (int) (8 * d), (int) (10 * d), (int) (8 * d)); break;
            default: tail = 10 * d; setPadding(px, py, px, (int) (py + tail)); break;
        }
        requestLayout(); invalidate();
    }

    /* 여러 줄일 때 오른쪽에 남는 빈칸을 없애요 */
    @Override protected void onMeasure(int wSpec, int hSpec) {
        super.onMeasure(wSpec, hSpec);
        Layout l = getLayout();
        if (l == null || l.getLineCount() < 2) return;
        float max = 0; for (int i = 0; i < l.getLineCount(); i++) max = Math.max(max, l.getLineWidth(i));
        int w = (int) Math.ceil(max) + getCompoundPaddingLeft() + getCompoundPaddingRight();
        if (w < getMeasuredWidth()) super.onMeasure(MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY), hSpec);
    }

    float tailCx(float l, float r, float rad) {
        return tailX > 0 ? Math.max(l + rad + 9 * d, Math.min(r - rad - 9 * d, tailX)) : (l + r) / 2;
    }

    @Override protected void onDraw(Canvas cv) {
        float W = getWidth(), H = getHeight();
        if ("sfx".equals(style)) { super.onDraw(cv); return; }
        RectF box = new RectF(sh, sh, W - sh, H - sh - tail);
        float r = Math.min(18 * d, box.height() / 2);
        fill.setColor(0xFFFFFFFF);
        switch (style) {
            case "thought": {
                Path p = new Path(); p.addRoundRect(box, r, r, Path.Direction.CW);
                cv.drawPath(p, fill);
                float cx = tailCx(box.left, box.right, r) - 2 * d;
                cv.drawCircle(cx, box.bottom + 7 * d, 4.6f * d, fill);
                cv.drawCircle(cx - 5 * d, box.bottom + 14 * d, 3.2f * d, fill);
                cv.drawCircle(cx - 9 * d, box.bottom + 20 * d, 2f * d, fill);
                break;
            }
            case "shout": {
                float cx = box.centerX(), cy = box.centerY(), rx = box.width() / 2, ry = box.height() / 2;
                int n = 14; Path p = new Path();
                for (int i = 0; i < n * 2; i++) {
                    double a = Math.PI * i / n - Math.PI / 2; float k = i % 2 == 0 ? 1f : .8f;
                    float x = cx + (float) Math.cos(a) * rx * k, y = cy + (float) Math.sin(a) * ry * k;
                    if (i == 0) p.moveTo(x, y); else p.lineTo(x, y);
                }
                p.close(); cv.drawPath(p, fill);
                break;
            }
            case "imagine": {
                Path p = new Path(); float rr = Math.min(14 * d, box.height() / 2);
                RectF b2 = new RectF(box.left + 2 * d, box.top + 2 * d, box.right - 2 * d, box.bottom - 2 * d);
                p.addRoundRect(b2, rr, rr, Path.Direction.CW);
                cv.drawPath(p, fill); cv.drawPath(p, dot);
                break;
            }
            case "memo": {
                fill.setColor(memoColor);
                cv.drawRoundRect(box, 2 * d, 2 * d, fill);
                extra.setColor(0x14000000); Path f = new Path(); f.moveTo(box.right - 14 * d, box.bottom); f.lineTo(box.right, box.bottom - 14 * d); f.lineTo(box.right, box.bottom); f.close(); cv.drawPath(f, extra);
                extra.setColor(0x9EAABEE1); cv.save(); cv.rotate(-4, box.centerX(), box.top);
                cv.drawRoundRect(new RectF(box.centerX() - 24 * d, box.top - 7 * d, box.centerX() + 24 * d, box.top + 8 * d), 1.5f * d, 1.5f * d, extra); cv.restore();
                break;
            }
            default: {
                Path p = new Path(); p.addRoundRect(box, r, r, Path.Direction.CW);
                float cx = tailCx(box.left, box.right, r), b = box.bottom - 2 * d;
                Path t = new Path();
                t.moveTo(cx - 9 * d, b); t.lineTo(cx - 2 * d, b + 12 * d);
                t.quadTo(cx, b + 14 * d, cx + 2 * d, b + 12 * d); t.lineTo(cx + 9 * d, b); t.close();
                p.op(t, Path.Op.UNION);
                cv.drawPath(p, fill);
            }
        }
        super.onDraw(cv);
    }
}
