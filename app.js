/* ============================================================
   免疫接力 · 互动实验室 — interactions
   ============================================================ */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- shared toast ---------- */
  const siteToast = $("#siteToast");
  let siteToastTimer = null;
  function showToast(message, duration = 2800) {
    if (!siteToast) return;
    siteToast.textContent = message;
    siteToast.classList.add("show");
    clearTimeout(siteToastTimer);
    siteToastTimer = setTimeout(() => siteToast.classList.remove("show"), duration);
  }

  /* ---------- sticky nav active state ---------- */
  const navLinks = $$("[data-nav]");
  const navSections = ["film", "lab", "experiments", "field"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if ("IntersectionObserver" in window && navSections.length) {
    const navObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach(link => {
            link.classList.toggle("active", link.dataset.nav === id);
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 }
    );
    navSections.forEach(section => navObserver.observe(section));
  }

  /* ---------- lab state machine ---------- */
  const labStage = $("#labStage");
  const geneBs2 = $("#geneBs2");
  const geneNrc = $("#geneNrc");
  const dropBs2 = $("#dropBs2");
  const dropNrc = $("#dropNrc");
  const statusDot = $("#statusDot");
  const statusTitle = $("#statusTitle");
  const statusDetail = $("#statusDetail");
  const stageStatus = $("#stageStatus");
  const stageToast = $("#stageToast");
  const labSteps = $$(".lab-step", $("#labProgress") || document);
  const labReset = $("#labReset");
  const labAuto = $("#labAuto");
  const avrParticles = $("#avrParticles");

  const labState = { bs2: false, nrc: false, defense: false };
  let labTimer = null;
  let bs2Timer1 = null;
  let bs2Timer2 = null;
  let nrcTurnTimer = null;
  let activationTimer1 = null;
  let activationTimer2 = null;
  let stageToastTimer = null;
  let selectedGene = null;
  let draggingGene = null;
  let dragGhost = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let didDrag = false;

  function setStageToast(message, duration = 3000) {
    if (!stageToast) return;
    stageToast.textContent = message;
    stageToast.classList.add("show");
    clearTimeout(stageToastTimer);
    stageToastTimer = setTimeout(() => stageToast.classList.remove("show"), duration);
  }

  function setStatus(dotClass, title, detail, stageText, stageClass) {
    if (statusDot) {
      statusDot.className = "status-dot" + (dotClass ? " " + dotClass : "");
    }
    if (statusTitle) statusTitle.textContent = title;
    if (statusDetail) statusDetail.textContent = detail;
    if (stageStatus) {
      stageStatus.className = "stage-status" + (stageClass ? " " + stageClass : "");
      stageStatus.innerHTML = "<i></i>" + stageText;
    }
  }

  function updateLab() {
    if (!labStage) return;
    labStage.dataset.bs2 = String(labState.bs2);
    labStage.dataset.nrc = String(labState.nrc);
    labStage.dataset.defense = String(labState.defense);

    if (geneBs2) {
      geneBs2.classList.toggle("placed", labState.bs2);
      geneBs2.setAttribute("aria-disabled", String(labState.bs2));
      if (labState.bs2) geneBs2.classList.remove("selected");
    }
    if (geneNrc) {
      geneNrc.classList.toggle("placed", labState.nrc);
      geneNrc.setAttribute("aria-disabled", String(labState.nrc));
      if (labState.nrc) geneNrc.classList.remove("selected");
    }

    const phase = labStage.dataset.bs2Phase || "idle";
    if (!labState.bs2 && !labState.nrc) {
      setStatus("", "等待 Bs2", "水稻缺少 NRC 类辅助 NLR；先看看只放 Bs2 会发生什么。", "等待识别", "");
    } else if (!labState.bs2 && labState.nrc) {
      setStatus("orange", "NRC 已就位，等待 Bs2", "NRC 不认 AvrBs2。它需要 Bs2 先把识别信号传过来，才能启动。", "NRC 待命 · 缺少识别", "is-orange");
    } else if (labState.bs2 && phase !== "gold") {
      setStatus("blue", "识别中…", "紫色 AvrBs2 粒子从左侧进入；Bs2 正在左右扫描，先别急。", "识别中 · 正在扫描", "is-blue");
    } else if (labState.bs2 && !labState.nrc) {
      setStatus("gold", "识别成功，警报传不出去", "Bs2 已经认出 AvrBs2；但 NRC 位空着，信号线断在缺口。把烟草的 NRC 接进来。", "识别成功 · 中继缺失", "is-gold");
    } else if (labState.bs2 && labState.nrc && !labState.defense) {
      if ((labStage.dataset.nrcTurn || "none") !== "left") {
        setStatus("orange", "金色广播传向 NRC…", "Bs2 的金色光波正向右扩散，NRC 准备接收。", "信号传播中", "is-orange");
      } else {
        setStatus("orange", "NRC 收到广播，正在组装", "NRC 已经收到金色信号，六个 NRC 单体开始组装成信号平台。", "信号接通 · 组装中", "is-orange");
      }
    } else if (labState.defense) {
      const activation = labStage.dataset.activation || "off";
      if (activation !== "done") {
        setStatus("gold", "六聚体激活中…", "一条线正在依次连接六个 NRC 单体；连接完成后会亮一下。", "激活中 · 连接六单体", "is-gold");
      } else {
        setStatus("green", "防御启动，病斑局限", "NRC 六聚体放大警报；活性氧、防御基因和局部细胞死亡启动，病菌分裂受抑。", "防御启动 · 病斑局限", "is-green");
      }
    }

    if (labSteps.length) {
      labSteps.forEach(step => {
        const n = Number(step.dataset.step);
        step.classList.remove("active", "done");
        if (n === 1) {
          if (labState.bs2) step.classList.add("done");
          else step.classList.add("active");
        } else if (n === 2) {
          if (labState.nrc) step.classList.add("done");
          else if (labState.bs2) step.classList.add("active");
        } else if (n === 3) {
          if (labState.defense) step.classList.add("done");
          else if (labState.bs2 && labState.nrc && (labStage.dataset.bs2Phase || "idle") === "gold") step.classList.add("active");
        } else if (n === 4) {
          if ((labStage.dataset.activation || "off") === "done") step.classList.add("done");
          else if (labState.defense) step.classList.add("active");
        }
      });
    }
  }

  function scheduleDefense() {
    clearTimeout(labTimer);
    clearTimeout(activationTimer1);
    clearTimeout(activationTimer2);
    labTimer = setTimeout(() => {
      if (!labState.bs2 || !labState.nrc) return;
      if ((labStage.dataset.bs2Phase || "idle") !== "gold") return;
      labState.defense = true;
      labStage.dataset.activation = "drawing";
      updateLab();
      activationTimer1 = setTimeout(() => {
        if (!labState.defense) return;
        labStage.dataset.activation = "flash";
        updateLab();
        activationTimer2 = setTimeout(() => {
          if (!labState.defense) return;
          labStage.dataset.activation = "done";
          updateLab();
          setStageToast("NRC 六聚体连接完成：防御启动。", 4200);
        }, 500);
      }, 1400);
    }, 2000);
  }

  function restartAvrParticles() {
    if (!avrParticles) return;
    avrParticles.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const c = document.createElementNS(ns, "circle");
      const x = 320 + t * 92; // 320 → 412, left of Bs2's face
      const y = 330 + Math.sin(t * Math.PI * 2 + 0.4) * 15 + ((i % 3) - 1) * 4;
      c.setAttribute("cx", x.toFixed(1));
      c.setAttribute("cy", y.toFixed(1));
      c.setAttribute("r", (1.5 + (i % 3) * 0.7).toFixed(1));
      c.setAttribute("fill", i % 4 === 0 ? "#EAD8FF" : "#B56CFF");
      c.style.animationDelay = (i * 0.035).toFixed(3) + "s";
      c.classList.add("avr-particle");
      avrParticles.appendChild(c);
    }
    avrParticles.classList.remove("play");
    void avrParticles.getBoundingClientRect();
    avrParticles.classList.add("play");
  }

  function startBs2Sequence() {
    clearTimeout(bs2Timer1);
    clearTimeout(bs2Timer2);
    if (!labStage) return;
    labStage.dataset.bs2Phase = "left";
    restartAvrParticles();
    updateLab();
    bs2Timer1 = setTimeout(() => {
      if (!labState.bs2) return;
      labStage.dataset.bs2Phase = "right";
      updateLab();
    }, 800);
    bs2Timer2 = setTimeout(() => {
      if (!labState.bs2) return;
      labStage.dataset.bs2Phase = "gold";
      updateLab();
      startSignalRelay(labState.nrc);
      if (!labState.nrc) {
        setStageToast("Bs2 扫描完成：光波转金，识别成功；但 NRC 位还空着，警报传不出去。", 3800);
      }
    }, 1600);
  }

  function startSignalRelay(hasNrc) {
    if (!labStage) return;
    clearTimeout(nrcTurnTimer);
    labStage.dataset.signal = "off";
    void labStage.getBoundingClientRect();
    labStage.dataset.signal = hasNrc ? "full" : "partial";
    if (hasNrc) {
      labStage.dataset.nrcTurn = "none";
      updateLab();
      nrcTurnTimer = setTimeout(() => {
        if (!labState.bs2 || !labState.nrc) return;
        labStage.dataset.nrcTurn = "left";
        updateLab();
        scheduleDefense();
      }, 1200);
    } else {
      labStage.dataset.nrcTurn = "none";
      updateLab();
    }
  }

  function placeGene(gene, silent) {
    if (gene === "bs2") {
      if (labState.bs2) return;
      labState.bs2 = true;
      startBs2Sequence();
      if (!silent) {
        setStageToast("Bs2 已就位：紫色 AvrBs2 粒子进入细胞，Bs2 正在扫描…", 3200);
      }
    } else if (gene === "nrc") {
      if (labState.nrc) return;
      labState.nrc = true;
      updateLab();
      if (!silent) {
        setStageToast(labState.bs2
          ? "NRC 已就位：等 Bs2 扫描完成，信号线就会接通。"
          : "NRC 已就位，但它不认 AvrBs2。先放 Bs2，识别才能开始。", 3800);
      }
      if (labState.bs2 && (labStage.dataset.bs2Phase || "idle") === "gold") {
        startSignalRelay(true);
      }
    }
    selectedGene = null;
    [geneBs2, geneNrc].forEach(card => card && card.classList.remove("selected"));
  }

  function resetLab() {
    clearTimeout(labTimer);
    clearTimeout(bs2Timer1);
    clearTimeout(bs2Timer2);
    clearTimeout(nrcTurnTimer);
    clearTimeout(activationTimer1);
    clearTimeout(activationTimer2);
    labState.bs2 = false;
    labState.nrc = false;
    labState.defense = false;
    if (labStage) {
      labStage.dataset.bs2Phase = "idle";
      labStage.dataset.nrcTurn = "none";
      labStage.dataset.signal = "off";
      labStage.dataset.activation = "off";
    }
    if (avrParticles) {
      avrParticles.classList.remove("play");
      avrParticles.innerHTML = "";
    }
    selectedGene = null;
    [geneBs2, geneNrc].forEach(card => card && card.classList.remove("selected", "placed"));
    updateLab();
    setStageToast("接力台已重置。先放 Bs2，还是先放 NRC？", 2600);
  }

  function autoDemo() {
    resetLab();
    showToast("自动演示：先放 Bs2，看紫粒子进入、Bs2 左右扫描；再放 NRC，接通信号。", 3600);
    setTimeout(() => placeGene("bs2", true), 700);
    setTimeout(() => {
      if (!labState.nrc) {
        setStageToast("只放 Bs2：扫描完成、光波转金，但 NRC 位空着，警报传不出去。", 3200);
      }
    }, 2400);
    setTimeout(() => placeGene("nrc", true), 3400);
  }

  function wrongDrop(gene, slot) {
    if (gene === "nrc" && slot === "bs2") {
      setStageToast("NRC 不认 AvrBs2——它不是传感器；请把 NRC 放进中继位。", 3600);
    } else if (gene === "bs2" && slot === "nrc") {
      setStageToast("Bs2 是传感器，不进入 NRC 的六聚体；请把 Bs2 放进传感器位。", 3600);
    } else {
      setStageToast("位置不对：Bs2 放传感器位，NRC 放中继位。", 3000);
    }
  }

  function handleDrop(gene, slot) {
    if (!gene || !slot) return;
    if ((gene === "bs2" && slot === "bs2") || (gene === "nrc" && slot === "nrc")) {
      placeGene(gene);
    } else {
      wrongDrop(gene, slot);
    }
  }

  function startDrag(event, gene) {
    if (!labStage) return;
    if ((gene === "bs2" && labState.bs2) || (gene === "nrc" && labState.nrc)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    draggingGene = gene;
    didDrag = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragGhost = document.createElement("div");
    dragGhost.className = "drag-ghost";
    dragGhost.textContent = gene === "bs2" ? "Bs2 · 传感器基因卡" : "NRC · 辅助 NLR 基因卡";
    document.body.appendChild(dragGhost);
    moveGhost(event.clientX, event.clientY);

    const onMove = moveEvent => {
      if (!draggingGene) return;
      const dx = moveEvent.clientX - dragStartX;
      const dy = moveEvent.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 6) didDrag = true;
      moveGhost(moveEvent.clientX, moveEvent.clientY);
      const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const zone = el && el.closest ? el.closest(".drop-zone") : null;
      $$(".drop-zone").forEach(z => z.classList.toggle("is-over", z === zone));
      if (moveEvent.cancelable) moveEvent.preventDefault();
    };

    const onUp = upEvent => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const el = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      const zone = el && el.closest ? el.closest(".drop-zone") : null;
      $$(".drop-zone").forEach(z => z.classList.remove("is-over"));
      if (dragGhost) {
        dragGhost.remove();
        dragGhost = null;
      }
      const geneReleased = draggingGene;
      draggingGene = null;
      if (zone && geneReleased) {
        handleDrop(geneReleased, zone.dataset.slot);
      }
      // suppress the click that follows a real drag
      if (didDrag) {
        setTimeout(() => { didDrag = false; }, 0);
      }
    };

    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp, { once: true });
  }

  function moveGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = x + "px";
    dragGhost.style.top = y + "px";
  }

  [geneBs2, geneNrc].forEach(card => {
    if (!card) return;
    card.addEventListener("pointerdown", event => {
      startDrag(event, card.dataset.gene);
    });
    card.addEventListener("click", () => {
      if (didDrag) return;
      const gene = card.dataset.gene;
      if ((gene === "bs2" && labState.bs2) || (gene === "nrc" && labState.nrc)) return;
      if (selectedGene === gene) {
        selectedGene = null;
        card.classList.remove("selected");
        return;
      }
      selectedGene = gene;
      [geneBs2, geneNrc].forEach(c => c && c.classList.remove("selected"));
      card.classList.add("selected");
      setStageToast(
        gene === "bs2"
          ? "已选中 Bs2：点击细胞里的「Bs2 传感器位」。"
          : "已选中 NRC：点击细胞里的「NRC 中继位」。",
        2600
      );
    });
  });

  [dropBs2, dropNrc].forEach(zone => {
    if (!zone) return;
    zone.addEventListener("click", () => {
      if (!selectedGene) {
        setStageToast("先从左侧选中一张基因卡，再点击这里放置。", 2600);
        return;
      }
      handleDrop(selectedGene, zone.dataset.slot);
    });
  });

  if (labReset) labReset.addEventListener("click", resetLab);
  if (labAuto) labAuto.addEventListener("click", autoDemo);

  // initial state
  if (labStage) updateLab();

  /* ---------- four-condition experiments ---------- */
  const expCards = $$(".exp-card");
  const expSummary = $("#expSummary");
  const expEgg = $("#expEgg");
  const expReset = $("#expReset");

  function updateExpSummary() {
    if (!expSummary) return;
    const revealed = expCards.filter(card => card.classList.contains("revealed")).length;
    const correct = expCards.filter(card => card.dataset.guessCorrect === "true").length;
    const all = revealed === expCards.length && expCards.length > 0;
    const allCorrect = all && correct === expCards.length;

    if (expEgg) {
      if (allCorrect) {
        expEgg.hidden = false;
        requestAnimationFrame(() => expEgg.classList.add("show"));
      } else {
        expEgg.hidden = true;
        expEgg.classList.remove("show");
      }
    }

    if (!all) {
      expSummary.hidden = true;
      expSummary.classList.remove("all-correct");
      return;
    }

    expSummary.hidden = false;
    if (allCorrect) {
      expSummary.hidden = true;
      expSummary.classList.remove("all-correct");
    } else {
      expSummary.classList.remove("all-correct");
      expSummary.innerHTML = "<b>已完成</b> 答对 " + correct + " / " + expCards.length + "，点「重置实验」再试一次。";
    }
  }

  expCards.forEach(card => {
    const answer = card.dataset.answer;
    const explain = card.dataset.explain || "";
    const result = $(".exp-result", card);
    const verdict = $(".exp-verdict", card);
    const explainEl = $(".exp-explain", card);
    const guesses = $$(".guess", card);

    guesses.forEach(button => {
      button.addEventListener("click", () => {
        if (card.classList.contains("revealed")) return;
        const guess = button.dataset.guess;
        guesses.forEach(b => {
          b.classList.remove("selected");
          b.setAttribute("aria-pressed", "false");
        });
        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");

        const isCorrect = guess === answer;
        card.dataset.guessCorrect = String(isCorrect);
        const isResistant = answer === "yes";
        if (verdict) {
          verdict.className = "exp-verdict " + (isResistant ? "yes" : "no");
          verdict.innerHTML =
            (isResistant ? "抗病" : "不抗病") +
            '<span class="guess-note">' + (isCorrect ? "你猜对了" : "再想想") + "</span>";
        }
        if (explainEl) explainEl.textContent = explain;
        if (result) result.hidden = false;
        card.classList.add("revealed");
        updateExpSummary();
      });
    });
  });

  if (expReset) {
    expReset.addEventListener("click", () => {
      expCards.forEach(card => {
        card.classList.remove("revealed");
        delete card.dataset.guessCorrect;
        $$(".guess", card).forEach(button => {
          button.classList.remove("selected");
          button.setAttribute("aria-pressed", "false");
        });
        const result = $(".exp-result", card);
        if (result) result.hidden = true;
      });
      updateExpSummary();
      showToast("四组对照已重置，可以重新预测。");
    });
  }

  /* ---------- end ---------- */
})();
