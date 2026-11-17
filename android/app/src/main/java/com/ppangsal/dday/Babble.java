package com.ppangsal.dday;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import java.util.Random;

/** 동물의 숲처럼 웅얼웅얼 말소리 (글자 수만큼 짧은 소리). 휴대폰이 무음 · 진동이면 소리를 내지 않아요. */
public class Babble {
    static final int SR = 22050;
    static AudioTrack last;

    static void play(Context ctx, String text, String type, float pitch, float speed, float vol) {
        if (type == null || type.isEmpty() || "none".equals(type) || text == null) return;
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am != null && am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return;
        float base; int wave; float gain; int mode = 0; float fixDur = 0, ring = 0, crackle = 0, lpHz = 0;
        // wave: 0 사인 1 세모 2 네모 3 얇은 네모(8비트) 4 톱니 5 딸깍 / mode: 0 웅얼 1 같은 높이 2 번갈아 3 도미솔도
        switch (type) {
            case "high": base = 440; wave = 1; gain = .55f; break;
            case "low": base = 185; wave = 2; gain = .42f; break;
            case "whisper": base = 250; wave = 0; gain = .30f; break;
            case "round": base = 350; wave = 1; gain = .6f; break;
            case "mono": base = 520; wave = 2; gain = .32f; mode = 1; fixDur = .038f; break;
            case "robot": base = 150; wave = 2; gain = .42f; mode = 1; fixDur = .07f; ring = 68; lpHz = 2400; break;
            case "beep": base = 880; wave = 0; gain = .42f; mode = 2; fixDur = .05f; break;
            case "chip": base = 440; wave = 3; gain = .40f; mode = 3; fixDur = .045f; break;
            case "radio": base = 230; wave = 4; gain = .34f; mode = 0; fixDur = .065f; crackle = .25f; lpHz = 1800; break;
            case "deep": base = 92; wave = 4; gain = .55f; mode = 1; fixDur = .085f; lpHz = 700; break;
            case "typer": base = 1800; wave = 5; gain = .5f; mode = 1; fixDur = .03f; break;
            default: base = 300; wave = 2; gain = .40f; // mid
        }
        int syl = 0; for (char ch : text.toCharArray()) if (!Character.isWhitespace(ch) && Character.isLetterOrDigit(ch)) syl++;
        syl = Math.max(2, Math.min(syl, 16));
        float sp = (float) Math.sqrt(Math.max(.4f, speed));
        float dur = (fixDur > 0 ? fixDur : .055f) / sp, gap = .03f / Math.max(.4f, speed);
        int per = (int) ((dur + gap) * SR), n = per * syl + SR / 20;
        short[] buf = new short[n];
        Random r = new Random();
        int[] semis = { 0, 2, 4, -2, 5, 3, -1 }, arp = { 0, 4, 7, 12 };
        boolean ask = text.trim().endsWith("?");
        double ph = 0, lp = 0, rph = 0, a = lpHz > 0 ? 1 - Math.exp(-2 * Math.PI * lpHz / SR) : 1;
        for (int s = 0; s < syl; s++) {
            int semi = mode == 1 ? 0 : mode == 2 ? (s % 2 == 1 ? 7 : 0) : mode == 3 ? arp[s % 4] : semis[r.nextInt(semis.length)];
            if (mode != 0 && ask && s == syl - 1) semi += 4;
            double f0 = base * Math.pow(2, (semi + pitch) / 12.0);
            int len = (int) (dur * SR), off = s * per;
            for (int i = 0; i < len && off + i < n; i++) {
                double t = (double) i / len, f = f0 * (mode != 0 ? 1 : "round".equals(type) ? 1 + .18 * t : 1 - .04 * t);
                ph += 2 * Math.PI * f / SR;
                double w;
                if (wave == 0) w = Math.sin(ph);
                else if (wave == 1) w = 2 / Math.PI * Math.asin(Math.sin(ph)); // 세모
                else if (wave == 3) w = ((ph / (2 * Math.PI)) % 1) < .125 ? .6 : -.25; // 얇은 네모
                else if (wave == 4) w = (((ph / (2 * Math.PI)) % 1) * 2 - 1) * .6; // 톱니
                else if (wave == 5) w = (r.nextDouble() * 2 - 1) * (1 - t) + .3 * Math.sin(ph * .5); // 딸깍
                else w = Math.sin(ph) > 0 ? .55 : -.55; // 네모 (부드럽게 작게)
                if (crackle > 0) w = Math.tanh(w * 3) * .6 + (r.nextDouble() * 2 - 1) * crackle;
                if (ring > 0) { rph += 2 * Math.PI * ring / SR; w *= Math.sin(rph) > 0 ? 1 : 0; }
                lp += a * (w - lp); w = lp;
                double env = mode != 0 ? (wave == 5 ? Math.pow(1 - t, 3) : Math.min(1, t * 40) * (t < .7 ? 1 : (1 - t) / .3)) : Math.min(1, t * 12) * Math.pow(1 - t, 1.6);
                buf[off + i] = (short) Math.max(-32767, Math.min(32767, w * env * gain * vol * 0.55 * Short.MAX_VALUE));
            }
        }
        try {
            if (last != null) { try { last.stop(); last.release(); } catch (Exception e) { } }
            AudioTrack at = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(SR).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(n * 2).build();
            at.write(buf, 0, n);
            at.play();
            last = at;
        } catch (Exception e) { }
    }
}
