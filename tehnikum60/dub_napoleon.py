"""Episode 5 «Диалог с горгульей» dubbed into Spanish with the actors' own voices (open tools only):
Demucs splits the Russian mix into voices and the rest; faster-whisper finds each line's time; the lines
are matched to the script; Chatterbox Multilingual (MIT) clones Napoleon's and Jean's voices from the
Russian take and speaks the Spanish; each line is fitted into its Russian slot and laid over the
original music and effects. Jean's non-verbal lines (laughs, «у-у-у», «а-а-а») keep his own take.
    python3 tehnikum60/dub_napoleon.py [step]      steps: split, asr, refs, tts, mix (default: all)
"""
import json, subprocess, sys, difflib, re
from pathlib import Path
import numpy as np

D = Path(__file__).resolve().parent / "napoleon_src"
OUT = Path(__file__).resolve().parents[1] / "VTT60_NAPOLEON"
SR = 44100
STEPS = sys.argv[1:] or ["split", "asr", "refs", "tts", "mix"]

# the lines as the actors recorded them (they differ from the script table: «Головы!» for «Хи-хи», the
# gargoyle's «Сам?» twice, the restoration speech before the fire); times from the ASR words (s, e).
# Everything not listed (Napoleon's scream, «у-у-у», «ой», «а-а-а») stays the actors' own sound.
LINES = [
    ("N", 3.55, 11.95, "¿Yo, una rata de iglesia? ¡Pero si soy descendiente del mismísimo Napoleón primero! Desde esta cornisa te contemplan ocho siglos."),
    ("N", 12.45, 12.95, "Y yo."),
    ("N", 14.00, 18.45, "¡Notre-Dame, símbolo de grandeza! Ponen la primera piedra… y tardan casi doscientos años."),
    ("N", 19.75, 22.00, "¡Aquí coronan a un rey inglés!"),
    ("N", 22.35, 24.95, "Puaj. Ingleses. Nunca más."),
    ("N", 26.65, 31.60, "Destrozaron las estatuas. Ningún respeto por el patrimonio. Perdieron la cabeza."),
    ("J", 31.75, 32.60, "¡Cabezas!"),
    ("N", 34.35, 37.80, "¡Un gran día! Nuestro antepasado se coronó él mismo."),
    ("J", 37.85, 38.30, "¿Solo?"),
    ("N", 38.80, 39.90, "Y a Josefina."),             # a little later than the Russian: «¿Solo?» needs the room
    ("J", 41.15, 42.20, "¿Él solito?"),
    ("N", 43.35, 48.55, "Monsieur Hugo escribe una novela, París llora y se acuerda de Notre-Dame de París."),
    ("N", 49.25, 50.45, "¡Por fin la restauran!"),
    ("N", 53.15, 55.00, "¡Quimeras! ¡Otra vez aquí!"),
    ("N", 55.75, 61.10, "Restauración… Me encanta. Catedrales, monarquías… Toda restauración es maravillosa. Incluso la ajena."),
    ("N", 63.35, 67.40, "Otra vez ardió el tejado, se cayó la aguja. Pero lo arreglaron rapidito."),
    ("N", 74.65, 75.55, "Retirada estratégica."),
]


def sh(*a): subprocess.run(list(map(str, a)), check=True)
def load(p):
    import soundfile as sf
    x, sr = sf.read(str(p), always_2d=True); assert sr == SR, sr
    return x.mean(axis=1) if x.shape[1] > 1 else x[:, 0]
def save(p, x):
    import soundfile as sf
    sf.write(str(p), np.clip(x, -1, 1), SR, subtype="PCM_24")


