# door-demo

One page that uses both libraries the way an app would: it makes (or unlocks) a key with a
passphrase, shows the public key to be licensed, shows licence status for a collection, sends one
grist with one photo to the live backend and shows the mill's answer. Plain TypeScript with Vite,
no framework. It imports `bsv-kit/bsv` and `bsv-kit/grist` from this workspace's source, and it is
not part of `npm pack`.

```bash
npm ci --no-audit --no-fund   # once, from the repo root
npm run demo                  # from the repo root; serves http://localhost:5173
```

The page calls `/api` on its own origin and Vite forwards that to `https://postern.allmymind.org`
(set `DEMO_BACKEND=<url>` to point it elsewhere), so the backend needs no CORS entry for it.
`npm run build` in this folder typechecks and bundles the page into `dist/`.

The key is wrapped by your passphrase and kept in this browser's localStorage under `bsv-kit.vault`.

## HOW TO CHECK IT

1. In a terminal in the repo root, run `npm run demo`, then open http://localhost:5173 in Chrome.
   Right looks like: a page titled "bsv-kit door demo" with four boxed sections.
2. In section 1, type a passphrase in **Passphrase** and press **Make**. Right looks like: "Key made
   and stored in this browser", a 12-word recovery phrase, and a long hex public key appearing in
   section 2. Reload the page, type the same passphrase and press **Unlock**: the same public key
   comes back. A wrong passphrase says "That passphrase does not open the stored key."
3. Press **Copy** in section 2. Right looks like: "Copied." Paste it wherever the Governor issues
   licences (a key without a licence is expected to be refused in step 5).
4. In section 3, leave **Collection** as `cairn` and press **Check licence**. Right looks like one of:
   "Held: this key holds a licence in "cairn" ..." (also for a licence the Governor issued a moment ago
   that is not in a block yet), or "None: this key holds no licence in that
   collection ..." for a fresh key.
5. In section 4, leave **App** `cairn`, **Kind** `sweep`, **Version** `1.1`, choose a JPEG, PNG or
   WebP in **Photo** and press **Send**. Right looks like: "Sent (record ...)" and then "Waiting for the
   mill's answer". With a licensed key the answer appears under **Answer** within a minute or so (the
   page asks every 20 seconds); press **Stop waiting** to give up. With an unlicensed key the send is
   refused with "Licence required" in plain words.
6. Press **Forget key** (and confirm) to clear the stored key and start over.
