/* =====================================================================
   Techtonics Club – script.js
   1) TechCard: the shared ID card component (used by index.html AND
      admin.html, so admin exports look identical to the preview).
   2) Supabase client helper.
   3) Member submission page logic (runs only on index.html).

   NOTE: This file intentionally contains NO download / export code.
   ===================================================================== */

(function () {
  "use strict";

  /* -------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------- */
  const CARD_W = 324;
  const CARD_H = 516;

  const DESIGNATIONS = [
    "Member",
    "Media Team",
    "Design Team",
    "Technical Team",
    "Event Management",
    "General Secretary",
    "Vice President",
    "President"
  ];

  const PLACEHOLDER = {
    full_name: "Your Name",
    designation: "Designation",
    department: "Department",
    batch: "Batch"
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* -------------------------------------------------------------------
     TechCard component
     ------------------------------------------------------------------- */
  const TechCard = {
    WIDTH: CARD_W,
    HEIGHT: CARD_H,

    /** Build a fresh card DOM node (fixed 324×516 design size). */
    create() {
      const card = el("div", "tc-card");
      card.setAttribute("aria-label", "Member ID card preview");

      // Header with both logos (files from /assets — never redrawn)
      const header = el("div", "tc-header");
      const club = el("img", "tc-logo-club");
      club.src = "assets/techtonics-logo.jpeg";
      club.alt = "Techtonics Club";
      club.draggable = false;
      const divider = el("span", "tc-header-divider");
      const iuBox = el("div", "tc-logo-iu");
      const iu = el("img");
      iu.src = "assets/iqra-university-logo.png";
      iu.alt = "Iqra University";
      iu.draggable = false;
      iuBox.appendChild(iu);
      header.append(club, divider, iuBox);

      const accent = el("div", "tc-accent");

      // Hero band + framed photo
      const hero = el("div", "tc-hero");
      const bg = el("div", "tc-hero-bg");
      bg.append(
        el("span", "tc-ring r1"), el("span", "tc-ring r2"),
        el("span", "tc-dot d1"), el("span", "tc-dot d2"), el("span", "tc-dot d3")
      );
      const frame = el("div", "tc-photo-frame");
      const box = el("div", "tc-photo-box");
      const sil = el("div", "tc-silhouette");
      sil.append(el("span", "head"), el("span", "body"));
      const photo = el("img", "tc-photo");
      photo.alt = "";
      photo.draggable = false;
      box.append(sil, photo);
      frame.appendChild(box);
      hero.append(bg, el("span", "tc-photo-shadow"), frame);

      // Info block
      const info = el("div", "tc-info");
      const name = el("h2", "tc-name");
      const badge = el("span", "tc-badge");
      const details = el("div", "tc-details");
      const rowDept = el("div", "tc-row");
      rowDept.append(el("span", "tc-label", "Department"), el("span", "tc-value tc-dept"));
      const rowBatch = el("div", "tc-row");
      rowBatch.append(el("span", "tc-label", "Batch"), el("span", "tc-value tc-batch"));
      details.append(rowDept, rowBatch);
      info.append(name, badge, details);

      // Footer band
      const footer = el("div", "tc-footer");
      footer.append(el("span", null, "Techtonics Club"), el("span", "sep", "|"), el("span", null, "Iqra University"));

      card.append(header, accent, hero, info, footer);
      card.addEventListener("contextmenu", (e) => e.preventDefault());
      card.addEventListener("dragstart", (e) => e.preventDefault());

      TechCard.update(card, {});
      return card;
    },

    /** Build a fresh back-side card DOM node (fixed 324×516 design size, static). */
    createBack() {
      const card = el("div", "tc-card tc-card-back");
      card.setAttribute("aria-label", "Member ID card back preview");

      const topLine = el("div", "tc-back-top-line");

      const body = el("div", "tc-back-body");

      // Center-top: Techtonics Club logo + tagline
      const brand = el("div", "tc-back-brand");
      const logo = el("img", "tc-back-logo");
      logo.src = "assets/techtonics-logo.jpeg";
      logo.alt = "Techtonics Club";
      logo.draggable = false;
      const tagline = el("p", "tc-back-tagline", "Innovate. Collaborate. Create.");
      brand.append(logo, tagline);

      // Middle: contact block with inline SVG phone icon
      const contact = el("div", "tc-back-contact");
      contact.innerHTML =
        '<svg class="tc-back-phone-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2b7a05" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>' +
        "</svg>" +
        "<span>Contact: +92 303 2888452</span>";

      const divider = el("div", "tc-back-divider");

      // CSS-only signature line + labels
      const sig = el("div", "tc-back-sig");
      sig.append(
        el("div", "tc-back-sig-line"),
        el("span", "tc-back-sig-title", "Authorized Signatory"),
        el("span", "tc-back-sig-sub", "President, Techtonics Club")
      );

      // Return notice
      const notice = el(
        "p",
        "tc-back-notice",
        "This card is the property of Techtonics Club, Iqra University. If found, please return to the club."
      );

      body.append(brand, contact, divider, sig, notice);

      // Footer band
      const footer = el("div", "tc-footer");
      footer.append(el("span", null, "Techtonics Club"), el("span", "sep", "|"), el("span", null, "Iqra University"));

      card.append(topLine, body, footer);
      card.addEventListener("contextmenu", (e) => e.preventDefault());
      card.addEventListener("dragstart", (e) => e.preventDefault());
      return card;
    },

    /** Update card text + photo. `data` uses the database column names. */
    update(card, data) {
      data = data || {};
      const set = (selector, key) => {
        const node = card.querySelector(selector);
        const value = (data[key] || "").toString().trim();
        node.textContent = value || PLACEHOLDER[key];
        node.classList.toggle("is-placeholder", !value);
      };
      set(".tc-name", "full_name");
      set(".tc-badge", "designation");
      set(".tc-dept", "department");
      set(".tc-batch", "batch");

      const img = card.querySelector(".tc-photo");
      if (data.photo_src) {
        if (img.getAttribute("src") !== data.photo_src) img.src = data.photo_src;
        card.classList.add("has-photo");
      } else {
        img.removeAttribute("src");
        card.classList.remove("has-photo");
      }
      TechCard.fit(card);
    },

    /** Auto-shrink long names (wrap up to 2 lines, then shrink). */
    fit(card) {
      const name = card.querySelector(".tc-name");
      const badge = card.querySelector(".tc-badge");
      if (!name.isConnected) return;
      let size = 25;
      const min = 14;
      name.style.fontSize = size + "px";
      // Max two lines at 1.12 line-height
      while (size > min && name.scrollHeight > size * 1.12 * 2 + 1) {
        size -= 0.5;
        name.style.fontSize = size + "px";
      }
      // Also shrink very long custom designations so the badge stays 1–2 lines
      let bSize = 11.5;
      badge.style.fontSize = bSize + "px";
      while (bSize > 8.5 && badge.offsetHeight > bSize * 1.25 * 2 + 12) {
        bSize -= 0.5;
        badge.style.fontSize = bSize + "px";
      }
    },

    /**
     * Mount a card (front + back) into a responsive "stage" that scales the
     * fixed-size card to the available width (so layout is pixel-identical everywhere).
     */
    mount(stage) {
      stage.innerHTML = "";
      stage.classList.add("card-stage");
      const scaler = el("div", "card-scale");
      const frontWrap = el("div", "card-face card-face-front");
      const backWrap = el("div", "card-face card-face-back is-hidden");
      backWrap.setAttribute("aria-hidden", "true");
      const card = TechCard.create();
      const backCard = TechCard.createBack();
      frontWrap.appendChild(card);
      backWrap.appendChild(backCard);
      scaler.append(frontWrap, backWrap);
      stage.appendChild(scaler);

      stage._setSide = (side) => {
        const showBack = side === "back";
        frontWrap.classList.toggle("is-hidden", showBack);
        frontWrap.setAttribute("aria-hidden", showBack ? "true" : "false");
        backWrap.classList.toggle("is-hidden", !showBack);
        backWrap.setAttribute("aria-hidden", showBack ? "false" : "true");
      };

      const resize = () => {
        const w = stage.clientWidth || CARD_W;
        const s = w / CARD_W;
        scaler.style.transform = "scale(" + s + ")";
        stage.style.height = CARD_H * s + "px";
      };
      resize();
      if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
      else window.addEventListener("resize", resize);

      // Re-fit once web fonts are ready (metrics change)
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => TechCard.fit(card));
      return card;
    },

    /** Switch the visible side ("front" or "back") on a mounted stage and optional toggle container. */
    setSide(stage, side, toggleRoot) {
      if (stage && stage._setSide) stage._setSide(side);
      if (toggleRoot) {
        toggleRoot.querySelectorAll("[data-side]").forEach((btn) => {
          const active = btn.dataset.side === side;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
      }
    },

    /** Wire a Front/Back toggle container to a mounted stage. */
    bindToggle(toggleRoot, stage) {
      if (!toggleRoot || !stage) return;
      toggleRoot.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-side]");
        if (!btn) return;
        TechCard.setSide(stage, btn.dataset.side, toggleRoot);
      });
    }
  };

  /* -------------------------------------------------------------------
     Supabase client
     ------------------------------------------------------------------- */
  function getConfig() {
    return window.TECHTONICS_CONFIG || {};
  }

  function isConfigured() {
    const c = getConfig();
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
      !/^YOUR_/.test(c.SUPABASE_URL) && !/^YOUR_/.test(c.SUPABASE_ANON_KEY));
  }

  let client = null;
  function getSupabase() {
    if (client) return client;
    if (!isConfigured()) throw new Error("Supabase is not configured. Add your project URL and anon key to config.js.");
    if (!window.supabase || !window.supabase.createClient) throw new Error("Could not load the Supabase library. Check your internet connection.");
    const c = getConfig();
    client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
    return client;
  }

  function friendlyError(err) {
    const msg = (err && (err.message || err.error_description || err.error)) || String(err || "Unknown error");
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Network error. Please check your connection and try again.";
    if (/row-level security|violates|permission denied|not authorized|Unauthorized/i.test(msg)) return "Permission denied by the server. (" + msg + ")";
    return msg;
  }

  window.Techtonics = { TechCard, DESIGNATIONS, getSupabase, isConfigured, getConfig, friendlyError, el };

  /* ===================================================================
     MEMBER PAGE (index.html only)
     =================================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("memberForm");
    if (!form) return;
    initMemberPage(form);
  });

  function initMemberPage(form) {
    const MAX_BYTES = 3 * 1024 * 1024;
    const MAX_DIM = 800;
    const STORAGE_KEY = "techtonics_card_submitted_v1";

    const $ = (id) => document.getElementById(id);
    const fieldset = $("formFields");
    const fullName = $("fullName");
    const department = $("department");
    const batch = $("batch");
    const designation = $("designation");
    const customWrap = $("customDesignationWrap");
    const customDesignation = $("customDesignation");
    const photoInput = $("photo");
    const uploadZone = $("uploadZone");
    const uploadThumb = $("uploadThumb");
    const uploadName = $("uploadName");
    const submitBtn = $("submitBtn");
    const formAlert = $("formAlert");
    const successPanel = $("successPanel");
    const configWarning = $("configWarning");

    // Build the designation dropdown
    DESIGNATIONS.forEach((d) => designation.appendChild(new Option(d, d)));
    designation.appendChild(new Option("Custom…", "__custom"));

    const stageEl = $("cardStage");
    const card = TechCard.mount(stageEl);
    const toggleEl = document.querySelector(".preview-panel .card-toggle");
    TechCard.bindToggle(toggleEl, stageEl);

    let photoBlob = null;     // compressed JPEG to upload
    let photoPreview = null;  // object URL for preview
    let photoToken = 0;

    if (!isConfigured()) configWarning.hidden = false;

    /* ---------- Live preview ---------- */
    function currentDesignation() {
      return designation.value === "__custom" ? customDesignation.value.trim() : designation.value;
    }
    function render() {
      TechCard.update(card, {
        full_name: fullName.value,
        department: department.value,
        batch: batch.value,
        designation: currentDesignation(),
        photo_src: photoPreview
      });
    }
    [fullName, department, batch, customDesignation].forEach((i) =>
      i.addEventListener("input", () => { clearError(i); render(); })
    );
    designation.addEventListener("change", () => {
      const custom = designation.value === "__custom";
      customWrap.hidden = !custom;
      if (custom) customDesignation.focus();
      clearError(designation);
      clearError(customDesignation);
      render();
    });

    /* ---------- Photo handling ---------- */
    photoInput.addEventListener("change", () => handleFile(photoInput.files && photoInput.files[0]));
    ["dragenter", "dragover"].forEach((ev) => uploadZone.addEventListener(ev, () => uploadZone.classList.add("is-drag")));
    ["dragleave", "drop"].forEach((ev) => uploadZone.addEventListener(ev, () => uploadZone.classList.remove("is-drag")));

    async function handleFile(file) {
      clearError(photoInput);
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        return rejectPhoto("Please choose an image file (JPG, PNG or WebP).");
      }
      if (file.size > MAX_BYTES) {
        return rejectPhoto("Image is too large (" + (file.size / 1048576).toFixed(1) + " MB). Maximum size is 3 MB.");
      }
      const token = ++photoToken;
      uploadName.textContent = "Processing photo…";
      try {
        const blob = await compressImage(file, MAX_DIM, 0.86);
        if (token !== photoToken) return;
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        photoBlob = blob;
        photoPreview = URL.createObjectURL(blob);
        uploadThumb.innerHTML = "";
        const t = document.createElement("img");
        t.src = photoPreview; t.alt = ""; t.draggable = false;
        uploadThumb.appendChild(t);
        uploadName.textContent = file.name + " · " + Math.round(blob.size / 1024) + " KB";
        render();
      } catch (e) {
        rejectPhoto("Could not read this image. Please try a different photo.");
      }
    }

    function rejectPhoto(msg) {
      photoInput.value = "";
      photoBlob = null;
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      photoPreview = null;
      uploadThumb.innerHTML = cameraIcon();
      uploadName.textContent = "JPG, PNG or WebP · max 3 MB";
      showError(photoInput, msg);
      render();
    }

    function compressImage(file, maxDim, quality) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          let { naturalWidth: w, naturalHeight: h } = img;
          if (!w || !h) return reject(new Error("Invalid image"));
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";           // flatten transparency for JPEG
          ctx.fillRect(0, 0, w, h);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image")); };
        img.src = url;
      });
    }

    /* ---------- Validation ---------- */
    function showError(input, msg) {
      const err = document.getElementById(input.id + "Error");
      if (err) err.textContent = msg;
      input.setAttribute("aria-invalid", "true");
      if (input === photoInput) uploadZone.classList.add("is-invalid");
    }
    function clearError(input) {
      const err = document.getElementById(input.id + "Error");
      if (err) err.textContent = "";
      input.removeAttribute("aria-invalid");
      if (input === photoInput) uploadZone.classList.remove("is-invalid");
    }

    function validate() {
      let first = null;
      const need = (input, ok, msg) => {
        if (!ok) { showError(input, msg); first = first || input; } else clearError(input);
      };
      const name = fullName.value.trim();
      need(fullName, name.length >= 2, name ? "Please enter your full name." : "Full Name is required.");
      need(department, department.value.trim().length > 0, "Department is required.");
      need(batch, batch.value.trim().length > 0, "Batch is required (e.g. Fall 2023).");
      need(designation, !!designation.value, "Please select a Designation.");
      if (designation.value === "__custom") {
        need(customDesignation, customDesignation.value.trim().length > 0, "Please type your Designation.");
      }
      need(photoInput, !!photoBlob, "Please upload a photo (image under 3 MB).");
      if (first) {
        (first === photoInput ? uploadZone : first).scrollIntoView({ behavior: "smooth", block: "center" });
        if (first !== photoInput) first.focus({ preventScroll: true });
      }
      return !first;
    }

    /* ---------- Duplicate check (client side) ---------- */
    function lockForm(record) {
      fieldset.disabled = true;
      submitBtn.disabled = true;
      submitBtn.hidden = true;
      successPanel.hidden = false;
      if (record && record.name) {
        $("successName").textContent = "Submitted for " + record.name +
          (record.at ? " on " + new Date(record.at).toLocaleString() : "") + ".";
      }
    }

    render();
    try {
      const prior = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (prior) {
        lockForm(prior);
        if (prior.preview) TechCard.update(card, prior.preview);
      }
    } catch (_) { /* ignore storage errors */ }

    /* ---------- Submit ---------- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      formAlert.hidden = true;
      if (fieldset.disabled) return;
      if (!validate()) return;

      const payload = {
        full_name: fullName.value.trim().replace(/\s+/g, " "),
        department: department.value.trim().replace(/\s+/g, " "),
        batch: batch.value.trim().replace(/\s+/g, " "),
        designation: currentDesignation().replace(/\s+/g, " ")
      };

      setLoading(true, "Uploading photo…");
      fieldset.disabled = true;
      try {
        const sb = getSupabase();
        const cfg = getConfig();
        const id = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
        const path = "submissions/" + id + ".jpg";

        const up = await sb.storage.from(cfg.PHOTO_BUCKET || "photos")
          .upload(path, photoBlob, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
        if (up.error) throw up.error;

        setLoading(true, "Saving your details…");
        // No .select() — the public is allowed to INSERT only.
        const ins = await sb.from(cfg.TABLE || "submissions").insert({ ...payload, photo_url: path });
        if (ins.error) throw ins.error;

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            name: payload.full_name, at: new Date().toISOString(),
            preview: { ...payload }
          }));
        } catch (_) { /* storage may be unavailable */ }

        setLoading(false);
        lockForm({ name: payload.full_name, at: Date.now() });
        successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        setLoading(false);
        fieldset.disabled = false;
        formAlert.querySelector("[data-msg]").textContent = friendlyError(err);
        formAlert.hidden = false;
        formAlert.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    function setLoading(on, label) {
      submitBtn.disabled = on;
      submitBtn.innerHTML = on
        ? '<span class="spinner" aria-hidden="true"></span><span>' + (label || "Submitting…") + "</span>"
        : "<span>Submit</span>";
      submitBtn.setAttribute("aria-busy", on ? "true" : "false");
    }

    function cameraIcon() {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    }
  }
})();
