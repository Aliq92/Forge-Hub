/* app.js — shell: sidebar, routing, experiment lifecycle, shareable URL state. */
(function (global) {
  const PP = (global.PP = global.PP || {});

  document.addEventListener('DOMContentLoaded', () => {
    const listCore = document.getElementById('experiment-list-core');
    const listExtra = document.getElementById('experiment-list-extra');
    const titleEl = document.getElementById('exp-title');
    const taglineEl = document.getElementById('exp-tagline');
    const stageEl = document.getElementById('lab-stage');
    const panelEl = document.getElementById('lab-panel');
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('sidebar-scrim');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const rngToggle = document.getElementById('rng-quality');
    const aboutOpen = document.getElementById('about-open');
    const aboutModal = document.getElementById('about-modal');

    let current = null; // { exp, controller, navBtn }

    function buildNav() {
      PP.experiments.forEach((exp) => {
        const btn = PP.ui.el('button', {
          type: 'button',
          onclick: () => switchTo(exp.id),
          'aria-label': exp.name,
        }, [
          PP.ui.el('span', { class: 'dot' }),
          PP.ui.el('span', { text: exp.name }),
        ]);
        const li = PP.ui.el('li', {}, [btn]);
        (exp.group === 'extra' ? listExtra : listCore).appendChild(li);
        exp._navBtn = btn;
      });
    }

    function getParamsFromURL() {
      const sp = new URLSearchParams(location.search);
      const obj = {};
      sp.forEach((v, k) => (obj[k] = v));
      return obj;
    }

    function switchTo(id, incomingParams) {
      const exp = PP.experiments.find((e) => e.id === id);
      if (!exp) return;

      if (current) {
        try { current.controller && current.controller.destroy && current.controller.destroy(); } catch (e) { /* noop */ }
        current.exp._navBtn.classList.remove('active');
      }

      PP.ui.clear(stageEl);
      PP.ui.clear(panelEl);
      titleEl.textContent = exp.name;
      taglineEl.textContent = exp.tagline || '';
      exp._navBtn.classList.add('active');

      const params = incomingParams || {};
      const controller = exp.init(stageEl, panelEl, params) || {};
      current = { exp, controller };

      updateURL(id, controller.getShareParams ? controller.getShareParams() : {});
      closeSidebarMobile();
      stageEl.scrollTop = 0;
    }

    const updateURL = PP.ui.debounce((id, params) => {
      const sp = new URLSearchParams();
      sp.set('lab', id);
      Object.keys(params || {}).forEach((k) => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') sp.set(k, params[k]);
      });
      history.replaceState(null, '', `${location.pathname}?${sp.toString()}`);
    }, 150);

    PP.app = {
      updateShareParams(params) {
        if (current) updateURL(current.exp.id, params);
      },
    };

    buildNav();

    const initial = getParamsFromURL();
    const startId = initial.lab && PP.experiments.some((e) => e.id === initial.lab) ? initial.lab : PP.experiments[0].id;
    switchTo(startId, initial);

    /* ---------------- Mobile sidebar ---------------- */
    function openSidebarMobile() {
      sidebar.classList.add('open');
      scrim.classList.add('open');
      sidebarToggle.setAttribute('aria-expanded', 'true');
    }
    function closeSidebarMobile() {
      sidebar.classList.remove('open');
      scrim.classList.remove('open');
      sidebarToggle.setAttribute('aria-expanded', 'false');
    }
    sidebarToggle.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeSidebarMobile();
      else openSidebarMobile();
    });
    scrim.addEventListener('click', closeSidebarMobile);

    /* ---------------- RNG toggle ---------------- */
    rngToggle.addEventListener('change', (e) => PP.random.setHighQuality(e.target.checked));

    /* ---------------- About modal ---------------- */
    function openAbout() {
      aboutModal.classList.remove('hidden');
    }
    function closeAbout() {
      aboutModal.classList.add('hidden');
    }
    aboutOpen.addEventListener('click', openAbout);
    aboutModal.querySelectorAll('[data-close]').forEach((n) => n.addEventListener('click', closeAbout));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAbout();
        closeSidebarMobile();
      }
    });

    /* Resize-driven canvas redraw for the active experiment */
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (current && current.controller && current.controller.onResize) current.controller.onResize();
      }, 120);
    });
  });
})(window);
