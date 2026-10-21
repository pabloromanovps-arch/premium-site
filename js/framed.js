// Внутри оболочки стенда (index.html) страницы прячут свою навигацию: её показывает оболочка.
(function () {
  try {
    if (window.parent !== window && window.parent.STEBEL_STAND) document.documentElement.classList.add("in-stand");
  } catch (e) { /* открыто не в оболочке */ }
})();
