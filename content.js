(function() {
  var parser = new SubtitleParser();
  var rootId = 'chrome-subtitles-root';
  var wrapClass = 'chrome-subtitles-text';
  var lineClass = 'chrome-subtitles-line';

  // global variables
  var subtitlesRoot;
  var timerId;
  var initialTime;
  var timeTable;
  var timeTableLength;
  var playerObj;
  var playerContainer;
  var count = 0;
  var runningTime = 0;
  var adjustMs = 0;
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
    // var uiInputStart = document.createElement('input');
    // uiInputStart.id = 'chrome-subtitles-ui-start-button';
    // uiInputStart.type = 'button';
    // uiInputStart.value = 'Start';

    uiBody.appendChild(uiInputFile);
    // uiBody.appendChild(uiInputStart);
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

    var ctrlPlay = document.createElement('input');
    ctrlPlay.id = 'chrome-subtitles-play';
    ctrlPlay.type = 'button';
    ctrlPlay.value = '▶';
    var ctrlPause = document.createElement('input');
    ctrlPause.id = 'chrome-subtitles-pause';
    ctrlPause.type = 'button';
    ctrlPause.value = '❙❙';

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
    ctrlReset.value = '0';

    var ctrlClickToPlay = document.createElement('input');
    ctrlClickToPlay.id = 'chrome-subtitles-click-to-play';
    ctrlClickToPlay.type = 'button';
    ctrlClickToPlay.value = 'Sync';
    
    ctrlWrap.appendChild(ctrlPlay);
    ctrlWrap.appendChild(ctrlPause);
    ctrlWrap.appendChild(ctrlAdvance);
    ctrlWrap.appendChild(ctrlReset);
    ctrlWrap.appendChild(ctrlDelay);
    ctrlWrap.appendChild(ctrlClickToPlay);
    document.body.appendChild(ctrlWrap);

    addEventListenersForControllers();
  }
  function removeControllers() {
    var ctrlObj = document.querySelector('#chrome-subtitles-controllers');
    if (ctrlObj) document.body.removeChild(ctrlObj);
  }
  function addEventListenersForControllers() {
    var play = document.querySelector('#chrome-subtitles-play');
    var pause = document.querySelector('#chrome-subtitles-pause');
    var delay = document.querySelector('#chrome-subtitles-adjust-delay');
    var advance = document.querySelector('#chrome-subtitles-adjust-advance');
    var reset = document.querySelector('#chrome-subtitles-adjust-reset');
    var syncPlay = 
          document.querySelector('#chrome-subtitles-click-to-play');

    play.addEventListener('click', resume);
    pause.addEventListener('click', stop);
    delay.addEventListener('click', function() {
      adjustMs += 100;
      console.log(adjustMs + 'ms delay');
    });
    advance.addEventListener('click', function() {
      adjustMs -= 100;
      console.log(adjustMs + 'ms delay');
    });
    reset.addEventListener('click', function() {
      adjustMs = 0;
      console.log('no delay');
    });
    syncPlay.addEventListener('click', function() {
      if (syncPlay.className.indexOf('active') == -1) {
        syncPlay.className += ' active';
        playerObj.addEventListener('mouseup', togglePlayPause);
      } else {
        syncPlay.className = syncPlay.className.replace(/\s?active/, '');
        playerObj.removeEventListener('mouseup', togglePlayPause);
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
      s = '.' + className + ' .' + lineClass + ' {' + l.join('') + '}';
      css.insertRule(s, css.cssRules.length);
    }
  }


  // 
  // add/remove texts
  // 
  function addText(obj) {
    var text, lines;
    text = document.createElement('div');
    text.className = wrapClass;
    text.id = obj.id;
    if (obj.className) text.className += ' ' + obj.className;
    lines = '<span class="' + lineClass + '">' +
      obj.texts.join('</span><br><span class="' + lineClass + '">') +
      '</span>';
    text.innerHTML = lines;
    subtitlesRoot.appendChild(text);
  }
  function removeText(obj) {
    var elem = document.getElementById(obj.id);
    if (elem) subtitlesRoot.removeChild(elem);
  }
  function removeAll() {
    if (subtitlesRoot) subtitlesRoot.innerHTML = null;
  }

  // 
  // playback control
  // 
  function mainLoop() {
    var time, target;
    time = new Date() - initialTime - adjustMs + runningTime;
    time = time / 100;
    time = Math.round(time);
    time = time * 100;
    target = timeTable[count];
    if (time == target.time) {
      target.event == 'start' ? addText(target) : removeText(target);
      count += 1;
    } else if (time > target.time) {
      removeText(target);
      console.info('id: ' + target.id + ' skipped');
      count += 1;
    }
    if (count >= timeTableLength) {
      stop();
      status = 'ready';
      console.log('end');
    }
  }
  function start() {
    if (timeTable) {
      removeAll();
      runningTime = 0;
      initialTime = new Date();
      count = 0;
      timerId = setInterval(mainLoop, 10);
      status = 'playing';
      toggleActive(document.querySelector('#chrome-subtitles-play'));
      console.log('start');
    } else {
      console.warn('no subs');
    }
  }
  function stop() {
    if (status == 'playing') {
      runningTime += new Date() - initialTime;
      clearInterval(timerId);
      status = 'stop';
      console.log('stop');
      console.log('running time(ms): ' + runningTime);
      toggleActive(document.querySelector('#chrome-subtitles-play'));
    }
  }
  function resume() {
    if (status == 'ready') {
      start();
    }
    if (status == 'stop') {
      initialTime = new Date();
      if (timeTable) {
        timerId = setInterval(mainLoop, 10);
        status = 'playing';
        toggleActive(document.querySelector('#chrome-subtitles-play'));
        console.log('continue');
      } else {
        console.warn('no subs');
      }
    }
  }
  function togglePlayPause() {
    if (status == 'ready' || status == 'stop') {
      resume();
    } else {
      stop();
    }
  }

  // 
  // class
  // 
  function toggleActive(elem) {
    if (elem.className.indexOf('active') == -1) {
      elem.className += ' active';
    } else {
      elem.className = elem.className.replace(/\s?active/, '');
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
    root.id = rootId;

    if (/^https?:\/\/www\.hulu\.jp/.test(url)) {
      playerSelector = 'embed#player';
      containerSelector = '#player-container';
    } else {
      playerSelector = '#player-object';
      containerSelector = 'body';
    }

    playerObj = document.querySelector(playerSelector);
    playerObj.setAttribute('wmode', 'transparent');
    playerContainer = document.querySelector(containerSelector);
    playerContainer.style.position = 'relative';
    playerContainer.appendChild(root);
    subtitlesRoot = document.querySelector('#' + rootId);
  }

  // 
  // do
  // 
  removeControllers();
  createUi();
  initialize();
})();
