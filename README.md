# Studio — Business Presentation Studio

An English-language presentation workspace built with Next.js App Router, strict TypeScript, Tailwind CSS, Prisma, Neon PostgreSQL, Clerk, and Zod. Presentations can be authored in English, Dutch, Romanian, or Spanish. The dashboard, slide editor, audience player, speaker notes, share links, local video recording, and print-to-PDF flow are implemented. ThuisZoek.nl copy is written as a proposed product direction and avoids unsupported traction, market, or partner claims.

## Requirements

- Node.js 20.9 or newer
- npm
- A Neon PostgreSQL project for persistent storage
- A Clerk application for authenticated workspaces
- Optional DeepL API access for creating translated presentation copies

Without service credentials, the dashboard runs in a browser-only demo mode using local storage. This mode is for trying the interface; it is not shared across browsers and is not a substitute for the Neon-backed production setup.

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set the credentials described below.

3. Generate the Prisma client and apply migrations:

   ```powershell
   npm run db:generate
   npm run db:migrate
   ```

4. Seed reusable template records (and optionally a demo account):

   ```powershell
   npm run db:seed
   ```

   To seed the sample presentation for a Clerk user, set `SEED_OWNER_EMAIL` and `SEED_OWNER_CLERK_ID` to the user's primary email and Clerk user ID before running the seed command. For a new account, the first authenticated request creates the ThuisZoek.nl starter presentation automatically.

5. Start the development server:

   ```powershell
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Neon setup

1. Create a project at [Neon](https://console.neon.tech/) and select PostgreSQL.
2. In the Neon dashboard, copy the pooled connection string for the `DATABASE_URL` value. It should use the pooler host and include `sslmode=require`.
3. Copy the direct (non-pooler) connection string for `DIRECT_URL`. Prisma uses it for migrations.
4. Keep both values in local `.env` or deployment environment settings only. Never add `.env` to source control.
5. Run `npm run db:migrate` after setting the values. `npm run db:seed` adds the template catalog.

The application uses the Neon serverless Prisma adapter for runtime database access and the direct connection for migrations.

## Clerk setup

1. Create a Clerk application and configure the desired sign-in methods in the Clerk dashboard.
2. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the Clerk API keys page.
3. Add your local origin (`http://localhost:3000`) to Clerk's allowed development origins.
4. Restart Next.js after changing environment variables.

The dashboard and editor are protected when Clerk is configured. The API associates each authenticated Clerk account with an application user and checks ownership for mutations. Without Clerk credentials, the local demo remains usable but all database APIs reject writes.

## Features and current boundaries

- Dashboard search, status filtering, grid/list views, duplicate/archive/delete, and templates.
- A global light/dark appearance toggle in the dashboard, editor, and presenter, with system-preference detection and browser-local persistence.
- A twelve-slide Dutch ThuisZoek.nl introduction and localized English, Dutch, Romanian, and Spanish presentation templates. English is the default for new presentations.
- Slide editing directly on the canvas or from the properties panel, including selecting and moving individual text sections, section-specific editing, quick color palettes, titles, subtitles, body text, bullet points, layout, public image URLs, and private speaker notes.
- Slide reorder by dragging thumbnails, plus adding and deleting slides.
- Automatic browser-local saves in demo mode and debounced Prisma writes when authenticated and configured.
- Presenter keyboard controls (arrow keys, space, page up/down), full-screen display, and speaker notes in the private presenter view.
- Manual and automatic narration modes using browser SpeechSynthesis. Narration follows the presentation language (English, Dutch, Romanian, or Spanish), with compatible voice selection, mute, slow/normal/fast speed presets, pause/resume/stop, swipe navigation, and slide-specific custom narration text.
- Presenter preview supports an optional fixed camera tile with microphone, plus a private LiveKit room that lets viewers joining the shared link appear in the same camera tile. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`; room tokens are issued server-side and limited to the presentation's room.
- Narration has a persistent output-volume slider. The browser SpeechSynthesis API applies the same requested output level to each utterance, but individual installed voices may still vary their loudness naturally; recording audio is mixed and passed through a dynamics compressor.
- Translation creates a separate draft copy and marks it for human review; visible slide text, custom narration, speaker notes, metadata, statistics, and labels are translated while layouts and images are preserved.
- Share links support public/unlisted visibility, optional password protection, and revocation through the API. Public responses omit notes and ownership details.
- PDF export uses the browser's print dialog. Choose “Save as PDF”; print styles create one landscape page per slide and exclude speaker notes and controls.
- Preview-mode video recording captures only the slide and downloads the resulting video to the presenter's device. Video files are not uploaded or saved with the presentation. Choose the preview browser tab in the screen-sharing prompt and enable tab audio to include narration.
- Narration is never started automatically on entering presentation mode. Automatic mode advances only after the browser reports that the current slide's speech has finished; manual narration never advances slides. Switching back to manual mode cancels speech and pending transitions.
- The slide editor supports PNG, JPEG, WebP, and animated GIF uploads (up to 4 MB per uploaded image), a small built-in icon library, and video elements from direct HTTPS video URLs. Media elements can be moved and resized on the canvas; selected text can be scaled from its corner or with the properties panel. Uploaded image data is embedded in the presentation JSON, so keep an eye on browser storage and server request limits when adding several large files. Video files are referenced by URL and are not uploaded.

## Validation

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Database migrations and remote-service flows require valid Neon and Clerk credentials, which are not included in this repository.

## Presentation translation

Translation uses the DeepL API from a server-only route; the API key is never sent to the browser. Set `DEEPL_API_KEY` in `.env` or the deployment environment. Use `DEEPL_API_URL=https://api-free.deepl.com` for DeepL API Free (the default), or `https://api.deepl.com` for DeepL API Pro. Translation also requires configured Clerk and Neon credentials because the translated copy is saved to the signed-in user's account. The editor asks for confirmation before creating a separate copy. The copy is marked “needs review” until a presenter explicitly marks it reviewed.

