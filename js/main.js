/* Mariachi Vergara de Oriente — interactividad (sin dependencias) */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Navegación ---------- */
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");

  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };

  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  nav.querySelectorAll(".nav__menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  const onScrollNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* ---------- Revelado al hacer scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  // escalonar elementos hermanos dentro de la misma lista
  reveals.forEach((el) => {
    const siblings = el.parentElement ? [...el.parentElement.children] : [];
    const i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty("--delay", `${Math.min(i, 6) * 90}ms`);
  });

  if ("IntersectionObserver" in window && !reduceMotion) {
    const show = (el) => {
      if (el.classList.contains("is-visible")) return;
      el.classList.add("is-visible");
      io.unobserve(el);
      // tras la entrada, quitar el retraso para que el tilt responda al instante
      setTimeout(() => el.style.removeProperty("--delay"), 1200);
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && show(entry.target)),
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));

    // Respaldo: un scroll muy rápido (o un salto con un enlace del menú) puede pasar un bloque
    // sin que el observer lo detecte; se revela todo lo que ya quedó por encima de la pantalla.
    let pending = false;
    window.addEventListener(
      "scroll",
      () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
            if (el.getBoundingClientRect().top < window.innerHeight) show(el);
          });
          pending = false;
        });
      },
      { passive: true }
    );
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Tarjetas 3D (tilt) ---------- */
  const MAX_TILT = 12; // grados
  const cards = document.querySelectorAll(".tilt");

  const applyTilt = (card, px, py, glare) => {
    // px, py en rango [-1, 1]
    card.style.setProperty("--ry", `${(px * MAX_TILT).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${(-py * MAX_TILT).toFixed(2)}deg`);
    card.style.setProperty("--gx", `${((px + 1) * 50).toFixed(1)}%`);
    card.style.setProperty("--gy", `${((py + 1) * 50).toFixed(1)}%`);
    card.style.setProperty("--glare", glare);
  };

  const resetTilt = (card) => {
    card.classList.remove("is-tilting");
    applyTilt(card, 0, 0, 0);
  };

  if (!reduceMotion) {
    cards.forEach((card) => {
      let frame = 0;

      const track = (e) => {
        const r = card.getBoundingClientRect();
        const px = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
        const py = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.classList.add("is-tilting");
          applyTilt(card, px, py, 1);
        });
      };

      // Cursor (escritorio) y dedo (móvil): el dedo inclina la tarjeta mientras la toca,
      // y el scroll vertical sigue funcionando gracias a touch-action: pan-y.
      card.style.touchAction = "pan-y";
      card.addEventListener("pointermove", track);
      card.addEventListener("pointerdown", track);
      card.addEventListener("pointerleave", () => resetTilt(card));
      card.addEventListener("pointerup", (e) => e.pointerType !== "mouse" && resetTilt(card));
      card.addEventListener("pointercancel", () => resetTilt(card));
    });

    // En pantallas táctiles: inclinación suave según la posición de la tarjeta al hacer scroll
    if (!finePointer && cards.length) {
      let ticking = false;
      const scrollTilt = () => {
        const vh = window.innerHeight;
        cards.forEach((card) => {
          if (card.classList.contains("is-tilting")) return;
          const r = card.getBoundingClientRect();
          if (r.bottom < 0 || r.top > vh) return;
          // -1 (arriba) … 1 (abajo) respecto al centro de la pantalla
          const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
          card.style.setProperty("--rx", `${(p * 7).toFixed(2)}deg`);
          card.style.setProperty("--ry", "0deg");
          card.style.setProperty("--gy", `${((1 - p) * 50).toFixed(1)}%`);
          card.style.setProperty("--glare", (0.6 * (1 - Math.abs(p))).toFixed(2));
        });
        ticking = false;
      };
      window.addEventListener(
        "scroll",
        () => {
          if (!ticking) {
            ticking = true;
            requestAnimationFrame(scrollTilt);
          }
        },
        { passive: true }
      );
      scrollTilt();
    }
  }

  /* ---------- Redes: feedback al tocar en móvil ---------- */
  document.querySelectorAll(".social__card").forEach((card) => {
    card.addEventListener("touchstart", () => card.classList.add("is-pressed"), { passive: true });
    ["touchend", "touchcancel"].forEach((t) =>
      card.addEventListener(t, () => setTimeout(() => card.classList.remove("is-pressed"), 350), { passive: true })
    );
  });

  /* ---------- Lightbox de la galería ---------- */
  const dialog = document.querySelector(".lightbox");
  const items = [...document.querySelectorAll(".gallery__item")];

  if (dialog && typeof dialog.showModal === "function" && items.length) {
    const big = dialog.querySelector(".lightbox__img");
    let current = 0;

    const show = (i) => {
      current = (i + items.length) % items.length;
      const thumb = items[current].querySelector("img");
      big.src = items[current].dataset.full;
      big.alt = thumb.alt;
    };

    items.forEach((btn, i) =>
      btn.addEventListener("click", () => {
        show(i);
        dialog.showModal();
      })
    );

    dialog.querySelector(".lightbox__close").addEventListener("click", () => dialog.close());
    dialog.querySelector(".lightbox__prev").addEventListener("click", () => show(current - 1));
    dialog.querySelector(".lightbox__next").addEventListener("click", () => show(current + 1));
    dialog.addEventListener("click", (e) => e.target === dialog && dialog.close());
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });

    // deslizar con el dedo para cambiar de foto
    let startX = 0;
    dialog.addEventListener("touchstart", (e) => (startX = e.touches[0].clientX), { passive: true });
    dialog.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      },
      { passive: true }
    );
  } else {
    // navegadores sin <dialog>: abrir la imagen directamente
    items.forEach((btn) => btn.addEventListener("click", () => window.open(btn.dataset.full, "_blank")));
  }

  /* ---------- Videos: solo uno reproduciéndose a la vez ---------- */
  const videos = document.querySelectorAll(".video video");
  videos.forEach((v) =>
    v.addEventListener("play", () => videos.forEach((o) => o !== v && !o.paused && o.pause()))
  );

  /* ---------- Año actual en el pie ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