# 1. voices / the rest
if "split" in STEPS:
    sh("ffmpeg", "-v", "error", "-y", "-i", D / "n5_ru.mp3", "-ar", SR, "-ac", "2", D / "n5_ru.wav")
    sh(sys.executable, "-m", "demucs", "--two-stems=vocals", "-n", "htdemucs", "-o", D / "sep", D / "n5_ru.wav")
    for k in ("vocals", "no_vocals"):
        sh("ffmpeg", "-v", "error", "-y", "-i", D / "sep/htdemucs/n5_ru" / f"{k}.wav", "-ar", SR, D / f"{k}.wav")
    print("split ok")

# 2. where each line is: whisper words, matched to the script in order
if "asr" in STEPS:
    from faster_whisper import WhisperModel
    m = WhisperModel("small", device="cpu", compute_type="int8")   # small: the disk is tight, the script fixes the words
    import librosa
    audio16, _ = librosa.load(str(D / "vocals.wav"), sr=16000, mono=True)   # (a raw array: this PyAV cannot open files for faster-whisper)
    segs, _ = m.transcribe(audio16, language="ru", word_timestamps=True, vad_filter=False,
                           initial_prompt="Наполеон, Нотр-Дам, Жозефина, Гюго, химеры, горгулья.")
    words = [dict(w=w.word.strip(), s=w.start, e=w.end) for sg in segs for w in sg.words]
    json.dump(words, open(D / "asr_words.json", "w"), ensure_ascii=False, indent=0)
    print(len(words), "words"); print(" ".join(f"{w['w']}[{w['s']:.1f}]" for w in words))
    # each script line: the best window of consecutive words, searched forward from the previous line
    norm = lambda s: re.sub(r"[^а-яё ]", "", s.lower().replace("-", " "))
    pos, timing = 0, []
    for spk, ru, es in LINES:
        target = norm(ru); n = max(1, len(target.split())); best = (0, pos, pos)
        for i in range(pos, min(len(words), pos + 60)):
            for j in range(i + 1, min(len(words), i + n + 6) + 1):
                cand = norm(" ".join(w["w"] for w in words[i:j]))
                r = difflib.SequenceMatcher(None, cand, target).ratio()
                if r > best[0]: best = (r, i, j)
        r, i, j = best
        if r >= 0.45:
            timing.append(dict(s=words[i]["s"], e=words[j - 1]["e"], score=round(r, 2), heard=" ".join(w["w"] for w in words[i:j]))); pos = j
        else:
            timing.append(None)
    json.dump(timing, open(D / "timing.json", "w"), ensure_ascii=False, indent=1)
    for (spk, ru, _), t in zip(LINES, timing): print(spk, t and f"{t['s']:6.2f}-{t['e']:6.2f} {t['score']} | {t['heard']}", "||", ru)

# 3. the gaps (lines whisper did not catch, mostly Jean's sounds): placed in the voiced stretches between
#    their neighbours; then the voice references
def fill_gaps(timing):
    v = load(D / "vocals.wav"); hop = SR // 100
    env = np.sqrt(np.convolve(v ** 2, np.ones(hop) / hop, "same"))[::hop]
    on = env > max(0.01, np.percentile(env, 60) * 0.5)
    runs, k = [], 0
    while k < len(on):
        if on[k]:
            j = k
            while j < len(on) and on[j]: j += 1
            if j - k > 8: runs.append((k / 100, j / 100))
            k = j
        else: k += 1
    out = list(timing)
    for idx, t in enumerate(out):
        if t: continue
        lo = next((out[i]["e"] for i in range(idx - 1, -1, -1) if out[i]), 0.0)
        hi = next((out[i]["s"] for i in range(idx + 1, len(out)) if out[i]), len(v) / SR)
        cand = [r for r in runs if r[0] >= lo - 0.05 and r[1] <= hi + 0.05]
        if cand:
            a, b = max(cand, key=lambda r: r[1] - r[0]); out[idx] = dict(s=a, e=b, score=0, heard="(voiced stretch)")
    return out


