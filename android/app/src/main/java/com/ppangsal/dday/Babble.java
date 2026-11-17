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
        float base, k; int wave; float gain;
        switch (type) {
            case "high": base = 440; wave = 1; gain = .55f; break;
            case "low": base = 185; wave = 2; gain = .42f; break;
            case "whisper": base = 250; wave = 0; gain = .30f; break;
            case "round": base = 350; wave = 1; gain = .6f; break;
            default: base = 300; wave = 2; gain = .40f; // mid
        }
        int syl = 0; for (char ch : text.toCharArray()) if (!Character.isWhitespace(ch) && Character.isLetterOrDigit(ch)) syl++;
        syl = Math.max(2, Math.min(syl, 16));
        float dur = .055f / (float) Math.sqrt(Math.max(.4f, speed)), gap = .03f / Math.max(.4f, speed);
        int per = (int) ((dur + gap) * SR), n = per * syl + SR / 20;
        short[] buf = new short[n];
        Random r = new Random();
        int[] semis = { 0, 2, 4, -2, 5, 3, -1 };
        double ph = 0;
        for (int s = 0; s < syl; s++) {
            double f0 = base * Math.pow(2, (semis[r.nextInt(semis.length)] + pitch) / 12.0);
            int len = (int) (dur * SR), off = s * per;
            for (int i = 0; i < len && off + i < n; i++) {
                double t = (double) i / len, f = f0 * ("round".equals(type) ? 1 + .18 * t : 1 - .04 * t);
                ph += 2 * Math.PI * f / SR;
                double w;
                if (wave == 0) w = Math.sin(ph);
                else if (wave == 1) w = 2 / Math.PI * Math.asin(Math.sin(ph)); // 세모
                else w = Math.sin(ph) > 0 ? .55 : -.55; // 네모 (부드럽게 작게)
                double env = Math.min(1, t * 12) * Math.pow(1 - t, 1.6);
                buf[off + i] = (short) (w * env * gain * vol * 0.55 * Short.MAX_VALUE);
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
