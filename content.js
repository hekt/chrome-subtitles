(function() {
  var parser = new SubtitleParser();
  var subsRootId = 'chrome-subtitles-root';
  var subsWrapClass = 'chrome-subtitles-text';
  var subsLineClass = 'chrome-subtitles-line';

  // global variables
  var subsRootElem;
  var timerId;
  var currentTime;
  var previousTime;
  var timeTable;
  var timeTableLength;
  var playerObject;
  var playerContainer;
  var playTimeBox;
  var eventIndex = 0;
  var runningTime = 0;
  var delayMs = 0;
  var status = 'ready';

  //
  // open file ui
  //
  function createUi() {
    removeUi();

    var uiWrap = document.createElement('div');
    uiWrap.id = 'chrome-subtitles-ui-wrap';
    var uiBody = document.createElement('div');
    uiBody.id = 'chrome-subtitles-ui-body';
    var uiInputFile = document.createElement('input');
    uiInputFile.id = 'chrome-subtitles-ui-file-selector';
    uiInputFile.type = 'file';

    uiBody.appendChild(uiInputFile);
    uiWrap.appendChild(uiBody);
    document.body.appendChild(uiWrap);

    addEventListenersForUi();
  }
  function removeUi() {
    var uiObj = document.querySelector("#chrome-subtitles-ui-wrap");
    if (uiObj) document.body.removeChild(uiObj);
  }
  function addEventListenersForUi() {
    var fileReciever = 
          document.querySelector('#chrome-subtitles-ui-file-selector');
    fileReciever.addEventListener('change', function() {
      var file = fileReciever.files[0];
      var r = new FileReader();
      var result;
      r.addEventListener('load', function(e) {
        if (file.name.indexOf('.ass') != -1) {
          console.log('ass');
          result = parser.assParser(r.result);
        } else if (file.name.indexOf('.srt') != -1) {
          console.log('srt');
          result = parser.srtParser(r.result);
        } else {
          console.error('invalid subtitle file');
          result= {};
        }
        timeTable = result.events;
        timeTableLength = timeTable.length;
        if (result.styles) appendStyles(result.styles);
        console.log(result.events);
        console.log(result.styles);
      }, true);
      r.readAsText(file, 'UTF-8');

      removeUi();
      createControllers();
    });
  }

  //
  // playback controllers
  //
  function createControllers() {
    removeControllers();

    var ctrlWrap = document.createElement('div');
    ctrlWrap.id = 'chrome-subtitles-controllers';

    var ctrlForm = document.createElement('form');
    ctrlForm.id = 'chrome-subtitles-form';

    var ctrlPlay = document.createElement('input');
    ctrlPlay.id = 'chrome-subtitles-play';
    ctrlPlay.type = 'button';
    ctrlPlay.value = '▶';

    var ctrlDelay = document.createElement('input');
    ctrlDelay.id = 'chrome-subtitles-adjust-delay';
    ctrlDelay.type = 'button';
    ctrlDelay.value = '+';
    var ctrlAdvance = document.createElement('input');
    ctrlAdvance.id = 'chrome-subtitles-adjust-advance';
    ctrlAdvance.type = 'button';
    ctrlAdvance.value = '-';
    var ctrlReset = document.createElement('input');
    ctrlReset.id = 'chrome-subtitles-adjust-reset';
    ctrlReset.type = 'button';
    ctrlReset.value = '=';

    var ctrlClickToPlay = document.createElement('input');
    ctrlClickToPlay.id = 'chrome-subtitles-click-to-play';
    ctrlClickToPlay.type = 'button';
    ctrlClickToPlay.value = '...';

    var ctrlPlayTime = document.createElement('input');
    ctrlPlayTime.id = 'chrome-subtitles-play-time';
    ctrlPlayTime.type = 'text';
    ctrlPlayTime.value = '00:00';
    
    ctrlForm.appendChild(ctrlPlay);
    ctrlForm.appendChild(ctrlClickToPlay);
    ctrlForm.appendChild(ctrlPlayTime);
    ctrlForm.appendChild(ctrlAdvance);
    ctrlForm.appendChild(ctrlReset);
    ctrlForm.appendChild(ctrlDelay);
    ctrlWrap.appendChild(ctrlForm);
    document.body.appendChild(ctrlWrap);

    addEventListenersForControllers();
  }
  function removeControllers() {
    var ctrlObj = document.querySelector('#chrome-subtitles-controllers');
    if (ctrlObj) document.body.removeChild(ctrlObj);
  }
  function addEventListenersForControllers() {
    var playButton = document.querySelector('#chrome-subtitles-play');
    var delayButton = document.querySelector('#chrome-subtitles-adjust-delay');
    var advButton = document.querySelector('#chrome-subtitles-adjust-advance');
    var resetButton = document.querySelector('#chrome-subtitles-adjust-reset');
    var syncButton = document.querySelector('#chrome-subtitles-click-to-play');
    var wrapForm = document.querySelector('#chrome-subtitles-form');

    // global
    playTimeBox = document.querySelector('#chrome-subtitles-play-time');

    playButton.addEventListener('click', function() {
      if (status == 'ready' || status == 'pause') {
        play();
      } else {
        pause();
      }
    });
    delayButton.addEventListener('click', function() {
      delayMs += 100;
      console.log(delayMs + 'ms delay');
    });
    advButton.addEventListener('click', function() {
      delayMs -= 100;
      console.log(delayMs + 'ms delay');
    });
    resetButton.addEventListener('click', function() {
      delayMs = 0;
      console.log('no delay');
    });
    syncButton.addEventListener('click', function() {
      if (syncButton.className.indexOf('active') == -1) {
        syncButton.className += ' active';
        playerObject.addEventListener('mouseup', togglePlayPause);
      } else {
        syncButton.className = syncButton.className.replace(/\s?active/, '');
        playerObject.removeEventListener('mouseup', togglePlayPause);
      }
    });
    wrapForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var time = playTimeBox.value.split(':');
      runningTime = time[0] * 60 * 1000 + time[1] * 1000;
      runningTime = Math.floor(runningTime / 10) * 10;
      status = 'pause';
      console.log('set ' + runningTime + ' ms');
      for (var i = 0; i < timeTableLength; i++) {
        if (runningTime <= timeTable[i].time) {
          eventIndex = i == 0 ? i : i - 1;
          break;
        }
      }
    });
  }

  //
  // styles
  //
  function appendStyles (styleObj) {
    var styleElem = document.createElement('style');
    document.querySelector('head').appendChild(styleElem);
    var css = styleElem.sheet || styleElem.styleSheet;

    var l, d, s;
    for (var className in styleObj) {
      l = [];
      d = styleObj[className];
      for (var k in d) {
        l.push(k + ':' + d[k] + ';');
      }
      s = '.' + className + ' .' + subsLineClass + ' {' + l.join('') + '}';
      css.insertRule(s, css.cssRules.length);
    }
  }
  function updateTimeBox() {
    var m, s;
    m = Math.floor(runningTime / 1000 / 60);
    m = m < 10 ? '0' + m : m;
    s = Math.floor(runningTime / 1000) % 60;
    s = s < 10 ? '0' + s : s;
    playTimeBox.value = m + ':' + s;
  }


  // 
  // add/remove texts
  // 
  function addText(obj) {
    var text, lines;
    text = document.createElement('div');
    text.className = subsWrapClass;
    text.id = obj.id;
    if (obj.className) text.className += ' ' + obj.className;
    lines = '<span class="' + subsLineClass + '">' +
      obj.texts.join('</span><br><span class="' + subsLineClass + '">') +
      '</span>';
    text.innerHTML = lines;
    subsRootElem.appendChild(text);
  }
  function removeText(obj) {
    var elem = document.getElementById(obj.id);
    if (elem) subsRootElem.removeChild(elem);
  }
  function removeAll() {
    if (subsRootElem) subsRootElem.innerHTML = null;
  }

  // 
  // playback control
  // 
  function mainLoop() {
    var time, target;

    currentTime = new Date();
    runningTime += currentTime - previousTime;
    previousTime = currentTime;
    updateTimeBox();

    time = Math.floor((runningTime - delayMs) / 100) * 100;
    target = timeTable[eventIndex];

    while(target && time > target.time) {
      removeText(target);
      console.info('id: ' + target.id + ' skipped');
      eventIndex += 1;
      target = timeTable[eventIndex];
    }
    while(target && time == target.time) {
      target.event == 'start' ? addText(target) : removeText(target);
      eventIndex += 1;
      target = timeTable[eventIndex];
    }
    if (eventIndex >= timeTableLength) {
      pause();
      status = 'ready';
      console.log('end');
    }
  }
  function start() {
    if (timeTable) {
      removeAll();
      runningTime = 0;
      eventIndex = 0;
      status = 'playing';
      toggleActive(document.querySelector('#chrome-subtitles-play'));
      console.log('start');
      previousTime = new Date();
      timerId = setInterval(mainLoop, 50);
    } else {
      console.warn('no subs');
    }
  }
  function pause() {
    if (status == 'playing') {
      clearInterval(timerId);
      status = 'pause';
      console.log('pause');
      console.log('running time(ms): ' + runningTime);
      toggleActive(document.querySelector('#chrome-subtitles-play'));
    }
  }
  function play() {
    if (status == 'ready') {
      start();
    }
    if (status == 'pause') {
      removeAll();
      if (timeTable) {
        status = 'playing';
        toggleActive(document.querySelector('#chrome-subtitles-play'));
        console.log('continue');
        previousTime = new Date();
        timerId = setInterval(mainLoop, 50);
      } else {
        console.warn('no subs');
      }
    }
  }
  function togglePlayPause() {
    if (status == 'ready' || status == 'pause') {
      play();
    } else {
      pause();
    }
  }

  // 
  // class
  // 
  function toggleActive(elem) {
    if (elem.className.indexOf('active') == -1) {
      elem.className += ' active';
      elem.value = '❙❙';
    } else {
      elem.className = elem.className.replace(/\s?active/, '');
      elem.value = '▶';
    }
  }

  // 
  // initialize
  // 
  function initialize() {
    var url = location.href;
    var root;
    var playerSelector, containerSelector;

    root = document.createElement('div');
    root.id = subsRootId;

    if (/^https?:\/\/www\.hulu\.jp/.test(url)) {
      playerSelector = 'embed#player';
      containerSelector = '#player-container';
    } else {
      playerSelector = '#player-object';
      containerSelector = 'body';
    }

    playerObject = document.querySelector(playerSelector);
    playerObject.setAttribute('wmode', 'transparent');
    playerContainer = document.querySelector(containerSelector);
    playerContainer.style.position = 'relative';
    playerContainer.appendChild(root);
    subsRootElem = document.querySelector('#' + subsRootId);
  }

  // 
  // do
  // 
  removeControllers();
  createUi();
  initialize();
})();
