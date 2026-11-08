/* english-for-kids. Original by gabriellji, ISC. Static bundle for GitHub Pages. */
(() => {
  // src/mixins/eventMixin.js
  var eventMixin = {
    on(eventName, handler) {
      if (!this._eventHandlers) this._eventHandlers = {};
      if (!this._eventHandlers[eventName]) {
        this._eventHandlers[eventName] = [];
      }
      this._eventHandlers[eventName].push(handler);
    },
    off(eventName) {
      const handlers = this._eventHandlers && this._eventHandlers[eventName];
      if (!handlers) return;
      handlers.length = 0;
    },
    emit(eventName, ...args) {
      if (!this._eventHandlers || !this._eventHandlers[eventName]) {
        return;
      }
      this._eventHandlers[eventName].forEach((handler) => handler.apply(this, args));
    }
  };
  var eventMixin_default = eventMixin;

  // src/assetUrl.js
  function assetUrl(src) {
    if (!src) return src;
    const value = String(src);
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    const clean = value.replace(/^(?:\.\.\/)+/, "").replace(/^\/+/, "");
    let base = document.baseURI || window.location.href;
    if (!base.endsWith("/")) {
      const url = new URL(base);
      if (!/\/[^/]+\.[^/]+$/.test(url.pathname)) {
        url.pathname = `${url.pathname}/`;
      }
      base = url.href;
    }
    return new URL(clean, base).href;
  }

  // src/audio.js
  var audioCtx = null;
  var bufferCache = /* @__PURE__ */ new Map();
  function context() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
  }
  function playElement(url) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.src = url;
    const pending = audio.play();
    if (pending && typeof pending.catch === "function") {
      pending.catch(() => {
      });
    }
  }
  function startBuffer(ctx, buffer) {
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    node.start(0);
  }
  function loadAndStart(ctx, url) {
    if (bufferCache.has(url)) {
      startBuffer(ctx, bufferCache.get(url));
      return;
    }
    fetch(url).then((response) => {
      if (!response.ok) throw new Error("audio");
      return response.arrayBuffer();
    }).then((data) => ctx.decodeAudioData(data)).then((buffer) => {
      bufferCache.set(url, buffer);
      startBuffer(ctx, buffer);
    }).catch(() => playElement(url));
  }
  function unlockAudio() {
    const ctx = context();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {
      });
    }
  }
  function playAsset(src) {
    const url = assetUrl(src);
    const root = document.documentElement;
    root.dataset.lastAudio = url;
    root.dataset.audioSeq = String(Number(root.dataset.audioSeq || 0) + 1);
    const ctx = context();
    if (!ctx) {
      playElement(url);
      return;
    }
    if (ctx.state === "suspended") {
      ctx.resume().then(() => loadAndStart(ctx, url)).catch(() => playElement(url));
      return;
    }
    loadAndStart(ctx, url);
  }

  // src/controller/modeController/ModeController.js
  var ModeController = class {
    constructor(view, model) {
      this.view = view;
      this.model = model;
    }
    createCards() {
      this.view.cleanPage();
      this.view.drawCards(this.model.category.cards);
    }
    playWord(src) {
      playAsset(src);
    }
    destruct() {
      return true;
    }
  };
  Object.assign(ModeController.prototype, eventMixin_default);
  var ModeController_default = ModeController;

  // src/controller/modeController/MenuModeController.js
  var MenuModeController = class extends ModeController_default {
    constructor(view, model) {
      super(view, model);
      this.createCards();
    }
    createCards() {
      this.view.cleanPage();
      this.view.drawCards(this.model.menu.items);
    }
    cardHandler(id) {
      this.emit("category_requested", id);
      this.view.activeLinkView(id);
    }
  };
  var MenuModeController_default = MenuModeController;

  // src/controller/modeController/TrainModeController.js
  var TrainModeController = class extends ModeController_default {
    constructor(view, model) {
      super(view, model);
      this.createCards();
    }
    createCards() {
      this.view.cleanPage();
      this.view.drawCards(this.model.category.cards, true);
    }
    cardHandler(id) {
      this.view.flipCard(id);
      this.playWord(this.model.getCard(id).audioSrc);
      this.model.statistic.setStatistic(id, "trainClicks");
    }
  };
  var TrainModeController_default = TrainModeController;

  // src/controller/modeController/PlayModeController.js
  var PlayModeController = class extends ModeController_default {
    constructor(view, model) {
      super(view, model);
      this.isStart = false;
      this.points = [];
      this.createCards();
      this.init();
      this.view.on("play_button_pushed", this.roundStart.bind(this));
    }
    init() {
      this.view.playModeView();
      this.view.drawButton();
      this.round = 1;
      this.roundList = this.model.getAllCards();
      this.shuffle(this.roundList);
    }
    destruct() {
      this.view.off("play_button_pushed");
    }
    roundStart() {
      this.isStart = true;
      if (this.round > this.roundList.length) {
        this.gameOver();
      } else {
        this.playWord(this.roundList[this.round - 1].audioSrc);
      }
    }
    cardHandler(id) {
      if (!this.isStart) return;
      if (this.checkCorrectAnswer(id)) {
        this.setPoint(true);
        this.model.statistic.setStatistic(id, "correctAnswer");
        this.view.clickedCard(id);
        this.playWord("/assets/audio/correct.mp3");
        this.round += 1;
        this.roundStart();
      } else {
        this.setPoint(false);
        this.model.statistic.setStatistic(id, "errorAnswer");
        this.playWord("/assets/audio/error.mp3");
      }
    }
    gameOver() {
      const score = this.points.reduce((acc, point) => point ? acc * 1 : acc * 0, 1);
      const errors = this.points.reduce((acc, point) => !point ? acc + 1 : acc, 0);
      this.view.off("play_button_pushed");
      if (score > 0) {
        this.view.showWinResult();
        this.playWord("/assets/audio/success.mp3");
      } else {
        this.view.showFailResult(errors);
        this.playWord("/assets/audio/failure.mp3");
      }
      this.view.cleanScoreContainer();
      setTimeout(() => {
        this.view.hideResult();
        this.emit("main_page_requested");
      }, 2e3);
    }
    checkCorrectAnswer(id) {
      return Number(id) === this.roundList[this.round - 1].id;
    }
    setPoint(point) {
      this.points.push(point);
      this.view.drawScore(this.points);
    }
    shuffle(activeCards) {
      activeCards.sort(() => 0.5 - Math.random());
    }
  };
  var PlayModeController_default = PlayModeController;

  // src/controller/Controller.js
  var Controller = class {
    constructor(view, model) {
      this.view = view;
      this.model = model;
      this.view.drowMenu(this.model.menu);
      this.setModeController(true);
      this.view.on("toggle_switched", this.toggleHandler.bind(this));
      this.view.on("main_page_requested", () => this.setModeController(true));
      this.view.on("statistic_requested", this.getStatistic.bind(this));
      this.view.on("category_requested", this.model.setCategory.bind(this.model));
      this.model.on("mode_changed", this.modeHandler.bind(this));
      this.model.on("category_changed", this.setModeController.bind(this));
      this.view.on("reset_stat_clicked", () => {
        this.model.statistic.reset();
        this.getStatistic();
      });
    }
    setModeController(isMenu = false) {
      this.view.hideStatistic();
      if (this.modeController) {
        this.view.off("card_clicked", this.modeController.cardHandler.bind(this.modeController));
        this.modeController.destruct();
        this.view.cleanScoreContainer();
      }
      if (isMenu) {
        this.model.isMenuMode = true;
        this.modeController = new MenuModeController_default(this.view, this.model);
        this.modeController.on("category_requested", this.model.setCategory.bind(this.model));
      } else {
        if (this.model.mode === "train") {
          this.modeController = new TrainModeController_default(this.view, this.model);
        }
        if (this.model.mode === "play") {
          this.modeController = new PlayModeController_default(this.view, this.model);
          this.modeController.on("main_page_requested", () => this.setModeController(true));
        }
      }
      this.view.on("card_clicked", this.modeController.cardHandler.bind(this.modeController));
    }
    getStatistic() {
      this.view.drawStatistic(this.model.statistic.getWords());
      this.view.cleanPage();
      this.view.showStatistic();
    }
    toggleHandler() {
      this.model.changeMode();
    }
    modeHandler(mode) {
      if (!this.model.isMenuMode) {
        this.setModeController();
      }
      this.view.changeBackgroundColor(mode);
    }
  };
  var Controller_default = Controller;

  // src/view/View.js
  var View = class {
    constructor() {
      this.body = document.querySelector("body");
      this.logo = document.querySelector(".logo");
      this.menu = document.querySelector("#menu");
      this.navigation = document.querySelector(".header__navigation");
      this.hamburger = document.querySelector(".hamburger");
      this.cardsContainer = document.querySelector(".main-cards-images");
      this.scoreContainer = document.querySelector(".score");
      this.card = document.querySelector(".image-link");
      this.resetStat = document.querySelector(".reset-button");
      this.statContainer = document.querySelector(".statist");
      this.link = document.querySelector("li");
      this.statTable = document.querySelector("#tbody");
      this.switcher = document.querySelector("input");
      this.overlay = document.querySelector(".overlay");
      this.armedCards = /* @__PURE__ */ new WeakSet();
      this.lastTouchAt = 0;
      document.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          this.lastTouchAt = Date.now();
        }
        unlockAudio();
        this.flipReset(e);
      });
      this.hamburger.addEventListener("click", this.clickHamburgerHandler.bind(this));
      this.navigation.addEventListener("click", this.clickLinksHandler.bind(this));
      this.switcher.addEventListener("click", this.clickSwitcherHandler.bind(this));
      this.cardsContainer.addEventListener("click", this.clickCardsHandler.bind(this));
      this.resetStat.addEventListener("click", this.clickResetHandler.bind(this));
      this.cardsContainer.onclick = (e) => {
        this.closeMobileMenu(e);
      };
      this.logo.onclick = (e) => {
        this.closeMobileMenu(e);
      };
      this.scoreContainer.onclick = (e) => {
        this.closeMobileMenu(e);
      };
      this.statContainer.onclick = (e) => {
        this.closeMobileMenu(e);
      };
    }
    clickResetHandler() {
      this.emit("reset_stat_clicked");
    }
    clickCardsHandler(e) {
      const card = e.target.closest(".card");
      if (!card) return;
      const card_id = card.getAttribute("data-id");
      if (!card_id) return;
      this.emit("card_clicked", card_id);
      this.closeMobileMenu();
    }
    clickHamburgerHandler() {
      if (this.navigation.style.left === "-108%" || this.navigation.style.left === "") {
        this.openMobileMenu();
      } else {
        this.closeMobileMenu();
      }
    }
    clickLinksHandler(e) {
      this.cleanScoreContainer();
      if (e.target.tagName === "LI") {
        this.closeMobileMenu();
        if (e.target.id === "maine-page__link") {
          this.emit("main_page_requested");
          this.activeLinkMainStatisticView("#maine-page__link");
        } else if (e.target.id === "statistic__link") {
          this.emit("statistic_requested");
          this.activeLinkMainStatisticView("#statistic__link");
        } else {
          this.emit("category_requested", e.target.getAttribute("data-id"));
          this.activeLinkView(e.target.getAttribute("data-id"));
        }
      }
    }
    activeLinkMainStatisticView(id) {
      const mainLinks = document.querySelector(id);
      const links = this.menu.querySelectorAll("li");
      links.forEach((e) => {
        e.classList.remove("active-link");
      });
      mainLinks.classList.add("active-link");
    }
    activeLinkView(id) {
      const links = this.menu.querySelectorAll("li");
      links.forEach((e) => {
        e.classList.remove("active-link");
      });
      const el = this.menu.querySelector(`li[data-id="${id}"]`);
      el.classList.add("active-link");
    }
    // Desktop: mouseleave puts the translation away. Touch: a later tap outside does the same,
    // because iPad Safari does not emit a reliable mouseleave after a tap.
    flipReset(e) {
      const flipped = this.cardsContainer.querySelectorAll(".card.is-flipped");
      flipped.forEach((card) => {
        if (e.type === "mouseleave") {
          if (e.currentTarget === card) card.classList.remove("is-flipped");
          return;
        }
        if (!card.contains(e.target)) card.classList.remove("is-flipped");
      });
    }
    clickSwitcherHandler() {
      this.emit("toggle_switched");
    }
    clickPlayButtonHandler() {
      this.emit("play_button_pushed");
      this.repeatViewButton();
    }
    repeatViewButton() {
      const button = document.querySelector(".button-start");
      button.classList.add("repeat");
    }
    openMobileMenu() {
      this.overlay.classList.add("hidden-overlay");
      this.hamburger.classList.add("clicked__hamburger");
      this.navigation.style.left = "0%";
    }
    closeMobileMenu() {
      this.hamburger.classList.remove("clicked__hamburger");
      this.navigation.style.left = "-108%";
    }
    flipCard(id) {
      const card = this.cardsContainer.querySelector(`[data-id="${id}"]`);
      if (!card) return;
      card.classList.toggle("is-flipped");
      const fromTouch = Date.now() - this.lastTouchAt < 1e3;
      if (card.classList.contains("is-flipped") && !fromTouch && !this.armedCards.has(card)) {
        this.armedCards.add(card);
        setTimeout(() => {
          card.addEventListener("mouseleave", this.flipReset.bind(this));
        }, 800);
      }
    }
    playModeView() {
      const card = document.querySelectorAll(".image-link");
      card.forEach((el) => {
        el.classList.add("play");
      });
    }
    showStatistic() {
      this.statContainer.style.display = "flex";
    }
    hideStatistic() {
      this.statContainer.style.display = "none";
    }
    clickedCard(id) {
      const card = this.cardsContainer.querySelector(`[data-id="${id}"]`);
      card.classList.add("clicked-card");
    }
    cleanPage() {
      this.cardsContainer.innerHTML = "";
    }
    cleanScoreContainer() {
      this.scoreContainer.innerHTML = "";
    }
    drawScore(roundArray) {
      this.scoreContainer.innerHTML = "";
      roundArray.forEach((round) => {
        const star = document.createElement("img");
        if (round) {
          star.setAttribute("src", assetUrl("/assets/img/star-win.svg"));
        } else {
          star.setAttribute("src", assetUrl("/assets/img/star.svg"));
        }
        this.scoreContainer.appendChild(star);
      });
    }
    drawCard(id, word, img, translation, isArrow) {
      const container = document.createElement("div");
      container.classList.add("scene");
      const innerContainer = document.createElement("div");
      innerContainer.classList.add("card");
      innerContainer.setAttribute("data-id", id);
      container.appendChild(innerContainer);
      const card = document.createElement("div");
      card.classList.add("card__face", "card__face--front", "image-link");
      const cardFacaBack = document.createElement("div");
      cardFacaBack.classList.add("card__face", "card__face--back", "image-link");
      const image = document.createElement("img");
      image.setAttribute("src", assetUrl(img));
      image.setAttribute("alt", word);
      const imageBack = document.createElement("img");
      imageBack.setAttribute("src", assetUrl(img));
      imageBack.setAttribute("alt", word);
      const title = document.createElement("span");
      title.textContent = word;
      const arr = document.createElement("img");
      arr.classList.add("arrow");
      arr.setAttribute("src", assetUrl("../assets/img/rotate.svg"));
      const titleBack = document.createElement("span");
      titleBack.textContent = translation;
      card.appendChild(image);
      card.appendChild(title);
      if (isArrow) {
        card.appendChild(arr);
      }
      cardFacaBack.appendChild(imageBack);
      cardFacaBack.appendChild(titleBack);
      innerContainer.appendChild(card);
      innerContainer.appendChild(cardFacaBack);
      this.cardsContainer.appendChild(container);
    }
    drawCards(arrayCards, isArrow = false) {
      arrayCards.forEach(({
        id,
        word,
        translation,
        img
      }) => {
        this.drawCard(id, word, img, translation, isArrow);
      });
    }
    drowMenuItem(text, id) {
      const listLink = document.createElement("li");
      listLink.setAttribute("data-id", id);
      listLink.textContent = text;
      this.menu.appendChild(listLink);
    }
    drawStatistic(arr) {
      this.statTable.innerHTML = "";
      arr.forEach((word) => {
        const tr = document.createElement("tr");
        const text = document.createElement("td");
        const translate = document.createElement("td");
        const trainClicks = document.createElement("td");
        const correct = document.createElement("td");
        const error = document.createElement("td");
        const percent = document.createElement("td");
        text.innerText = word.word;
        translate.innerText = word.translation;
        trainClicks.innerText = word.trainClicks;
        correct.innerText = word.correctAnswer;
        error.innerText = word.errorAnswer;
        percent.innerText = word.errorAnswer / (word.correctAnswer + word.errorAnswer) * 100 || 0;
        tr.appendChild(text);
        tr.appendChild(translate);
        tr.appendChild(trainClicks);
        tr.appendChild(correct);
        tr.appendChild(error);
        tr.appendChild(percent);
        this.statTable.appendChild(tr);
      });
    }
    drowMenu(arrayMenu) {
      arrayMenu.items.forEach((link) => {
        this.drowMenuItem(link.word, link.id);
      });
    }
    drawButton() {
      const buttonContainer = document.createElement("div");
      buttonContainer.classList.add("button-box");
      const button = document.createElement("button");
      button.classList.add("button-start");
      button.innerText = "Start Game";
      buttonContainer.appendChild(button);
      this.cardsContainer.appendChild(buttonContainer);
      button.addEventListener("click", this.clickPlayButtonHandler.bind(this));
    }
    changeBackgroundColor(mode) {
      const imageColor = document.querySelectorAll(".image-link");
      if (mode === "play") {
        this.navigation.style.background = "linear-gradient(to bottom left, #00cc00 0%, #ffcc00 100%)";
        imageColor.forEach((b) => b.style.background = "linear-gradient(to bottom left, #00cc00 0%, #ffcc00 100%)");
      } else if (mode === "train") {
        this.navigation.style.background = "linear-gradient(to top right, #ffcc00 0%, #ff00ff 100%)";
        imageColor.forEach((b) => b.style.background = "linear-gradient(to top right, #ffcc00 0%, #ff00ff 100%)");
      }
    }
    showWinResult() {
      const image = document.querySelector(".finish-round-succes");
      image.style.visibility = "unset";
    }
    showFailResult(error) {
      const errorText = document.querySelector(".error");
      errorText.innerText = error;
      const image = document.querySelector(".finish-round-failure");
      image.style.visibility = "unset";
    }
    hideResult() {
      const image = document.querySelectorAll(".image");
      image.forEach((img) => img.style.visibility = "hidden");
    }
  };
  Object.assign(View.prototype, eventMixin_default);
  var View_default = View;

  // src/model/Card.js
  var Card = class {
    constructor(id, word, translation, img, audioSrc) {
      this.id = id;
      this.word = word;
      this.translation = translation;
      this.img = img;
      this.audioSrc = audioSrc;
    }
  };
  var Card_default = Card;

  // src/model/Category.js
  var Category = class {
    constructor(id, title, img, words) {
      this.id = id;
      this.title = title;
      this.img = img;
      this.cards = this.createCards(words);
    }
    createCards(array) {
      const cards = [];
      array.forEach(({
        id,
        word,
        translation,
        img,
        audioSrc
      }) => {
        cards.push(new Card_default(id, word, translation, img, audioSrc));
      });
      return cards;
    }
  };
  var Category_default = Category;

  // src/model/Menu.js
  var Menu = class {
    constructor(items) {
      this.items = this.createItems(items);
    }
    createItems(array) {
      const items = [];
      array.forEach(({ id, title, img }) => {
        items.push(new Card_default(id, title, null, img));
      });
      return items;
    }
  };
  var Menu_default = Menu;

  // src/data.js
  var data_default = [
    {
      title: "Action (set A)",
      img: "/assets/img/dance.jpg",
      id: 1,
      words: [
        {
          word: "cry",
          translation: "\u043F\u043B\u0430\u043A\u0430\u0442\u044C",
          img: "/assets/img/cry.jpg",
          audioSrc: "/assets/audio/cry.mp3",
          id: 1
        },
        {
          word: "dance",
          translation: "\u0442\u0430\u043D\u0446\u0435\u0432\u0430\u0442\u044C",
          img: "/assets/img/dance.jpg",
          audioSrc: "/assets/audio/dance.mp3",
          id: 2
        },
        {
          word: "dive",
          translation: "\u043D\u044B\u0440\u044F\u0442\u044C",
          img: "/assets/img/dive.jpg",
          audioSrc: "/assets/audio/dive.mp3",
          id: 3
        },
        {
          word: "draw",
          translation: "\u0440\u0438\u0441\u043E\u0432\u0430\u0442\u044C",
          img: "/assets/img/draw.jpg",
          audioSrc: "/assets/audio/draw.mp3",
          id: 4
        },
        {
          word: "fish",
          translation: "\u043B\u043E\u0432\u0438\u0442\u044C \u0440\u044B\u0431\u0443",
          img: "/assets/img/fish.jpg",
          audioSrc: "/assets/audio/fish.mp3",
          id: 5
        },
        {
          word: "fly",
          translation: "\u043B\u0435\u0442\u0430\u0442\u044C",
          img: "/assets/img/fly.jpg",
          audioSrc: "/assets/audio/fly.mp3",
          id: 6
        },
        {
          word: "hug",
          translation: "\u043E\u0431\u043D\u0438\u043C\u0430\u0442\u044C",
          img: "/assets/img/hug.jpg",
          audioSrc: "/assets/audio/hug.mp3",
          id: 7
        },
        {
          word: "jump",
          translation: "\u043F\u0440\u044B\u0433\u0430\u0442\u044C",
          img: "/assets/img/jump.jpg",
          audioSrc: "/assets/audio/jump.mp3",
          id: 8
        }
      ]
    },
    {
      title: "Action (set B)",
      img: "/assets/img/swim.jpg",
      id: 2,
      words: [
        {
          word: "open",
          translation: "\u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0442\u044C",
          img: "/assets/img/open.jpg",
          audioSrc: "/assets/audio/open.mp3",
          id: 9
        },
        {
          word: "play",
          translation: "\u0438\u0433\u0440\u0430\u0442\u044C",
          img: "/assets/img/play.jpg",
          audioSrc: "/assets/audio/play.mp3",
          id: 10
        },
        {
          word: "point",
          translation: "\u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C",
          img: "/assets/img/point.jpg",
          audioSrc: "/assets/audio/point.mp3",
          id: 11
        },
        {
          word: "ride",
          translation: "\u0435\u0437\u0434\u0438\u0442\u044C",
          img: "/assets/img/ride.jpg",
          audioSrc: "/assets/audio/ride.mp3",
          id: 12
        },
        {
          word: "run",
          translation: "\u0431\u0435\u0433\u0430\u0442\u044C",
          img: "/assets/img/run.jpg",
          audioSrc: "/assets/audio/run.mp3",
          id: 13
        },
        {
          word: "sing",
          translation: "\u043F\u0435\u0442\u044C",
          img: "/assets/img/sing.jpg",
          audioSrc: "/assets/audio/sing.mp3",
          id: 14
        },
        {
          word: "skip",
          translation: "\u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u044C, \u043F\u0440\u044B\u0433\u0430\u0442\u044C",
          img: "/assets/img/skip.jpg",
          audioSrc: "/assets/audio/skip.mp3",
          id: 15
        },
        {
          word: "swim",
          translation: "\u043F\u043B\u0430\u0432\u0430\u0442\u044C",
          img: "/assets/img/swim.jpg",
          audioSrc: "/assets/audio/swim.mp3",
          id: 16
        }
      ]
    },
    {
      title: "Action (set C)",
      img: "/assets/img/read.jpg",
      id: 3,
      words: [
        {
          word: "read",
          translation: "\u0447\u0438\u0442\u0430\u0442\u044C",
          img: "/assets/img/read.jpg",
          audioSrc: "/assets/audio/read.mp3",
          id: 17
        },
        {
          word: "sleep",
          translation: "\u0441\u043F\u0430\u0442\u044C",
          img: "/assets/img/sleep.jpg",
          audioSrc: "/assets/audio/sleep.mp3",
          id: 18
        },
        {
          word: "study",
          translation: "\u0443\u0447\u0438\u0442\u044C\u0441\u044F",
          img: "/assets/img/study.jpg",
          audioSrc: "/assets/audio/study.mp3",
          id: 19
        },
        {
          word: "help",
          translation: "\u043F\u043E\u043C\u043E\u0433\u0430\u0442\u044C",
          img: "/assets/img/help.jpg",
          audioSrc: "/assets/audio/help.mp3",
          id: 20
        },
        {
          word: "cook",
          translation: "\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C",
          img: "/assets/img/cook.jpg",
          audioSrc: "/assets/audio/cook.mp3",
          id: 22
        },
        {
          word: "drink",
          translation: "\u043F\u0438\u0442\u044C",
          img: "/assets/img/drink.jpg",
          audioSrc: "/assets/audio/drink.mp3",
          id: 23
        },
        {
          word: "listen",
          translation: "\u0441\u043B\u0443\u0448\u0430\u0442\u044C",
          img: "/assets/img/listen.jpg",
          audioSrc: "/assets/audio/listen.mp3",
          id: 24
        },
        {
          word: "eat",
          translation: "\u043A\u0443\u0448\u0430\u0442\u044C",
          img: "/assets/img/eat.jpg",
          audioSrc: "/assets/audio/eat.mp3",
          id: 25
        }
      ]
    },
    {
      title: "Abjective",
      img: "/assets/img/funny.jpg",
      id: 4,
      words: [
        {
          word: "beautiful",
          translation: "\u043A\u0440\u0430\u0441\u0438\u0432\u044B\u0439",
          img: "/assets/img/beautiful.jpg",
          audioSrc: "/assets/audio/beautiful.mp3",
          id: 26
        },
        {
          word: "big",
          translation: "\u0431\u043E\u043B\u044C\u0448\u043E\u0439",
          img: "/assets/img/big.jpg",
          audioSrc: "/assets/audio/big.mp3",
          id: 27
        },
        {
          word: "tasty",
          translation: "\u0432\u043A\u0443\u0441\u043D\u044B\u0439",
          img: "/assets/img/tasty.jpg",
          audioSrc: "/assets/audio/tasty.mp3",
          id: 28
        },
        {
          word: "old",
          translation: "\u0441\u0442\u0430\u0440\u044B\u0439",
          img: "/assets/img/old.jpg",
          audioSrc: "/assets/audio/old.mp3",
          id: 29
        },
        {
          word: "friendly",
          translation: "\u0434\u0440\u0443\u0436\u0435\u043B\u044E\u0431\u043D\u044B\u0439",
          img: "/assets/img/friendly.jpg",
          audioSrc: "/assets/audio/friendly.mp3",
          id: 30
        },
        {
          word: "funny",
          translation: "\u0441\u043C\u0435\u0448\u043D\u043E\u0439",
          img: "/assets/img/funny.jpg",
          audioSrc: "/assets/audio/funny.mp3",
          id: 31
        },
        {
          word: "colorful",
          translation: "\u0440\u0430\u0437\u043D\u043E\u0446\u0432\u0435\u0442\u043D\u044B\u0439",
          img: "/assets/img/colorful.jpg",
          audioSrc: "/assets/audio/colorful.mp3",
          id: 32
        },
        {
          word: "small",
          translation: "\u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0439",
          img: "/assets/img/small.jpg",
          audioSrc: "/assets/audio/small.mp3",
          id: 33
        }
      ]
    },
    {
      title: "Animal (set A)",
      img: "/assets/img/rabbit.jpg",
      id: 5,
      words: [
        {
          word: "cat",
          translation: "\u043A\u043E\u0442",
          img: "/assets/img/cat.jpg",
          audioSrc: "/assets/audio/cat.mp3",
          id: 34
        },
        {
          word: "chick",
          translation: "\u0446\u044B\u043F\u043B\u0451\u043D\u043E\u043A",
          img: "/assets/img/chick.jpg",
          audioSrc: "/assets/audio/chick.mp3",
          id: 35
        },
        {
          word: "chicken",
          translation: "\u043A\u0443\u0440\u0438\u0446\u0430",
          img: "/assets/img/chicken.jpg",
          audioSrc: "/assets/audio/chicken.mp3",
          id: 36
        },
        {
          word: "dog",
          translation: "\u0441\u043E\u0431\u0430\u043A\u0430",
          img: "/assets/img/dog.jpg",
          audioSrc: "/assets/audio/dog.mp3",
          id: 37
        },
        {
          word: "horse",
          translation: "\u043B\u043E\u0448\u0430\u0434\u044C",
          img: "/assets/img/horse.jpg",
          audioSrc: "/assets/audio/horse.mp3",
          id: 38
        },
        {
          word: "pig",
          translation: "\u0441\u0432\u0438\u043D\u044C\u044F",
          img: "/assets/img/pig.jpg",
          audioSrc: "/assets/audio/pig.mp3",
          id: 39
        },
        {
          word: "rabbit",
          translation: "\u043A\u0440\u043E\u043B\u0438\u043A",
          img: "/assets/img/rabbit.jpg",
          audioSrc: "/assets/audio/rabbit.mp3",
          id: 40
        },
        {
          word: "sheep",
          translation: "\u043E\u0432\u0446\u0430",
          img: "/assets/img/sheep.jpg",
          audioSrc: "/assets/audio/sheep.mp3",
          id: 41
        }
      ]
    },
    {
      title: "Animal (set B)",
      img: "/assets/img/lion.jpg",
      id: 6,
      words: [
        {
          word: "bird",
          translation: "\u043F\u0442\u0438\u0446\u0430",
          img: "/assets/img/bird.jpg",
          audioSrc: "/assets/audio/bird.mp3",
          id: 42
        },
        {
          word: "fish",
          translation: "\u0440\u044B\u0431\u0430",
          img: "/assets/img/fish1.jpg",
          audioSrc: "/assets/audio/fish.mp3",
          id: 43
        },
        {
          word: "frog",
          translation: "\u0436\u0430\u0431\u0430",
          img: "/assets/img/frog.jpg",
          audioSrc: "/assets/audio/frog.mp3",
          id: 44
        },
        {
          word: "giraffe",
          translation: "\u0436\u0438\u0440\u0430\u0444\u0430",
          img: "/assets/img/giraffe.jpg",
          audioSrc: "/assets/audio/giraffe.mp3",
          id: 45
        },
        {
          word: "lion",
          translation: "\u043B\u0435\u0432",
          img: "/assets/img/lion.jpg",
          audioSrc: "/assets/audio/lion.mp3",
          id: 46
        },
        {
          word: "mouse",
          translation: "\u043C\u044B\u0448\u044C",
          img: "/assets/img/mouse.jpg",
          audioSrc: "/assets/audio/mouse.mp3",
          id: 47
        },
        {
          word: "turtle",
          translation: "\u0447\u0435\u0440\u0435\u043F\u0430\u0445\u0430",
          img: "/assets/img/turtle.jpg",
          audioSrc: "/assets/audio/turtle.mp3",
          id: 48
        },
        {
          word: "dolphin",
          translation: "\u0434\u0435\u043B\u044C\u0444\u0438\u043D",
          img: "/assets/img/dolphin.jpg",
          audioSrc: "/assets/audio/dolphin.mp3",
          id: 49
        }
      ]
    },
    {
      title: "Clothes",
      img: "/assets/img/dress.jpg",
      id: 7,
      words: [
        {
          word: "skirt",
          translation: "\u044E\u0431\u043A\u0430",
          img: "/assets/img/skirt.jpg",
          audioSrc: "/assets/audio/skirt.mp3",
          id: 50
        },
        {
          word: "pants",
          translation: "\u0431\u0440\u044E\u043A\u0438",
          img: "/assets/img/pants.jpg",
          audioSrc: "/assets/audio/pants.mp3",
          id: 51
        },
        {
          word: "blouse",
          translation: "\u0431\u043B\u0443\u0437\u043A\u0430",
          img: "/assets/img/blouse.jpg",
          audioSrc: "/assets/audio/blouse.mp3",
          id: 52
        },
        {
          word: "dress",
          translation: "\u043F\u043B\u0430\u0442\u044C\u0435",
          img: "/assets/img/dress.jpg",
          audioSrc: "/assets/audio/dress.mp3",
          id: 53
        },
        {
          word: "boot",
          translation: "\u0431\u043E\u0442\u0438\u043D\u043E\u043A",
          img: "/assets/img/boot.jpg",
          audioSrc: "/assets/audio/boot.mp3",
          id: 54
        },
        {
          word: "shirt",
          translation: "\u0440\u0443\u0431\u0430\u0448\u043A\u0430",
          img: "/assets/img/shirt.jpg",
          audioSrc: "/assets/audio/shirt.mp3",
          id: 55
        },
        {
          word: "coat",
          translation: "\u043F\u0430\u043B\u044C\u0442\u043E",
          img: "/assets/img/coat.jpg",
          audioSrc: "/assets/audio/coat.mp3",
          id: 56
        },
        {
          word: "shoe",
          translation: "\u0442\u0443\u0444\u043B\u0438",
          img: "/assets/img/shoe.jpg",
          audioSrc: "/assets/audio/shoe.mp3",
          id: 57
        }
      ]
    },
    {
      title: "Emotions",
      img: "/assets/img/smile.jpg",
      id: 8,
      words: [
        {
          word: "sad",
          translation: "\u0433\u0440\u0443\u0441\u0442\u043D\u044B\u0439",
          img: "/assets/img/sad.jpg",
          audioSrc: "/assets/audio/sad.mp3",
          id: 58
        },
        {
          word: "angry",
          translation: "\u0441\u0435\u0440\u0434\u0438\u0442\u044B\u0439",
          img: "/assets/img/angry.jpg",
          audioSrc: "/assets/audio/angry.mp3",
          id: 59
        },
        {
          word: "happy",
          translation: "\u0441\u0447\u0430\u0441\u0442\u043B\u0438\u0432\u044B\u0439",
          img: "/assets/img/happy.jpg",
          audioSrc: "/assets/audio/happy.mp3",
          id: 60
        },
        {
          word: "tired",
          translation: "\u0443\u0441\u0442\u0430\u0432\u0448\u0438\u0439",
          img: "/assets/img/tired.jpg",
          audioSrc: "/assets/audio/tired.mp3",
          id: 61
        },
        {
          word: "surprised",
          translation: "\u0443\u0434\u0438\u0432\u043B\u0451\u043D\u043D\u044B\u0439",
          img: "/assets/img/surprised.jpg",
          audioSrc: "/assets/audio/surprised.mp3",
          id: 62
        },
        {
          word: "scared",
          translation: "\u0438\u0441\u043F\u0443\u0433\u0430\u043D\u043D\u044B\u0439",
          img: "/assets/img/scared.jpg",
          audioSrc: "/assets/audio/scared.mp3",
          id: 63
        },
        {
          word: "smile",
          translation: "\u0443\u043B\u044B\u0431\u043A\u0430",
          img: "/assets/img/smile.jpg",
          audioSrc: "/assets/audio/smile.mp3",
          id: 64
        },
        {
          word: "laugh",
          translation: "\u0441\u043C\u0435\u0445",
          img: "/assets/img/laugh.jpg",
          audioSrc: "/assets/audio/laugh.mp3",
          id: 65
        }
      ]
    }
  ];

  // src/model/Statistic.js
  var Statistic = class {
    constructor() {
      this.storage = window.localStorage;
      this.words = this.loadOrCreate();
    }
    getWords(id = "all") {
      if (id === "all") {
        return this.words.reduce(
          (acc, category) => acc.concat(category.words).sort(
            (a, b) => a.word.charCodeAt(0) - b.word.charCodeAt(0)
          ),
          []
        );
      }
      return this.words.filter((category) => category.id === Number(id))[0].words;
    }
    setStatistic(id, parameter) {
      for (const category of this.words) {
        let flag = false;
        for (const word of category.words) {
          if (word.id === Number(id)) {
            word[parameter] += 1;
            flag = true;
            break;
          }
          if (flag) break;
        }
      }
      this.storage.setItem("statistic", JSON.stringify(this.words));
    }
    loadOrCreate() {
      let words = this.storage.getItem("statistic");
      if (!words) {
        words = this.createData();
        return words;
      }
      return JSON.parse(words);
    }
    createData() {
      const words = data_default.map((category) => ({
        id: category.id,
        title: category.title,
        words: category.words.map(
          (word) => ({
            id: word.id,
            word: word.word,
            translation: word.translation,
            trainClicks: 0,
            correctAnswer: 0,
            errorAnswer: 0
          })
        )
      }));
      this.storage.setItem("statistic", JSON.stringify(words));
      return words;
    }
    reset() {
      this.storage.removeItem("statistic");
      this.words = this.createData();
    }
  };
  var Statistic_default = Statistic;

  // src/model/Model.js
  var Model = class {
    constructor(mode) {
      this.mode = mode;
      this.isMenuMode = true;
      this.data = data_default;
      this.statistic = new Statistic_default();
      this.createMenu(this.data);
    }
    changeMode() {
      this.mode = this.mode === "train" ? "play" : "train";
      this.emit("mode_changed", this.mode);
    }
    setCategory(id) {
      this.createCategory(this.data.filter((category) => category.id === Number(id))[0]);
      this.isMenuMode = false;
      this.emit("category_changed");
    }
    getCard(id) {
      return this.category.cards.filter((card) => card.id === Number(id))[0];
    }
    getAllCards() {
      return this.category.cards;
    }
    createCategory({
      id,
      title,
      img,
      words
    }) {
      this.category = new Category_default(id, title, img, words);
    }
    createMenu(data) {
      this.menu = new Menu_default(data);
    }
  };
  Object.assign(Model.prototype, eventMixin_default);
  var Model_default = Model;

  // src/index.js
  new Controller_default(new View_default(), new Model_default("train"));
})();
