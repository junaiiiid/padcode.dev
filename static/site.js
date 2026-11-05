// padcode.dev: the theme switch, the sidebar drawer, search, "On this page" and the picture viewer.
(function () {
  "use strict";
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // MARK: Theme: the system's until someone picks; remembered when storage works.
  const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = () => root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : systemDark();
  function labelThemeButton() {
    $$("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode"));
  }
  $$("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      labelThemeButton();
    })
  );
  labelThemeButton();

  // MARK: The top bar's sections: the one whose sidebar group this page is in.
  const group = document.body.dataset.group;
  $$(".topnav a").forEach((a) => {
    if (group && a.dataset.group === group) a.setAttribute("aria-current", "true");
  });

  // MARK: Sidebar: a drawer on narrow screens; the current page scrolled into view.
  const sidebar = $("#sidebar");
  const menuButton = $("[data-open-sidebar]");
  function setNav(open) {
    document.body.classList.toggle("nav-open", open);
    if (menuButton) {
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.setAttribute("aria-label", open ? "Close the navigation" : "Open the navigation");
    }
    if (open && sidebar) (sidebar.querySelector("[aria-current=page]") || sidebar.querySelector("a")).focus({ preventScroll: true });
  }
  if (menuButton) menuButton.addEventListener("click", () => setNav(!document.body.classList.contains("nav-open")));
  $$("[data-close-sidebar]").forEach((el) => el.addEventListener("click", () => setNav(false)));
  if (sidebar) {
    const current = sidebar.querySelector("[aria-current=page]");
    if (current) {
      const top = current.offsetTop - sidebar.clientHeight / 3;
      sidebar.scrollTop = Math.max(0, top);
    }
  }

  // MARK: On this page: the section being read.
  const tocLinks = $$(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const headings = Array.from(byId.keys()).map((id) => document.getElementById(id)).filter(Boolean);
    let activeId = null;
    const setActive = (id) => {
      if (id === activeId) return;
      activeId = id;
      tocLinks.forEach((a) => a.classList.toggle("active", decodeURIComponent(a.hash.slice(1)) === id));
    };
    const visible = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
      const first = headings.find((h) => visible.has(h.id));
      if (first) setActive(first.id);
      else {
        // Between headings: the last one above the fold.
        const above = headings.filter((h) => h.getBoundingClientRect().top < 120);
        if (above.length) setActive(above[above.length - 1].id);
      }
    }, { rootMargin: "-72px 0px -60% 0px" });
    headings.forEach((h) => observer.observe(h));
  }

  // MARK: Pictures: open full size.
  const lightbox = $("#lightbox");
  if (lightbox && lightbox.showModal) {
    const img = lightbox.querySelector("img");
    $$("figure .zoom").forEach((button) =>
      button.addEventListener("click", () => {
        const source = button.querySelector("img");
        img.src = source.currentSrc || source.src;
        img.alt = source.alt;
        lightbox.showModal();
      })
    );
    lightbox.addEventListener("click", (e) => { if (e.target === lightbox || e.target.closest("[data-close-lightbox]")) lightbox.close(); });
  }

  // MARK: Search: the index loads the first time it opens; results as you type.
  const dialog = $("#search");
  const input = $("#search-input");
  const list = $("#search-results");
  let index = null;
  let selected = -1;
  const POPULAR = ["/get-started/your-first-app/", "/build/ai-agent/", "/components/", "/data/formula-language/", "/build/widgets/", "/test-and-ship/preview/"];

  function openSearch() {
    if (!dialog || !dialog.showModal) return;
    if (!dialog.open) dialog.showModal();
    input.value = "";
    show("");
    input.focus();
    if (!index) {
      fetch("/static/search.json")
        .then((r) => r.json())
        .then((data) => { index = data; show(input.value); })
        .catch(() => { list.innerHTML = '<li class="search-empty">Search couldn\'t load. Check your connection and try again.</li>'; });
    }
  }
  function closeSearch() { if (dialog && dialog.open) dialog.close(); }
  $$("[data-open-search]").forEach((b) => b.addEventListener("click", openSearch));
  $$("[data-close-search]").forEach((b) => b.addEventListener("click", closeSearch));
  if (dialog) dialog.addEventListener("click", (e) => { if (e.target === dialog) closeSearch(); });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      openSearch();
    } else if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
      setNav(false);
      if (menuButton) menuButton.focus();
    }
  });

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function highlight(text, words) {
    let out = escapeHtml(text);
    words.forEach((w) => {
      if (w.length < 2) return;
      const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function snippet(text, words) {
    const lower = text.toLowerCase();
    const at = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (at === undefined) return text.slice(0, 160);
    const start = Math.max(0, at - 50);
    return (start ? "…" : "") + text.slice(start, start + 170);
  }
  function score(entry, words, phrase) {
    const title = entry.t.toLowerCase();
    let total = 0;
    for (const w of words) {
      let s = 0;
      if (title === w) s += 120;
      else if (title.startsWith(w)) s += 60;
      else if (title.includes(w)) s += 40;
      if (entry.h.some((h) => h.toLowerCase().includes(w))) s += 14;
      if (entry.d.toLowerCase().includes(w)) s += 10;
      if (entry.x.toLowerCase().includes(w)) s += 4;
      if (!s) return 0; // every word has to be there
      total += s;
    }
    if (title.includes(phrase)) total += 50;
    return total;
  }
  function show(query) {
    selected = -1;
    const phrase = query.trim().toLowerCase();
    if (!index) {
      list.innerHTML = phrase ? '<li class="search-empty">Loading…</li>' : "";
      return;
    }
    let results;
    if (!phrase) {
      results = POPULAR.map((u) => index.find((e) => e.u === u)).filter(Boolean);
    } else {
      const words = phrase.split(/\s+/).filter(Boolean);
      results = index
        .map((e) => ({ e, s: score(e, words, phrase) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 12)
        .map((r) => r.e);
    }
    if (!results.length) {
      list.innerHTML = `<li class="search-empty">Nothing matches “${escapeHtml(query.trim())}”. Try fewer words, or start from <a href="/components/">Components</a>, <a href="/actions/">Actions</a> or the <a href="/reference/glossary/">Glossary</a>.</li>`;
      return;
    }
    const words = phrase.split(/\s+/).filter(Boolean);
    list.innerHTML = results
      .map((e, i) => `<li><a id="result-${i}" role="option" href="${e.u}" aria-selected="false"><span class="result-group">${escapeHtml(e.g)}</span><span class="result-title">${highlight(e.t, words)}</span><span class="result-text">${highlight(snippet(e.d || e.x, words), words)}</span></a></li>`)
      .join("");
  }
  function move(by) {
    const items = $$("a[role=option]", list);
    if (!items.length) return;
    selected = (selected + by + items.length) % items.length;
    items.forEach((a, i) => a.setAttribute("aria-selected", String(i === selected)));
    items[selected].scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", items[selected].id);
  }
  if (input) {
    input.addEventListener("input", () => show(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        const items = $$("a[role=option]", list);
        const target = items[selected >= 0 ? selected : 0];
        if (target) { e.preventDefault(); location.href = target.href; }
      }
    });
  }
})();
