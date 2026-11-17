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
    String greet = "", name = "";
    ObjectAnimator breathe;
    int sizePx;

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
        if (root == null) { build(); load(); h.postDelayed(() -> say(greet.isEmpty() ? pick() : greet), 1200); }
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
            float sx, sy; int ox, oy; boolean drag, longed; long t0;
            final Runnable lpress = () -> { longed = true; showMenu(); };
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        sx = e.getRawX(); sy = e.getRawY(); ox = lp.x; oy = lp.y; drag = false; longed = false; t0 = System.currentTimeMillis();
                        h.postDelayed(lpress, 550); return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = e.getRawX() - sx, dy = e.getRawY() - sy;
                        if (!drag && Math.abs(dx) + Math.abs(dy) > slop) { drag = true; h.removeCallbacks(lpress); hideMenu(); }
                        if (drag) { lp.x = Math.round(ox + dx); lp.y = Math.round(oy - dy); try { wm.updateViewLayout(root, lp); } catch (Exception ex) { } }
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        h.removeCallbacks(lpress);
                        if (drag) getSharedPreferences(DdayWidget.PREFS, MODE_PRIVATE).edit().putInt("ovX", lp.x).putInt("ovY", lp.y).apply();
                        else if (!longed && e.getActionMasked() == MotionEvent.ACTION_UP) { hideMenu(); hop(); say(pick()); }
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
                JSONArray ls = ov.optJSONArray("lines");
                if (ls != null) for (int i = 0; i < ls.length(); i++) { String s = ls.optString(i, "").trim(); if (!s.isEmpty()) lines.add(s); }
                greet = ov.optString("greet", ""); name = ov.optString("name", "");
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
