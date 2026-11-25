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
        final List<String> lines = new ArrayList<>(), idle = new ArrayList<>(), bumpLines = new ArrayList<>(), petLines = new ArrayList<>();
        FrameLayout fxRoot; WindowManager.LayoutParams flp; String petShape = "heart"; int[] petCols; boolean petOff = false;
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

            // 쓰다듬기 하트 · 별이 뜨는 창 (눌리지 않아요)
            fxRoot = new FrameLayout(OverlayService.this); fxRoot.setClipChildren(false);
            flp = new WindowManager.LayoutParams(Math.round(sizePx * 1.6f), Math.round(sizePx * 1.6f), type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
            flp.gravity = Gravity.BOTTOM | Gravity.START; flp.x = slot(idx) - (flp.width - sizePx) / 2; flp.y = gy + sizePx / 4;
            wm.addView(img, ilp);
            wm.addView(fxRoot, flp);
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
            try { if (fxRoot != null) wm.removeView(fxRoot); } catch (Exception e) { }
        }

        void setSize() {
            ilp.width = sizePx; ilp.height = sizePx; img.setPivotY(sizePx); img.setPivotX(sizePx / 2f);
            if (flp != null) { flp.width = Math.round(sizePx * 1.6f); flp.height = flp.width; }
        }

        /* 그림 창을 무리 자리로, 말풍선 창은 그 위로 */
        void move() {
            ilp.x = slot(idx); ilp.y = gy;
            try { wm.updateViewLayout(img, ilp); } catch (Exception e) { }
            if (flp != null) { flp.x = slot(idx) - (flp.width - sizePx) / 2; flp.y = gy + sizePx / 4; try { wm.updateViewLayout(fxRoot, flp); } catch (Exception e) { } }
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
                /* mode: 0 그냥 누름 · 1 움직이기 시작(끌기인지 쓰다듬기인지 보는 중) · 2 끌기 · 3 쓰다듬기 */
                float sx, sy, lx, ly, lastRx; int ox, oy, mode, dirX, flips; long pendT, heartT; boolean longed; android.view.VelocityTracker vt;
                final Runnable lpress = () -> { if (mode == 0) { longed = true; showMenu(); } };
                @Override public boolean onTouch(View v, MotionEvent e) {
                    long now = android.os.SystemClock.uptimeMillis();
                    switch (e.getActionMasked()) {
                        case MotionEvent.ACTION_DOWN:
                            stopWalk(); touching = true; quietUntil = System.currentTimeMillis() + 5000;
                            lx = e.getX() / Math.max(1, v.getWidth()); ly = e.getY() / Math.max(1, v.getHeight());
                            sx = e.getRawX(); sy = e.getRawY(); lastRx = sx; ox = gx; oy = gy; mode = 0; dirX = 0; flips = 0; longed = false;
                            stopFling(); if (vt != null) vt.recycle(); vt = android.view.VelocityTracker.obtain(); vt.addMovement(e);
                            h.postDelayed(lpress, 550); return true;
                        case MotionEvent.ACTION_MOVE: {
                            float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                            if (vt != null) vt.addMovement(e);
                            // 좌우로 왔다 갔다 한 횟수 (쓰다듬기 알아보기)
                            float mx = e.getRawX() - lastRx;
                            if (Math.abs(mx) > dp(6)) { int d = mx > 0 ? 1 : -1; if (dirX != 0 && d != dirX) flips++; dirX = d; lastRx = e.getRawX(); }
                            if (mode == 0 && Math.abs(dx) + Math.abs(dy) > slop) { mode = 1; pendT = now; h.removeCallbacks(lpress); }
                            if (mode == 1) {
                                if (flips >= 1 && !petOff && Math.abs(dy) < sizePx * .6f) { mode = 3; petStart(); }
                                else if (now - pendT > 220 || Math.abs(dx) + Math.abs(dy) > dp(42)) { mode = 2; for (Pet p : pets) p.hideMenu(); hangStart(); }
                            }
                            if (mode == 2) { // 같이 서 있는 친구들도 함께 옮겨요. 화면 끝에 닿으면 "아야!"
                                int side = moveGroup(Math.round(ox + dx), Math.round(oy - dy));
                                if (side != 0) bump(Pet.this, side, false);
                                if (vt != null) { vt.computeCurrentVelocity(1000); hangVx = vt.getXVelocity(); }
                            } else if (mode == 3 && now - heartT > 130) { heartT = now; spawnFx(e.getX() / Math.max(1, v.getWidth())); }
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL:
                            h.removeCallbacks(lpress); touching = false; quietUntil = System.currentTimeMillis() + 5000;
                            boolean up = e.getActionMasked() == MotionEvent.ACTION_UP;
                            if (mode == 2) {
                                float fvx = 0, fvy = 0; if (vt != null) { vt.addMovement(e); vt.computeCurrentVelocity(1000); fvx = vt.getXVelocity(); fvy = vt.getYVelocity(); }
                                hangVx = 0;
                                if (Math.hypot(fvx, fvy) > 1300) fling(Pet.this, fvx, -fvy); else { hangLand(); keepInside(); prefsPos(); }
                            } else if (mode == 3) { if (up) petEnd(); }
                            else if (!longed && up) { hideMenu(); motion("hop"); say(pickFor(lx, ly)); tapped(Pet.this); }
                            if (vt != null) { vt.recycle(); vt = null; }
                            return true;
                    }
                    return false;
                }
            };
        }

        /* ---------- 쓰다듬기: 손가락으로 좌우로 슥슥 → 하트 · 별이 뿅뿅, 다 쓰다듬으면 좋아해요 ---------- */
        void petStart() {
            if (breathe != null) breathe.pause();
            img.animate().scaleX(1.04f).scaleY(.95f).setDuration(160).start();
            for (int i = 0; i < 3; i++) { final float fx = .35f + i * .15f; h.postDelayed(() -> spawnFx(fx), i * 90); }
        }
        void petEnd() {
            img.animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(new android.view.animation.OvershootInterpolator(2.5f)).withEndAction(() -> { if (breathe != null) breathe.resume(); }).start();
            motion("hop");
            String[] D = { "헤헤, 좋다~", "간지러워!", "더 쓰다듬어 줘", "기분 좋아…" };
            say(!petLines.isEmpty() ? petLines.get(rnd.nextInt(petLines.size())) : D[rnd.nextInt(D.length)]);
        }
        /** 하트(또는 별) 하나가 손가락 근처에서 올라가며 사라져요 */
        void spawnFx(float fx) {
            if (fxRoot == null) return;
            int W = flp.width, H = flp.height, s = Math.max(dp(12), Math.round(sizePx * .16f * (.7f + rnd.nextFloat() * .6f)));
            boolean star = "star".equals(petShape) || ("mix".equals(petShape) && rnd.nextBoolean());
            int col;
            if (petCols != null) col = petCols[rnd.nextInt(petCols.length)];
            else if (star) col = new int[] { 0xFFFFD34D, 0xFFFFE58A, 0xFFFFB703 }[rnd.nextInt(3)];
            else col = new int[] { 0xFFFF7FA8, 0xFFFFB3D0, 0xFFFF5C8A, 0xFFFFC6DC }[rnd.nextInt(4)];
            FxShape v = new FxShape(OverlayService.this, star, col);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(s, s);
            float cx = (W - sizePx) / 2f + Math.max(.1f, Math.min(.9f, fx)) * sizePx;
            lp.leftMargin = Math.round(cx - s / 2f + (rnd.nextFloat() - .5f) * s * 1.4f);
            lp.topMargin = Math.round(H - sizePx * .62f - s / 2f + (rnd.nextFloat() - .5f) * s * .6f);
            fxRoot.addView(v, lp);
            v.setRotation((rnd.nextFloat() * 2 - 1) * 22);
            v.setScaleX(.4f); v.setScaleY(.4f);
            v.animate().translationY(-dp(46) - rnd.nextInt(dp(24))).translationX((rnd.nextFloat() - .5f) * s * 2.4f).scaleX(1f).scaleY(1f).alpha(0f).setDuration(1050)
                .setInterpolator(new android.view.animation.DecelerateInterpolator()).withEndAction(() -> fxRoot.removeView(v)).start();
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
            // 말소리와 같은 박자로 한 글자씩 (PC와 같아요)
            final int[] at = Voice.schedule(full, vSpeed, voice);
            final long t0 = android.os.SystemClock.uptimeMillis();
            final int[] k = { 0 };
            typer = new Runnable() { @Override public void run() {
                long el = android.os.SystemClock.uptimeMillis() - t0; int nk = k[0];
                while (nk < full.length() && at[nk] <= el) nk++;
                if (nk != k[0]) {
                    k[0] = nk;
                    android.text.SpannableString s2 = new android.text.SpannableString(full);
                    if (k[0] < full.length()) s2.setSpan(new android.text.style.ForegroundColorSpan(0x00000000), k[0], full.length(), 0);
                    bub.setText(s2);
                }
                if (k[0] < full.length()) h.postDelayed(this, 16);
            } };
            h.post(typer);
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
            petLines.clear(); JSONArray pl = o.optJSONArray("pet"); if (pl != null) for (int i = 0; i < pl.length(); i++) { String x = pl.optString(i, "").trim(); if (!x.isEmpty()) petLines.add(x); }
            petOff = o.optBoolean("petOff", false); petShape = o.optString("petShape", "heart");
            petCols = shades(o.optString("petColor", ""));
            bumpLines.clear(); JSONArray bl = o.optJSONArray("bump"); if (bl != null) for (int i = 0; i < bl.length(); i++) { String x = bl.optString(i, "").trim(); if (!x.isEmpty()) bumpLines.add(x); }
            JSONArray ls = o.optJSONArray("lines"); if (ls != null) for (int i = 0; i < ls.length(); i++) { String x = ls.optString(i, "").trim(); if (!x.isEmpty()) lines.add(x); }
            greet = o.optString("greet", ""); name = o.optString("name", "");
            voice = o.optString("voice", ""); vPitch = (float) o.optDouble("pitch", 0); vSpeed = (float) o.optDouble("speed", 1); vVol = (float) o.optDouble("vol", .6);
        }
    }

    /** 고른 색 하나로 진하고 연한 네 가지 (PC와 같아요) */
    static int[] shades(String hex) {
        if (hex == null || !hex.matches("#?[0-9a-fA-F]{6}")) return null;
        int c = (int) Long.parseLong(hex.replace("#", ""), 16), r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
        float[][] t = { { 0, 0 }, { .45f, 1 }, { -.15f, 0 }, { .65f, 1 } }; int[] out = new int[4];
        for (int i = 0; i < 4; i++) { float k = t[i][0]; int[] v = { r, g, b }; for (int j = 0; j < 3; j++) v[j] = Math.round(k > 0 ? v[j] + (255 - v[j]) * k : v[j] * (1 + k)); out[i] = 0xFF000000 | (v[0] << 16) | (v[1] << 8) | v[2]; }
        return out;
    }
    /** 하트 · 별 모양 하나 (하얀 테두리) */
    static class FxShape extends View {
        final android.graphics.Paint f = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG), st = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        final android.graphics.Path p = new android.graphics.Path();
        FxShape(Context c, boolean star, int col) {
            super(c); f.setColor(col); st.setColor(Color.WHITE); st.setStyle(android.graphics.Paint.Style.STROKE); st.setStrokeJoin(android.graphics.Paint.Join.ROUND);
            if (star) { float[] P = { 12,2.6f, 14.75f,8.6f, 21.3f,9.25f, 16.37f,13.62f, 17.8f,20.05f, 12,16.7f, 6.2f,20.05f, 7.63f,13.62f, 2.7f,9.25f, 9.25f,8.6f }; p.moveTo(P[0], P[1]); for (int i = 2; i < P.length; i += 2) p.lineTo(P[i], P[i + 1]); p.close(); }
            else { p.moveTo(12, 21); p.cubicTo(5, 16.5f, 2.5f, 12.5f, 3.5f, 8.5f); p.cubicTo(4.5f, 5, 9, 4.2f, 12, 7.6f); p.cubicTo(15, 4.2f, 19.5f, 5, 20.5f, 8.5f); p.cubicTo(21.5f, 12.5f, 19, 16.5f, 12, 21); p.close(); }
        }
        @Override protected void onDraw(android.graphics.Canvas cv) { float k = getWidth() / 24f; cv.save(); cv.scale(k, k); st.setStrokeWidth(1.6f); cv.drawPath(p, f); cv.drawPath(p, st); cv.restore(); }
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
        { int[] at = Voice.schedule(text, p.vSpeed, p.voice); ms = Math.min(9000, Math.max(ms, at[text.length()] + 1100L)); } // 글자가 다 나온 뒤 조금 더 보여 줘요
        for (Pet o : pets) if (o != p) o.lean(p.idx > o.idx ? 1 : -1, ms + 400);
        int dir = w == 0 ? 1 : (w == pets.size() - 1 ? -1 : (rnd.nextBoolean() ? 1 : -1));
        p.motion(ln[2].isEmpty() ? null : ln[2], dir);
        p.sayOne(text, !duoVoice, ms);
        h.postDelayed(() -> step(gen, conv, k + 1), ms + 450);
    }

    /* ---------- 들어 올리면 대롱대롱 · 벽에 부딪히면 "아야!" · 휙 던지기 ---------- */
    float hangVx = 0, hangAng = 0, hangAv = 0; boolean hanging = false; long bumpAt = 0; ValueAnimator flinger;
    /** 무리를 (x, y)로 옮겨요. 화면 끝에서 멈추고, 닿은 쪽을 돌려줘요 (1 왼쪽 2 오른쪽 3 위 4 아래) */
    int moveGroup(int x, int y) {
        DisplayMetrics m = dm(); int side = 0, maxX = m.widthPixels - groupW(), maxY = m.heightPixels - sizePx - dp(8);
        if (x < 0) { x = 0; side = 1; } else if (x > maxX) { x = maxX; side = 2; }
        if (y > maxY) { y = maxY; side = side != 0 ? side : 3; } else if (y < 0) { y = 0; side = side != 0 ? side : 4; }
        gx = x; gy = y; for (Pet p : pets) p.move(); return side;
    }
    final Runnable hangTick = new Runnable() { @Override public void run() {
        float tgt = hanging ? Math.max(-38f, Math.min(38f, -hangVx / 60f)) : 0f;
        hangAv += (tgt - hangAng) * .09f; hangAv *= .86f; hangAng += hangAv;
        for (Pet p : pets) p.img.setRotation(hangAng);
        if (hanging || Math.abs(hangAng) > .15f || Math.abs(hangAv) > .05f) h.postDelayed(this, 16);
        else for (Pet p : pets) { p.img.setRotation(0); p.img.setPivotY(sizePx); }
    } };
    void hangStart() {
        hanging = true; stopWalk();
        for (Pet p : pets) { if (p.breathe != null) p.breathe.pause(); p.img.setPivotX(sizePx / 2f); p.img.setPivotY(sizePx * .1f); p.img.animate().scaleX(.96f).scaleY(1.05f).translationY(-dp(4)).setDuration(160).start(); }
        h.removeCallbacks(hangTick); h.post(hangTick);
    }
    void hangLand() {
        hanging = false; h.removeCallbacks(hangTick); h.post(hangTick);
        for (Pet p : pets) {
            final Pet q = p;
            q.img.animate().translationY(0).scaleX(1.08f).scaleY(.9f).setDuration(110).withEndAction(() -> {
                q.img.animate().scaleX(1f).scaleY(1f).setDuration(260).setInterpolator(new android.view.animation.OvershootInterpolator(3f)).withEndAction(() -> { if (q.breathe != null && !hanging) q.breathe.resume(); }).start();
            }).start();
        }
    }
    /** 벽에 쿵: 납작해졌다가 "아야!" */
    void bump(Pet who, int side, boolean hard) {
        long now = System.currentTimeMillis(); if (now - bumpAt < 1300) return; bumpAt = now;
        hangAv += (side == 1 ? 14 : side == 2 ? -14 : 0) * (hard ? 1.6f : 1f);
        for (Pet p : pets) {
            boolean sideHit = side <= 2;
            ObjectAnimator sx = ObjectAnimator.ofFloat(p.img, "scaleX", p.img.getScaleX(), sideHit ? .82f : 1.12f, 1.04f, 1f);
            ObjectAnimator sy = ObjectAnimator.ofFloat(p.img, "scaleY", p.img.getScaleY(), sideHit ? 1.08f : .84f, .97f, 1f);
            sx.setDuration(420); sy.setDuration(420); sx.start(); sy.start();
        }
        String[] L = { "아야!", "으앗!", "아야야…", "쿵! 아파~", "벽이다…!" };
        if (!who.bumpLines.isEmpty()) who.say("§s§" + who.bumpLines.get(rnd.nextInt(who.bumpLines.size())));
        else who.say("§s§" + L[rnd.nextInt(L.length)]);
    }
    /** 휙 던지면: 미끄러지다가 벽에 부딪히면 튕기며 "아야!" */
    void fling(final Pet who, float vx0, float vy0) {
        stopFling();
        final float[] v = { vx0 / 1000f, vy0 / 1000f }; final float[] p = { gx, gy }; final long[] last = { android.os.SystemClock.uptimeMillis() }; final int[] hits = { 0 };
        flinger = ValueAnimator.ofFloat(0f, 1f); flinger.setDuration(1500);
        flinger.addUpdateListener(a -> {
            long now = android.os.SystemClock.uptimeMillis(); float dt = Math.min(40, now - last[0]); last[0] = now;
            float dec = (float) Math.pow(.992, dt); v[0] *= dec; v[1] *= dec;
            p[0] += v[0] * dt; p[1] += v[1] * dt; hangVx = v[0] * 1000f;
            int side = moveGroup(Math.round(p[0]), Math.round(p[1]));
            if (side != 0) { if (side <= 2) v[0] = -v[0] * .35f; else v[1] = -v[1] * .35f; p[0] = gx; p[1] = gy; if (hits[0]++ < 2) bump(who, side, true); }
            if (Math.abs(v[0]) + Math.abs(v[1]) < .05f) a.cancel();
        });
        flinger.addListener(new android.animation.AnimatorListenerAdapter() {
            boolean done = false;
            void fin() { if (done) return; done = true; flinger = null; hangVx = 0; hangLand(); keepInside(); prefsPos(); }
            @Override public void onAnimationEnd(android.animation.Animator a) { fin(); }
            @Override public void onAnimationCancel(android.animation.Animator a) { fin(); }
        });
        flinger.start();
    }
    void stopFling() { if (flinger != null) flinger.cancel(); }

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