if "refs" in STEPS:
    v = load(D / "vocals.wav")
    for spk in ("N", "J"):
        parts = [v[int(a * SR):int(b * SR)] for sp, a, b, _ in LINES if sp == spk]
        if spk == "J": parts.append(v[int(69.4 * SR):int(71.5 * SR)])          # his «у-у-у» too: more of his timbre
        parts.sort(key=len, reverse=True)
        ref = np.concatenate([np.concatenate([p, np.zeros(SR // 6)]) for p in parts])[: SR * 14]
        save(D / f"ref_{spk}.wav", ref / (np.abs(ref).max() + 1e-6) * 0.9)
        print(spk, "reference", round(len(ref) / SR, 1), "s")


# 4. the Spanish lines in the cloned voices
if "tts" in STEPS:
    import torch, torchaudio
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    torch.set_num_threads(4)
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    (D / "es").mkdir(exist_ok=True)
    for k, (spk, a, b, es) in enumerate(LINES):
        out = D / "es" / f"{k:02d}.wav"
        if out.exists(): continue
        excl = 0.75 if "!" in es else 0.5                         # more life where the Russian shouts
        wav = model.generate(es, language_id="es", audio_prompt_path=str(D / f"ref_{spk}.wav"), exaggeration=excl, cfg_weight=0.5)
        wav = torchaudio.functional.resample(wav, model.sr, SR)
        torchaudio.save(str(out), wav, SR)
        print(k, spk, round(wav.shape[-1] / SR, 2), "s", es[:50], flush=True)

# 5. each line into its slot, over the original music and effects
if "mix" in STEPS:
    v_ru = load(D / "vocals.wav"); bed = load(D / "no_vocals.wav"); total = len(bed)
    keep = np.ones(total); voice = np.zeros(total); f = int(0.03 * SR)
    for k, (spk, a, b, es) in enumerate(LINES):
        nxt = LINES[k + 1][1] if k + 1 < len(LINES) else total / SR
        slot = min(nxt - 0.06, b + 0.5) - a                               # may run up to 0.5 s past the Russian
        seg = load(D / "es" / f"{k:02d}.wav")
        aa = np.abs(seg); nz = np.where(aa > aa.max() * 0.03)[0]; seg = seg[max(0, nz[0] - 200):nz[-1] + 400] if len(nz) else seg
        ratio = len(seg) / SR / slot
        if ratio > 1.0:                                                    # speed up, pitch kept, at most 1.5x
            tmp_in, tmp_out = D / "_fit_in.wav", D / "_fit_out.wav"; save(tmp_in, seg)
            sh("ffmpeg", "-v", "error", "-y", "-i", tmp_in, "-af", f"atempo={min(1.5, ratio):.3f}", tmp_out); seg = load(tmp_out)
        ru_seg = v_ru[int(a * SR):int(b * SR)]
        g = (np.sqrt((ru_seg ** 2).mean()) + 1e-6) / (np.sqrt((seg ** 2).mean()) + 1e-6); seg = seg * min(g, 4)
        seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        i0 = int(a * SR); i1 = min(total, i0 + len(seg)); voice[i0:i1] += seg[:i1 - i0]
        # the Russian words out from just before the line to the end of the Spanish or the Russian, whichever is later
        k0, k1 = max(0, int((a - 0.06) * SR)), min(total, max(i1, int((b + 0.08) * SR)))
        keep[k0:k1] = 0
        print(f"{k:2d} {spk} {a:6.2f}-{b:6.2f} slot {slot:4.1f}s  es {len(seg) / SR:4.1f}s  x{max(1, ratio):.2f}  {es[:44]}")
    keep = np.convolve(keep, np.ones(f) / f, "same")                       # soft edges where the Russian stem comes and goes
    voice = voice + v_ru * keep
    OUT.mkdir(exist_ok=True)
    save(OUT / "N5_Napoleon_ES_golosa.wav", voice)
    save(OUT / "N5_Napoleon_ES_dorozhka.wav", voice + bed)
    print("mix ok", round(total / SR, 2), "s")
