// Consolidated inline scripts extracted on request

document.addEventListener("DOMContentLoaded", function () {
  /** From: onelink/templates/404.html */
  function gotoHandle() {
    const v = (document.getElementById("handleLookup").value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    if (!v) return;
    window.location.href = `/@${encodeURIComponent(v)}`;
  }

  /** From: onelink/templates/base.html */
  (function () {
    const btn = document.querySelector(".nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(isOpen));
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        btn.focus();
      }
    });
  })();

  /** From: onelink/templates/base.html */
  window.addEventListener("profile:saved", (e) => {
    try {
      const handle = (e.detail && e.detail.handle || "").trim();
      if (!handle) return;

      const links = Array.from(
        document.querySelectorAll("#profile-link, a[data-profile-link]")
      );
      if (!links.length) return;

      links.forEach((a) => {
        const oldHref = a.getAttribute("href") || a.href || "";
        // Replace only the "/@<handle>" segment (up to next /, ? or #)
        const newHref = oldHref.replace(/\/@[^\/?#]*/i, `/@${handle}`);
        a.setAttribute("href", newHref === oldHref ? `/@${handle}` : newHref);
      });

      // Debug signal
      console.log("[profile:saved] navbar link(s) updated to /@" + handle);
    } catch (err) {
      console.error("[profile:saved] failed to update navbar link", err);
    }
  });

  /** From: onelink/templates/index.html */
  (function () {
    const openBtn = document.getElementById("open-register");
    const cancelBtn = document.getElementById("cancel-register");
    const modal = document.getElementById("register-modal");
    const backdrop = document.getElementById("register-backdrop");

    function openModal() {
      modal.hidden = false;
      backdrop.hidden = false;
      document.body.style.overflow = "hidden";
      modal.querySelector("input")?.focus();
    }
    function closeModal() {
      modal.hidden = true;
      backdrop.hidden = true;
      document.body.style.overflow = "";
      openBtn?.focus();
    }

    openBtn?.addEventListener("click", openModal);
    cancelBtn?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
  })();

  /** From: onelink/templates/profiles/link_list.html */
  // Progressive enhancement: keyboard + drag reorder with CSRF
  (function () {
    const list = document.getElementById("links");
    if (!list) return;

    const statusEl = document.getElementById("status");

    // ✅ FIXED: read CSRF token from cookie only (no Django template tag)
    const csrftoken =
      (document.cookie.match(/(?:^|;)\s*csrftoken=([^;]+)/) || [])[1] || "";

    // ✅ FIXED: read real reorder URL from data attribute
    const reorderUrl = list.dataset.reorderUrl;

    function announce(t) {
      if (statusEl) statusEl.textContent = t;
    }

    async function saveOrder() {
      const ids = [...list.querySelectorAll(".row")].map(
        (li) => li.dataset.id
      );
      if (!reorderUrl) {
        console.warn("Missing data-reorder-url on #links");
        return;
      }
      try {
        const res = await fetch(reorderUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
          },
          body: JSON.stringify({ ordered_ids: ids }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        announce("Order saved");
      } catch (e) {
        announce("Reorder failed");
        console.error(e);
      }
    }

    // Drag and drop (mouse/touch)
    let dragSrc = null;
    list.addEventListener("dragstart", (e) => {
      const li = e.target.closest(".row");
      if (!li) return;
      dragSrc = li;
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });

    list.addEventListener("dragend", (e) => {
      const li = e.target.closest(".row");
      if (li) li.classList.remove("dragging");
      dragSrc = null;
      saveOrder();
    });

    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      const after = getDragAfterElement(list, e.clientY);
      if (after == null) {
        list.appendChild(dragSrc);
      } else {
        list.insertBefore(dragSrc, after);
      }
    });

    function getDragAfterElement(container, y) {
      const els = [...container.querySelectorAll(".row:not(.dragging)")];
      return els.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
          } else {
            return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY }
      ).element;
    }

    // Make rows draggable
    list.querySelectorAll(".row").forEach((li) => {
      li.draggable = true;
    });

    // Keyboard reorder + shortcuts
    list.addEventListener("keydown", (e) => {
      const row = e.target.closest(".row");
      if (!row) return;
      if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        if (e.key === "ArrowUp" && row.previousElementSibling) {
          row.parentNode.insertBefore(row, row.previousElementSibling);
          row.focus();
          announce("Moved up");
        }
        if (e.key === "ArrowDown" && row.nextElementSibling) {
          row.parentNode.insertBefore(row.nextElementSibling, row);
          row.focus();
          announce("Moved down");
        }
        saveOrder();
      }
      if (e.key === "Enter") {
        const edit = row.querySelector(".actions a");
        if (edit) {
          window.location = edit.href;
        }
      }
      if (e.key === "Delete") {
        const del = row.querySelector(".actions .danger");
        if (del) {
          window.location = del.href;
        }
      }
    });
  })();

  /** From: onelink/templates/profiles/profile_detail.html */
  // Copy current URL
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.querySelector('[data-action="copy-link"]');
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy link"), 1800);
        } catch (e) {
          console.error(e);
        }
      });
    }
  });

  /** From: onelink/templates/profiles/profile_links.html */
  /* (your JS unchanged) */
});