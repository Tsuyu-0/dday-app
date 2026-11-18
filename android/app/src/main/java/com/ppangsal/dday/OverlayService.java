package com.ppangsal.dday;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Random;

/** 폰 화면 위에 떠 있는 캐릭터 (다른 앱 위에 표시). 끌어서 옮기고, 누르면 말풍선으로 한마디.
 *  [페어 → 같이 띄우기]를 켜 두면 페어(최대 5명)가 나란히 서서 가끔 대화를 주고받아요.
 *  캐릭터마다 창이 두 개: 그림 창(누르기·끌기) + 말풍선 창(눌리지 않아서 다른 캐릭터·앱을 가리지 않아요). */
public class OverlayService extends Service {
    static final String CH = "overlay", ACT_REFRESH = "refresh", ACT_STOP = "stop", ACT_TALK = "talk";
    static boolean running = false;
    static final String[] ZK = { null, "head", "face", "body", "hand", "foot", "ear", "tail", "all" };

    WindowManager wm;
    final Handler h = new Handler(Looper.getMainLooper());
    final Random rnd = new Random();
    final List<Pet> pets = new ArrayList<>();
    String sig = null;
    boolean started = false;

    /* 무리 전체 자리: 맨 왼쪽 캐릭터 그림의 왼쪽 끝(gx), 화면 아래에서 그림 아래까지(gy) */
    int gx, gy, sizePx, gap;
    boolean wander = false, touching = false; float wSpeed = 1f; long quietUntil = 0; ValueAnimator walker;

    /* 페어 대화 */
    final List<List<String[]>> dialogs = new ArrayList<>(); int dialogBase = 0;
    boolean duoAuto = true, duoVoice = true, talking = false; int talkGen = 0, lastTalk = -1;

