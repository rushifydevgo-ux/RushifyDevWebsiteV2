const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Intro curtain — locks scroll until it slides open; the RUSH word holds its
// position independently and fades out on its own schedule shortly after.
const introOverlay = document.getElementById('introOverlay');
const introWord = document.getElementById('introWord');
if (introOverlay || introWord) {
  if (prefersReducedMotion) {
    if (introOverlay) introOverlay.remove();
    if (introWord) introWord.remove();
  } else {
    document.body.classList.add('intro-locked');
    if (introOverlay) {
      introOverlay.addEventListener('animationend', (e) => {
        if (e.animationName === 'introSlideOut') {
          introOverlay.remove();
          document.body.classList.remove('intro-locked');
        }
      });
    }
    if (introWord) {
      introWord.addEventListener('animationend', (e) => {
        if (e.animationName === 'introWordFade') introWord.remove();
      });
    }
  }
}

// Hero scroll parallax — content drifts up and fades as the hero scrolls out of view
// (glow orbs keep their own CSS float animation, so they're left alone here —
// a competing inline transform would just get overridden by the running keyframe)
const heroEl = document.querySelector('.hero');
const heroContent = document.querySelector('.hero-content');

if (heroEl && heroContent && !prefersReducedMotion) {
  let ticking = false;

  const updateHeroParallax = () => {
    const progress = Math.min(Math.max(window.scrollY / heroEl.offsetHeight, 0), 1);
    const fade = Math.min(progress * 1.6, 1);

    heroContent.style.transform = `translateY(${progress * -70}px) scale(${1 - progress * 0.06})`;
    heroContent.style.opacity = String(1 - fade);

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeroParallax);
      ticking = true;
    }
  }, { passive: true });

  updateHeroParallax();
}

// Magnetic hover on hero CTAs — buttons drift slightly toward the cursor
if (!prefersReducedMotion) {
  document.querySelectorAll('.hero-actions a').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

// Reveal-on-scroll
const reveals = document.querySelectorAll('.reveal, .reveal-right');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });
reveals.forEach((el) => revealObserver.observe(el));

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navBackdrop = document.getElementById('navBackdrop');
const navMenu = document.getElementById('navMenu');

function closeNav() {
  document.body.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

function toggleNav() {
  const isOpen = document.body.classList.toggle('nav-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
}

navToggle.addEventListener('click', toggleNav);
navBackdrop.addEventListener('click', closeNav);
navMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNav();
});

// Interactive option pills (budget/timeline/add-ons on quote forms) —
// single-select groups act like radios, multi-select like checkboxes,
// each syncing selections into a hidden input so FormSubmit gets plain text.
document.querySelectorAll('.option-group').forEach((group) => {
  const isMulti = group.dataset.type === 'multi';
  const targetInput = document.getElementById(group.dataset.target);
  const pills = Array.from(group.querySelectorAll('.option-pill'));

  const syncValue = () => {
    if (!targetInput) return;
    targetInput.value = pills
      .filter((p) => p.classList.contains('selected'))
      .map((p) => p.textContent.trim())
      .join(', ');
  };

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      if (isMulti) {
        pill.classList.toggle('selected');
      } else {
        pills.forEach((p) => p.classList.remove('selected'));
        pill.classList.add('selected');
      }
      syncValue();
    });
  });
});

// Contact / quote forms — FormSubmit AJAX submission (no page reload).
// Each page may have its own form; status/success elements are found
// relative to the form rather than by a shared global ID.
document.querySelectorAll('form.contact-form').forEach((form) => {
  const wrapper = form.closest('.contact-inner') || form.parentElement;
  const formStatus = wrapper.querySelector('.form-status');
  const formSuccess = wrapper.querySelector('.form-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot: real users never fill this in, bots often do.
    if (form._honey.value) return;

    const submitBtn = form.querySelector('.form-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const originalLabel = btnText.textContent;

    submitBtn.disabled = true;
    btnText.textContent = 'Sending…';
    if (formStatus) {
      formStatus.textContent = '';
      formStatus.className = 'form-status';
    }

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Request failed');

      form.reset();
      form.querySelectorAll('.option-pill.selected').forEach((p) => p.classList.remove('selected'));
      form.hidden = true;
      if (formSuccess) {
        formSuccess.hidden = false;
        formSuccess.classList.add('visible');
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      if (formStatus) {
        formStatus.textContent = "Something went wrong — please email us directly at rushifydev.go@gmail.com.";
        formStatus.className = 'form-status error';
      }
      submitBtn.disabled = false;
      btnText.textContent = originalLabel;
    }
  });
});
