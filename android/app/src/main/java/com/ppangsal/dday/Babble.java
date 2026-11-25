package com.ppangsal.dday;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;

/** 웅얼웅얼 말소리 재생 (글자마다 하나씩, 화면에 글자가 나타나는 박자와 같게). */
public class Babble {
    static final int SR = Voice.SR;
    static AudioTrack last;
    /** true면 무음·진동 모드일 때 소리를 안 내요. 기본은 false: 게임처럼 미디어 음량으로 소리가 나요 */
    static boolean quietInSilent = false;

    static void play(Context ctx, String text, String type, float pitch, float speed, float vol) {
        if (type == null || type.isEmpty() || "none".equals(type) || text == null) return;
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (quietInSilent && am != null && am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return;
        // 글자가 나타나는 박자에 맞춰 글자마다 소리 (대사가 길면 그만큼 길게) — 소리 만들기는 Voice.java
        short[] buf = Voice.render(text, type, pitch, speed, vol);
        if (buf == null) return;
        int n = buf.length;
        try {
            if (last != null) { try { last.stop(); last.release(); } catch (Exception e) { } }
            AudioTrack at = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(SR).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setTransferMode(AudioTrack.MODE_STATIC).setBufferSizeInBytes(n * 2).build();
            at.write(buf, 0, n);
            at.play();
            last = at;
        } catch (Exception e) { }
    }
}