    int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }
    DisplayMetrics dm() { return getResources().getDisplayMetrics(); }
    int slot(int i) { return gx + i * (sizePx + gap); }
    int groupW() { int n = Math.max(1, pets.size()); return n * sizePx + (n - 1) * gap; }
    boolean anyBusy() { for (Pet p : pets) if (p.busy()) return true; return false; }
    void prefsPos() { getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putInt("ovX", gx).putInt("ovY", gy).apply(); }

    /* 한 사람 크기: 혼자면 112dp, 여럿이면 화면 너비에 맞게 조금씩 작게 */
    void fitSize() {
        int n = Math.max(1, pets.size()), W = dm().widthPixels;
        gap = n > 1 ? dp(2) : 0;
        sizePx = n == 1 ? dp(112) : Math.max(dp(64), Math.min(dp(112), (W - dp(12) - (n - 1) * gap) / n));
    }

    /* ================= 캐릭터 한 명 ================= */
    class Pet {
        final int idx;
        ImageView img; FrameLayout bubRoot; BubbleView bub; LinearLayout menu;
        WindowManager.LayoutParams ilp, blp;
        ObjectAnimator breathe;
        String name = "", greet = "", voice = "", zmap = "";
        float vPitch = 0, vSpeed = 1, vVol = .6f;
        final List<String> lines = new ArrayList<>(), idle = new ArrayList<>();
        final Map<String, List<String>> zoneLines = new HashMap<>();
        boolean idleVoice = false;
        final List<String> queue = new ArrayList<>(); boolean qQuiet = false;
        Runnable typer;

        Pet(int idx) { this.idx = idx; }

        boolean busy() { return bub.getVisibility() == View.VISIBLE || menu.getVisibility() == View.VISIBLE; }

        void build() {
            int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
            img = new ImageView(OverlayService.this); img.setScaleType(ImageView.ScaleType.FIT_CENTER);
            ilp = new WindowManager.LayoutParams(sizePx, sizePx, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
            ilp.gravity = Gravity.BOTTOM | Gravity.START; ilp.x = slot(idx); ilp.y = gy;

            bubRoot = new FrameLayout(OverlayService.this);
            bub = new BubbleView(OverlayService.this); bub.setVisibility(View.GONE);
            menu = new LinearLayout(OverlayService.this); menu.setOrientation(LinearLayout.HORIZONTAL); menu.setVisibility(View.GONE);
            menu.addView(menuBtn("앱 열기", v -> { hideMenu(); try { DdayWidget.openApp(OverlayService.this).send(); } catch (Exception e) { } }));
            menu.addView(menuBtn("숨기기", v -> { getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putBoolean("overlayOn", false).apply(); stopSelf(); }));
            bubRoot.addView(bub, new FrameLayout.LayoutParams(-2, -2)); bubRoot.addView(menu, new FrameLayout.LayoutParams(-2, -2));
            blp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
            blp.gravity = Gravity.BOTTOM | Gravity.START; blp.x = ilp.x; blp.y = gy + sizePx;

            wm.addView(img, ilp);
            wm.addView(bubRoot, blp);
            img.setPivotY(sizePx); img.setPivotX(sizePx / 2f);
            breathe = ObjectAnimator.ofFloat(img, "scaleY", 1f, 0.975f);
            breathe.setDuration(1700 + idx * 130); breathe.setRepeatCount(ValueAnimator.INFINITE); breathe.setRepeatMode(ValueAnimator.REVERSE); breathe.start();
            img.setOnTouchListener(touch());
        }

        void destroy() {
            h.removeCallbacks(hideBub); h.removeCallbacks(nextPart); if (typer != null) h.removeCallbacks(typer);
            if (breathe != null) breathe.cancel();
            try { wm.removeView(img); } catch (Exception e) { }
            try { wm.removeView(bubRoot); } catch (Exception e) { }
        }

        void setSize() {
            ilp.width = sizePx; ilp.height = sizePx; img.setPivotY(sizePx); img.setPivotX(sizePx / 2f);
        }

        /* 그림 창을 무리 자리로, 말풍선 창은 그 위로 */
        void move() {
            ilp.x = slot(idx); ilp.y = gy;
            try { wm.updateViewLayout(img, ilp); } catch (Exception e) { }
            placeTop(false);
        }

        View topShown() { return bub.getVisibility() == View.VISIBLE ? bub : menu.getVisibility() == View.VISIBLE ? menu : null; }

        /* 말풍선이 캐릭터보다 넓어도 화면 안에 다 보이게 좌우로 밀고, 꼬리는 캐릭터를 가리켜요. 위가 모자라면 머리에 살짝 겹쳐요 */
        void placeTop(boolean measure) {
            View top = topShown(); if (top == null) return;
            int W = dm().widthPixels, H = dm().heightPixels, pad = dp(6), cx = slot(idx);
            if (measure || top.getMeasuredWidth() == 0) {
                if (top == bub) bub.setMaxWidth(Math.max(dp(120), Math.min(dp(212), W - pad * 2)));
                top.measure(View.MeasureSpec.makeMeasureSpec(W - pad * 2, View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
            }
            int tw = top.getMeasuredWidth(), th = top.getMeasuredHeight();
            int tl = Math.max(pad, Math.min(W - tw - pad, cx + sizePx / 2 - tw / 2));
            if (top == bub) { float tx = cx + sizePx / 2f - tl; if (Math.abs(bub.tailX - tx) > 1) { bub.tailX = tx; bub.invalidate(); } }
            blp.x = tl; blp.y = Math.max(0, Math.min(H - th - dp(4), gy + sizePx));
            if (top == menu) blp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE; else blp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
            try { wm.updateViewLayout(bubRoot, blp); } catch (Exception e) { }
        }

        View.OnTouchListener touch() {
            final int slop = ViewConfiguration.get(OverlayService.this).getScaledTouchSlop();
            return new View.OnTouchListener() {
                float sx, sy, lx, ly; int ox, oy; boolean drag, longed;
                final Runnable lpress = () -> { longed = true; showMenu(); };
                @Override public boolean onTouch(View v, MotionEvent e) {
                    switch (e.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            stopWalk(); touching = true; quietUntil = System.currentTimeMillis() + 5000;
                            lx = e.getX() / Math.max(1, v.getWidth()); ly = e.getY() / Math.max(1, v.getHeight());
                            sx = e.getRawX(); sy = e.getRawY(); ox = gx; oy = gy; drag = false; longed = false;
                            h.postDelayed(lpress, 550); return true;
                        case MotionEvent.ACTION_MOVE:
                            float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                            if (!drag && Math.abs(dx) + Math.abs(dy) > slop) { drag = true; h.removeCallbacks(lpress); for (Pet p : pets) p.hideMenu(); }
                            if (drag) { gx = Math.round(ox + dx); gy = Math.round(oy - dy); for (Pet p : pets) p.move(); } // 같이 서 있는 친구들도 함께 옮겨요
                            return true;
                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL:
                            h.removeCallbacks(lpress); touching = false; quietUntil = System.currentTimeMillis() + 5000;
                            if (drag) { keepInside(); prefsPos(); }
                            else if (!longed && e.getActionMasked() == MotionEvent.ACTION_UP) { hideMenu(); motion("hop"); say(pickFor(lx, ly)); tapped(Pet.this); }
                            return true;
                    }
                    return false;
                }
            };
        }

        TextView menuBtn(String t, View.OnClickListener l) {
            TextView b = new TextView(OverlayService.this); b.setText(t); b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f); b.setTextColor(Color.WHITE);
            b.setPadding(dp(12), dp(7), dp(12), dp(7));
            GradientDrawable g = new GradientDrawable(); g.setColor(0xE61B2230); g.setCornerRadius(dp(99)); b.setBackground(g);
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, -2); p.setMargins(dp(3), dp(4), dp(3), dp(6)); b.setLayoutParams(p);
            b.setOnClickListener(l); return b;
        }
        void showMenu() { h.removeCallbacks(hideBub); bub.setVisibility(View.GONE); menu.setVisibility(View.VISIBLE); placeTop(true); h.postDelayed(this::hideMenu, 4000); }
        void hideMenu() { if (menu.getVisibility() != View.GONE) { menu.setVisibility(View.GONE); placeTop(true); blp.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE; try { wm.updateViewLayout(bubRoot, blp); } catch (Exception e) { } } }

        /* 몸짓: 통통 · 펄쩍 · 끄덕 · 씰룩 · 움찔 · 깜짝 · 빙글 · 다가가기(dir 쪽으로 살짝) */
        void motion(String m) { motion(m, 1); }
        void motion(String m, int dir) {
            if (m == null || m.isEmpty()) return;
            ObjectAnimator a;
            switch (m) {
                case "jump": a = ObjectAnimator.ofFloat(img, "translationY", 0, -dp(30), 0); a.setDuration(460); break;
                case "nod": a = ObjectAnimator.ofFloat(img, "translationY", 0, dp(5), 0, dp(5), 0); a.setDuration(560); break;
                case "dance": a = ObjectAnimator.ofFloat(img, "rotation", 0, -8, 8, -8, 8, 0); a.setDuration(900); break;
                case "shy": a = ObjectAnimator.ofFloat(img, "scaleX", 1f, .92f, 1f); a.setDuration(620); break;
                case "surprise": a = ObjectAnimator.ofFloat(img, "translationY", 0, -dp(20), 0, -dp(6), 0); a.setDuration(420); break;
                case "spin": a = ObjectAnimator.ofFloat(img, "rotationY", 0, 360); a.setDuration(700); break;
                case "approach": a = ObjectAnimator.ofFloat(img, "translationX", 0, dir * dp(20), dir * dp(20), 0); a.setDuration(900); break;
                default: a = ObjectAnimator.ofFloat(img, "translationY", 0, -dp(14), 0); a.setDuration(380); break;
            }
            a.start();
        }
        /* 듣는 친구는 말하는 쪽으로 살짝 기울어요 */
        void lean(int dir, long hold) {
            img.animate().rotation(dir * 5f).setDuration(220).start();
            h.postDelayed(() -> img.animate().rotation(0).setDuration(260).start(), Math.max(400, hold));
        }

        final Runnable hideBub = () -> {
            if (bub == null) return;
            bub.animate().alpha(0f).scaleX(.9f).scaleY(.9f).setDuration(160).withEndAction(() -> { bub.setVisibility(View.GONE); bub.setAlpha(1f); bub.setScaleX(1f); bub.setScaleY(1f); }).start();
        };
        /* "//" 로 나눈 대사는 말풍선을 하나씩 차례로 보여 줘요 */
        final Runnable nextPart = () -> { if (!queue.isEmpty()) sayOne(queue.remove(0), qQuiet, 0); };
        void say(String s) { say(s, false); }
        void say(String s, boolean quiet) {
            if (s == null) return; h.removeCallbacks(nextPart); queue.clear(); qQuiet = quiet;
            for (String part : s.split("//")) { String p = part.trim(); if (!p.isEmpty()) queue.add(p); }
            if (!queue.isEmpty()) sayOne(queue.remove(0), quiet, 0);
        }
        /** hold > 0: 대화 중 한 마디 (정해진 만큼 보여 주고 닫아요) */
        void sayOne(String s, boolean quiet, long hold) {
            stopWalk(); quietUntil = System.currentTimeMillis() + 4000;
            if (s == null || s.isEmpty()) return;
            h.removeCallbacks(hideBub); if (typer != null) h.removeCallbacks(typer);
            hideMenu();
            // 말풍선 모양: 앱이 대사 앞에 붙여 보낸 표시 (§t§ 생각 · §s§ 놀람 · §i§ 상상 · §m§ 포스트잇 · §x§ 효과음)
            String st = "speech";
            if (s.length() > 3 && s.charAt(0) == '\u00A7' && s.charAt(2) == '\u00A7') {
                switch (s.charAt(1)) { case 't': st = "thought"; break; case 's': st = "shout"; break; case 'i': st = "imagine"; break; case 'm': st = "memo"; break; case 'x': st = "sfx"; break; }
                s = s.substring(3).trim(); if (s.isEmpty()) return;
            }
            bub.setBubbleStyle(st);
            final String full = s;
            // 크기를 먼저 맞춰 두고(투명 글자) 한 글자씩 보여 줘요
            android.text.SpannableString sp = new android.text.SpannableString(full);
            sp.setSpan(new android.text.style.ForegroundColorSpan(0x00000000), 0, full.length(), 0);
            bub.setText(sp);
            bub.animate().cancel(); bub.setVisibility(View.VISIBLE);
            placeTop(true);
            bub.setPivotX(bub.tailX > 0 ? bub.tailX : bub.getMeasuredWidth() / 2f); bub.setPivotY(bub.getMeasuredHeight());
            bub.setScaleX(.6f); bub.setScaleY(.6f); bub.setAlpha(0f);
            bub.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(220).setInterpolator(new android.view.animation.OvershootInterpolator(2.2f)).start();
            if (!quiet) Babble.play(OverlayService.this, full, voice, vPitch, vSpeed, vVol);
            final int step = Math.max(28, (int) (48 / Math.max(.5f, vSpeed)));
            final int[] k = { 0 };
            typer = new Runnable() { @Override public void run() {
                k[0] = Math.min(full.length(), k[0] + 1);
                android.text.SpannableString s2 = new android.text.SpannableString(full);
                if (k[0] < full.length()) s2.setSpan(new android.text.style.ForegroundColorSpan(0x00000000), k[0], full.length(), 0);
                bub.setText(s2);
                if (k[0] < full.length()) h.postDelayed(this, step);
            } };
            h.postDelayed(typer, 120);
            if (hold > 0) { h.postDelayed(hideBub, hold); return; }
            long dur = Math.max(2600, 1200 + full.length() * 120L);
            if (!queue.isEmpty()) h.postDelayed(nextPart, Math.max(1500, 700 + full.length() * 90L));
            else h.postDelayed(hideBub, dur);
        }

        /* 누른 부위: 앱이 보내 준 50×50 부위 지도 (0 없음 1 머리 2 얼굴 3 몸 4 팔 5 다리 6 귀 7 꼬리) + 부위별 대사 */
        String zoneAt(float fx, float fy) {
            if (zmap.length() != 2500) return null;
            int x = Math.round(fx * 49), y = Math.round(fy * 49);
            int v0 = (x >= 0 && y >= 0 && x <= 49 && y <= 49) ? zmap.charAt(y * 50 + x) - '0' : 0;
            // 팔·다리는 가늘어서: 몸통 가장자리나 바로 바깥을 눌러도 팔·다리로
            if (v0 == 3) { int n = near(x, y, 1, 4, 4); if (n > 0) return ZK[n]; }
            if (v0 > 0 && v0 < ZK.length) return ZK[v0];
            int lim = near(x, y, 2, 4, 5); if (lim > 0) return ZK[lim];
            for (int r = 0; r <= 2; r++) for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) {
                int xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > 49 || yy > 49) continue;
                int v = zmap.charAt(yy * 50 + xx) - '0'; if (v > 0 && v < ZK.length) return ZK[v];
            }
            return null;
        }
        int near(int x, int y, int R, int a, int b) {
            for (int r = 1; r <= R; r++) for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) != r) continue;
                int xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > 49 || yy > 49) continue;
                int v = zmap.charAt(yy * 50 + xx) - '0'; if (v == a || v == b) return v;
            }
            return 0;
        }
        String pickFor(float fx, float fy) { String z = zoneAt(fx, fy); List<String> L = z == null ? null : zoneLines.get(z); return L != null && !L.isEmpty() ? L.get(rnd.nextInt(L.size())) : pick(); }
        String pick() { if (lines.isEmpty()) return "불렀어?"; return lines.get(rnd.nextInt(lines.size())); }

        void loadImage(File f) {
            Bitmap bm = f != null && f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
            if (bm != null) img.setImageBitmap(bm); else img.setImageResource(R.mipmap.ic_launcher_foreground);
        }
        void loadData(JSONObject o) {
            lines.clear(); idle.clear(); zoneLines.clear(); greet = "";
            if (o == null) return;
            zmap = o.optString("zmap", "");
            JSONObject zl = o.optJSONObject("zl");
            if (zl != null) { Iterator<String> it = zl.keys(); while (it.hasNext()) { String k = it.next(); JSONArray a = zl.optJSONArray(k); List<String> L = new ArrayList<>(); if (a != null) for (int i = 0; i < a.length(); i++) { String x = a.optString(i, "").trim(); if (!x.isEmpty()) L.add(x); } if (!L.isEmpty()) zoneLines.put(k, L); } }
            idleVoice = o.optBoolean("idleVoice", false);
            JSONArray il = o.optJSONArray("idle"); if (il != null) for (int i = 0; i < il.length(); i++) { String x = il.optString(i, "").trim(); if (!x.isEmpty()) idle.add(x); }
            JSONArray ls = o.optJSONArray("lines"); if (ls != null) for (int i = 0; i < ls.length(); i++) { String x = ls.optString(i, "").trim(); if (!x.isEmpty()) lines.add(x); }
            greet = o.optString("greet", ""); name = o.optString("name", "");
            voice = o.optString("voice", ""); vPitch = (float) o.optDouble("pitch", 0); vSpeed = (float) o.optDouble("speed", 1); vVol = (float) o.optDouble("vol", .6);
        }
    }

    /* ================= 무리 전체 ================= */

    /* 돌아다니기: 지금 높이에서 좌우로 통통 튀며 걸어요 (같이 서 있으면 다 같이) */
    final Runnable wanderTick = new Runnable() { @Override public void run() {
        h.postDelayed(this, 6000 + rnd.nextInt(8000));
        if (!wander || pets.isEmpty() || walker != null || touching || talking || System.currentTimeMillis() < quietUntil) return;
        if (anyBusy() || rnd.nextFloat() < .3f) return;
        walk();
    } };
    void walk() {
        int sw = dm().widthPixels, rw = groupW();
        final int x0 = gx, dist = Math.round((150 + rnd.nextFloat() * 370) * dm().density);
        int t = x0 + (rnd.nextBoolean() ? dist : -dist); t = Math.max(0, Math.min(sw - rw, t));
        if (Math.abs(t - x0) < dp(40)) return;
        final int target = t;
        final float hopLen = dp(40) * wSpeed, hopMs = 430f / (float) Math.sqrt(wSpeed);
        final int hops = Math.max(1, Math.round(Math.abs(target - x0) / hopLen));
        walker = ValueAnimator.ofFloat(0f, 1f); walker.setDuration((long) (hops * hopMs)); walker.setInterpolator(null);
        walker.addUpdateListener(a -> {
            float k = (float) a.getAnimatedValue(), el = k * hops * hopMs;
            gx = Math.round(x0 + (target - x0) * k);
            for (Pet p : pets) {
                float ph = ((el + p.idx * hopMs * .35f) % hopMs) / hopMs; // 친구들은 박자가 살짝 어긋나게
                float up = (float) Math.sin(Math.min(1f, ph) * Math.PI), sq = ph < .12f ? 1f - (.12f - ph) * .6f : 1f;
                p.img.setTranslationY(-up * dp(12)); p.img.setScaleX(2f - sq);
                p.move();
            }
        });
        walker.addListener(new android.animation.AnimatorListenerAdapter() {
            boolean done = false;
            void fin() { if (done) return; done = true; walker = null; for (Pet p : pets) { p.img.setTranslationY(0); p.img.setScaleX(1f); } prefsPos(); }
            @Override public void onAnimationEnd(android.animation.Animator a) { fin(); }
            @Override public void onAnimationCancel(android.animation.Animator a) { fin(); }
        });
        walker.start();
    }
    void stopWalk() { if (walker != null) walker.cancel(); }

    /* 혼잣말: 가만히 있을 때 가끔 (말소리는 [가만히 있을 때도 말소리 내기]를 켰을 때만) */
    final Runnable idleTick = new Runnable() { @Override public void run() {
        h.postDelayed(this, 40000 + rnd.nextInt(50000));
        if (pets.isEmpty() || touching || talking || walker != null || System.currentTimeMillis() < quietUntil || anyBusy()) return;
        List<Pet> can = new ArrayList<>(); for (Pet p : pets) if (!p.idle.isEmpty()) can.add(p);
        if (can.isEmpty()) return;
        Pet p = can.get(rnd.nextInt(can.size()));
        p.say(p.idle.get(rnd.nextInt(p.idle.size())), !p.idleVoice);
    } };

    /* 페어 대화: 가끔 저절로 (평균 2~3분에 한 번) */
    final Runnable talkTick = new Runnable() { @Override public void run() {
        h.postDelayed(this, 20000);
        if (pets.size() < 2 || !duoAuto || talking || touching || walker != null || anyBusy() || System.currentTimeMillis() < quietUntil) return;
        if (rnd.nextFloat() < .12f) playTalk(-1);
    } };
    /* 한 명을 누르면 옆 친구들도 반응하고, 가끔 대화가 시작돼요 */
    void tapped(Pet from) {
        if (pets.size() < 2) return;
        for (Pet p : pets) {
            if (p == from || rnd.nextFloat() > .35f) continue;
            final Pet q = p; final int dir = from.idx > p.idx ? 1 : -1;
            h.postDelayed(() -> { q.lean(dir, 1500); q.motion("hop"); }, 250 + rnd.nextInt(400));
        }
        if (duoAuto && !talking && rnd.nextFloat() < .3f) h.postDelayed(() -> playTalk(-1), 2600);
    }
    boolean playTalk(int only) {
        if (pets.size() < 2 || dialogs.isEmpty()) return false;
        if (talking && only < 0) return false;
        List<List<String[]>> list = new ArrayList<>();
        for (List<String[]> c : dialogs) { List<String[]> c2 = new ArrayList<>(); for (String[] l : c) if (Integer.parseInt(l[0]) < pets.size()) c2.add(l); list.add(c2); }
        int i = rnd.nextInt(list.size()); if (list.size() > 1 && i == lastTalk) i = (i + 1) % list.size();
        if (only >= 0 && only < Math.min(dialogBase, list.size())) i = only;
        if (list.get(i).isEmpty()) return false;
        lastTalk = i; talkGen++; final int gen = talkGen; talking = true; stopWalk();
        for (Pet p : pets) { p.hideMenu(); h.removeCallbacks(p.nextPart); p.queue.clear(); }
        step(gen, list.get(i), 0);
        return true;
    }
    void step(final int gen, final List<String[]> conv, final int k) {
        if (gen != talkGen) return;
        if (k >= conv.size()) { talking = false; quietUntil = System.currentTimeMillis() + 3000; return; }
        String[] ln = conv.get(k); int w = Integer.parseInt(ln[0]);
        if (w >= pets.size()) { step(gen, conv, k + 1); return; }
        final Pet p = pets.get(w);
        String text = ln[1].replace("//", "\n");
        long ms = Math.min(4200, Math.max(1700, 900 + text.length() * 90L));
        for (Pet o : pets) if (o != p) o.lean(p.idx > o.idx ? 1 : -1, ms + 400);
        int dir = w == 0 ? 1 : (w == pets.size() - 1 ? -1 : (rnd.nextBoolean() ? 1 : -1));
        p.motion(ln[2].isEmpty() ? null : ln[2], dir);
        p.sayOne(text, !duoVoice, ms);
        h.postDelayed(() -> step(gen, conv, k + 1), ms + 450);
    }

    /* 가로·세로를 바꾸거나 끌어다 놓으면: 다 같이 화면 안으로 */
    void keepInside() {
        if (pets.isEmpty()) return;
        int old = sizePx; fitSize();
        if (old != sizePx) for (Pet p : pets) p.setSize();
        DisplayMetrics m = dm();
        gx = Math.max(0, Math.min(m.widthPixels - groupW(), gx));
        gy = Math.max(0, Math.min(m.heightPixels - sizePx - dp(8), gy));
        for (Pet p : pets) { p.move(); p.placeTop(true); }
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration c) {
        super.onConfigurationChanged(c); stopWalk();
        h.postDelayed(this::keepInside, 150); h.postDelayed(this::keepInside, 600);
    }

    static boolean canDraw(Context c) { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override public void onCreate() {
        super.onCreate();
        running = true;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CH, "화면 위 캐릭터", NotificationManager.IMPORTANCE_MIN));
        Intent stop = new Intent(this, OverlayService.class).setAction(ACT_STOP);
        Notification n = new NotificationCompat.Builder(this, CH)
            .setSmallIcon(R.drawable.ic_stat_heart)
            .setContentTitle("캐릭터가 화면에 나와 있어요")
            .setContentText("누르면 앱이 열려요")
            .setContentIntent(DdayWidget.openApp(this))
            .addAction(0, "숨기기", PendingIntent.getService(this, 2, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
            .setOngoing(true).setSilent(true).setPriority(NotificationCompat.PRIORITY_MIN).build();
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, 41, n, type);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        if (ACT_STOP.equals(a)) { getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putBoolean("overlayOn", false).apply(); stopSelf(); return START_NOT_STICKY; }
        if (!canDraw(this)) { stopSelf(); return START_NOT_STICKY; }
        if (!started) {
            started = true;
            wm = (WindowManager) getSystemService(WINDOW_SERVICE);
            SharedPreferences sp = getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE);
            gx = sp.getInt("ovX", -1); gy = sp.getInt("ovY", dp(140));
            load();
            keepInside();
            h.postDelayed(() -> { if (!pets.isEmpty()) { Pet p = pets.get(0); p.say(p.greet.isEmpty() ? p.pick() : p.greet); } }, 1200);
            h.postDelayed(wanderTick, 7000); h.postDelayed(idleTick, 25000); h.postDelayed(talkTick, 30000);
        } else load();
        if (ACT_TALK.equals(a)) { final int i = intent.getIntExtra("i", -1); h.postDelayed(() -> playTalk(i), 300); }
        return START_STICKY;
    }

    /** 앱이 저장해 둔 그림 · 대사를 다시 읽어요. 같이 띄우는 사람이 바뀌면 창을 새로 만들어요 */
    void load() {
        JSONObject ov = null;
        try { ov = new JSONObject(getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).getString("data", "{}")).optJSONObject("ov"); } catch (Exception e) { }
        JSONArray mem = ov != null ? ov.optJSONArray("members") : null;
        List<JSONObject> ms = new ArrayList<>();
        if (mem != null && mem.length() >= 2) for (int i = 0; i < Math.min(5, mem.length()); i++) ms.add(mem.optJSONObject(i));
        else ms.add(ov);
        StringBuilder sb = new StringBuilder(); sb.append(ms.size());
        for (JSONObject o : ms) sb.append('|').append(o != null ? o.optString("id", "") : "");
        String ns = sb.toString();
        if (!ns.equals(sig)) {
            int oldW = pets.isEmpty() ? 0 : groupW(), oldN = pets.size();
            talkGen++; talking = false;
            for (Pet p : pets) p.destroy();
            pets.clear();
            for (int i = 0; i < ms.size(); i++) pets.add(new Pet(i));
            fitSize();
            // 무리가 넓어지거나 좁아져도 오른쪽 끝을 그대로: 원래 있던 자리 근처에 서요
            if (gx < 0) gx = dm().widthPixels - groupW() - dp(16);
            else if (oldN > 0) gx = gx + oldW - groupW();
            DisplayMetrics m = dm();
            gx = Math.max(0, Math.min(m.widthPixels - groupW(), gx));
            for (Pet p : pets) p.build();
            sig = ns;
        }
        boolean multi = ms.size() > 1;
        for (int i = 0; i < pets.size(); i++) {
            Pet p = pets.get(i);
            File f = multi ? new File(getFilesDir(), "ov_m_" + i + ".png") : null;
            if (f == null || !f.exists()) f = i == 0 ? new File(getFilesDir(), "widget_char.png") : null;
            p.loadImage(f);
            p.loadData(ms.get(i));
        }
        dialogs.clear(); dialogBase = 0;
        if (ov != null) {
            wander = ov.optBoolean("wander", false); wSpeed = (float) ov.optDouble("wspeed", 1); if (wSpeed <= 0) wSpeed = 1;
            Babble.quietInSilent = ov.optBoolean("quietSilent", false);
            duoAuto = ov.optBoolean("duoAuto", true); duoVoice = ov.optBoolean("duoVoice", true);
            dialogBase = ov.optInt("dialogBase", 0);
            JSONArray dl = ov.optJSONArray("dialogs");
            if (dl != null) for (int i = 0; i < dl.length(); i++) {
                JSONArray c = dl.optJSONArray(i); if (c == null) continue;
                List<String[]> conv = new ArrayList<>();
                for (int j = 0; j < c.length(); j++) { JSONObject l = c.optJSONObject(j); if (l == null) continue; String t = l.optString("t", "").trim(); if (t.isEmpty()) continue; conv.add(new String[] { String.valueOf(l.optInt("w", 0)), t, l.optString("m", "") }); }
                if (!conv.isEmpty()) dialogs.add(conv);
            }
        }
        if (!multi) talking = false;
    }

    @Override public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        stopWalk();
        for (Pet p : pets) p.destroy();
        pets.clear();
        super.onDestroy();
    }
}
