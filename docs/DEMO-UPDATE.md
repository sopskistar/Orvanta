# Final edited website demonstration

The user-approved final edit from `artifacts/demo/orvanta-demo-final.mp4` replaces the earlier public demonstration. Only the finished public MP4 and a still extracted at 88 seconds are published; raw recordings and private artifacts remain Git-ignored. Source and exported MP4 SHA-256:

```text
62049c7b0feffcac09269561ac07f016a81f9a09fd821ed995194dd30eba7e84
```

The video is 99.866 seconds, 1920 × 1080 H.264/yuv420p with AAC audio, 3,393,973 bytes. The video and poster use new URLs so cached previous assets are not reused. The central demo configuration drives the player and both homepage previews. Page design, demo heading/description, contact email and the static export are preserved. This asset update does not change the deployed email Worker, Retell prompt, AI-first greeting, inbound number or DNS.

Local verification: lint, TypeScript, configuration/testimonial tests and a fresh production export passed. Chromium verification passed 220 checks, with 15 desktop/tablet/mobile page captures. The final MP4 decoded and played inline, sought to its delivered-email segment, exposed native controls, supported HTTP byte ranges and displayed recovery after an intentionally failed load. Screenshots at desktop 1440 px, tablet 768 px and mobile 375 px were inspected; the player fits without horizontal overflow and the existing layout remains intact. Additional viewport overflow checks cover 320–1920 px. Physical-device audio, Safari and screen readers were not tested by this browser suite. The user independently confirmed Mia's AI-first greeting is audibly verified.

Commit `b715a034a8394c4d5b8893bf88eaa36de21cd6ed` was pushed to `origin/main`. GitHub checks passed, and Cloudflare's actual `github:push` deployment record reports success at 10:40:58 UTC on 25 November 2026. The MP4 downloaded from `https://getorvanta.xyz` matches the SHA-256 above. The same 220 browser/media checks passed against the actual production site, including playback, seeking, byte ranges, error recovery and desktop/tablet/mobile display. The existing email Worker remains enabled on its minute cron; this website deployment did not deploy booking code or alter DNS. Private screenshots and media reports remain under `artifacts/`.
