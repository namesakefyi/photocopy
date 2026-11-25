# photocopy

## 0.3.0

### Minor Changes

- [#20](https://github.com/namesakefyi/photocopy/pull/20) [`65076fc`](https://github.com/namesakefyi/photocopy/commit/65076fc6b110cde05193f4be4cb18f2d32d0463e)
  - Rename layers inline with Enter or a double-click
  - Type an exact slider value by clicking its number or pressing Enter on the slider
  - New artboards start with the open artboard’s style and canvas size
  - Add menu items for reporting bugs and donating
  - Add a File menu for creating, duplicating and deleting artboards, adding images and exporting
  - Allow moving between toolbar menus with the arrow keys
  - On phones, display editing controls in a tabbed toolbar to leave more space for the artboard

### Patch Changes

- [#20](https://github.com/namesakefyi/photocopy/pull/20) [`65076fc`](https://github.com/namesakefyi/photocopy/commit/65076fc6b110cde05193f4be4cb18f2d32d0463e)
  - Remove backgrounds in a worker to prevent the page from hanging
  - Allow panning an artboard until only an edge remains in view
  - Make controls larger and rename the "Appearance" pane to "Style"

## 0.2.0

### Minor Changes

- [#17](https://github.com/namesakefyi/photocopy/pull/17) [`159d0ac`](https://github.com/namesakefyi/photocopy/commit/159d0ac374b178305756163b6f9595661a4d6274) - Add the ability to copy, cut and paste layers within and between artboards via menu item or keyboard shortcut.

## 0.1.3

### Patch Changes

- [#15](https://github.com/namesakefyi/photocopy/pull/15) [`b3bca9a`](https://github.com/namesakefyi/photocopy/commit/b3bca9aba9663db2c29d33d43c295fc8487cba51) - Cache recently opened artboards for quicker reloading of data when switching

## 0.1.2

### Patch Changes

- [#13](https://github.com/namesakefyi/photocopy/pull/13) [`e6834c8`](https://github.com/namesakefyi/photocopy/commit/e6834c88be9b7f484f6b3f151ae42a97d099be40) - Convert uploaded images to webp to preserve storage space and improve load times

## 0.1.1

### Patch Changes

- [#7](https://github.com/namesakefyi/photocopy/pull/7) [`233454c`](https://github.com/namesakefyi/photocopy/commit/233454ca7abaa1bca69360cb419df586ba5aae62) - Compress exported PNGs by saving only 1-2 bits per pixel to take advantage of the tool's limited color palette. Exported files are about 72–75% smaller.
  
  Display filesize in export pane.

## 0.1.0

### Minor Changes

- [#2](https://github.com/namesakefyi/photocopy/pull/2) [`7b40024`](https://github.com/namesakefyi/photocopy/commit/7b40024bc7b3a234507638edeba1567a8a2575e2) - Allow pasting images from the clipboard to add them as new layers

## 0.0.1

- Initial release
