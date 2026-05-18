/*
 * Compatibility shim.
 *
 * The orchestrator now lives at js-files/shared/layout.js. This file is kept
 * so existing <script src="js-files/components/layout.js"> tags keep working.
 * It defers to the canonical shared loader.
 */
(function () {
  const TARGET = 'js-files/shared/layout.js';
  if (document.querySelector(`script[src$="${TARGET}"]`)) return;

  const script = document.createElement('script');
  script.src = TARGET;
  document.head.appendChild(script);
})();
