import { POPUP_CONTENT, SCROLL_CONFIG } from "../config.js";

function pageProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / max));
}

// Returns true when the event started inside an element that should keep
// the popup locked in place (e.g. the interactive Rive canvas).
function isScrollLockTarget(event) {
  const target = event.target;
  if (!target) return false;
  return !!target.closest("[data-scroll-lock=\"true\"]");
}

function clampScroll(position) {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const target = position * max;
  if (Math.abs(window.scrollY - target) > 0.5) {
    window.scrollTo(0, target);
  }
}

function findForwardStop(prev, next, stops) {
  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    if (stop > prev && stop <= next) {
      return { index: i, position: stop };
    }
  }
  return null;
}

function findBackwardStop(prev, next, stops) {
  for (let i = stops.length - 1; i >= 0; i -= 1) {
    const stop = stops[i];
    if (stop < prev && stop >= next) {
      return { index: i, position: stop };
    }
  }
  return null;
}

export function initScrollController({ popupManager, onTargetChange }) {
  const popupStops = POPUP_CONTENT.map(
    (_, idx) => (idx + 1) / (POPUP_CONTENT.length + 1)
  );
  const scrollKeys = new Set(SCROLL_CONFIG.scrollKeys);

  let rawProgress = 0;
  let lastProgress = 0;
  let lockedStop = null;
  let lockCooldown = false;
  let lockTimer = null;
  let lastTouchY = null;
  let lastWheelEventTime = 0;

  function beginLockCooldown() {
    lockCooldown = true;
    if (lockTimer) clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      lockCooldown = false;
      lockTimer = null;
    }, SCROLL_CONFIG.popupRevealMs);
    lastWheelEventTime = performance.now();
  }

  function clearLockTimer() {
    if (lockTimer) {
      clearTimeout(lockTimer);
      lockTimer = null;
    }
  }

  function releaseLock() {
    if (lockedStop === null) return;
    popupManager.hide();
    lockedStop = null;
    lockCooldown = false;
    clearLockTimer();
    lastTouchY = null;
    lastWheelEventTime = 0;
    onTargetChange(rawProgress);
  }

  function handleScroll() {
    rawProgress = pageProgress();

    if (lockedStop !== null) {
      clampScroll(lockedStop);
      rawProgress = lockedStop;
      lastProgress = lockedStop;
      onTargetChange(lockedStop);
      return;
    }

    const delta = rawProgress - lastProgress;
    if (delta === 0) {
      onTargetChange(rawProgress);
      lastProgress = rawProgress;
      return;
    }

    const crossing =
      delta > 0
        ? findForwardStop(lastProgress, rawProgress, popupStops)
        : findBackwardStop(lastProgress, rawProgress, popupStops);

    if (crossing) {
      lockedStop = crossing.position;
      popupManager.show(crossing.index);
      popupManager.setProgress(0);
      beginLockCooldown();
      clampScroll(lockedStop);
      rawProgress = lockedStop;
      lastProgress = lockedStop;
      lastWheelEventTime = performance.now();
      onTargetChange(lockedStop);
      return;
    }

    lastProgress = rawProgress;
    onTargetChange(rawProgress);
  }

  function handleWheel(event) {
    if (lockedStop === null) return;
    if (isScrollLockTarget(event)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const now = performance.now();
    if (lockCooldown) {
      lastWheelEventTime = now;
      return;
    }
    if (
      lastWheelEventTime &&
      now - lastWheelEventTime < SCROLL_CONFIG.wheelUnlockPauseMs
    ) {
      lastWheelEventTime = now;
      return;
    }
    lastWheelEventTime = now;
    releaseLock();
  }

  function handleTouchStart(event) {
    if (lockedStop === null) return;
    if (isScrollLockTarget(event)) {
      lastTouchY = null;
      return;
    }
    if (event.touches.length > 0) {
      lastTouchY = event.touches[0].clientY;
    }
  }

  function handleTouchMove(event) {
    if (lockedStop === null) return;
    if (isScrollLockTarget(event)) {
      event.preventDefault();
      lastTouchY = null;
      return;
    }
    if (event.touches.length === 0) return;

    const y = event.touches[0].clientY;

    if (lockCooldown) {
      event.preventDefault();
      return;
    }

    if (lastTouchY === null) {
      event.preventDefault();
      lastTouchY = y;
      return;
    }

    const delta = lastTouchY - y;
    lastTouchY = y;

    if (Math.abs(delta) < 2) {
      event.preventDefault();
      return;
    }

    releaseLock();
  }

  function handleTouchEnd() {
    if (lockedStop === null) return;
    if (lastTouchY === null) return;
    lastTouchY = null;
  }

  function handleKeyDown(event) {
    if (lockedStop === null) return;
    if (!scrollKeys.has(event.key)) return;
    if (lockCooldown) {
      event.preventDefault();
      return;
    }
    releaseLock();
  }

  const scrollListener = () => handleScroll();
  const wheelListener = (event) => handleWheel(event);
  const touchStartListener = (event) => handleTouchStart(event);
  const touchMoveListener = (event) => handleTouchMove(event);
  const touchEndListener = () => handleTouchEnd();
  const keyListener = (event) => handleKeyDown(event);

  window.addEventListener("scroll", scrollListener, { passive: true });
  window.addEventListener("wheel", wheelListener, { passive: false });
  window.addEventListener("touchstart", touchStartListener, { passive: true });
  window.addEventListener("touchmove", touchMoveListener, { passive: false });
  window.addEventListener("touchend", touchEndListener, { passive: true });
  window.addEventListener("touchcancel", touchEndListener, { passive: true });
  window.addEventListener("keydown", keyListener, { passive: false });

  function refresh() {
    rawProgress = pageProgress();
    lastProgress = rawProgress;
    onTargetChange(rawProgress);
  }

  function destroy() {
    clearLockTimer();
    window.removeEventListener("scroll", scrollListener);
    window.removeEventListener("wheel", wheelListener);
    window.removeEventListener("touchstart", touchStartListener);
    window.removeEventListener("touchmove", touchMoveListener);
    window.removeEventListener("touchend", touchEndListener);
    window.removeEventListener("touchcancel", touchEndListener);
    window.removeEventListener("keydown", keyListener);
  }

  return {
    refresh,
    destroy
  };
}
