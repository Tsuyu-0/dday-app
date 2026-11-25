package com.ppangsal.dday;

import java.util.Random;

/** 말소리 소리 만들기 (안드로이드에 기대지 않는 순수 계산이라 따로 시험해 볼 수 있어요).
 *  PC와 같은 규칙: 글자가 하나씩 나타나는 박자(sched)에 맞춰 글자마다 소리를 하나씩 내고,
 *  같은 대사는 늘 같은 가락으로 (대사로 만든 씨앗값). 대사가 길면 그만큼 길게 웅얼거려요. */
public class Voice {
    static final int SR = 22050;
    /* 모음 21개의 포먼트 (PC zones.js의 VF와 같아요) */
    static final int[][] VF = { {800,1200},{600,1800},{800,1300},{600,1800},{600,1000},{500,1900},{600,1100},{500,1900},{450,800},{750,1150},{600,1700},{450,1700},{450,850},{350,800},{550,1000},{450,1700},{300,1900},{350,850},{350,1300},{330,1800},{300,2200} };
    /* 초성 종류: 0 ㅇ 1 터지는 소리 2 ㅅ·ㅆ 3 ㄴ·ㅁ 4 ㄹ 5 ㅎ */
    static final int[] CHO_K = { 1,1,3,1,1,4,3,1,1,2,2,0,1,1,1,1,1,1,5 };
    static final int[] CHO_F = { 1800,1800,0,2600,2600,0,0,1200,1200,5200,5200,0,3800,3800,4200,2000,3000,1500,0 };
    static final int[] SC = { 0,2,4,5,7,9,7,4 };

    /** 글자마다 나타나는 시각(밀리초). PC와 같아요: 보통 44ms, 문장부호 150ms, 띄어쓰기 24ms (빠르기로 나눔) */
    public static int[] schedule(String text, float speed) { return schedule(text, speed, ""); }
    /** 동글동글 웅얼(animal)은 글자마다 또박또박 들리게 한 글자를 조금 길게 (62ms) */
    public static int[] schedule(String text, float speed, String type) {
        float spd = Math.max(.4f, speed), per = type != null && type.startsWith("animal") ? 62 : 44; int n = text.length(); int[] at = new int[n + 1]; float t = 0;
        for (int i = 0; i < n; i++) {
            at[i] = Math.round(t); char ch = text.charAt(i);
            t += ".,!?…~".indexOf(ch) >= 0 ? 150 / spd : ch == ' ' ? 24 / spd : per / spd;
        }
        at[n] = Math.round(t);
        return at;
    }

    static long hsh(String s) { int h = (int) 2166136261L; for (int i = 0; i < s.length(); i++) { h ^= s.charAt(i); h *= 16777619; } return h & 0xffffffffL; }

