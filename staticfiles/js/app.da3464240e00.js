/**** Define Alpine component FIRST (must exist before Alpine evaluates x-data) ****/
window.profileLinksEditor = function profileLinksEditor(){

  // ---- helpers for bio syncing ----
  function findEditableBio(root){
    return root.querySelector('[contenteditable="true"][name="bio"]')
        || root.querySelector('.editable-area.bio[contenteditable="true"]')
        || root.querySelector('[data-bio-editable]')
        || root.querySelector('[x-ref="bioEditable"]');
  }
  function ensureBioField(form){
    let fld = form.querySelector('textarea[name="bio"], input[type="hidden"][name="bio"], input[type="text"][name="bio"]');
    if(!fld){
      fld = document.createElement('input');
      fld.type = 'hidden';
      fld.name = 'bio';
      form.appendChild(fld);
    }
    return fld;
  }
  function syncBioToForm(root){
    const form = root.querySelector('form.profile-shell') || document.querySelector('form.profile-shell');
    if(!form) return;
    const editable = findEditableBio(root);
    if(!editable) return;
    const fld = ensureBioField(form);
    fld.value = (editable.textContent || '').trim();
  }
  // ---------------------------------

  // ---- helpers for formset mgmt ----
  function getFormsetInfo(form){
    const totalEl = form.querySelector('input[name$="-TOTAL_FORMS"]');
    if(!totalEl){ return null; }
    const name = totalEl.getAttribute('name');            // e.g. "form-TOTAL_FORMS" or "link_set-TOTAL_FORMS"
    const prefix = name.replace(/-TOTAL_FORMS$/, '');     // e.g. "form" or "link_set"
    return { totalEl, prefix };
  }
  function getContainer(){
    return document.querySelector('[data-formset-container]') || document.getElementById('linksList');
  }
  // ----------------------------------

  return {
    errors: {},

    init(){
      const root = document.querySelector('.profile-shell')?.closest('body') || document;

      // initialize contenteditable placeholder
      const bioEl = findEditableBio(root);
      if (bioEl && bioEl.getAttribute && bioEl.getAttribute('contenteditable') === 'true') {
        const text = (bioEl.textContent || '').trim();
        bioEl.dataset.empty = String(text.length === 0);
      }
      // prime hidden field so initial server value is preserved on first submit
      syncBioToForm(root);

      // Delegated blur handler for link inputs (title/url)
      const form = document.querySelector('form.profile-shell');
      if (form) {
        form.addEventListener('focusout', (e) => {
          const t = e.target;
          if (!(t && t.tagName === 'INPUT')) return;
          const name = t.getAttribute('name') || '';
          if (!/-(title|url)$/.test(name)) return;
          this.onLinkFieldBlur(e);
        }, true); // capture helps when focus changes quickly
      }
    },

    onHandleInput(e){
      const v = (e.target.value || '').toLowerCase().replace(/[^a-z0-9_\\.]/g, '');
      e.target.value = v;
      this.errors.handle = (v.length < 5) ? 'Handle must be at least 5 characters.' : '';
    },

    updateBioPlaceholder(e){
      const el = e?.target;
      if(!el || !el.getAttribute) return;
      if (el.getAttribute('contenteditable') === 'true') {
        const txt = (el.textContent || '').trim();
        el.dataset.empty = String(txt.length === 0);
      }
    },

    previewAvatar(e){
      const input = e?.target;
      if(!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      const img = document.getElementById('avatarPreview');
      try {
        const url = URL.createObjectURL(file);
        if (img) img.src = url;
      } catch(_) {}
      const root = document.querySelector('.profile-shell')?.closest('body') || document;
      syncBioToForm(root);
      const form = input.form || document.querySelector('form.profile-shell');
      if (form) form.requestSubmit();
    },

    saveProfile(event){
      const root = document.querySelector('.profile-shell')?.closest('body') || document;
      syncBioToForm(root);
      const form = (event && event.target && event.target.form) || document.querySelector('form.profile-shell');
      if (form) form.requestSubmit(); // form has novalidate, so it won't be blocked
    },

    onLinkFieldBlur(event){
      const root = document.querySelector('form.profile-shell')?.closest('body') || document;
      syncBioToForm(root);
      const form = (event && event.target && event.target.form) || document.querySelector('form.profile-shell');
      if (form) form.requestSubmit(); // with novalidate, autosave always posts
    },

    addLink(){
      const form = document.querySelector('form.profile-shell');
      const info = form && getFormsetInfo(form);
      if(!info) return;

      const { totalEl } = info;
      const idx = parseInt(totalEl.value, 10) || 0;

      // Clone template and swap __prefix__
      const tpl = document.getElementById('empty-form-template');
      if(!tpl) return;
      const html = tpl.innerHTML.replace(/__prefix__/g, String(idx));

      // Append to container
      const container = getContainer();
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      const node = wrapper.firstElementChild;
      container.appendChild(node);

      // Bump TOTAL_FORMS
      totalEl.value = String(idx + 1);

      // Focus first input in the new row
      const firstInput = node.querySelector('input[type="text"], input:not([type]), textarea');
      firstInput?.focus();
    },

    deleteLink(e){
      const card = e?.target?.closest('[data-form-row]');
      if(!card) return;

      const idInput = card.querySelector('input[name$="-id"]');
      const del = card.querySelector('input[type="checkbox"][name$="-DELETE"]');

      // Unsaved newly added row? Just remove it and decrement TOTAL_FORMS.
      const isUnsaved = idInput && !idInput.value;

      if(isUnsaved){
        const form = document.querySelector('form.profile-shell');
        const info = form && getFormsetInfo(form);
        if(info){
          const { totalEl } = info;
          const total = Math.max(0, (parseInt(totalEl.value, 10) || 0) - 1);
          totalEl.value = String(total);
        }
        card.remove();
        return;
      }

      if(!del) return;
      if(!confirm('Delete this link?')) return;

      // Mark for deletion and submit WITHOUT HTML5 validation
      del.checked = true;
      const root = document.querySelector('.profile-shell')?.closest('body') || document;
      syncBioToForm(root);
      const form = card.closest('form') || document.querySelector('form.profile-shell');
      if (form) {
        form.submit();   // bypass validation so delete always posts
      }
    }
  };
};

/**** The rest of your JS can stay inside DOMContentLoaded ****/
document.addEventListener('DOMContentLoaded', function(){

/** From: onelink/templates/404.html */
function gotoHandle() {
  const v = (document.getElementById('handleLookup').value || '').trim().toLowerCase().replace(/^@/, '');
  if (!v) return;
  window.location.href = `/@${encodeURIComponent(v)}`;
}


/** From: onelink/templates/base.html */
(function(){
  const btn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && nav.classList.contains('open')){
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
})();


/** From: onelink/templates/base.html */
window.addEventListener('profile:saved', (e) => {
  try {
    const handle = (e.detail && e.detail.handle || '').trim();
    if (!handle) return;

    const links = Array.from(document.querySelectorAll('#profile-link, a[data-profile-link]'));
    if (!links.length) return;

    links.forEach((a) => {
      const oldHref = a.getAttribute('href') || a.href || '';
      const newHref = oldHref.replace(/\/@[^\/?#]*/i, `/@${handle}`);
      a.setAttribute('href', newHref === oldHref ? `/@${handle}` : newHref);
    });

    const placeholders = Array.from(document.querySelectorAll('[data-profile-handle]'));
    placeholders.forEach((el) => { el.textContent = handle; });
  } catch(err) {
    console.warn('profile:saved update skipped:', err);
  }
});


/** From: onelink/templates/components/modal.html */
(function(){
  const modal = document.getElementById('generic-modal');
  if(!modal) return;
  const openBtn   = document.querySelector('[data-open-modal]');
  const cancelBtn = modal.querySelector('[data-cancel-modal]');
  const backdrop  = modal.querySelector('.modal-backdrop');

  function openModal(){
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('[autofocus]')?.focus();
  }
  function closeModal(){
    modal.hidden = true;
    document.body.style.overflow = '';
    openBtn?.focus();
  }

  openBtn?.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && !modal.hidden) closeModal(); });
})();


/** From: onelink/templates/profiles/link_list.html */
// Progressive enhancement: keyboard + drag reorder with CSRF
(function(){
  const list = document.getElementById('links'); // legacy ID; safe no-op if absent
  if(!list) return;
  const reorderUrl = list.dataset.reorderUrl || '/profiles/links/reorder/';

  const statusEl = document.getElementById('status');
  const csrftoken = (document.cookie.match(/csrftoken=([^;]+)/)||[])[1];

  function announce(t){ if(statusEl){ statusEl.textContent = t; } }

  async function saveOrder(){
    if(!reorderUrl || reorderUrl.includes("{%")){ return; }
    const order = Array.from(list.querySelectorAll('.row')).map((li, idx) => ({
      id: li.dataset.id, position: idx + 1
    }));
    try{
      const res = await fetch(reorderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken
        },
        body: JSON.stringify({ order })
      });
      if(!res.ok) throw new Error(`Bad status ${res.status}`);
      announce('Saved order.');
    }catch(err){
      console.error(err);
      announce('Could not save order.');
    }
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.row:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  list.querySelectorAll('.row').forEach(li => { li.draggable = true; });

  list.addEventListener('keydown', e => {
    const row = e.target.closest('.row');
    if(!row) return;
    if(e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      const sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      if(sib && sib.classList.contains('row')){
        (dir < 0 ? row.parentNode.insertBefore(row, sib) : row.parentNode.insertBefore(sib, row));
        row.focus();
        announce('Reordered. Saving…');
        saveOrder();
      }
    }
  });

  list.addEventListener('dragstart', e => {
    e.target.classList.add('dragging');
  });

  list.addEventListener('dragend', e => {
    e.target.classList.remove('dragging');
    announce('Reordered. Saving…');
    saveOrder();
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(list, e.clientY);
    const dragging = list.querySelector('.dragging');
    if (afterElement == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterElement);
    }
  });
})();


}); // DOMContentLoaded end
