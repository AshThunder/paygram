/** Lock page scroll + hide tab bar while a portaled overlay is open. */
export function setOverlayOpen(open: boolean) {
  const root = document.documentElement;
  if (open) {
    root.dataset.overlayOpen = '1';
    document.body.style.overflow = 'hidden';
  } else {
    delete root.dataset.overlayOpen;
    document.body.style.overflow = '';
  }
}
