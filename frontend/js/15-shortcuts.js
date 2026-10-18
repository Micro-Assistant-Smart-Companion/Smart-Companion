// [15/19] keyboard shortcuts, Escape key
// Part of the Smart Companion page script. Loaded by index.html in numeric order; all files share one global scope.
// --- 17. GLOBAL SHORTCUTS & ESCAPE LISTENER ---
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    if (newChatBtn) newChatBtn.click();
    return;
  }
  if (e.key === 'Escape') {
    const dynamicModals = document.querySelectorAll('.settings-modal.active');
    if (dynamicModals.length > 0) {
      dynamicModals.forEach(m => {
        if (m === ipSettingsModal) m.classList.remove('active');
        else m.remove();
      });
      return;
    }
    if (camMenu && camMenu.classList.contains('open')) camMenu.classList.remove('open');
    else if (badgesModal && badgesModal.classList.contains('active')) badgesModal.classList.remove('active');
    else if (ipSettingsModal && ipSettingsModal.classList.contains('active')) ipSettingsModal.classList.remove('active');
    else if (snapOverlay && snapOverlay.classList.contains('active')) stopSnapCapture();
    else if (liveCamOverlay && liveCamOverlay.classList.contains('active')) stopLiveCam();
    else if (sidebarEl && sidebarEl.classList.contains('open')) toggleSidebar(false);
  }
});