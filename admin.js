/* =====================================================================
   Techtonics Club – admin.js  (admin.html only)
   Login gate (Supabase Auth), submissions table, edit/delete,
   single PNG download, ZIP of all cards (3x) and CSV export.
   Uses the SAME TechCard component as the member page (script.js).
   ===================================================================== */

(function () {
  "use strict";

  const { TechCard, DESIGNATIONS, getSupabase, isConfigured, getConfig, friendlyError } = window.Techtonics;
  const cfg = getConfig();
  const BUCKET = cfg.PHOTO_BUCKET || "photos";
  const TABLE = cfg.TABLE || "submissions";
  const EXPORT_SCALE = 3;
  // Photo box inside the card is 124×152 px; we pre-crop to this ratio so the
  // exported PNG matches the on-screen object-fit: cover exactly.
  const PHOTO_W = 124, PHOTO_H = 152;

  const $ = (id) => document.getElementById(id);
  const views = { boot: $("bootView"), login: $("loginView"), dash: $("dashView") };

  let sb = null;
  let rows = [];                 // all submissions
  const signedUrls = new Map();  // photo path -> signed URL (thumbnails / preview)
  const croppedCache = new Map();// row id + path -> cropped data URL (exports)
  let busy = false;

  /* ---------------------------------------------------------------
     Views & auth
     --------------------------------------------------------------- */
  function show(view) {
    Object.entries(views).forEach(([k, v]) => (v.hidden = k !== view));
    $("headerActions").hidden = view !== "dash";
  }

  async function boot() {
    if (!isConfigured()) {
      $("loginConfigWarning").hidden = false;
      $("loginBtn").disabled = true;
      show("login");
      return;
    }
    try {
      sb = getSupabase();
    } catch (e) {
      show("login");
      return showLoginError(friendlyError(e));
    }

    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        rows = []; signedUrls.clear(); croppedCache.clear();
        show("login");
      }
    });

    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      if (data.session) enterDashboard(data.session);
      else show("login");
    } catch (e) {
      show("login");
      showLoginError(friendlyError(e));
    }
  }

  function showLoginError(msg) {
    const box = $("loginError");
    box.querySelector("[data-msg]").textContent = msg;
    box.hidden = false;
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginError").hidden = true;
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    if (!email || !password) return showLoginError("Please enter your email and password.");
    const btn = $("loginBtn");
    setBtnLoading(btn, true, "Signing in…");
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      $("loginPassword").value = "";
      enterDashboard(data.session);
    } catch (err) {
      showLoginError(/invalid login/i.test(err.message || "") ? "Incorrect email or password." : friendlyError(err));
    } finally {
      setBtnLoading(btn, false);
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    const btn = $("logoutBtn");
    setBtnLoading(btn, true, "Signing out…");
    try {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    } catch (e) {
      toast(friendlyError(e), true);
    } finally {
      setBtnLoading(btn, false);
      show("login");
    }
  });

  function enterDashboard(session) {
    $("adminEmail").textContent = session && session.user ? session.user.email : "";
    show("dash");
    loadSubmissions();
  }

  /* ---------------------------------------------------------------
     Data loading
     --------------------------------------------------------------- */
  async function loadSubmissions() {
    setTableState("loading");
    $("tableBody").innerHTML = "";
    try {
      const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      rows = data || [];
      await refreshSignedUrls(rows);
      buildFilterOptions();
      renderTable();
    } catch (e) {
      setTableState("error", friendlyError(e));
    }
  }

  function isHttp(p) { return /^https?:\/\//i.test(p || ""); }

  async function refreshSignedUrls(list) {
    const paths = list.map((r) => r.photo_url).filter((p) => p && !isHttp(p) && !signedUrls.has(p));
    if (!paths.length) return;
    try {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
      if (error) throw error;
      (data || []).forEach((d) => { if (d.signedUrl) signedUrls.set(d.path, d.signedUrl); });
    } catch (e) {
      toast("Could not load photo thumbnails: " + friendlyError(e), true);
    }
  }

  function photoSrc(row) {
    if (!row.photo_url) return null;
    return isHttp(row.photo_url) ? row.photo_url : signedUrls.get(row.photo_url) || null;
  }

  /* ---------------------------------------------------------------
     Table, search & filter
     --------------------------------------------------------------- */
  const searchInput = $("searchInput");
  const filterSel = $("filterDesignation");
  searchInput.addEventListener("input", debounce(renderTable, 150));
  filterSel.addEventListener("change", renderTable);
  $("refreshBtn").addEventListener("click", () => { if (!busy) loadSubmissions(); });

  function buildFilterOptions() {
    const current = filterSel.value;
    const set = new Set(DESIGNATIONS);
    rows.forEach((r) => r.designation && set.add(r.designation));
    filterSel.innerHTML = '<option value="">All Designations</option>';
    [...set].forEach((d) => filterSel.appendChild(new Option(d, d)));
    filterSel.value = [...set].includes(current) ? current : "";
  }

  function filteredRows() {
    const q = searchInput.value.trim().toLowerCase();
    const d = filterSel.value;
    return rows.filter((r) => {
      if (d && r.designation !== d) return false;
      if (!q) return true;
      return [r.full_name, r.department, r.batch, r.designation].some((v) => (v || "").toLowerCase().includes(q));
    });
  }

  function renderTable() {
    const list = filteredRows();
    const body = $("tableBody");
    body.innerHTML = "";
    $("countLabel").textContent = list.length === rows.length
      ? rows.length + " submission" + (rows.length === 1 ? "" : "s")
      : list.length + " of " + rows.length + " shown";
    $("zipBtn").querySelector("span").textContent =
      list.length === rows.length ? "Download all cards as ZIP" : "Download " + list.length + " cards as ZIP";

    if (!rows.length) return setTableState("empty");
    if (!list.length) return setTableState("nomatch");
    setTableState(null);

    const frag = document.createDocumentFragment();
    list.forEach((r) => {
      const tr = document.createElement("tr");

      const tdPhoto = td("td-photo", "Photo");
      const src = photoSrc(r);
      if (src) {
        const img = document.createElement("img");
        img.className = "thumb"; img.src = src; img.alt = ""; img.loading = "lazy";
        img.onerror = () => { img.replaceWith(emptyThumb()); };
        tdPhoto.appendChild(img);
      } else tdPhoto.appendChild(emptyThumb());

      const tdName = td("cell-name", "Name", r.full_name);
      const tdDept = td("", "Department", r.department);
      const tdBatch = td("", "Batch", r.batch);
      const tdDes = td("", "Designation");
      const pill = document.createElement("span");
      pill.className = "pill"; pill.textContent = r.designation;
      tdDes.appendChild(pill);
      const tdDate = td("cell-date", "Date", formatDate(r.created_at));

      const tdAct = td("td-actions", "Actions");
      const wrap = document.createElement("div");
      wrap.className = "row-actions";
      wrap.append(
        actionBtn("Preview Card", "", () => openPreview(r)),
        actionBtn("Edit", "", () => openEdit(r)),
        actionBtn("Delete", "btn-ghost-danger", () => openDelete(r)),
        actionBtn("Download PNG", "btn-primary", (btn) => downloadOne(r, btn))
      );
      tdAct.appendChild(wrap);

      tr.append(tdPhoto, tdName, tdDept, tdBatch, tdDes, tdDate, tdAct);
      frag.appendChild(tr);
    });
    body.appendChild(frag);
  }

  function td(cls, label, text) {
    const c = document.createElement("td");
    if (cls) c.className = cls;
    if (label) c.dataset.label = label;
    if (text != null) c.textContent = text;
    return c;
  }
  function emptyThumb() {
    const d = document.createElement("div");
    d.className = "thumb thumb-empty"; d.textContent = "No photo";
    return d;
  }
  function actionBtn(label, cls, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sm " + cls;
    b.innerHTML = "<span>" + label + "</span>";
    b.addEventListener("click", () => onClick(b));
    return b;
  }

  function setTableState(state, msg) {
    const box = $("tableState");
    if (!state) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    if (state === "loading") box.innerHTML = '<div class="spinner"></div>Loading submissions…';
    if (state === "empty") box.innerHTML = "<strong>No submissions yet</strong>New member submissions will appear here. If you expected data, make sure this account's email is listed in the <code>is_admin()</code> SQL function (see README).";
    if (state === "nomatch") box.innerHTML = "<strong>No matches</strong>Try a different search or Designation filter.";
    if (state === "error") {
      box.innerHTML = "";
      const s = document.createElement("strong"); s.textContent = "Could not load submissions";
      const p = document.createElement("div"); p.textContent = msg;
      const b = document.createElement("button");
      b.className = "btn btn-sm"; b.style.marginTop = "12px"; b.textContent = "Try again";
      b.onclick = loadSubmissions;
      box.append(s, p, b);
    }
  }

  /* ---------------------------------------------------------------
     Modals
     --------------------------------------------------------------- */
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const m = $(id);
    m.hidden = false;
    const f = m.querySelector("input, select, button.btn-primary, button.btn-danger");
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal(id) {
    $(id).hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-close]")) closeModal(m.id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal:not([hidden])").forEach((m) => closeModal(m.id));
  });

  /* ---------- Preview ---------- */
  const previewStage = $("previewStage");
  const previewToggle = $("previewToggle");
  const previewCard = TechCard.mount(previewStage);
  TechCard.bindToggle(previewToggle, previewStage);
  let previewRow = null;
  function openPreview(r) {
    previewRow = r;
    $("previewModalTitle").textContent = r.full_name;
    TechCard.setSide(previewStage, "front", previewToggle);
    openModal("previewModal");
    TechCard.update(previewCard, { ...r, photo_src: photoSrc(r) });
  }
  $("previewDownloadBtn").addEventListener("click", (e) => previewRow && downloadOne(previewRow, e.currentTarget));

  /* ---------- Edit ---------- */
  const editSel = $("editDesignation");
  const editCustom = $("editCustomDesignation");
  DESIGNATIONS.forEach((d) => editSel.appendChild(new Option(d, d)));
  editSel.appendChild(new Option("Custom…", "__custom"));
  editSel.addEventListener("change", () => {
    editCustom.hidden = editSel.value !== "__custom";
    if (!editCustom.hidden) editCustom.focus();
  });
  let editRow = null;

  function openEdit(r) {
    editRow = r;
    $("editError").hidden = true;
    $("editName").value = r.full_name || "";
    $("editDepartment").value = r.department || "";
    $("editBatch").value = r.batch || "";
    if (DESIGNATIONS.includes(r.designation)) {
      editSel.value = r.designation; editCustom.value = ""; editCustom.hidden = true;
    } else {
      editSel.value = "__custom"; editCustom.value = r.designation || ""; editCustom.hidden = false;
    }
    openModal("editModal");
  }

  $("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errBox = $("editError");
    errBox.hidden = true;
    const clean = (v) => v.trim().replace(/\s+/g, " ");
    const patch = {
      full_name: clean($("editName").value),
      department: clean($("editDepartment").value),
      batch: clean($("editBatch").value),
      designation: clean(editSel.value === "__custom" ? editCustom.value : editSel.value)
    };
    if (Object.values(patch).some((v) => !v)) {
      errBox.querySelector("[data-msg]").textContent = "All fields are required.";
      errBox.hidden = false;
      return;
    }
    const btn = $("editSaveBtn");
    setBtnLoading(btn, true, "Saving…");
    try {
      const { data, error } = await sb.from(TABLE).update(patch).eq("id", editRow.id).select().single();
      if (error) throw error;
      Object.assign(editRow, data || patch);
      buildFilterOptions();
      renderTable();
      closeModal("editModal");
      toast("Changes saved for " + editRow.full_name + ".");
    } catch (err) {
      errBox.querySelector("[data-msg]").textContent = friendlyError(err);
      errBox.hidden = false;
    } finally {
      setBtnLoading(btn, false);
    }
  });

  /* ---------- Delete ---------- */
  let deleteRow = null;
  function openDelete(r) {
    deleteRow = r;
    $("deleteName").textContent = r.full_name;
    $("deleteError").hidden = true;
    openModal("deleteModal");
  }
  $("deleteConfirmBtn").addEventListener("click", async () => {
    const btn = $("deleteConfirmBtn");
    const errBox = $("deleteError");
    errBox.hidden = true;
    setBtnLoading(btn, true, "Deleting…");
    try {
      const { error } = await sb.from(TABLE).delete().eq("id", deleteRow.id);
      if (error) throw error;
      if (deleteRow.photo_url && !isHttp(deleteRow.photo_url)) {
        const rm = await sb.storage.from(BUCKET).remove([deleteRow.photo_url]);
        if (rm.error) toast("Row deleted, but the photo could not be removed: " + friendlyError(rm.error), true);
      }
      rows = rows.filter((r) => r !== deleteRow);
      buildFilterOptions();
      renderTable();
      closeModal("deleteModal");
      toast("Submission deleted.");
    } catch (err) {
      errBox.querySelector("[data-msg]").textContent = friendlyError(err);
      errBox.hidden = false;
    } finally {
      setBtnLoading(btn, false);
    }
  });

  /* ---------------------------------------------------------------
     EXPORT (admin only) — html2canvas + JSZip
     --------------------------------------------------------------- */
  async function getPhotoBlob(row) {
    if (!row.photo_url) return null;
    if (isHttp(row.photo_url)) {
      const res = await fetch(row.photo_url, { mode: "cors" });
      if (!res.ok) throw new Error("Photo download failed (" + res.status + ")");
      return res.blob();
    }
    const { data, error } = await sb.storage.from(BUCKET).download(row.photo_url);
    if (error) throw error;
    return data;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode image"));
      img.src = src;
    });
  }

  /** Crop the member photo to the exact frame ratio (cover) at export resolution. */
  async function getCroppedPhoto(row) {
    const key = row.id + "|" + row.photo_url;
    if (croppedCache.has(key)) return croppedCache.get(key);
    const blob = await getPhotoBlob(row);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const outW = PHOTO_W * EXPORT_SCALE * 1.5, outH = PHOTO_H * EXPORT_SCALE * 1.5;
      const sw = img.naturalWidth, sh = img.naturalHeight;
      const scale = Math.max(outW / sw, outH / sh);
      const cw = outW / scale, ch = outH / scale;
      const sx = (sw - cw) / 2, sy = (sh - ch) / 2;   // object-position: center
      const c = document.createElement("canvas");
      c.width = Math.round(outW); c.height = Math.round(outH);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.92);
      croppedCache.set(key, dataUrl);
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function waitForImages(root) {
    const imgs = [...root.querySelectorAll("img")].filter((i) => i.getAttribute("src"));
    return Promise.all(imgs.map((img) =>
      img.complete && img.naturalWidth
        ? (img.decode ? img.decode().catch(() => {}) : Promise.resolve())
        : new Promise((res) => { img.onload = img.onerror = () => res(); })
    ));
  }

  /** Render one front card to a canvas at 3x using the shared TechCard component. */
  async function renderCardCanvas(row) {
    if (typeof html2canvas !== "function") throw new Error("Export library (html2canvas) failed to load.");
    const host = $("exportHost");
    host.innerHTML = "";
    const card = TechCard.create();
    host.appendChild(card);
    const photo = await getCroppedPhoto(row);
    TechCard.update(card, { ...row, photo_src: photo });
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await waitForImages(card);
    TechCard.fit(card);
    const canvas = await html2canvas(card, {
      scale: EXPORT_SCALE,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      width: TechCard.WIDTH,
      height: TechCard.HEIGHT,
      onclone: (doc) => {
        const h = doc.getElementById("exportHost");
        if (h) h.style.opacity = "1";
      }
    });
    host.innerHTML = "";
    return canvas;
  }

  let cachedBackBlob = null;
  /** Render the static back card to a PNG blob at 3x (cached after first render). */
  async function getBackBlob() {
    if (cachedBackBlob) return cachedBackBlob;
    if (typeof html2canvas !== "function") throw new Error("Export library (html2canvas) failed to load.");
    const host = $("exportHost");
    host.innerHTML = "";
    const card = TechCard.createBack();
    host.appendChild(card);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await waitForImages(card);
    const canvas = await html2canvas(card, {
      scale: EXPORT_SCALE,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      width: TechCard.WIDTH,
      height: TechCard.HEIGHT,
      onclone: (doc) => {
        const h = doc.getElementById("exportHost");
        if (h) h.style.opacity = "1";
      }
    });
    host.innerHTML = "";
    cachedBackBlob = await canvasToBlob(canvas);
    return cachedBackBlob;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed. If you opened the file directly (file://), serve the site over http instead."))), "image/png")
    );
  }

  function slug(name) {
    return (name || "member").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "member";
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function downloadOne(row, btn) {
    if (busy) return toast("Please wait for the current export to finish.", true);
    busy = true;
    setBtnLoading(btn, true, "Rendering…");
    try {
      const base = slug(row.full_name);
      const frontCanvas = await renderCardCanvas(row);
      const frontBlob = await canvasToBlob(frontCanvas);
      const backBlob = await getBackBlob();
      saveBlob(frontBlob, base + "-front.png");
      await new Promise((r) => setTimeout(r, 180));
      saveBlob(backBlob, base + "-back.png");
      toast("Downloaded front and back cards for " + row.full_name + ".");
    } catch (e) {
      toast("Download failed: " + friendlyError(e), true);
    } finally {
      busy = false;
      setBtnLoading(btn, false);
    }
  }

  $("zipBtn").addEventListener("click", async () => {
    if (busy) return;
    const list = filteredRows();
    if (!list.length) return toast("There are no cards to download.", true);
    if (typeof JSZip !== "function") return toast("Export library (JSZip) failed to load.", true);
    busy = true;
    const btn = $("zipBtn");
    setBtnLoading(btn, true, "Building ZIP…");
    setProgress(0, list.length);
    const zip = new JSZip();
    const used = new Map();
    const failed = [];
    try {
      const backBlob = await getBackBlob();
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        setProgress(i, list.length, "Rendering " + r.full_name + "…");
        try {
          const canvas = await renderCardCanvas(r);
          const frontBlob = await canvasToBlob(canvas);
          let base = slug(r.full_name);
          const n = (used.get(base) || 0) + 1;
          used.set(base, n);
          if (n > 1) base += "-" + n;
          zip.file(base + "-front.png", frontBlob);
          zip.file(base + "-back.png", backBlob);
        } catch (e) {
          failed.push(r.full_name + " (" + friendlyError(e) + ")");
        }
      }
      if (failed.length === list.length) throw new Error(failed[0]);
      setProgress(list.length, list.length, "Compressing ZIP…");
      const out = await zip.generateAsync({ type: "blob" });
      saveBlob(out, "techtonics-id-cards-" + new Date().toISOString().slice(0, 10) + ".zip");
      toast(failed.length
        ? "ZIP downloaded, but " + failed.length + " card(s) failed: " + failed.join("; ")
        : "Downloaded front & back cards for " + list.length + " member" + (list.length === 1 ? "" : "s") + " as ZIP.", failed.length > 0);
    } catch (e) {
      toast("ZIP export failed: " + friendlyError(e), true);
    } finally {
      busy = false;
      $("progress").hidden = true;
      setBtnLoading(btn, false);
    }
  });

  $("csvBtn").addEventListener("click", () => {
    const list = filteredRows();
    if (!list.length) return toast("There is no data to export.", true);
    const cols = ["id", "full_name", "department", "batch", "designation", "photo_url", "created_at"];
    const esc = (v) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // guard against CSV formula injection
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.join(",")].concat(list.map((r) => cols.map((c) => esc(r[c])).join(",")));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    saveBlob(blob, "techtonics-submissions-" + new Date().toISOString().slice(0, 10) + ".csv");
    toast("Exported " + list.length + " row" + (list.length === 1 ? "" : "s") + " to CSV.");
  });

  /* ---------------------------------------------------------------
     UI helpers
     --------------------------------------------------------------- */
  function setBtnLoading(btn, on, label) {
    if (!btn) return;
    if (on) {
      if (!btn.dataset.html) btn.dataset.html = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + (label || "Working…") + "</span>";
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    } else {
      if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
      delete btn.dataset.html;
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  }

  function setProgress(done, total, text) {
    $("progress").hidden = false;
    $("progressText").textContent = (text || "Preparing…") + " (" + Math.min(done + (done < total ? 1 : 0), total) + "/" + total + ")";
    $("progressFill").style.width = Math.round((done / total) * 100) + "%";
  }

  function toast(msg, isError) {
    const t = document.createElement("div");
    t.className = "toast" + (isError ? " error" : "");
    t.setAttribute("role", isError ? "alert" : "status");
    t.textContent = msg;
    $("toasts").appendChild(t);
    setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, isError ? 7000 : 3500);
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  boot();
})();
