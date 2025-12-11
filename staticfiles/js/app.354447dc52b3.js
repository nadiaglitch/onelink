/**** Define Alpine component FIRST (must exist before Alpine evaluates x-data) ****/
window.profileLinksEditor = function profileLinksEditor(){

  // ---- helpers for bio syncing ----
  function findEditableBio(root){
    return root.querySelector('[contenteditable="true"][name="bio"]') ||
           root.querySelector('.editable-area.bio[contenteditable="true"]') ||
           root.querySelector('[data-bio-editable]') ||
           root.querySelector('[x-ref="bioEditable"]');
  }
  function ensureBioField(form){
    var fld = form.querySelector('textarea[name="bio"], input[type="hidden"][name="bio"], input[type="text"][name="bio"]');
    if(!fld){
      fld = document.createElement('input');
      fld.type = 'hidden';
      fld.name = 'bio';
      form.appendChild(fld);
    }
    return fld;
  }
  function syncBioToForm(root){
    var form = root.querySelector('form.profile-shell') || document.querySelector('form.profile-shell');
    if(!form) return;
    var editable = findEditableBio(root);
    if(!editable) return;
    var fld = ensureBioField(form);
    fld.value = (editable.textContent || '').trim();
  }
  // ---------------------------------

  // ---- helpers for formset mgmt ----
  function getFormsetInfo(form){
    var totalEl = form.querySelector('input[name$="-TOTAL_FORMS"]');
    if(!totalEl){ return null; }
    var name = totalEl.getAttribute('name');            // e.g. "form-TOTAL_FORMS" or "link_set-TOTAL_FORMS"
    var prefix = name.replace(/-TOTAL_FORMS$/, '');     // e.g. "form" or "link_set"
    return { totalEl: totalEl, prefix: prefix };
  }
  function getContainer(){
    return document.querySelector('[data-formset-container]') || document.getElementById('linksList');
  }
  // ----------------------------------

  return {
    errors: {},

    init: function(){
      var ps = document.querySelector('.profile-shell');
      var root = (ps ? ps.closest('body') : null) || document;

      // initialize contenteditable placeholder
      var bioEl = findEditableBio(root);
      if (bioEl && bioEl.getAttribute && bioEl.getAttribute('contenteditable') === 'true') {
        var text = (bioEl.textContent || '').trim();
        bioEl.dataset.empty = String(text.length === 0);
      }
      // prime hidden field so initial server value is preserved on first submit
      syncBioToForm(root);

      // Delegated blur handler for link inputs (title/url)
      var form = document.querySelector('form.profile-shell');
      if (form) {
        form.addEventListener('focusout', function(e){
          var t = e.target;
          if (!(t && t.tagName === 'INPUT')) return;
          var name = t.getAttribute('name') || '';
          if (!/-(title|url)$/.test(name)) return;
          this.onLinkFieldBlur(e);
        }.bind(this), true); // capture helps when focus changes quickly
      }
    },

    onHandleInput: function(e){
      var v = (e && e.target && e.target.value ? e.target.value : '').toLowerCase().replace(/[^a-z0-9_\\.]/g, '');
      if (e && e.target) e.target.value = v;
      this.errors.handle = (v.length < 5) ? 'Handle must be at least 5 characters.' : '';
    },

    updateBioPlaceholder: function(e){
      var el = e && e.target;
      if(!el || !el.getAttribute) return;
      if (el.getAttribute('contenteditable') === 'true') {
        var txt = (el.textContent || '').trim();
        el.dataset.empty = String(txt.length === 0);
      }
    },

    previewAvatar: function(e){
      var input = e && e.target;
      if(!input || !input.files || !input.files[0]) return;
      var file = input.files[0];
      var img = document.getElementById('avatarPreview');
      try {
        var url = window.URL && URL.createObjectURL ? URL.createObjectURL(file) : null;
        if (img && url) img.src = url;
      } catch(_) {}
      var ps = document.querySelector('.profile-shell');
      var root = (ps ? ps.closest('body') : null) || document;
      syncBioToForm(root);
      var form = input.form || document.querySelector('form.profile-shell');
      if (form && form.requestSubmit) { form.requestSubmit(); }
      else if (form) { form.submit(); }
    },

    saveProfile: function(event){
      var ps = document.querySelector('.profile-shell');
      var root = (ps ? ps.closest('body') : null) || document;
      syncBioToForm(root);
      var form = (event && event.target && event.target.form) || document.querySelector('form.profile-shell');
      if (form && form.requestSubmit) { form.requestSubmit(); }
      else if (form) { form.submit(); } // form has novalidate, so it won't be blocked
    },

    onLinkFieldBlur: function(event){
      var ps = document.querySelector('form.profile-shell');
      var root = (ps ? ps.closest('body') : null) || document;
      syncBioToForm(root);
      var form = (event && event.target && event.target.form) || document.querySelector('form.profile-shell');
      if (form && form.requestSubmit) { form.requestSubmit(); }
      else if (form) { form.submit(); } // with novalidate, autosave always posts
    },

    addLink: function(){
      var form = document.querySelector('form.profile-shell');
      var info = form && getFormsetInfo(form);
      if(!info) return;

      var totalEl = info.totalEl;
      var idx = parseInt(totalEl.value, 10) || 0;

      // Clone template and swap __prefix__
      var tpl = document.getElementById('empty-form-template');
      if(!tpl) return;
      var html = tpl.innerHTML.replace(/__prefix__/g, String(idx));

      // Append to container
      var container = getContainer();
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html.trim();
      var node = wrapper.firstElementChild;
      container.appendChild(node);

      // Bump TOTAL_FORMS
      totalEl.value = String(idx + 1);

      // Focus first input in the new row
      var firstInput = node.querySelector('input[type="text"], input:not([type]), textarea');
      if (firstInput && firstInput.focus) firstInput.focus();
    },

    deleteLink: function(e){
      var target = e && e.target;
      var card = target && target.closest ? target.closest('[data-form-row]') : null;
      if(!card) return;

      var idInput = card.querySelector('input[name$="-id"]');
      var del = card.querySelector('input[type="checkbox"][name$="-DELETE"]');

      // Unsaved newly added row? Just remove it and decrement TOTAL_FORMS.
      var isUnsaved = idInput && !idInput.value;

      if(isUnsaved){
        var form = document.querySelector('form.profile-shell');
        var info = form && getFormsetInfo(form);
        if(info){
          var totalEl = info.totalEl;
          var total = Math.max(0, (parseInt(totalEl.value, 10) || 0) - 1);
          totalEl.value = String(total);
        }
        card.parentNode.removeChild(card);
        return;
      }

      if(!del) return;
      if(!window.confirm('Delete this link?')) return;

      // Mark for deletion and submit WITHOUT HTML5 validation
      del.checked = true;
      var ps = document.querySelector('.profile-shell');
      var root = (ps ? ps.closest('body') : null) || document;
      syncBioToForm(root);
      var f = card.closest ? card.closest('form') : null;
      var form2 = f || document.querySelector('form.profile-shell');
      if (form2) {
        form2.submit();   // bypass validation so delete always posts
      }
    }
  };
};

