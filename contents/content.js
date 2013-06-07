(function() {
  var parser = new SubtitleParser();
  var domain = location.href.match(/(?:http|file)s?:\/\/([a-z.]+)/)[1];
  var subsRootId = 'chrome-subtitles-root';
  var subsWrapClass = 'chrome-subtitles-wrap';
  var subsTextClass = 'chrome-subtitles-text';
  var subsLineClass = 'chrome-subtitles-line';

  // global variables
  var subsRootElem;
  var timerId;
  var timeTable;
  var timeTableLength;
  var currentTime;
  var previousTime;
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
    ctrlForm.appendChild(ctrlPlay);

    if (domain == 'www.hulu.jp' || domain == 'www.hulu.com') {
      var ctrlClickToPlay = document.createElement('input');
      ctrlClickToPlay.id = 'chrome-subtitles-click-to-play';
      ctrlClickToPlay.type = 'button';
      ctrlClickToPlay.value = '...';
      ctrlForm.appendChild(ctrlClickToPlay);
    }

    var ctrlPlayTime = document.createElement('input');
    ctrlPlayTime.id = 'chrome-subtitles-play-time';
    ctrlPlayTime.type = 'text';
    ctrlPlayTime.value = '00:00';
    ctrlForm.appendChild(ctrlPlayTime);

    var ctrlAdvance = document.createElement('input');
    ctrlAdvance.id = 'chrome-subtitles-adjust-advance';
    ctrlAdvance.type = 'button';
    ctrlAdvance.value = '-';
    ctrlForm.appendChild(ctrlAdvance);
    var ctrlReset = document.createElement('input');
    ctrlReset.id = 'chrome-subtitles-adjust-reset';
    ctrlReset.type = 'button';
    ctrlReset.value = '=';
    ctrlForm.appendChild(ctrlReset);
    var ctrlDelay = document.createElement('input');
    ctrlDelay.id = 'chrome-subtitles-adjust-delay';
    ctrlDelay.type = 'button';
    ctrlDelay.value = '+';
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
    // global
    playTimeBox = document.querySelector('#chrome-subtitles-play-time');

    var playButton = document.querySelector('#chrome-subtitles-play');
    playButton.addEventListener('click', function() {
      if (status == 'ready' || status == 'pause') {
        play();
        playVideo();
      } else {
        pause();
        pauseVideo();
      }
    });
    var delayButton = document.querySelector('#chrome-subtitles-adjust-delay');
    delayButton.addEventListener('click', function() {
      delayMs += 100;
      console.log(delayMs + 'ms delay');
    });
    var advButton = document.querySelector('#chrome-subtitles-adjust-advance');
    advButton.addEventListener('click', function() {
      delayMs -= 100;
      console.log(delayMs + 'ms delay');
    });
    var resetButton = document.querySelector('#chrome-subtitles-adjust-reset');
    resetButton.addEventListener('click', function() {
      delayMs = 0;
      console.log('no delay');
    });

    if (domain == 'www.hulu.jp' || domain == 'www.hulu.com') {
      var syncButton = 
            document.querySelector('#chrome-subtitles-click-to-play');
      syncButton.addEventListener('click', function() {
        if (syncButton.className.indexOf('active') == -1) {
          syncButton.className += ' active';
          playerObject.addEventListener('mouseup', togglePlayPause);
        } else {
          syncButton.className = syncButton.className.replace(/\s?active/, '');
          playerObject.removeEventListener('mouseup', togglePlayPause);
        }
      });
    }

    var wrapForm = document.querySelector('#chrome-subtitles-form');
    wrapForm.addEventListener('submit', function(e) {
      var elem, t, sec;
      e.preventDefault();
      t = document.querySelector('#chrome-subtitles-play-time')
        .value.split(':').map(parseFloat);
      sec = t[0] * 60 + t[1];
      
      setSoughtTime(sec * 1000);
      if (domain == 'www.hulu.jp' || domain == 'www.hulu.com') huluSeek(sec);
    });
  }
  function setSoughtTime(ms) {
    runningTime = ms;
    status = 'pause';
    console.log('set ' + runningTime + ' ms');
    for (var i = 0; i < timeTableLength; i++) {
      if (runningTime <= timeTable[i].time) {
        eventIndex = i == 0 ? i : i - 1;
        break;
      }
    }
  }
  function toggleYoutubePlay() {
    var state = playerObject.getPlayerState();
    if (state == 1) {
      playerObject.pauseVideo();
    } else {
      playerObject.playVideo();
    }
  }

  // 
  // dom
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
        if (k == 'background-color') continue;
        l.push(k + ':' + d[k] + ';');
      }
      s = '.' + className + ' {' + l.join('') + '}';
      css.insertRule(s, css.cssRules.length);
      s = '.' + className + ' .' + subsLineClass + ' {background-color: ' + 
        d['background-color'] + ';}';
      css.insertRule(s, css.cssRules.length);
    }
  }
  function toggleActive() {
    var elem = document.querySelector('#chrome-subtitles-play');
    if (elem.className.indexOf('active') == -1) {
      elem.className += ' active';
      elem.value = '❙❙';
    } else {
      elem.className = elem.className.replace(/\s?active/, '');
      elem.value = '▶';
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
  function addText(obj) {
    var wrap, text, lines;
    wrap = document.createElement('div');
    wrap.className = subsWrapClass;
    wrap.id = obj.id;
    if (wrap.className) wrap.className += ' ' + obj.className;
    text = document.createElement('div');
    text.className = subsTextClass;
    lines = '<span class="' + subsLineClass + '">' + 
      obj.texts.join('</span><br><span class="' + subsLineClass + '">') + 
      '</span>';
    text.innerHTML = lines;
    wrap.appendChild(text);
    subsRootElem.appendChild(wrap);
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
  function play() {
    removeAll();
    if (status == 'ready') {
      runningTime = 0;
      eventIndex = 0;
    }
    if (timeTable) {
      status = 'playing';
      toggleActive();
      console.log('play');
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
      toggleActive();
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
  // video control
  // 
  function playVideo() {
    if (domain == 'www.hulu.jp' || domain == 'www.hulu.com') {
      huluPlay();
    } else if (domain == 'www.youtube.com') {
      youtubePlay();
    }
  }
  function pauseVideo() {
    if (domain == 'www.youtube.com') {
      youtubePause();
    }
  }
  function huluPlay() {
    playerObject.resumeVideo();
  }
  function huluSeek(sec) {
    playerObject.seekVideo(sec);
  }
  function youtubePlay() {
    playerObject.playVideo();
  }
  function youtubePause() {
    playerObject.pauseVideo();
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

    if (domain == 'www.hulu.jp' || domain == 'www.hulu.com') {
      playerSelector = '#player';
      containerSelector = '#player-container';
    } else if (domain == 'www.youtube.com') {
      playerSelector = '#movie_player';
      containerSelector = '#player-api';
    } else {
      playerSelector = '#player-object';
      containerSelector = '#player-container';
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
  if (timerId) clearInterval(timerId);
  removeAll();
})();
