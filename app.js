// app.js (Autosave draft realtime + Submit All + PDF Today) - Vanilla JS

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwuTqRX5M3I6vY1uhfOudhMqFdlynA61dnIFmtwrd6hJ_q_66xoVwgG9b2bjJXU-G1xUQ/exec";
const TOKEN_KEY = "qc_token_v1";

// ===== TOKEN (memory only, hilang saat refresh) =====
let QC_TOKEN = "";

function getToken(){ return QC_TOKEN; }
function setToken(t){ QC_TOKEN = t; }
function clearToken(){ QC_TOKEN = ""; }


(function () {
  const tanggalGlobal = document.getElementById("tanggalGlobal");
  const signTanggal = document.getElementById("signTanggal");

  const statusGlobal = document.getElementById("statusGlobal");
  const btnResetAll = document.getElementById("btnResetAll");
  const btnSubmitAll = document.getElementById("btnSubmitAll");
  const btnPdfToday = document.getElementById("btnPdfToday");

  const forms = Array.from(document.querySelectorAll(".qc-card"));

  // ========= Helpers =========
  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function setGlobalStatus(msg, type) {
    if (!statusGlobal) return;
    statusGlobal.textContent = msg || "";
    statusGlobal.classList.remove("ok", "err");
    if (type === "ok") statusGlobal.classList.add("ok");
    if (type === "err") statusGlobal.classList.add("err");
  }

  function setCardStatus(form, msg, type) {
    const el = form.querySelector(".cardStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.remove("ok", "err");
    if (type === "ok") el.classList.add("ok");
    if (type === "err") el.classList.add("err");
  }

  function setSignTanggal(val) {
    if (!signTanggal) return;
    signTanggal.textContent = val || "-";
  }

  function syncTanggalToAll(dateVal) {
    forms.forEach((form) => {
      const hidden = form.querySelector("input.tanggal");
      if (hidden) hidden.value = dateVal || "";
    });
  }

  function calcAvgForForm(form) {
    const kaInputs = Array.from(form.querySelectorAll("input.ka"));
    const values = kaInputs
      .map((inp) => toNumber(inp.value))
      .filter((n) => n !== null);

    const avgEl = form.querySelector("input.avgKa");
    if (!avgEl) return;

    if (values.length === 0) {
      avgEl.value = "-";
      return;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    avgEl.value = String(round2(avg)).replace(".", ",");
  }

  function getFormSlot(form) {
    return Number(form.getAttribute("data-form") || "0"); // 1..6
  }

  function readFormData(form) {
    const relasi = form.querySelector('input[name="relasi"]')?.value || "";
    const nopol = form.querySelector('input[name="nopol"]')?.value || "";
    const keterangan = form.querySelector('input[name="keterangan"]')?.value || "";

    const ka = Array.from(form.querySelectorAll("input.ka")).map((inp) => inp.value || "");
    const avg = form.querySelector('input[name="avgKa"]')?.value || "";

    return {
      relasi,
      nopol,
      ka,   // string (boleh "28,5")
      avg,  // string
      keterangan,
    };
  }

  function applyDraftToForm(form, draft) {
    form.querySelector('input[name="relasi"]').value = draft.relasi || "";
    form.querySelector('input[name="nopol"]').value = draft.nopol || "";
    form.querySelector('input[name="keterangan"]').value = draft.keterangan || "";

    const kaInputs = Array.from(form.querySelectorAll("input.ka"));
    (draft.ka || []).forEach((v, i) => {
      if (kaInputs[i]) kaInputs[i].value = v ?? "";
    });

    calcAvgForForm(form);
  }

  function clearForm(form) {
    form.reset();
    const kom = form.querySelector('input[name="komoditi"]');
    if (kom) kom.value = "GKP (GABAH KERING PANEN)";

    const t = tanggalGlobal ? tanggalGlobal.value : "";
    const hidden = form.querySelector("input.tanggal");
    if (hidden) hidden.value = t;

    const avgEl = form.querySelector("input.avgKa");
    if (avgEl) avgEl.value = "-";
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

    async function postJSON(payload) {
        const token = getToken();
        const body = token ? { ...payload, token } : payload;

        const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            if (res.status === 401) {
            clearToken();
            showPinGate("Sesi habis. Masukkan PIN lagi.");
            }
            throw new Error(data.message || `HTTP ${res.status}`);
        }
        return data;
        }



    async function getDraft(tanggal) {
        const token = getToken();
        const url =
            `${APPS_SCRIPT_URL}?action=getDraft&tanggal=${encodeURIComponent(tanggal)}&token=${encodeURIComponent(token)}`;

        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.ok === false) {
            if (res.status === 401) {
            clearToken();
            showPinGate("Sesi habis. Masukkan PIN lagi.");
            }
            throw new Error(data.message || `HTTP ${res.status}`);
        }
        return data.data || [];
        }


    function showPinGate(message) {
    const gate = document.getElementById("pinGate");
    const msg = document.getElementById("pinMsg");
    if (msg) {
      msg.textContent = message || "";
      msg.classList.remove("error");
    }
    if (gate) gate.classList.add("active");
    }

    function hidePinGate() {
    const gate = document.getElementById("pinGate");
    if (gate) gate.classList.remove("active");
    }

    async function initPinGateServer(){
    showPinGate("");

    const input = document.getElementById("pinInput");
    const btn = document.getElementById("pinBtn");
    const msg = document.getElementById("pinMsg");

    async function tryLogin(){
        const pin = String(input.value || "").trim();
        if (!pin) { 
          msg.textContent = "PIN wajib diisi.";
          msg.classList.add("error");
          return; 
        }

        msg.textContent = "Memeriksa PIN...";
        msg.classList.remove("error");
        try{
        const res = await postJSON({ action:"checkPin", pin }); // token tidak diperlukan untuk checkPin
        setToken(res.token);
        hidePinGate();
        msg.textContent = "";

        // baru load draft setelah login sukses
        await loadDraftToAllForms(tanggalGlobal.value);
        } catch(e){
        msg.textContent = e.message || "PIN salah.";
        msg.classList.add("error");
        input.focus(); input.select();
        }
    }

    btn.addEventListener("click", tryLogin);
    input.addEventListener("keydown", (e) => { if(e.key==="Enter") tryLogin(); });
    }

  // ========= Autosave realtime =========
  const autosaveByForm = new Map();

  function setupAutosaveForForm(form) {
    const slot = getFormSlot(form);

    const saveDraft = async () => {
      // update avg dulu
      calcAvgForForm(form);

      const tanggal = tanggalGlobal?.value || "";
      if (!tanggal) return;

      const payload = {
        action: "draftUpsert",
        tanggal,
        slot,
        form: readFormData(form),
      };

      try {
        await postJSON(payload);
        setCardStatus(form, "Tersimpan (draft)", "ok");
        setTimeout(() => setCardStatus(form, "", ""), 800);
      } catch (e) {
        setCardStatus(form, `Gagal autosave: ${e.message}`, "err");
      }
    };

    const debounced = debounce(saveDraft, 700);
    autosaveByForm.set(form, debounced);

    // semua input trigger autosave
    form.querySelectorAll("input").forEach((inp) => {
      // jangan autosave untuk input readonly avg/komoditi
      if (inp.hasAttribute("readonly")) return;

      inp.addEventListener("input", () => {
        if (inp.classList.contains("ka")) calcAvgForForm(form);
        debounced();
      });

      inp.addEventListener("change", () => {
        if (inp.classList.contains("ka")) calcAvgForForm(form);
        debounced();
      });
    });
  }

  async function loadDraftToAllForms(tanggal) {
    setGlobalStatus("Memuat draft...", "ok");

    // kosongkan dulu semua slot
    forms.forEach((f) => {
      clearForm(f);
      setCardStatus(f, "", "");
    });

    const drafts = await getDraft(tanggal);

    // map slot -> draft
    const map = new Map();
    drafts.forEach((d) => map.set(Number(d.slot), d));

    forms.forEach((form) => {
      const slot = getFormSlot(form);
      const d = map.get(slot);
      if (d) applyDraftToForm(form, d);
    });

    setGlobalStatus("Draft dimuat.", "ok");
    setTimeout(() => setGlobalStatus("", ""), 1200);
  }

  // ========= Actions =========
  async function submitAllFinal() {
    const tanggal = tanggalGlobal?.value || "";
    if (!tanggal) return setGlobalStatus("Tanggal belum diisi.", "err");

    setGlobalStatus("Menyimpan final ke QC_RAW...", "ok");
    try {
      const data = await postJSON({ action: "submitAll", tanggal });
      setGlobalStatus(data.message || "Berhasil.", "ok");

      // setelah submit, form jadi kosong (draft dihapus oleh server)
      forms.forEach((f) => clearForm(f));

      setTimeout(() => setGlobalStatus("", ""), 2000);
    } catch (e) {
      setGlobalStatus(`Gagal submit: ${e.message}`, "err");
    }
  }

  async function pdfToday() {
    const tanggal = tanggalGlobal?.value || "";
    if (!tanggal) return setGlobalStatus("Tanggal belum diisi.", "err");

    setGlobalStatus("Membuat PDF hari ini...", "ok");
    try {
      const data = await postJSON({ action: "pdfToday", tanggal });
      setGlobalStatus("PDF berhasil dibuat. Membuka link...", "ok");

      // buka link drive
      if (data.fileUrl) window.open(data.fileUrl, "_blank");

      setTimeout(() => setGlobalStatus("", ""), 2500);
    } catch (e) {
      setGlobalStatus(`Gagal bikin PDF: ${e.message}`, "err");
    }
  }

  // ========= Init =========
  if (tanggalGlobal) {
    tanggalGlobal.value = todayISO();
    syncTanggalToAll(tanggalGlobal.value);
    setSignTanggal(tanggalGlobal.value);

    tanggalGlobal.addEventListener("change", async (e) => {
      syncTanggalToAll(e.target.value);
      setSignTanggal(e.target.value);
      // load draft tanggal baru
      try {
        await loadDraftToAllForms(e.target.value);
      } catch (err) {
        setGlobalStatus(`Gagal load draft: ${err.message}`, "err");
      }
    });
  }
  initPinGateServer();
  // setup autosave
  forms.forEach((form) => {
    setupAutosaveForForm(form);

    // tombol reset per form
    const btnReset = form.querySelector(".btnReset");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        clearForm(form);
        setCardStatus(form, "Form direset.", "ok");
        setTimeout(() => setCardStatus(form, "", ""), 1000);

        // trigger autosave (biar draft juga kosong slot itu)
        const slot = getFormSlot(form);
        const tanggal = tanggalGlobal?.value || "";
        if (tanggal) {
          postJSON({
            action: "draftUpsert",
            tanggal,
            slot,
            form: readFormData(form),
          }).catch(() => {});
        }
      });
    }

    // submit per form (opsional: tetap ada tapi gak dipakai)
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      calcAvgForForm(form);
      setCardStatus(form, "Autosave aktif. Gunakan SIMPAN SEMUA untuk final.", "ok");
      setTimeout(() => setCardStatus(form, "", ""), 1200);
    });
  });

  // reset semua (lokal + draft kosong)
  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      forms.forEach((f) => {
        clearForm(f);
        setCardStatus(f, "", "");
      });
      setGlobalStatus("Semua form direset.", "ok");
      setTimeout(() => setGlobalStatus("", ""), 1200);

      // kosongkan draft server untuk 6 slot
      const tanggal = tanggalGlobal?.value || "";
      if (tanggal) {
        forms.forEach((form) => {
          const slot = getFormSlot(form);
          postJSON({ action: "draftUpsert", tanggal, slot, form: readFormData(form) }).catch(() => {});
        });
      }
    });
  }

  if (btnSubmitAll) btnSubmitAll.addEventListener("click", submitAllFinal);
  if (btnPdfToday) btnPdfToday.addEventListener("click", pdfToday);

  // load draft pertama kali (tanggal hari ini)
  loadDraftToAllForms(tanggalGlobal.value).catch((err) => {
    setGlobalStatus(`Gagal load draft: ${err.message}`, "err");
        // Setelah tanggalGlobal.value diset
    initPinGateServer(); // ini yang akan loadDraft setelah token dapat
  });
})();
