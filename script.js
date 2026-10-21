(() => {
  const NS = "http://www.w3.org/2000/svg";
  const dial = document.querySelector(".dial");

  // разметка циферблата
  const ticks = document.getElementById("ticks");
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0;
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", 200);
    line.setAttribute("x2", 200);
    line.setAttribute("y1", 24);
    line.setAttribute("y2", major ? 44 : 32);
    line.setAttribute("stroke", major ? "var(--brass)" : "var(--on-dial)");
    line.setAttribute("stroke-width", major ? 3 : 1);
    line.setAttribute("stroke-opacity", major ? 1 : 0.5);
    line.setAttribute("transform", `rotate(${i * 6} 200 200)`);
    ticks.appendChild(line);
  }

  const numerals = document.getElementById("numerals");
  ["XII", "III", "VI", "IX"].forEach((n, i) => {
    if (n === "VI") return; // место занято малой секундной стрелкой
    const a = (i * 90 * Math.PI) / 180;
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", 200 + Math.sin(a) * 128);
    t.setAttribute("y", 200 - Math.cos(a) * 128 + 10);
    t.textContent = n;
    numerals.appendChild(t);
  });

  const subTicks = document.getElementById("sub-ticks");
  for (let i = 0; i < 12; i++) {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("x1", 200);
    line.setAttribute("x2", 200);
    line.setAttribute("y1", 243);
    line.setAttribute("y2", 248);
    line.setAttribute("stroke", "var(--on-dial)");
    line.setAttribute("stroke-opacity", 0.6);
    line.setAttribute("transform", `rotate(${i * 30} 200 275)`);
    subTicks.appendChild(line);
  }

  // стрелки показывают московское время
  const hour = document.getElementById("hour");
  const min = document.getElementById("min");
  const sec = document.getElementById("sec");
  const nowLabel = document.getElementById("now");
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

  function moscowTime() {
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
    return { h: +parts.hour % 24, m: +parts.minute, s: +parts.second, ms: new Date().getMilliseconds() };
  }

  function render() {
    const { h, m, s, ms } = moscowTime();
    const secs = s + ms / 1000;
    hour.style.transform = `rotate(${(h % 12) * 30 + m * 0.5 + s / 120}deg)`;
    min.style.transform = `rotate(${m * 6 + secs * 0.1}deg)`;
    // механический ход: 6 полушагов в секунду, как у калибра на 21 600 пк/ч
    sec.style.transform = `rotate(${Math.floor(secs * 6) / 6 * 6}deg)`;
    nowLabel.textContent = fmt.format(new Date()).slice(0, 5);
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = false;
  function loop() {
    render();
    setTimeout(loop, reduced ? 1000 : 1000 / 6);
  }

  // при загрузке стрелки один раз «доводятся» от 12 часов до текущего времени
  if (reduced) {
    loop();
  } else {
    dial.classList.add("settling");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      render();
      setTimeout(() => { dial.classList.remove("settling"); if (!running) { running = true; loop(); } }, 1650);
    }));
  }

  document.getElementById("year").textContent = new Date().getFullYear();

  // заявка
  const form = document.getElementById("request-form");
  const error = document.getElementById("form-error");
  const done = document.getElementById("form-done");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.elements.name;
    const phone = form.elements.phone;
    const digits = phone.value.replace(/\D/g, "");
    const problems = [];

    name.setAttribute("aria-invalid", String(!name.value.trim()));
    if (!name.value.trim()) problems.push("укажите имя");

    const phoneOk = digits.length >= 10 && digits.length <= 12;
    phone.setAttribute("aria-invalid", String(!phoneOk));
    if (!phoneOk) problems.push("введите телефон из 10–11 цифр");

    if (problems.length) {
      error.textContent = "Чтобы отправить заявку, " + problems.join(" и ") + ".";
      error.hidden = false;
      (name.value.trim() ? phone : name).focus();
      return;
    }

    // TODO: подключить отправку на сервер или в CRM
    error.hidden = true;
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });
})();
