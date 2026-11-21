# Photocopy

A browser tool for making photocopy-style collage illustrations.

## Use it

1. Go to [photocopy.namesake.fyi](https://photocopy.namesake.fyi).
2. Drop photos on the canvas, or use **Upload image** or **Search for images** to find openly licensed photos.
3. Select a photo, then use the toolbar to **Remove Background** automatically. If the automatic removal isn't great, use the **Mask** brushes to add or remove parts of the image.
4. Modify **Appearance** settings like **Ink** and **Grain** to taste.
5. Press **Export** (or ⌘E / Ctrl+E), then **Download PNG**.

Work is saved in the browser as you go, and you can keep several artboards: use **Show artboards** (the sidebar button at the top left, or ⌥↑ / ⌥↓) to switch between them or start a new one. Nothing is uploaded anywhere.

## Scripts

- `pnpm dev`: start the app
- `pnpm build`: type-check and build a static site into `dist/`
- `pnpm test`: run the pipeline tests
- `pnpm check`: lint and format with Biome
- `pnpm changeset`: describe your change for the changelog

## License

[AGPL-3.0](LICENSE.md).
