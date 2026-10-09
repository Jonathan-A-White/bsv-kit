# Changelog: @bsv-kit/testing

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-09)

- New: `bsv-kit/testing/speech`: an honest `speechSynthesis` and `SpeechSynthesisUtterance` (mw-it6qk5.2). `speak()` queues; each
  utterance takes 150 ms and 60 ms a word, divided by its rate, on a clock the test can fake, and fires `start`, a `boundary` for each
  word (`charIndex`, `charLength`), then `end`. `pause()` holds the current utterance and `resume()` carries on; `cancel()` ends the
  current one with error `interrupted` and drops the queue with `canceled`. `getVoices()` is empty until `voiceschanged` fires 50 ms
  after install. A log says what was spoken and when. `installSpeech(window)` for vitest; `speechInitScript()` for Playwright's
  `page.addInitScript`.
- New: `bsv-kit/testing/mic`: an honest microphone. `getUserMedia` answers after 100 ms with a stream that plays a WAV clip in real
  time (an English and a Greek clip, spoken by eSpeak NG, are committed: `clips.english`, `clips.greek`); `MediaRecorder` hands over
  chunks as it records and what is left on `stop()`; `SpeechRecognition` (and `webkitSpeechRecognition`) opens after 300 ms, sends
  interim results word by word as the clip plays and a final one at its end, and ends 1.5 s later. Options: a `silent` input (nothing
  for 3 s, as a Bluetooth headset can be), a `denied` permission (`NotAllowedError`). `installMic(window)` for vitest;
  `micInitScript()` for Playwright.
- Not changed: `bsv-kit/testing` stays the grist tests' fake Postern (`fakePostern`); the new fakes are its two subpaths.
