// ── Workflow tab switcher ─────────────────────────────────────
// Shows/hides the "Getting Started" step panels based on the
// active tab.  Each tab has a data-tab attribute that maps to
// a #steps-<tab> element.

(function () {
  document.querySelectorAll('.workflow-tab').forEach(function (tab) { //No I18N
    tab.addEventListener('click', function () {
      document.querySelectorAll('.workflow-tab').forEach(function (t) { //No I18N
        t.classList.remove('active'); //No I18N
      });
      document.querySelectorAll('.workflow-steps').forEach(function (s) { //No I18N
        s.classList.remove('active'); //No I18N
      });
      tab.classList.add('active'); //No I18N
      document.getElementById('steps-' + tab.dataset.tab).classList.add('active'); //No I18N
    });
  });
})();
