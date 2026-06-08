/**
 * Lightweight field validation (Day 31).
 * @typedef {{ rule: 'required' | 'minLength' | 'maxLength' | 'email' | 'oneOf'; min?: number; max?: number; values?: string[] }} FieldRule
 */

/**
 * @param {unknown} value
 * @param {FieldRule[]} rules
 * @returns {string | null} error message or null if valid
 */
export function validateWithRules(value, rules) {
  const s = value == null ? '' : String(value);
  const trim = s.trim();

  for (const r of rules) {
    if (r.rule === 'required' && !trim) {
      return 'This field is required.';
    }
    if (r.rule === 'minLength' && typeof r.min === 'number' && trim.length < r.min) {
      return `Enter at least ${r.min} characters.`;
    }
    if (r.rule === 'maxLength' && typeof r.max === 'number' && trim.length > r.max) {
      return `At most ${r.max} characters.`;
    }
    if (r.rule === 'email' && trim) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim);
      if (!ok) return 'Enter a valid email address.';
    }
    if (r.rule === 'oneOf' && Array.isArray(r.values) && r.values.length > 0) {
      if (!r.values.includes(s)) {
        return 'Please choose a valid option.';
      }
    }
  }
  return null;
}

/**
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} el
 * @param {HTMLElement | null} errorEl
 * @param {string | null} message
 */
export function setFieldError(el, errorEl, message) {
  if (!errorEl) return;
  if (message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    el.setAttribute('aria-invalid', 'true');
  } else {
    errorEl.textContent = '';
    errorEl.hidden = true;
    el.removeAttribute('aria-invalid');
  }
}

/**
 * @param {{
 *   form: HTMLFormElement;
 *   submitButton: HTMLButtonElement | null;
 *   fields: { name: string; el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement; errorEl: HTMLElement | null; rules: FieldRule[] }[];
 * }} cfg
 */
export function attachFormValidation(cfg) {
  const { form, submitButton, fields } = cfg;

  function collectValues() {
    /** @type {Record<string, string>} */
    const out = {};
    for (const f of fields) {
      out[f.name] = f.el.value;
    }
    return out;
  }

  function validateField(name, touchOnly = false) {
    const f = fields.find((x) => x.name === name);
    if (!f) return true;
    const err = validateWithRules(f.el.value, f.rules);
    if (touchOnly || err) {
      setFieldError(f.el, f.errorEl, err);
    }
    return !err;
  }

  function validateAll() {
    let ok = true;
    for (const f of fields) {
      const err = validateWithRules(f.el.value, f.rules);
      setFieldError(f.el, f.errorEl, err);
      if (err) ok = false;
    }
    return ok;
  }

  function updateSubmitDisabled() {
    if (!submitButton) return;
    const anyInvalid = fields.some((f) => validateWithRules(f.el.value, f.rules) !== null);
    submitButton.disabled = anyInvalid;
  }

  for (const f of fields) {
    f.el.addEventListener('blur', () => {
      validateField(f.name, true);
      updateSubmitDisabled();
    });
    f.el.addEventListener('input', () => {
      if (f.errorEl && !f.errorEl.hidden) {
        const err = validateWithRules(f.el.value, f.rules);
        setFieldError(f.el, f.errorEl, err);
      }
      updateSubmitDisabled();
    });
    f.el.addEventListener('change', () => updateSubmitDisabled());
  }

  form.addEventListener('input', () => updateSubmitDisabled());
  form.addEventListener('change', () => updateSubmitDisabled());

  updateSubmitDisabled();

  return {
    validateAll,
    validateField,
    updateSubmitDisabled,
    collectValues,
    clearErrors() {
      for (const f of fields) {
        setFieldError(f.el, f.errorEl, null);
      }
    },
  };
}
