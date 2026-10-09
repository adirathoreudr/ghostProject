/** Decode a URI-encoded response header, falling back to the raw value. */
export function safeDecodeHeader(val) {
  if (!val) return '';
  try { return decodeURIComponent(val); } catch { return val; }
}

/** True when keyboard focus is in a text field, where SPACE must keep typing. */
export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!el.isContentEditable;
}
