/* Static project page. Curves are original PDF vectors, not generated values. */
(() => {
  "use strict";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const config = window.SITE_CONFIG || {};
  const resourceLinks = [
    ["paper-link", config.arxivPdfUrl, (url) => url.hostname === "arxiv.org" && url.pathname.startsWith("/pdf/")],
    ["code-link", config.githubUrl, (url) => url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length >= 2]
  ];
  resourceLinks.forEach(([id, value, valid]) => {
    if (!value) return;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !valid(url)) return;
      const link = document.getElementById(id);
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.removeAttribute("aria-disabled");
      link.removeAttribute("aria-describedby");
      link.classList.remove("pending");
      link.querySelector(".link-status")?.remove();
    } catch { /* Missing or invalid release URLs retain their pending state. */ }
  });

  /* Matched states, error states, and trajectory depth: manual figure carousel. */
  const carousel = document.querySelector(".scatter-carousel");
  if (carousel) {
    const slides = [...carousel.querySelectorAll(".scatter-slide")];
    const cards = [...document.querySelectorAll("[data-scatter-card]")];
    const selectors = [...carousel.querySelectorAll("[data-scatter]")];
    let slideIndex = 0;
    const showSlide = (index) => {
      slideIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== slideIndex; });
      selectors.forEach((button, i) => button.setAttribute("aria-pressed", String(i === slideIndex)));
      cards.forEach((card, i) => {
        card.classList.toggle("selected", i === slideIndex);
        card.setAttribute("aria-pressed", String(i === slideIndex));
      });
      document.getElementById("scatter-title").textContent = slides[slideIndex].dataset.slideTitle;
      document.getElementById("scatter-counter").textContent = `${slideIndex + 1} / ${slides.length}`;
    };
    carousel.querySelector(".scatter-controls").hidden = false;
    document.getElementById("scatter-prev").addEventListener("click", () => showSlide(slideIndex - 1));
    document.getElementById("scatter-next").addEventListener("click", () => showSlide(slideIndex + 1));
    selectors.forEach((button) => button.addEventListener("click", () => showSlide(Number(button.dataset.scatter))));
    cards.forEach((card, i) => {
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-controls", "scatter-slide-" + i);
      card.addEventListener("click", () => showSlide(i));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); showSlide(i);
        }
      });
    });
    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        showSlide(slideIndex + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    let touchStart = null;
    carousel.addEventListener("touchstart", (event) => {
      if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      else touchStart = null;
    }, { passive: true });
    carousel.addEventListener("touchend", (event) => {
      if (!touchStart || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showSlide(slideIndex + (dx < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
    showSlide(0);
  }

  const navLinks = [...document.querySelectorAll(".nav-links a")];
  if ("IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          const active = link.hash === "#" + entry.target.id;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-15% 0px -65% 0px", threshold: 0 });
    navLinks.forEach((link) => navObserver.observe(document.querySelector(link.hash)));
    const budget = document.querySelector(".budget-method");
    const budgetObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        budget.classList.add("in-view");
        budgetObserver.disconnect();
      }
    }, { threshold: 0.3 });
    budgetObserver.observe(budget);
  }

  if (!window.PAPER_FIGURES) return; // Original full-grid images remain available.
  const taskNames = ["BFCL v3", "DeepCoder-MT", "InterCode-SQL", "FrozenLake"];
  const modelNames = ["Qwen3-4B", "Qwen3-8B"];
  const chartSvgs = {};
  for (const mode of ["k", "t"]) {
    const host = document.getElementById("chart-" + mode);
    host.innerHTML = window.PAPER_FIGURES[mode];
    chartSvgs[mode] = host.querySelector("svg");
  }
  document.querySelectorAll(".interactive-only").forEach((el) => el.hidden = false);

  // Viewports crop the supplied four-column/two-row PDF artwork, preserving
  // each plot's ticks and original scale. They are not numerical data domains.
  const cropX = [23, 277, 531, 785];
  const cropY = [8, 223];
  const slider = document.getElementById("curve-progress");
  const progressLabel = document.getElementById("progress-value");
  const pauseButton = document.getElementById("pause");
  let task = 1, model = 0, progress = 1, frame = 0, playing = false, paused = false;
  const duration = 2600;

  const draw = (value) => {
    progress = Math.max(0, Math.min(1, value));
    for (const mode of ["k", "t"]) {
      const svg = chartSvgs[mode];
      const mask = svg.querySelector(".sweep-mask");
      const left = cropX[task];
      // Reveal the paper's curves, markers and shading along the horizontal axis.
      mask.setAttribute("x", left);
      mask.setAttribute("width", 254 * progress);
    }
    slider.value = String(Math.round(progress * 100));
    progressLabel.value = slider.value + "%";
    slider.setAttribute("aria-valuetext", slider.value + "% of the curves revealed");
  };
  const stop = () => {
    cancelAnimationFrame(frame);
    playing = false;
  };
  const finish = () => {
    stop();
    paused = false;
    draw(1);
    pauseButton.textContent = "Pause";
    pauseButton.disabled = true;
  };
  const play = (from = 0, explicit = false) => {
    stop();
    if (reducedMotion.matches && !explicit) { finish(); return; }
    paused = false;
    playing = true;
    pauseButton.disabled = false;
    pauseButton.textContent = "Pause";
    const start = performance.now() - from * duration;
    const tick = (now) => {
      draw((now - start) / duration);
      if (progress >= 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    stop();
    paused = true;
    pauseButton.disabled = false;
    pauseButton.textContent = "Resume";
  };
  const select = (animate = true) => {
    for (const mode of ["k", "t"]) {
      chartSvgs[mode].setAttribute("viewBox", `${cropX[task]} ${cropY[model]} 254 213`);
      chartSvgs[mode].setAttribute("aria-labelledby", `chart-context chart-${mode}-title chart-${mode}-description`);
    }
    document.querySelectorAll("[data-task]").forEach((button) => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.task) === task));
    });
    document.getElementById("chart-context").textContent = `${taskNames[task]} · ${modelNames[model]} · GRPO`;
    if (animate) play(); else finish();
  };
  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => { task = Number(button.dataset.task); select(); });
  });
  document.getElementById("model-select").addEventListener("change", (event) => {
    model = Number(event.target.value); select();
  });
  document.getElementById("replay").addEventListener("click", () => play(0, true));
  pauseButton.addEventListener("click", () => {
    if (playing) pause(); else if (paused) play(progress, true);
  });
  slider.addEventListener("input", () => {
    stop();
    draw(Number(slider.value) / 100);
    paused = progress < 1;
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.disabled = !paused;
  });
  // Avoid background playback and unexpected motion when preferences change.
  document.addEventListener("visibilitychange", () => { if (document.hidden && playing) pause(); });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) finish(); });
  select(false);
  if ("IntersectionObserver" in window) {
    let firstView = true;
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && firstView) {
          firstView = false;
          play();
        } else if (!entry.isIntersecting && playing) pause();
      });
    }, { threshold: 0.12 });
    chartObserver.observe(document.querySelector(".chart-grid"));
  }
})();
