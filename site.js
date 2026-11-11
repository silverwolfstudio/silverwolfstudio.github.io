// Lista de așteptare: trimite e-mailul la Supabase prin funcția `join_waitlist` (vezi supabase/waitlist.sql).
// Cheia din pagină e cea publică; tabelul nu poate fi citit de nimeni din afară.
(function () {
  const form = document.getElementById('waitlist-form');
  if (!form) return;
  const messages = JSON.parse(document.getElementById('waitlist-messages').textContent);
  const email = form.elements.email;
  const consent = form.elements.consent;
  const trap = form.elements.company;
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.form-status');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const show = (text, kind) => {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  };

  email.addEventListener('input', () => email.removeAttribute('aria-invalid'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = email.value.trim();
    if (!EMAIL.test(value) || value.length > 254) {
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      show(messages.invalidEmail, 'error');
      return;
    }
    if (!consent.checked) {
      show(messages.needConsent, 'error');
      consent.focus();
      return;
    }
    // Câmpul ascuns e completat doar de roboți: le răspundem „gata” fără să trimitem nimic.
    if (trap.value) {
      show(messages.success, 'ok');
      form.reset();
      return;
    }

    button.disabled = true;
    button.textContent = messages.sending;
    show('', '');
    try {
      const response = await fetch(form.dataset.url + '/rest/v1/rpc/join_waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: form.dataset.key,
        },
        body: JSON.stringify({ email: value, lang: form.dataset.lang }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(String(error.message || response.status));
      }
      form.reset();
      show(messages.success, 'ok');
    } catch (error) {
      show(/too many/i.test(error.message) ? messages.tooMany : messages.failed, 'error');
    } finally {
      button.disabled = false;
      button.textContent = messages.submit;
    }
  });
})();