The initial supported target languages are English, Dutch, Romanian, and Spanish. Browser speech synthesis requires a compatible voice installed in the browser/operating system; the presenter reports an explicit error if none is available. Changing narration volume or mute while speech is in progress restarts from the last reported word boundary, which can repeat a short fragment. The browser speech API does not expose audio samples for live loudness normalization, so some installed voices may retain natural level variation.

## Live camera and guest video

Create a LiveKit Cloud project and set `LIVEKIT_URL` to its secure `wss://` server URL, along with its API key and secret in the server environment. The secret is never exposed to the browser. The presenter joins from preview; guests join from the share link, enter a display name, and grant camera/microphone access. Password-protected share links require their password for live-room tokens as well. Camera and microphone media are not saved in Neon. Local recordings are downloaded to the presenter's device.

## Vercel deployment

1. Import this repository into Vercel.
2. Add `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and (if translation is enabled) `DEEPL_API_KEY` in the project's environment settings.
3. Configure the production domain in Clerk, including the authorized redirect/origin settings.
4. Run `npm run db:migrate` against the production Neon database from a trusted local/deployment environment before routing users to the new deployment.
5. Deploy with the default Next.js build command. Confirm the deployment can reach Neon and sign in before inviting users.

## Troubleshooting

- **Database connection errors:** verify the Neon project is active, the pooled/direct strings target the same database, both use TLS, and the account has migration permissions.
- **Prisma client errors after schema changes:** run `npm run db:generate`, then restart the development server.
- **Clerk redirects or missing-key errors:** check the two Clerk variables and the application's allowed origins, then restart Next.js.
- **Hydration warnings or `insertBefore` errors with browser translation enabled:** the app marks its English UI as non-translatable because translation extensions mutate React-managed DOM. Turn off page translation for localhost, then hard reload the page.
- **Translation is unavailable:** configure `DEEPL_API_KEY`, Clerk, and Neon. Translation is performed server-side and cannot run in browser-only demo mode.
- **No compatible narration voice:** install an English, Dutch, Romanian, or Spanish speech voice in the operating system/browser and reopen the presentation. An unrelated voice is not substituted.
- **Live camera is unavailable:** configure LiveKit and secure Clerk/Neon settings, then allow camera and microphone access. Live video is only available for a presentation with a valid shared link.
- **Missing Neon credentials:** `/api/presentations` returning `503` is expected in browser-only demo mode. Configure `DATABASE_URL`, `DIRECT_URL`, and Clerk keys to enable account-backed storage.
- **Changes appear only in one browser:** the app is running in browser-only demo mode; configure Clerk and Neon for account-backed persistence.
- **PDF is blank or split unexpectedly:** use landscape orientation, enable background graphics, and disable browser headers/footers in the print dialog.
