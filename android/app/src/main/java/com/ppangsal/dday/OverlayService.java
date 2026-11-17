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
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/** 폰 화면 위에 떠 있는 캐릭터 (다른 앱 위에 표시). 끌어서 옮기고, 누르면 말풍선으로 한마디. */
public class OverlayService extends Service {
    static final String CH = "overlay", ACT_REFRESH = "refresh", ACT_STOP = "stop";
    static boolean running = false;

    WindowManager wm; WindowManager.LayoutParams lp;
    LinearLayout root, menu; BubbleView bub; ImageView img;
    String voice = ""; float vPitch = 0, vSpeed = 1, vVol = .6f;
    final Handler h = new Handler(Looper.getMainLooper());
    final Random rnd = new Random();
    List<String> lines = new ArrayList<>();
    /* 누른 부위: 앱이 보내 준 50×50 부위 지도 (0 없음 1 머리 2 얼굴 3 몸 4 팔 5 다리 6 귀 7 꼬리) + 부위별 대사 */
    String zmap = ""; java.util.Map<String, List<String>> zoneLines = new java.util.HashMap<>();
    static final String[] ZK = { null, "head", "face", "body", "hand", "foot", "ear", "tail", "all" };
    String zoneAt(float fx, float fy) {
        if (zmap.length() != 2500) return null;
        int x = Math.round(fx * 49), y = Math.round(fy * 49);
        for (int r = 0; r <= 2; r++) for (int dy = -r; dy <= r; dy++) for (int dx = -r; dx <= r; dx++) {
            int xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx > 49 || yy > 49) continue;
            int v = zmap.charAt(yy * 50 + xx) - '0'; if (v > 0 && v < ZK.length) return ZK[v];
        }
        return null;
    }
    String pickFor(float fx, float fy) { String z = zoneAt(fx, fy); List<String> L = z == null ? null : zoneLines.get(z); return L != null && !L.isEmpty() ? L.get(rnd.nextInt(L.size())) : pick(); }
    String greet = "", name = "";
    ObjectAnimator breathe;
    int sizePx;
    /* 돌아다니기: 지금 높이에서 좌우로 통통 튀며 걸어요 */
    boolean wander = false, touching = false; float wSpeed = 1f; long quietUntil = 0; ValueAnimator walker;
    final Runnable wanderTick = new Runnable() { @Override public void run() {
        h.postDelayed(this, 6000 + rnd.nextInt(8000));
        if (!wander || root == null || walker != null || touching || System.currentTimeMillis() < quietUntil) return;
        if (bub.getVisibility() == View.VISIBLE || menu.getVisibility() == View.VISIBLE || rnd.nextFloat() < .3f) return;
        walk();
    } };
    void walk() {
        int sw = getResources().getDisplayMetrics().widthPixels, rw = Math.max(root.getWidth(), sizePx);
        final int x0 = lp.x, dist = Math.round((150 + rnd.nextFloat() * 370) * getResources().getDisplayMetrics().density);
        int t = x0 + (rnd.nextBoolean() ? dist : -dist); t = Math.max(0, Math.min(sw - rw, t));
        if (Math.abs(t - x0) < dp(40)) return;
        final int target = t, dir = target > x0 ? 1 : -1;
        final float hopLen = dp(40) * wSpeed, hopMs = 430f / (float) Math.sqrt(wSpeed);
        final int hops = Math.max(1, Math.round(Math.abs(target - x0) / hopLen));
        walker = ValueAnimator.ofFloat(0f, 1f); walker.setDuration((long) (hops * hopMs)); walker.setInterpolator(null);
        walker.addUpdateListener(a -> {
            float k = (float) a.getAnimatedValue(), el = k * hops * hopMs, ph = (el % hopMs) / hopMs;
            float up = (float) Math.sin(Math.min(1f, ph) * Math.PI), sq = ph < .12f ? 1f - (.12f - ph) * .6f : 1f;
            img.setTranslationY(-up * dp(12)); img.setScaleX(2f - sq);
            lp.x = Math.round(x0 + (target - x0) * k); try { wm.updateViewLayout(root, lp); } catch (Exception ex) { }
        });
        walker.addListener(new android.animation.AnimatorListenerAdapter() {
            boolean done = false;
            void fin() { if (done) return; done = true; walker = null; img.setTranslationY(0); img.setScaleX(1f);
                getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putInt("ovX", lp.x).apply(); }
            @Override public void onAnimationEnd(android.animation.Animator a) { fin(); }
            @Override public void onAnimationCancel(android.animation.Animator a) { fin(); }
        });
        walker.start();
    }
    void stopWalk() { if (walker != null) walker.cancel(); }

    static boolean canDraw(Context c) { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c); }

    int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }

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
        if (root == null) { build(); load(); h.postDelayed(() -> say(greet.isEmpty() ? pick() : greet), 1200); h.postDelayed(wanderTick, 7000); }
        else load();
        return START_STICKY;
    }

    void build() {
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        sizePx = dp(112);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER_HORIZONTAL);

        bub = new BubbleView(this);
        bub.setMaxWidth(dp(210)); bub.setVisibility(View.GONE);

        menu = new LinearLayout(this); menu.setOrientation(LinearLayout.HORIZONTAL); menu.setVisibility(View.GONE);
        menu.addView(menuBtn("앱 열기", v -> { hideMenu(); try { DdayWidget.openApp(this).send(); } catch (Exception e) { } }));
        menu.addView(menuBtn("숨기기", v -> { getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putBoolean("overlayOn", false).apply(); stopSelf(); }));

        img = new ImageView(this); img.setScaleType(ImageView.ScaleType.FIT_CENTER);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(sizePx, sizePx); ip.topMargin = dp(4);
        root.addView(bub); root.addView(menu); root.addView(img, ip);

        SharedPreferences sp = getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.BOTTOM | Gravity.START; // 말풍선이 위로 자라게 아래 기준
        lp.x = sp.getInt("ovX", getResources().getDisplayMetrics().widthPixels - sizePx - dp(16));
        lp.y = sp.getInt("ovY", dp(140));
        wm.addView(root, lp);

        img.setPivotY(sizePx); img.setPivotX(sizePx / 2f);
        breathe = ObjectAnimator.ofFloat(img, "scaleY", 1f, 0.975f);
        breathe.setDuration(1700); breathe.setRepeatCount(ValueAnimator.INFINITE); breathe.setRepeatMode(ValueAnimator.REVERSE); breathe.start();

        final int slop = ViewConfiguration.get(this).getScaledTouchSlop();
        img.setOnTouchListener(new View.OnTouchListener() {
            float sx, sy, lx, ly; int ox, oy; boolean drag, longed; long t0;
            final Runnable lpress = () -> { longed = true; showMenu(); };
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        stopWalk(); touching = true; quietUntil = System.currentTimeMillis() + 5000;
                        lx = e.getX() / Math.max(1, v.getWidth()); ly = e.getY() / Math.max(1, v.getHeight());
                        sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; drag = false; longed = false; t0 = System.currentTimeMillis();
                        h.postDelayed(lpress, 550); return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (!drag && Math.abs(dx) + Math.abs(dy) > slop) { drag = true; h.removeCallbacks(lpress); hideMenu(); }
                        if (drag) { lp.x = Math.round(ox + dx); lp.y = Math.round(oy - dy); try { wm.updateViewLayout(root, lp); } catch (Exception ex) { } }
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        h.removeCallbacks(lpress); touching = false; quietUntil = System.currentTimeMillis() + 5000;
                        if (drag) getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putInt("ovX", lp.x).putInt("ovY", lp.y).apply();
                        else if (!longed && e.getActionMasked() == MotionEvent.ACTION_UP) { hideMenu(); hop(); say(pickFor(lx, ly)); }
                        return true;
                }
                return false;
            }
        });
    }

    TextView menuBtn(String t, View.OnClickListener l) {
        TextView b = new TextView(this); b.setText(t); b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f); b.setTextColor(Color.WHITE);
        b.setPadding(dp(12), dp(7), dp(12), dp(7));
        GradientDrawable g = new GradientDrawable(); g.setColor(0xE61B2230); g.setCornerRadius(dp(99)); b.setBackground(g);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, -2); p.setMargins(dp(3), dp(4), dp(3), 0); b.setLayoutParams(p);
        b.setOnClickListener(l); return b;
    }
    void showMenu() { h.removeCallbacks(hideBub); bub.setVisibility(View.GONE); menu.setVisibility(View.VISIBLE); h.postDelayed(this::hideMenu, 4000); }
    void hideMenu() { if (menu != null) menu.setVisibility(View.GONE); }

    void hop() {
        ObjectAnimator a = ObjectAnimator.ofFloat(img, "translationY", 0, -dp(14), 0);
        a.setDuration(380); a.start();
    }

    final Runnable hideBub = () -> {
        if (bub == null) return;
        bub.animate().alpha(0f).scaleX(.9f).scaleY(.9f).setDuration(160).withEndAction(() -> { bub.setVisibility(View.GONE); bub.setAlpha(1f); bub.setScaleX(1f); bub.setScaleY(1f); }).start();
    };
    Runnable typer;
    void say(String s) {
        stopWalk(); quietUntil = System.currentTimeMillis() + 4000;
        if (bub == null || s == null || s.isEmpty()) return;
        h.removeCallbacks(hideBub); if (typer != null) h.removeCallbacks(typer);
        hideMenu();
        final String full = s;
        // 크기를 먼저 맞춰 두고(투명 글자) 한 글자씩 보여 줘요
        android.text.SpannableString sp = new android.text.SpannableString(full);
        sp.setSpan(new android.text.style.ForegroundColorSpan(0x00000000), 0, full.length(), 0);
        bub.setText(sp);
        bub.setVisibility(View.VISIBLE);
        bub.setPivotX(bub.getWidth() > 0 ? bub.getWidth() / 2f : dp(60)); bub.setPivotY(dp(40));
        bub.setScaleX(.6f); bub.setScaleY(.6f); bub.setAlpha(0f);
        bub.animate().scaleX(1f).scaleY(1f).alpha(1f).setDuration(220).setInterpolator(new android.view.animation.OvershootInterpolator(2.2f)).start();
        Babble.play(this, full, voice, vPitch, vSpeed, vVol);
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
        h.postDelayed(hideBub, Math.max(2600, 1200 + full.length() * 120L));
    }

    String pick() { if (lines.isEmpty()) return name.isEmpty() ? "불렀어?" : "불렀어?"; return lines.get(rnd.nextInt(lines.size())); }

    /** 앱이 저장해 둔 그림 · 대사를 다시 읽어요 */
    void load() {
        File f = new File(getFilesDir(), "widget_char.png");
        Bitmap bm = f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
        if (bm != null) img.setImageBitmap(bm); else img.setImageResource(R.mipmap.ic_launcher_foreground);
        lines.clear(); greet = "";
        try {
            JSONObject d = new JSONObject(getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).getString("data", "{}"));
            JSONObject ov = d.optJSONObject("ov");
            if (ov != null) {
                zmap = ov.optString("zmap", ""); zoneLines.clear();
                JSONObject zl = ov.optJSONObject("zl");
                if (zl != null) { java.util.Iterator<String> it = zl.keys(); while (it.hasNext()) { String k = it.next(); JSONArray a = zl.optJSONArray(k); List<String> L = new ArrayList<>(); if (a != null) for (int i = 0; i < a.length(); i++) { String x = a.optString(i, "").trim(); if (!x.isEmpty()) L.add(x); } if (!L.isEmpty()) zoneLines.put(k, L); } }
                JSONArray ls = ov.optJSONArray("lines");
                if (ls != null) for (int i = 0; i < ls.length(); i++) { String s = ls.optString(i, "").trim(); if (!s.isEmpty()) lines.add(s); }
                greet = ov.optString("greet", ""); name = ov.optString("name", "");
                wander = ov.optBoolean("wander", false); wSpeed = (float) ov.optDouble("wspeed", 1); if (wSpeed <= 0) wSpeed = 1;
                voice = ov.optString("voice", ""); vPitch = (float) ov.optDouble("pitch", 0); vSpeed = (float) ov.optDouble("speed", 1); vVol = (float) ov.optDouble("vol", .6);
            }
        } catch (Exception e) { }
    }

    @Override public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        if (breathe != null) breathe.cancel();
        if (root != null) try { wm.removeView(root); } catch (Exception e) { }
        root = null;
        super.onDestroy();
    }
}
