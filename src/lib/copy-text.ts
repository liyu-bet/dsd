/**
 * Copy string to the system clipboard.
 * Prefer Async Clipboard API; fall back to a hidden textarea + execCommand
 * when the API is blocked (Permissions-Policy, non-focus, Safari quirks, etc.).
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  const value = String(text ?? '');
  if (!value) return;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // fall through to legacy path
  }

  if (typeof document === 'undefined') {
    throw new Error('No document');
  }

  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, value.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }

  if (!ok) {
    throw new Error('execCommand copy failed');
  }
}