/**** The rest of your JS can stay inside DOMContentLoaded ****/
document.addEventListener('DOMContentLoaded', function(){

/** From: onelink/templates/404.html */
function gotoHandle() {
  var el = document.getElementById('handleLookup');
  var v = (el && el.value ? el.value : '').trim().toLowerCase().replace(/^@/, '');
  if (!v) return;
  window.location.href = '/@' + encodeURIComponent(v);
}


/** From: onelink/templates/base.html */
(function(){
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', function(){
    var isOpen = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && nav.classList.contains('open')){
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      if (btn.focus) btn.focus();
    }
  });
})();


/** From: onelink/templates/base.html */
window.addEventListener('profile:saved', function(e){
  try {
    var detail = e && e.detail;
    var handle = (detail && detail.handle ? detail.handle : '').trim();
    if (!handle) return;

    var links = document.querySelectorAll('#profile-link, a[data-profile-link]');
    if (!links || !links.length) return;

    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var oldHref = a.getAttribute('href') || a.href || '';
      var newHref = oldHref.replace(/\/@[^\/?#]*/i, '/@' + handle);
      a.setAttribute('href', newHref === oldHref ? ('/@' + handle) : newHref);
    }

    var placeholders = document.querySelectorAll('[data-profile-handle]');
    for (var j = 0; j < placeholders.length; j++) {
      placeholders[j].textContent = handle;
    }
  } catch(err) {
    try { console.warn('profile:saved update skipped:', err); } catch(_) {}
  }
});


/** From: onelink/templates/components/modal.html */
(function(){
  var modal = document.getElementById('generic-modal');
  if(!modal) return;
  var openBtn   = document.querySelector('[data-open-modal]');
  var cancelBtn = modal.querySelector('[data-cancel-modal]');
  var backdrop  = modal.querySelector('.modal-backdrop');

  function openModal(){
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var af = modal.querySelector('[autofocus]');
    if (af && af.focus) af.focus();
  }
  function closeModal(){
    modal.hidden = true;
    document.body.style.overflow = '';
    if (openBtn && openBtn.focus) openBtn.focus();
  }

  if (openBtn)   openBtn.addEventListener('click', openModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (backdrop)  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !modal.hidden) closeModal(); });
})();


