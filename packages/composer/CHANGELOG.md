# Changelog: @bsv-kit/composer

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.2.0 (2026-10-10)

- New: with something attached and nothing typed, a Send arrow stands beside Hold to talk (mw-jtzpw0.9): one tap sends the
  attachments with no words (`onSend` gets `text: ''`). Hold to talk stays the big button, in the same place and the same
  height, and gives up only the arrow's width; with nothing attached the composer looks as before, and with words typed the
  text box's own Send stays. The arrow is the `bk-composer__bar-send` button, sized by `--bk-composer-bar-send-size`, named by
  the existing `send` label, and held back while the bar is held. The bar now sits in a `bk-composer__bar-row` with it.

## 0.1.0 (2026-10-09)

- New: the `Composer` React component, lifted from Postern's composer (mw-jtzpw0.1): hold to talk with the words
  shown as they are heard, let go to send, slide off to keep them unsent; attach and camera quiet below the bar
  and hidden unless the app asks; 'Type a message'; `mode` 'speak' (the bar first) or 'type' (the text box and
  Send first, with a small mic); every word on the screen replaceable through `labels`; themed through
  `--bk-composer-*` CSS custom properties and `bk-composer__*` classes (`bsv-kit/composer/styles.css`).
- New: how audio becomes text is the app's `Transcriber`: `browserSpeech` (the browser's recogniser, as Postern)
  or `transcribeRecording(fn)` (the hold's recording, turned into words by the app's function on release).
- New: the parts, exported: `HoldToTalkBar`, `useHold`, `startListening`, `openBluetoothInput`, `VoiceRecorder`,
  with Postern's fixes mw-f7gmps.1 (a silent Bluetooth input gives way to the default microphone while he holds),
  mw-f7gmps.2 (no recorder holds the phone's microphone beside the recogniser) and mw-f7gmps.3 (a hold that ends
  without sending leaves its words in the box, unsent).
- Changed from Postern: the microphone-permission messages name the app from `appName` ('this app' when not
  given) where Postern's said 'Postern'.
