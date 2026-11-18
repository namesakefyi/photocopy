# Copyshop

A browser tool for making photocopy-style collage illustrations.

## Use it

```sh
pnpm install
pnpm dev
```

1. Drop photos on the canvas, or use **Upload image** or **Search Wikimedia Commons** to find openly licensed photos. Turn on **No attribution required** to see only public domain and CC0 files.
2. Select a photo, then use the **Layer** menu to **Auto-Remove Background**, **Crop to Fit**, flip it, or move it forward and back. To tidy a cutout, choose **Layer → Add to Mask** (E) or **Subtract from Mask** (B) and paint on the photo. Background removal runs in your browser. On first use it downloads its model from IMG.LY's CDN, but your photos never leave your device.
3. Drag, scale and rotate photos on the bed, and drag in the layer list to change the stacking order.
4. Under **Appearance**, pick a **Preset** (Default, Clean, Heavy grain, Bold or Faded), then fine-tune it with the sliders if you like.
5. In the **Image** menu, pick a **Size**: Trimmed (crops to fit), 1:1 square, 1.91:1 for link previews, 16:9 for video, 9:16 for Instagram Stories, or **Custom Size…**. Then pick a **Background**: transparent, or a Namesake brand color.
6. Press **Export** (or ⌘E / Ctrl+E), then **Download PNG**.

Work is saved in the browser as you go. Nothing is uploaded anywhere.

## Scripts

- `pnpm dev`: start the app
- `pnpm build`: type-check and build a static site into `dist/`
- `pnpm test`: run the pipeline tests
- `pnpm check`: lint and format with Biome

## License

[AGPL-3.0](LICENSE.md).
