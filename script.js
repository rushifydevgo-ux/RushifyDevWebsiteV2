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

// Welcome offer popup — email capture that emails a setup-fee-waiver code.
// FormSubmit forwards the lead to us and auto-replies to the visitor with the code.
(() => {
  const KEY = 'rushifyOfferSeen';
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set() { try { localStorage.setItem(KEY, '1'); } catch (e) {} },
  };
  if (store.get()) return;

  const CODE = 'RUSHFREE';
  const modal = document.createElement('div');
  modal.className = 'offer-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'offerTitle');
  modal.hidden = true;
  modal.innerHTML = `
    <div class="offer-backdrop" data-close></div>
    <div class="offer-card">
      <button type="button" class="offer-close" aria-label="Close offer" data-close>×</button>
      <div class="offer-form-view">
        <p class="section-label">Limited-time offer</p>
        <h2 id="offerTitle" class="offer-title">Skip the setup fee.</h2>
        <p class="offer-text">Enter your email and we'll send you a code that <strong>waives the setup fee</strong> on any Rushify service.</p>
        <form class="offer-form" action="https://formsubmit.co/ajax/rushifydev.go@gmail.com" method="POST" novalidate>
          <input type="hidden" name="_subject" value="🎁 New setup-fee-waiver signup — Rushify">
          <input type="hidden" name="_template" value="table">
          <input type="hidden" name="_captcha" value="false">
          <input type="hidden" name="_autoresponse" value="Thanks for stopping by Rushify! Your promo code is ${CODE} — enter it in the Promo code field of any quote form to waive the setup fee on your project. Questions? Just reply to this email.">
          <input type="hidden" name="Offer" value="Setup fee waiver">
          <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
          <label class="offer-sr" for="offerEmail">Email</label>
          <input type="email" id="offerEmail" name="Email" placeholder="you@company.com" required>
          <button type="submit" class="btn-primary offer-submit">Send my code →</button>
          <p class="offer-status" role="status" aria-live="polite"></p>
        </form>
        <p class="offer-fine">No spam. One email with your code.</p>
      </div>
      <div class="offer-done-view" hidden>
        <p class="section-label">You're in</p>
        <h2 class="offer-title">Check your inbox.</h2>
        <p class="offer-text">Your code is on its way. Here it is now:</p>
        <div class="offer-code">${CODE}</div>
        <p class="offer-fine">Enter it in the Promo code field on any quote form.</p>
        <button type="button" class="btn-primary offer-submit" data-close>Continue →</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const form = modal.querySelector('.offer-form');
  const status = modal.querySelector('.offer-status');
  const formView = modal.querySelector('.offer-form-view');
  const doneView = modal.querySelector('.offer-done-view');
  let lastFocus = null;

  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('offer-open');
    store.set();
    if (lastFocus) lastFocus.focus();
  };
  const open = () => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('offer-open');
    modal.querySelector('#offerEmail').focus();
  };

  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form._honey.value) return;
    const email = form.Email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = 'Please enter a valid email address.';
      return;
    }
    const btn = form.querySelector('.offer-submit');
    btn.disabled = true;
    status.textContent = '';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      if (!res.ok) throw new Error('Request failed');
      store.set();
      formView.hidden = true;
      doneView.hidden = false;
    } catch (err) {
      status.textContent = 'Something went wrong — please email rushifydev.go@gmail.com.';
      btn.disabled = false;
    }
  });

  // Wait for the homepage intro curtain to finish before interrupting.
  setTimeout(open, document.getElementById('introOverlay') ? 5000 : 2000);
})();
