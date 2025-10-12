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
      // Replace only the "/@<handle>" segment (up to next /, ? or #)
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
  const list = document.getElementById('links');
  if(!list) return;
  const reorderUrl = list.dataset.reorderUrl || '/profiles/links/reorder/';

  const statusEl = document.getElementById('status');
  const csrftoken = (document.cookie.match(/csrftoken=([^;]+)/)||[])[1];

  function announce(t){ if(statusEl){ statusEl.textContent = t; } }

  async function saveOrder(){
    if(!reorderUrl || reorderUrl.includes("{%")){ return; } // guard if no server route is present
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

  // Make rows draggable
  list.querySelectorAll('.row').forEach(li => { li.draggable = true; });

  // Keyboard reorder + shortcuts
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


/** Alpine component used by profiles/profile_links.html */
window.profileLinksEditor = function profileLinksEditor(){
  // Utilities
  function getCookie(name){
    const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return v ? v.pop() : '';
  }
  const csrftoken = getCookie('csrftoken');

  function getBioEl(root){
    // Prefer contenteditable [name="bio"]; fallback to <textarea name="bio">
    return root.querySelector('[contenteditable="true"][name="bio"]') ||
           root.querySelector('textarea[name="bio"]');
  }

  return {
    errors: {},
    init(){
      // Initialize bio placeholder state on load
      const root = document.querySelector('.profile-shell') || document;
      const bioEl = getBioEl(root);
      if (bioEl && bioEl.getAttribute('contenteditable') === 'true') {
        const text = (bioEl.textContent || '').trim();
        bioEl.dataset.empty = String(text.length === 0);
      }
    },
    onHandleInput(e){
      const v = (e.target.value || '').toLowerCase().replace(/[^a-z0-9_\\.]/g, '');
      e.target.value = v;
      this.errors.handle = (v.length < 3) ? 'Handle must be at least 3 characters.' : '';
    },
    updateBioPlaceholder(e){
      const el = e?.target;
      if(!el) return;
      const txt = (el.textContent || '').trim();
      el.dataset.empty = String(txt.length === 0);
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
    },
    async saveProfile(e){
      // Collect fields present on the page
      const root = e?.target?.closest('.profile-shell') || document;

      const payload = new FormData();
      const displayName = root.querySelector('input[name="display_name"]')?.value ?? '';
      const handle = root.querySelector('input[name="handle"]')?.value ?? '';

      // Bio: support both contenteditable div and textarea
      const bioEl = getBioEl(root);
      let bio = '';
      if (bioEl) {
        if (bioEl.getAttribute('contenteditable') === 'true') {
          // Preserve line breaks
          bio = (bioEl.textContent || '').replace(/\u00A0/g, ' ').trim();
        } else {
          bio = bioEl.value || '';
        }
      }

      // Optional avatar
      const avatarInput = root.querySelector('input[type="file"][name="profile_image"]');
      const avatarFile = avatarInput?.files?.[0];

      payload.append('display_name', displayName);
      payload.append('handle', handle);
      payload.append('bio', bio);
      if (avatarFile) payload.append('profile_image', avatarFile);

      try{
        const resp = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrftoken },
          body: payload,
          credentials: 'same-origin'
        });
        if(!resp.ok){ throw new Error('Save failed with status ' + resp.status); }

        // If response includes JSON with new handle, broadcast it
        try {
          const data = await resp.json();
          if(data && data.handle){
            const event = new CustomEvent('profile:saved', { detail: { handle: data.handle }});
            window.dispatchEvent(event);
          }
        } catch(_) { /* non-JSON response is fine */ }
      } catch(err){
        console.error(err);
        this.errors.general = 'Could not save. Please try again.';
      }
    },
    async onLinkFieldBlur(e){
      // No-op until an autosave endpoint exists.
      return;
    },
    async createLink(){
      const title = document.getElementById('newTitle')?.value || '';
      const url = document.getElementById('newUrl')?.value || '';
      if(!url){ return; }
      const fd = new FormData();
      fd.append('title', title);
      fd.append('url', url);
      try{
        const resp = await fetch('/links/create/', { method:'POST', headers: { 'X-CSRFToken': csrftoken }, body: fd });
        if(resp.ok){ location.reload(); }
      }catch(_){}
    },
    async deleteLink(e){
      const id = e?.target?.closest('[data-id]')?.dataset?.id;
      if(!id) return;
      if(!confirm('Delete this link?')) return;
      try {
        const resp = await fetch(`/links/${id}/delete/`, { method: 'POST', headers: { 'X-CSRFToken': csrftoken } });
        if(resp.ok){ location.reload(); }
      } catch(_){}
    }
  };
};