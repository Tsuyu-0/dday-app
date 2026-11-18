package com.ppangsal.dday;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.os.Build;
import android.text.Layout;
import android.util.TypedValue;
import android.widget.TextView;

/** 화면 위 캐릭터의 말풍선: PC 말풍선과 같은 모양 (테두리 없는 하얀 둥근 풍선 + 부드러운 그림자 + 둥근 꼬리).
 *  긴 대사는 옆으로 늘어나지 않고 아래로 줄이 바뀌어요. 줄 길이는 고르게, 한국어는 어절 단위로 끊어요. */
public class BubbleView extends TextView {
    final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    final float d, tail, sh;
    /** 꼬리가 가리킬 x (캐릭터 가운데). 0 이하면 말풍선 가운데 */
    public float tailX = -1;

    public BubbleView(Context c) {
        super(c);
        d = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, getResources().getDisplayMetrics());
        tail = 10 * d; sh = 7 * d; // sh: 그림자가 잘리지 않게 둘레에 남기는 자리
        fill.setColor(0xFFFFFFFF); fill.setShadowLayer(5 * d, 0, 3 * d, 0x33142240);
        setLayerType(LAYER_TYPE_SOFTWARE, null); // 그림자
        setPadding((int) (sh + 15 * d), (int) (sh + 9 * d), (int) (sh + 15 * d), (int) (sh + 9 * d + tail));
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14); setTextColor(0xFF18202B); setLineSpacing(0, 1.28f);
        setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        setGravity(android.view.Gravity.CENTER);
        setIncludeFontPadding(false);
        if (Build.VERSION.SDK_INT >= 23) { setBreakStrategy(Layout.BREAK_STRATEGY_BALANCED); setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE); }
        if (Build.VERSION.SDK_INT >= 33) setLineBreakWordStyle(android.graphics.text.LineBreakConfig.LINE_BREAK_WORD_STYLE_PHRASE);
    }

    /* 한 줄에 다 들어가도 글자 폭에 딱 맞게: 여러 줄일 때 오른쪽에 남는 빈칸을 없애요 */
    @Override protected void onMeasure(int wSpec, int hSpec) {
        super.onMeasure(wSpec, hSpec);
        Layout l = getLayout();
        if (l == null || l.getLineCount() < 2) return;
        float max = 0; for (int i = 0; i < l.getLineCount(); i++) max = Math.max(max, l.getLineWidth(i));
        int w = (int) Math.ceil(max) + getCompoundPaddingLeft() + getCompoundPaddingRight();
        if (w < getMeasuredWidth()) super.onMeasure(MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY), hSpec);
    }

    @Override protected void onDraw(Canvas cv) {
        float w = getWidth() - sh, h = getHeight() - tail - sh;
        RectF box = new RectF(sh, sh, w, h);
        float r = Math.min(18 * d, box.height() / 2);
        Path p = new Path();
        p.addRoundRect(box, r, r, Path.Direction.CW);
        float cx = tailX > 0 ? Math.max(sh + r + 9 * d, Math.min(w - r - 9 * d, tailX)) : (sh + w) / 2;
        float b = box.bottom - 2 * d;
        Path t = new Path();
        t.moveTo(cx - 9 * d, b); t.lineTo(cx - 2 * d, b + 12 * d);
        t.quadTo(cx, b + 14 * d, cx + 2 * d, b + 12 * d); t.lineTo(cx + 9 * d, b); t.close();
        p.op(t, Path.Op.UNION);
        cv.drawPath(p, fill);
        super.onDraw(cv);
    }
}