/** From: onelink/templates/profiles/link_list.html */
// Progressive enhancement: keyboard + drag reorder with CSRF
(function(){
  var list = document.getElementById('links'); // legacy ID; safe no-op if absent
  if(!list) return;
  var reorderUrl = list.dataset.reorderUrl || '/profiles/links/reorder/';

  var statusEl = document.getElementById('status');
  var match = document.cookie.match(/csrftoken=([^;]+)/);
  var csrftoken = (match && match[1]) ? match[1] : '';

  function announce(t){ if(statusEl){ statusEl.textContent = t; } }

  function saveOrder(){
    if(!reorderUrl || /{\%/.test(reorderUrl)) { return; }
    var rows = list.querySelectorAll('.row');
    var order = [];
    for (var i = 0; i < rows.length; i++) {
      order.push({ id: rows[i].dataset.id, position: i + 1 });
    }
    // Use fetch if available; otherwise skip silently
    if (window.fetch) {
      fetch(reorderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrftoken
        },
        body: JSON.stringify({ order: order })
      }).then(function(res){
        if(!res.ok) throw new Error('Bad status ' + res.status);
        announce('Saved order.');
      }).catch(function(err){
        try { console.error(err); } catch(_) {}
        announce('Could not save order.');
      });
    }
  }

  function getDragAfterElement(container, y) {
    var els = container.querySelectorAll('.row:not(.dragging)');
    var closestOffset = -Infinity;
    var closestEl = null;
    for (var i = 0; i < els.length; i++) {
      var child = els[i];
      var box = child.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closestEl = child;
      }
    }
    return closestEl;
  }

  // Make rows draggable
  (function(){
    var rows = list.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) { rows[i].draggable = true; }
  })();

  list.addEventListener('keydown', function(e){
    var row = e.target && e.target.closest ? e.target.closest('.row') : null;
    if(!row) return;
    if(e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){
      e.preventDefault();
      var dir = e.key === 'ArrowUp' ? -1 : 1;
      var sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      if(sib && sib.classList.contains('row')){
        if (dir < 0) { row.parentNode.insertBefore(row, sib); }
        else { row.parentNode.insertBefore(sib, row); }
        if (row.focus) row.focus();
        announce('Reordered. Saving…');
        saveOrder();
      }
    }
  });

  list.addEventListener('dragstart', function(e){
    if (e.target && e.target.classList) { e.target.classList.add('dragging'); }
  });

  list.addEventListener('dragend', function(e){
    if (e.target && e.target.classList) { e.target.classList.remove('dragging'); }
    announce('Reordered. Saving…');
    saveOrder();
  });

  list.addEventListener('dragover', function(e){
    e.preventDefault();
    var afterElement = getDragAfterElement(list, e.clientY);
    var dragging = list.querySelector('.dragging');
    if (!dragging) return;
    if (afterElement == null) {
      list.appendChild(dragging);
    } else {
      list.insertBefore(dragging, afterElement);
    }
  });
})();


}); // DOMContentLoaded end