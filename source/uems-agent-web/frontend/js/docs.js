// ── Client-side router for /docs/* ───────────────────────────
// Intercepts /docs/* URL paths, hides the landing page, and
// renders either a markdown file or directory listing inside the
// docs viewer container — without a full page reload.

(function () {
  const path = window.location.pathname;
  if (!path.startsWith('/docs/')) { return; }

  document.querySelector('.home-container').classList.add('hidden');
  document.getElementById('docs-container').classList.remove('hidden');

  const docPath = path.replace('/docs/', '').replace(/\/$/, '') || 'README.md';

  buildBreadcrumb(docPath);
  fetchAndRender(docPath);

  // ── Breadcrumb ───────────────────────────────────────────────

  function buildBreadcrumb(docPath) {
    const breadcrumb = document.getElementById('docs-breadcrumb');
    const segments = docPath.split('/');
    let crumbs = '<a href="/">Home</a>';
    let accumulated = '';

    segments.forEach(function (seg, i) {
      accumulated += (accumulated ? '/' : '') + seg;
      crumbs += ' <span class="crumb-sep">/</span> ';
      if (i < segments.length - 1) {
        crumbs += '<a href="/docs/' + accumulated + '">' + seg + '</a>';
      } else {
        crumbs += '<span>' + seg + '</span>';
      }
    });

    breadcrumb.innerHTML = crumbs;
  }

  // ── Link rewriting ───────────────────────────────────────────
  // Resolve relative markdown links against the actual file path
  // returned by the API (not the URL path, which may be a
  // directory that served a README.md).

  function rewriteDocLinks(container, actualFilePath) {
    const parts = actualFilePath.split('/');
    parts.pop();
    const baseDir = parts.join('/');

    container.querySelectorAll('a[href]').forEach(function (a) {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('/')) { return; }
      const fakePath = baseDir ? baseDir + '/_' : '_';
      const base = 'http' + '://x/' + fakePath; //No I18N
      const resolved = new URL(href, base).pathname.slice(1);
      // Non-markdown files (e.g. .vsix) → served as downloads
      const ext = resolved.split('.').pop().toLowerCase();
      const isMarkdown = ext === 'md' || !resolved.includes('.');
      a.href = (isMarkdown ? '/docs/' : '/api/download/') + resolved;
    });
  }

  // ── Fetch and render ─────────────────────────────────────────

  function renderFile(content, data) {
    const html = DOMPurify.sanitize(marked.parse(content));
    content = '<article class="markdown-body">' + html + '</article>';
    const contentEl = document.getElementById('docs-content');
    contentEl.innerHTML = content;
    contentEl.querySelectorAll('pre code').forEach(function (el) {
      hljs.highlightElement(el);
    });
    rewriteDocLinks(contentEl, data.path || docPath);
  }

  function renderDirectory(data) {
    const segments = docPath.split('/');
    const title = segments[segments.length - 1] || 'Docs';
    let html = '<h1>' + title.charAt(0).toUpperCase() + title.slice(1) + '</h1>';
    html += '<div class="docs-list">';
    data.items.forEach(function (item) {
      const icon = item.type === 'directory' ? 'folder' : 'description';
      const href = '/docs/' + (docPath ? docPath + '/' : '') + item.name;
      html += '<a href="' + href + '" class="docs-list-item">';
      html += '<span class="material-symbols-rounded">' + icon + '</span>';
      html += '<span>' + item.name + '</span>';
      html += '</a>';
    });
    html += '</div>';
    document.getElementById('docs-content').innerHTML = html;
  }

  function fetchAndRender(docPath) {
    fetch('/api/docs/' + docPath)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.content) {
          renderFile(data.content, data);
        } else if (data.items) {
          renderDirectory(data);
        } else if (data.error) {
          document.getElementById('docs-content').innerHTML =
            '<p class="docs-error">Not found: ' + data.error + '</p>';
        }
      })
      .catch(function () {
        document.getElementById('docs-content').innerHTML =
          '<p class="docs-error">Failed to load documentation.</p>';
      });
  }
})();
