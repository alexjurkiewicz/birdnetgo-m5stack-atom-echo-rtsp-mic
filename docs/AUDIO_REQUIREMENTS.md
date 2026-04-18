# BirdNET-Go Audio Requirements vs Atom Echo Hardware

## BirdNET-Go Audio Processing

### How BirdNET processes audio

BirdNET-Analyzer (the model BirdNET-Go uses) converts 3-second audio segments into two parallel log-scaled mel-spectrograms before classification:

| Channel | Frequency range | Purpose |
|---|---|---|
| Low | 0–3 kHz | Owls, bitterns, grouse, low passerine calls |
| High | 500 Hz–15 kHz | Most passerine songs, waders, raptors |

Together they cover **0–15 kHz**. The model was trained on unfiltered field recordings — it expects audio that preserves this full range.

### Input requirements

| Parameter | Requirement | Notes |
|---|---|---|
| Sample rate | **48 kHz** | Native processing rate. Lower rates are resampled but 16 kHz→48 kHz (3× upsample) introduces artefacts and loses the 8–15 kHz band entirely |
| Bit depth | 16-bit | Sufficient — BirdNET normalises to ±1.0 before spectrogramming |
| Channels | Mono | Stereo is downmixed; mono preferred |
| Frequency response | Flat 0–15 kHz | Any significant pre-emphasis or filtering degrades one of the two spectrogram channels |
| DC offset | None | BirdNET normalises amplitude but does not remove DC — a DC bias wastes headroom asymmetrically, causing one clip rail to be hit before the other |
| High-pass filter | Conservative | A 300 Hz HPF removes signal the low-frequency spectrogram channel actively uses. 80 Hz or lower removes only true infrasound/DC and is transparent to the model |
| Clipping | Avoid | Normalisation cannot restore a clipped waveform; clipping degrades spectrogram features |
| RTSP transport | TCP or UDP | BirdNET-Go uses FFmpeg; defaults to TCP for RTSP. Either works; TCP is more reliable on home networks |

### Species impact of high-pass filtering

| Species | Call frequency | Effect of 300 Hz HPF | Effect of 80 Hz HPF |
|---|---|---|---|
| Great Horned Owl | 300–400 Hz fundamental | Partially removed | Unaffected |
| American Bittern | ~250 Hz boom | Mostly removed | Unaffected |
| Ruffed Grouse drumming | <100 Hz | Completely removed | Unaffected |
| Most songbirds | 1–8 kHz | Unaffected | Unaffected |

---

## SPM1423HM4H-B Microphone Specifications

The M5Stack Atom Echo uses the **Knowles SPM1423HM4H-B**, a PDM MEMS microphone.

| Parameter | Value |
|---|---|
| Type | PDM (sigma-delta, 1-bit oversampled) |
| SNR | ~61 dB(A) |
| Sensitivity | −22 dBFS @ 94 dB SPL, 1 kHz |
| Acoustic overload point | ~112–115 dB SPL (10% THD) |
| Dynamic range | ~51–54 dB |
| PDM clock range | **1.0–3.25 MHz** |
| Natural low-frequency roll-off | ~100 Hz (−3 dB) |
| DC bias | Small (~2–6% of full scale from sigma-delta idle pattern) |

### PDM clock vs sample rate

The ESP32 I2S PDM decimator uses 64× oversampling:

| Sample rate | PDM clock | Within spec? |
|---|---|---|
| 16 kHz | 1.024 MHz | Yes |
| 32 kHz | 2.048 MHz | Yes |
| 48 kHz | 3.072 MHz | Yes (near ceiling) |
| 96 kHz | 6.144 MHz | **No — 2× over spec** |

**Hard maximum is 48 kHz.** The previous firmware allowed 96 kHz in the UI, which would push the PDM clock nearly twice over the datasheet limit, producing undefined decimation filter behaviour.

---

## Hardware vs Requirements Assessment

### Strengths

**SNR is adequate for bird detection.** 61 dB(A) is not exceptional (a good field recorder mic is 74+ dB(A)), but outdoor bird monitoring is fundamentally SNR-limited by ambient noise, not the microphone floor. The mic is not the bottleneck.

**AOP of 112+ dB SPL is more than sufficient.** Common bird calls rarely exceed 100 dB SPL at 1 metre. No clipping in realistic outdoor conditions.

**48 kHz is achievable and within spec.** PDM clock of 3.072 MHz sits within the 1.0–3.25 MHz window, giving BirdNET-Go the full 0–15 kHz coverage it needs without upsampling artefacts.

**16-bit output is fine.** BirdNET normalises before spectrogramming; the 51–54 dB dynamic range of the mic is the actual limit, not the 96 dB theoretical range of 16-bit audio.

### Weaknesses / Limitations

**Natural low-frequency roll-off below ~100 Hz.** The mic itself attenuates frequencies below ~100 Hz, so the very bottom of the 0–3 kHz BirdNET spectrogram channel is slightly degraded. In practice this means infrasound (<80 Hz) is already filtered by hardware — an 80 Hz software HPF adds no loss. Calls in the 100–300 Hz range (owls, bitterns) are fully captured.

**PDM DC bias.** The sigma-delta idle pattern produces a small DC offset (~2–6% of full scale). At 3× gain this consumes up to 18% of headroom asymmetrically, and causes the AGC to fight a phantom non-zero RMS during silence. This is a firmware problem, not a hardware flaw — it must be corrected in software before any gain or AGC stage.

**Modest SNR limits range, not frequency coverage.** For distant birds in noisy environments (traffic, wind), the ~61 dB(A) SNR will be the practical detection limit. This is an inherent hardware constraint of the SPM1423's price class and cannot be improved in firmware.

### Summary table

| BirdNET requirement | Atom Echo capability | Status |
|---|---|---|
| 48 kHz sample rate | 3.072 MHz PDM clock (within 1.0–3.25 MHz spec) | Met |
| 0–15 kHz frequency coverage | ~100 Hz–15 kHz (hardware roll-off below 100 Hz) | Substantially met |
| Flat response in 0–3 kHz channel | Natural roll-off below 100 Hz only | Met (minimal impact) |
| No DC offset | DC bias from PDM idle pattern | Requires software DC blocker |
| Conservative HPF (≤80 Hz) | Configurable in firmware | Met with correct default |
| 16-bit, mono output | SPM1423 → ESP32 I2S PDM decimation → 16-bit | Met |
| No clipping at typical bird SPL | AOP 112+ dB SPL >> typical bird call levels | Met |

---

## PR #4 Changes in Context

The PR (stedrow/birdnetgo-m5stack-atom-echo-rtsp-mic#4) addresses the firmware defaults and processing pipeline based on exactly this analysis:

1. **16 kHz → 48 kHz default** — eliminates 3× upsample and restores 8–15 kHz to BirdNET
2. **Buffer 1024 → 3072** — maintains ~64 ms latency at the new higher rate
3. **HPF cutoff 300 Hz → 80 Hz** — stops discarding signal the low-frequency spectrogram needs
4. **DC blocker added** — corrects the SPM1423 PDM bias before gain/AGC stages
5. **DMA buffer scaled with sample rate** — prevents interrupt frequency tripling at 48 kHz
6. **96 kHz UI cap → 48 kHz** — prevents users from pushing the PDM clock out of spec
