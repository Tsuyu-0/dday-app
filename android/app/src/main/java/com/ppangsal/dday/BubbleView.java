package com.ppangsal.dday;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.util.TypedValue;
import android.widget.TextView;

/** 화면 위 캐릭터의 말풍선: 하얀 둥근 풍선 + 진한 테두리 + 아래 꼬리 (PC 말풍선과 같은 느낌) */
public class BubbleView extends TextView {
    final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), line = new Paint(Paint.ANTI_ALIAS_FLAG);
    final float d, tail;

    public BubbleView(Context c) {
        super(c);
        d = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 1, getResources().getDisplayMetrics());
        tail = 9 * d;
        fill.setColor(0xFFFFFFFF); fill.setShadowLayer(4 * d, 0, 1.5f * d, 0x30000000);
        line.setStyle(Paint.Style.STROKE); line.setStrokeWidth(2f * d); line.setColor(0xFF2E3442); line.setStrokeJoin(Paint.Join.ROUND);
        setLayerType(LAYER_TYPE_SOFTWARE, null); // 그림자
        setPadding((int) (14 * d), (int) (9 * d), (int) (14 * d), (int) (9 * d + tail));
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14); setTextColor(0xFF1B2230); setLineSpacing(2 * d, 1f);
        setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
        setGravity(android.view.Gravity.CENTER);
    }

    @Override protected void onDraw(Canvas cv) {
        float w = getWidth(), h = getHeight() - tail, r = Math.min(16 * d, h / 2), m = 3 * d;
        RectF box = new RectF(m, m, w - m, h - m * .3f);
        Path p = new Path();
        p.addRoundRect(box, r, r, Path.Direction.CW);
        Path t = new Path();
        float cx = w / 2;
        t.moveTo(cx - 8 * d, box.bottom - 1 * d); t.lineTo(cx - 1 * d, box.bottom + tail - 2 * d); t.lineTo(cx + 7 * d, box.bottom - 1 * d); t.close();
        p.op(t, Path.Op.UNION);
        cv.drawPath(p, fill);
        cv.drawPath(p, line);
        super.onDraw(cv);
    }
}
