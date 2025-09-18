/* global Vue, Sortable, PDFLib */
(function () {
  const { createApp, onMounted, ref } = Vue;
  const { PDFDocument } = PDFLib;

  createApp({
    setup() {
      const items = ref([]); // { id, file, kind: 'pdf'|'image', name, size }
      const isProcessing = ref(false);
      const isDragOver = ref(false);
      const outputName = ref('combined.pdf');
      const alert = ref({ message: '', variant: 'info' });
      const fileInput = ref(null);
      const combineFileListRef = ref(null);
      const progressPercent = ref(0);

      // Theme
      const isDark = ref(false);
      function applyTheme(dark) {
        isDark.value = !!dark;
        document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light');
        try { localStorage.setItem('pdf-theme', isDark.value ? 'dark' : 'light'); } catch (_) {}
      }
      function toggleTheme() { applyTheme(!isDark.value); }

      function triggerFileDialog() {
        if (isProcessing.value) return;
        fileInput.value && fileInput.value.click();
      }

      function onFileChange(event) {
        const list = event.target.files;
        addItems(list);
        event.target.value = '';
      }

      function onDragEnter() {
        if (isProcessing.value) return;
        isDragOver.value = true;
      }
      function onDragOver() {
        if (isProcessing.value) return;
        isDragOver.value = true;
      }
      function onDragLeave() { isDragOver.value = false; }
      function onDrop(event) {
        isDragOver.value = false;
        if (isProcessing.value) return;
        const dt = event.dataTransfer; if (!dt) return;
        addItems(dt.files);
      }

      function addItems(fileList) {
        if (!fileList || fileList.length === 0) return;
        const added = [];
        for (const file of fileList) {
          const name = file?.name || '';
          const type = (file?.type || '').toLowerCase();
          let kind = null;
          if (type === 'application/pdf' || /\.pdf$/i.test(name)) kind = 'pdf';
          else if (/image\/(jpeg|png)/.test(type) || /\.(jpe?g|png)$/i.test(name)) kind = 'image';
          if (!kind) continue;
          added.push({
            id: `${name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
            file,
            kind,
            name,
            size: file.size,
          });
        }
        if (added.length === 0) {
          setAlert('Please select PDFs or JPEG/PNG images only.', 'warning');
          return;
        }
        items.value = items.value.concat(added);
        clearAlertIfAny();
      }

      function removeItem(index) {
        if (index < 0 || index >= items.value.length) return;
        items.value.splice(index, 1);
      }

      function moveItem(from, to) {
        if (to < 0 || to >= items.value.length || from === to) return;
        const updated = items.value.slice();
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        items.value = updated;
      }

      function clearItems() {
        items.value = [];
        progressPercent.value = 0;
        clearAlertIfAny();
      }

      function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
      }

      function setAlert(message, variant = 'info') { alert.value = { message, variant }; }
      function clearAlertIfAny() { if (alert.value.message) alert.value = { message: '', variant: 'info' }; }

      async function combine() {
        if (items.value.length === 0 || isProcessing.value) return;
        isProcessing.value = true;
        progressPercent.value = 0;
        setAlert('Processing…', 'info');

        try {
          // Preload metrics to compute total units (pages + images)
          let totalUnits = 0;
          const preloads = [];
          for (const it of items.value) {
            if (it.kind === 'pdf') {
              preloads.push(it.file.arrayBuffer().then(buf => PDFDocument.load(buf)).then(doc => {
                it._pdfDoc = doc; // cache
                it._pageIndices = doc.getPageIndices();
                totalUnits += it._pageIndices.length;
              }));
            } else {
              // image counts as 1 unit
              totalUnits += 1;
            }
          }
          await Promise.all(preloads);

          const out = await PDFDocument.create();
          out.setTitle('Combined PDF');
          out.setAuthor('PDF Tools');
          out.setProducer('pdf-lib');
          out.setCreator('PDF Tools (Client-side)');
          out.setCreationDate(new Date());

          let completed = 0;

          for (const it of items.value) {
            if (it.kind === 'pdf') {
              const copied = await out.copyPages(it._pdfDoc, it._pageIndices);
              for (const page of copied) {
                out.addPage(page);
                completed += 1;
                progressPercent.value = Math.round((completed / totalUnits) * 100);
              }
            } else {
              // image → add to a new page (A4 auto orientation, fit with 1in margins)
              const bytes = await it.file.arrayBuffer();
              const ext = (it.name.split('.').pop() || '').toLowerCase();
              const embed = ext === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
              const imgW = embed.width; const imgH = embed.height;
              const a4W = 595.28; const a4H = 841.89;
              const landscape = imgW > imgH;
              const page = out.addPage(landscape ? [a4H, a4W] : [a4W, a4H]);
              const maxW = page.getWidth() - 72; const maxH = page.getHeight() - 72;
              const scale = Math.min(maxW / imgW, maxH / imgH, 1);
              const drawW = imgW * scale; const drawH = imgH * scale;
              const x = (page.getWidth() - drawW) / 2; const y = (page.getHeight() - drawH) / 2;
              page.drawImage(embed, { x, y, width: drawW, height: drawH });
              completed += 1;
              progressPercent.value = Math.round((completed / totalUnits) * 100);
            }
          }

          let name = (outputName.value || '').trim();
          if (!name || !/\.pdf$/i.test(name)) name = 'combined.pdf';
          const bytes = await out.save();
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);

          setAlert(`Created PDF from ${items.value.length} item(s).`, 'success');
        } catch (err) {
          console.error(err);
          setAlert('Failed to create PDF. Ensure files are valid.', 'danger');
        } finally {
          isProcessing.value = false;
          progressPercent.value = 0;
          // cleanup cached docs
          for (const it of items.value) { delete it._pdfDoc; delete it._pageIndices; }
        }
      }

      function initSortable() {
        if (!combineFileListRef.value) return;
        new Sortable(combineFileListRef.value, {
          animation: 150,
          handle: '.bi-grip-vertical',
          draggable: '.draggable-item',
          ghostClass: 'bg-body-tertiary',
          onEnd: (evt) => {
            const { oldIndex, newIndex } = evt; if (oldIndex == null || newIndex == null) return;
            moveItem(oldIndex, newIndex);
          },
        });
      }

      onMounted(() => {
        // Theme
        try {
          const saved = localStorage.getItem('pdf-theme');
          if (saved === 'dark' || saved === 'light') applyTheme(saved === 'dark');
          else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        } catch (_) { applyTheme(false); }
        initSortable();
      });

      return {
        items,
        isProcessing,
        isDragOver,
        outputName,
        alert,
        fileInput,
        combineFileListRef,
        progressPercent,
        isDark,
        toggleTheme,
        triggerFileDialog,
        onFileChange,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        addItems,
        removeItem,
        moveItem,
        clearItems,
        combine,
        formatBytes,
      };
    },
  }).mount('#app');
})(); 