    /** {초성, 모음, 받침} — 소리 낼 글자가 아니면 null */
    static int[] jamo(char ch) {
        if (ch >= 0xAC00 && ch <= 0xD7A3) { int o = ch - 0xAC00; return new int[] { o / 588, (o % 588) / 28, o % 28 }; }
        char l = Character.toLowerCase(ch);
        int v = "aeiouy".indexOf(l); if (v >= 0) return new int[] { 11, new int[] { 0, 5, 20, 8, 13, 20 }[v], 0 };
        String cs = "bcdfghjklmnpqrstvwxz"; int[] cm = { 7,14,3,17,0,18,12,15,5,6,2,17,15,5,9,16,7,11,9,12 };
        int ci = cs.indexOf(l); if (ci >= 0) return new int[] { cm[ci], 18, 0 };
        if (ch >= '0' && ch <= '9') return new int[] { 16, 20, 0 };
        if (ch >= 'ㄱ' && ch <= 'ㅎ') { int k = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".indexOf(ch); return new int[] { Math.max(0, k), 18, 0 }; }
        if (ch >= 'ㅏ' && ch <= 'ㅣ') return new int[] { 11, ch - 'ㅏ', 0 };
        return null;
    }

    /* 2차 공진 필터 (대역 통과) */
    static final class BP {
        double b0, b2, a1, a2, x1, x2, y1, y2;
        void set(double f, double q) { double w = 2 * Math.PI * Math.min(f, SR * .45) / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; b0 = al / a0; b2 = -al / a0; a1 = -2 * Math.cos(w) / a0; a2 = (1 - al) / a0; }
        double run(double x) { double y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
    }

    /**
     * 대사 전체 소리. type: 목소리 종류, pitch: 반음, speed: 빠르기, vol: 크기.
     * 돌려주는 값: 16비트 소리 샘플 (null이면 소리 없음)
     */
    public static short[] render(String text, String type, float pitch, float speed, float vol) {
        if (type == null || type.isEmpty() || "none".equals(type) || text == null || text.isEmpty()) return null;
        if (text.length() > 240) text = text.substring(0, 240);
        int[] at = schedule(text, speed, type);
        float spd = Math.max(.4f, speed), sq = (float) Math.sqrt(spd);
        int total = 0; for (int i = 0; i < text.length(); i++) if (jamo(text.charAt(i)) != null) total++;
        if (total == 0) return null;
        float[] mix = new float[(int) ((at[text.length()] / 1000f + .25f) * SR) + 1];
        String tt = text.trim();
        boolean q = tt.endsWith("?"), ex = tt.endsWith("!");
        long seed = hsh(text);
        Random r = new Random(seed);
        boolean animal = type.startsWith("animal");
        int syl = 0;
        for (int i = 0; i < text.length(); i++) {
            int[] j = jamo(text.charAt(i)); if (j == null) continue;
            int off = (int) (at[i] / 1000f * SR) + SR / 200;
            double semi;
            Spec sp = spec(type);
            if (sp.mode == 1) semi = (q && syl == total - 1) ? 4 : 0;
            else if (sp.mode == 2) semi = syl % 2 == 1 ? 7 : 0;
            else if (sp.mode == 3) semi = new int[] { 0, 4, 7, 12 }[syl % 4] + (q && syl == total - 1 ? 5 : 0);
            else {
                semi = SC[(int) (((seed >>> (syl % 24)) + syl * 3L) & 7)] - 3;
                double pos = total > 1 ? (double) syl / (total - 1) : 0; semi += -1.5 * pos;
                if (q && syl >= total - 2) semi += syl == total - 1 ? 7 : 4;
            }
            if (ex) semi += 2;
            double f0 = sp.base * Math.pow(2, (semi + pitch) / 12.0) * (sp.mode == 0 && !animal ? 1 + (r.nextDouble() - .5) * .02 : 1);
            if (animal) addAnimal(mix, off, j, f0, (.05 + (j[2] > 0 ? .008 : 0)) * sp.df / spd, sp, ex, q && syl >= total - 1, r);
            else addBlip(mix, off, j, f0, (sp.fixDur > 0 ? sp.fixDur : (j[2] > 0 ? .07f : .055f)) / sq, sp, ex, r, type);
            syl++;
        }
        short[] out = new short[mix.length];
        float g = vol * .55f;
        for (int i = 0; i < mix.length; i++) { double x = Math.tanh(mix[i] * g * 1.15) ; out[i] = (short) Math.round(x * 30000); }
        return out;
    }

    static final class Spec { float base, gain, fixDur, ring, crackle, lp, k = 1, df = 1; int wave, mode; boolean soft; }
    static Spec spec(String type) {
        Spec s = new Spec();
        // wave: 0 사인 1 세모 2 네모 3 얇은 네모(8비트) 4 톱니 5 딸깍 / mode: 0 웅얼 1 같은 높이 2 번갈아 3 도미솔도
        switch (type) {
            case "animal": s.base = 540; s.k = 1.42f; s.gain = .62f; break;
            case "animal3": s.base = 720; s.k = 1.62f; s.gain = .55f; break;
            case "animal4": s.base = 480; s.k = 1.36f; s.gain = .6f; s.df = .8f; break;
            case "animal2": s.base = 370; s.k = 1.24f; s.gain = .68f; s.soft = true; break;
            case "animal5": s.base = 310; s.k = 1.2f; s.gain = .62f; break;
            case "high": s.base = 440; s.wave = 1; s.gain = .55f; s.k = 1.15f; break;
            case "low": s.base = 185; s.wave = 2; s.gain = .42f; s.k = .9f; break;
            case "whisper": s.base = 250; s.wave = 0; s.gain = .30f; break;
            case "round": s.base = 350; s.wave = 1; s.gain = .6f; s.k = 1.05f; break;
            case "mono": s.base = 520; s.wave = 2; s.gain = .32f; s.mode = 1; s.fixDur = .038f; break;
            case "robot": s.base = 150; s.wave = 2; s.gain = .42f; s.mode = 1; s.fixDur = .07f; s.ring = 68; s.lp = 2400; break;
            case "beep": s.base = 880; s.wave = 0; s.gain = .42f; s.mode = 2; s.fixDur = .05f; break;
            case "chip": s.base = 440; s.wave = 3; s.gain = .40f; s.mode = 3; s.fixDur = .045f; break;
            case "radio": s.base = 230; s.wave = 4; s.gain = .34f; s.fixDur = .065f; s.crackle = .25f; s.lp = 1800; break;
            case "deep": s.base = 92; s.wave = 4; s.gain = .55f; s.mode = 1; s.fixDur = .085f; s.lp = 700; break;
            case "typer": s.base = 1800; s.wave = 5; s.gain = .5f; s.mode = 1; s.fixDur = .03f; break;
            default: s.base = 300; s.wave = 2; s.gain = .40f; // mid
        }
        return s;
    }

    /* 동물 마을 같은 웅얼: 자음(톡 · 쓰 · 하) + 성대 소리(톱니) → 모음 색(포먼트 둘) + 받침 음~ */
    static void addAnimal(float[] mix, int off, int[] j, double f0, double dur, Spec sp, boolean loud, boolean rise, Random r) {
        int k = CHO_K[j[0]];
        double pk = sp.gain * (loud ? 1.3 : 1), F1 = VF[j[1]][0] * sp.k, F2 = VF[j[1]][1] * sp.k;
        int onN = 0;
        if (k == 1 || k == 2 || k == 5) {
            double nl = k == 1 ? .009 : k == 2 ? .022 : .016; onN = (int) ((k == 1 ? .006 : k == 2 ? .016 : .01) * SR);
            BP nf = new BP(); nf.set(k == 5 ? 1400 : (CHO_F[j[0]] > 0 ? CHO_F[j[0]] : 2500), k == 2 ? .9 : 1.4);
            double na = pk * (k == 1 ? .55 : k == 2 ? .32 : .25) * (sp.soft ? .6 : 1) * .8; int L = (int) (nl * SR);
            for (int i = 0; i < L && off + i < mix.length; i++) { double e = Math.exp(-5.0 * i / L); mix[off + i] += (float) (nf.run(r.nextDouble() * 2 - 1) * na * e); }
        }
        int vo = off + onN, vN = (int) (Math.max(.025, dur - onN / (double) SR) * (j[2] > 0 ? .78 : 1) * SR);
        BP b1 = new BP(), b2 = new BP(); b1.set(F1, 5); b2.set(F2, 7);
        double ph = 0, lpS = 0;
        for (int i = 0; i < vN && vo + i < mix.length; i++) {
            double t = (double) i / vN;
            double f = f0 * (rise ? .95 + .17 * t : 1.05 - .12 * t);
            ph += f / SR; ph -= Math.floor(ph);
            double src = sp.soft ? 1 - 4 * Math.abs(ph - .5) : 2 * ph - 1;   // 세모 / 톱니
            if (k == 3 && i < SR * .018) b1.set(280 * sp.k + (F1 - 280 * sp.k) * (i / (SR * .018)), 5);
            else if (k == 4 && i < SR * .02) b2.set(1100 * sp.k + (F2 - 1100 * sp.k) * (i / (SR * .02)), 7);
            lpS += .3 * (src - lpS);
            double y = 1.5 * b1.run(src) + 1.0 * b2.run(src) + (sp.soft ? .18 : .07) * lpS;
            double env = Math.min(1, i / (SR * .005)) * (t < .6 ? 1 : Math.pow((1 - t) / .4, 1.5));
            mix[vo + i] += (float) (y * env * pk * .9);
        }
        if (j[2] == 4 || j[2] == 16 || j[2] == 21) {
            int te = vo + (int) (vN * .85), L = (int) (.03 * SR); double hp = 0, lp = 0;
            for (int i = 0; i < L && te + i < mix.length; i++) { hp += f0 * .97 / SR; hp -= Math.floor(hp); double w = 1 - 4 * Math.abs(hp - .5); lp += .18 * (w - lp); double e = Math.min(1, i / (SR * .006)) * Math.exp(-4.0 * i / L); mix[te + i] += (float) (lp * e * pk * .5); }
        }
    }

    /* 예전 목소리들 (높은 톤 · 삐빅 등): 글자 박자에 맞춰 하나씩 */
    static void addBlip(float[] mix, int off, int[] j, double f0, double dur, Spec sp, boolean loud, Random r, String type) {
        int len = (int) (dur * SR); double ph = 0, lp = 0, rph = 0, a = sp.lp > 0 ? 1 - Math.exp(-2 * Math.PI * sp.lp / SR) : 1;
        BP b1 = null, b2 = null;
        if (sp.mode == 0 && sp.wave != 5) { b1 = new BP(); b2 = new BP(); b1.set(VF[j[1]][0] * sp.k, 4); b2.set(VF[j[1]][1] * sp.k, 5); }
        for (int i = 0; i < len && off + i < mix.length; i++) {
            double t = (double) i / len, f = f0 * (sp.mode != 0 ? 1 : "round".equals(type) ? 1 + .18 * t : 1 - .04 * t);
            ph += 2 * Math.PI * f / SR;
            double w;
            if (sp.wave == 0) w = Math.sin(ph);
            else if (sp.wave == 1) w = 2 / Math.PI * Math.asin(Math.sin(ph));
            else if (sp.wave == 3) w = ((ph / (2 * Math.PI)) % 1) < .125 ? .6 : -.25;
            else if (sp.wave == 4) w = (((ph / (2 * Math.PI)) % 1) * 2 - 1) * .6;
            else if (sp.wave == 5) w = (r.nextDouble() * 2 - 1) * (1 - t) + .3 * Math.sin(ph * .5);
            else w = Math.sin(ph) > 0 ? .55 : -.55;
            if (sp.crackle > 0) w = Math.tanh(w * 3) * .6 + (r.nextDouble() * 2 - 1) * sp.crackle;
            if (sp.ring > 0) { rph += 2 * Math.PI * sp.ring / SR; w *= Math.sin(rph) > 0 ? 1 : 0; }
            lp += a * (w - lp); w = lp;
            if (b1 != null) w = .45 * w + 1.1 * b1.run(w) + .7 * b2.run(w); // 모음 색을 살짝
            double env = sp.mode != 0 ? (sp.wave == 5 ? Math.pow(1 - t, 3) : Math.min(1, t * 40) * (t < .7 ? 1 : (1 - t) / .3)) : Math.min(1, t * 12) * Math.pow(1 - t, 1.6);
            mix[off + i] += (float) (w * env * sp.gain * (loud ? 1.3 : 1));
        }
    }
}
