# Documentation assets

The README expects a demo GIF and four screenshots here. None are committed yet.

## `demo.gif` — the most important asset in the repository

For a visual tool, this is the pitch. Most people decide from it alone, before reading a word.

Record roughly ten seconds, no narration, no cursor hunting:

1. Paste a paragraph into the left panel.
2. Click **Generate visual**.
3. Let the diagram appear.
4. Drag one node to show it is genuinely editable.

Keep it under about 5 MB so it loads on a phone — capture at 1440×900, trim dead frames, and
scale to roughly 800px wide. Then uncomment the image in the README's header block.

## Screenshots

| Filename                    | What to capture                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `screenshot-main.png`       | The whole window: example text on the left, a generated flowchart on the right, Minimal theme |
| `screenshot-dark.png`       | The same diagram in the Dark technical theme                                                  |
| `screenshot-onboarding.png` | The first-run setup dialog                                                                    |
| `screenshot-export.png`     | The export menu open, showing formats, scale and the transparency toggle                      |

## How to capture them

1. `npm run tauri dev` (or `npm run dev` for a browser window at 1440×900).
2. Generate a diagram from one of the built-in examples so the screenshots show real output.
3. Capture the window at 2x — `Cmd+Shift+4` then `Space` on macOS.
4. Save as PNG into this folder using the filenames above.

Keep them under about 600 KB each so the repository stays small, and avoid capturing any
personal text: these images end up in the README.
