## PDF Tools

A tiny, client‑side web app to combine PDFs and images into a single PDF. No sign‑in, no uploads—everything runs in your browser.

Live site: [pdftools.sanjaysingh.net](https://pdftools.sanjaysingh.net)

### Features
- **Combine files**: Merge PDFs and JPEG/PNG images into one PDF
- **Drag & drop**: Drop files or use the picker; add multiple at once
- **Reorder easily**: Drag the handle to set the order before merging
- **Name the output**: Set a filename (defaults to `combined.pdf`)
- **Live progress**: See a percentage while processing
- **Light/Dark theme**: Toggle theme; choice persists
- **Private by design**: Files never leave your device

### How to use
1. Open `index.html` in a modern browser (or host the folder with any static server).
2. Drop PDFs and/or JPG/PNG images into the dropzone, or click “Choose files”.
3. Reorder items as needed; remove any you don’t want.
4. Optional: set the output filename.
5. Click “Create PDF” to download the combined file.

### Supported formats
- **PDF** files
- **Images**: JPEG, PNG

Images are placed on A4 pages with automatic portrait/landscape orientation and fitted within ~1 inch margins.

### Tech stack
- **Vue 3** (CDN)
- **SortableJS** for drag‑reorder
- **Bootstrap 5** + **Bootstrap Icons** for UI
- **pdf-lib** for PDF creation (all client‑side)

### Limitations
- Very large files may use significant memory (browser‑based processing)
- Only JPEG/PNG images are supported (no HEIC/TIFF)
- Image pages use fixed A4 size; custom page sizes aren’t configurable yet

### Privacy
All processing happens locally in your browser. The app never uploads your files anywhere.
