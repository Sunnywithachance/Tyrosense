# TyroSense Companion App

Capstone workspace for a proposed companion app for the TyroSense wearable microneedle patch.

The app is intended to help users capture patch photographs, record colourimetric changes associated with tyrosinase activity, and organize screening and lesion photographs over time. It supports, rather than replaces, professional dermatological assessment.

## Proposed features

- Guided before and after patch photography.
- A reaction timer and follow-up reminders.
- Colour-change comparison and screening history.
- Lesion photo logs with comparisons over time.
- Screening history exports for sharing with healthcare professionals.

## Reference workflow

1. Home: view the current test, latest recorded result, and tracked lesions.
2. Start a test: select a lesion and review patch application instructions.
3. Capture a baseline photograph.
4. Track the reaction waiting period.
5. Capture the after photograph.
6. Review the comparison and save it to the selected lesion's history.

The supplied visual references use warm off-white surfaces, rounded cards, orange accents, and a mobile layout. Their one-hour timer and numerical results are illustrative design examples; the final protocol and measurement interpretation remain to be established.

## Prototype boundaries

Any demonstration results must be clearly labelled as sample data. Converting image colour changes into enzyme activity values or clinical categories requires a validated calibration and interpretation method; these must not be inferred from the mockups.

## Implementation status

The repository contains a mobile-first browser prototype implemented with HTML, CSS, and JavaScript. It is a capstone demonstration, with TYR calibration still pending.

## Run the prototype

Requires Node.js 20 or newer. No dependency installation is needed.

```sh
npm start
```

Open `http://localhost:5173`. The interface is designed for phone screens and stays phone-sized on desktop. For phone camera access over a network, use an HTTPS deployment; a phone's `localhost` points to the phone itself.

```sh
npm run check
npm test
```

## Implemented prototype

- Register lesions with names, locations, and notes.
- Capture baseline and after photographs in a dedicated live camera screen, or choose them from a photo library.
- Request camera permission explicitly, show square alignment guides and a green outline for stable square candidates, then review or retake the crop.
- Offer camera switching, plus zoom and a camera light when supported by the device and browser.
- Persist a reaction timer across page reloads using an absolute deadline.
- Compare the mean RGB colour in the central 40% of each image.
- Save comparisons and lesion photo journals in IndexedDB in the current browser.
- Filter history by lesion and download JSON records, including photographs.
- Choose follow-up dates and download calendar reminders.
- Load an explicitly labelled synthetic comparison from Settings.
- Delete the local workspace from Settings.

The app uses no backend or cloud photo storage. Data is local to each browser and origin; the local preview and hosted app have separate databases. Export records before clearing browser data. Downloads are exports only; importing backups is not implemented. Calendar reminders require importing the downloaded `.ics` file into a calendar app.

## Analysis limits and next steps

RGB distance is a descriptive image metric, not a calibrated enzyme activity measurement. The camera uses lightweight intensity and edge contours to highlight square-shaped candidates, with three-frame stability before showing green. This is an experimental alignment aid, not identification of a TyroSense patch. It can miss translucent patches or highlight unrelated squares. Detection needs testing on actual patches and representative lighting and skin tones. The prototype does not normalize lighting, register images, or classify lesions. It intentionally does not display numerical TYR concentrations or activity categories.

The next analysis milestone is a controlled imaging protocol, reference colours, a defined reaction region, and paired photographs with known TYR activities. Calibration and evaluation should use separate datasets, with uncertainty and image quality checks before activity ranges are shown.

## Source layout

- `dist/`: directly served browser application; these are editable source files.
- `dist/analysis.js`: descriptive colour comparison and timer functions.
- `server.mjs`: dependency-free local development server.
- `tests/`: calculation and timer tests.
- `.openai/hosting.json`: private Sites deployment configuration.


## Custom camera

The before and after capture buttons open a full-screen camera dialog. Camera access starts only when the user taps **Enable camera**; the browser then handles its permission prompt. Use HTTPS (including the Netlify URL) or localhost. HTTP addresses on a local Wi-Fi network do not qualify for live camera access.

A stable square candidate is outlined in green. Capture remains available without detection: the white guide supplies a manual square crop. When detection is stable at capture time, the saved image is cropped around the candidate with a small margin. Both crops are shown for review before use; they are not perspective-corrected. Library imports retain the full photograph. The colour analysis continues to sample the central 40% of the saved image; match the reaction area, crop, lighting, and orientation between both photographs. Older records and library imports may have different framing.

The app requests video only, with the rear camera preferred. Video stays local and is not recorded. Tracks stop on capture/review, close, camera switch, hiding the page, and leaving the page. Camera light and zoom controls appear only when the camera exposes those capabilities. Real Safari/iPhone permission handling, hardware controls, and detection performance must still be verified on a physical phone.

Browser camera tests use simulated input:

```sh
npm install
npx playwright install chromium
npm run test:browser
```

The tests cover explicit activation, real getUserMedia with simulated hardware, square detection, capture/retake, both test photos and result saving, denied permission and library fallback, retry, manual capture, Escape, background/resume, and a permission request that resolves after closing.
