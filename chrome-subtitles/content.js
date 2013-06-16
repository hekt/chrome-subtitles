(function() {
  var subsRootId = 'chrome-subtitles-root';
  var subsWrapClass = 'chrome-subtitles-wrap';
  var subsTextClass = 'chrome-subtitles-text';
  var subsLineClass = 'chrome-subtitles-line';
  var domain = location.href.match(/(?:http|file)s?:\/\/([a-z.]+)/)[1];

  var timerId;
  var timeTable;
  var timeTableLength;
  var currentTime;
  var previousTime;
  var playerObject;
  var playerContainer;
  var currentTimeBox;

  var eventIndex;
  var runningTime;
  var delayMs;
  var status;


  function main() {
    Controller.initialize();

    View.removeControllers();
    View.removeUi();
    View.createUi();

    Controller.addEventListenersForUi();
    
    if (timerId) clearInterval(timerId);
    View.removeAllSubs();
  }


  // 
  // Models
  // 
  var Model = {};

  Model.Subtitle = function(start, end ,texts, id, opt_className) {
    this.start = start;
    this.end = end;
    this.texts = texts;
    this.id = id;
    if (opt_className) this.className = opt_className;
  };
  Model.Subtitle.prototype = {
    rootId: subsRootId,
    wrapClassName: subsWrapClass,
    textClassName: subsTextClass,
    lineClassName: subsLineClass,
    rootElement: document.body,
    action: function() {
      var wrap, text, lines;
      wrap = document.createElement('div');
      wrap.className = this.wrapClassName;
      wrap.id = this.id;
      if (this.className) wrap.className += ' ' + this.className;
      text = document.createElement('div');
      text.className = this.textClassName;
      lines = '<span class="' + this.lineClassName + '">' +
        this.texts.join('</span><br><span class="' + this.lineClassName + 
                        '">') +'</span>';
      text.innerHTML = lines;
      wrap.appendChild(text);
      this.rootElement.appendChild(wrap);
      setTimeout(function(p, c) { if (c) p.removeChild(c); },
                 this.end - this.start,
                 this.rootElement, wrap);
    }
  };

  Model.setRootElementToSubtitle = function(elem) {
    Model.Subtitle.prototype.rootElement = elem;
  };

  Model.setPlayerObject = function() {
    var playerId;

    switch (domain) {
    case 'www.hulu.jp':
    case 'www.hulu.com':
      playerId = 'player';
      break;
    case 'www.youtube.com':
      playerId = 'movie_player';
      break;
    default:
      playerId = 'player-object';
    }

    playerObject = document.getElementById(playerId);
  };

  Model.setPlayerContainerObject = function() {
    var containerId;

    switch (domain) {
    case 'www.hulu.jp':
    case 'www.hulu.com':
      containerId = 'player-container';
      break;
    case 'www.youtube.com':
      containerId = 'player-api';
      break;
    default:
      containerId = 'player-container';
    }

    playerContainer = document.getElementById(containerId);
  };

  Model.assParser = function(content) {
    return SubtitleParser().assParser(content);
  };

  Model.srtParser = function(content) {
    return SubtitleParser().srtParser(content);
  };

  Model.setTimeTable = function(events) {
    var table = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      table.push(new Model.Subtitle(e.start, e.end, e.texts, 
                                    e.id, e.className));
    }
    timeTable = table;
    timeTableLength = timeTable.length;
  };

  Model.v4pToCss = function(styles) {
    var css = {};

    for (var i=0; i < styles.length; i++) {
      var s = styles[i];
      
      // text-decorations: Underline, StrikeOut
      var decorations;
      var decoList = [];
      if (s['Underline'] === '1') decoList.push('underline');
      if (s['StrikeOut'] === '1') decoList.push('line-through');
      decorations = (decoList.length > 0) ? decoList.join(' ') : 'none';

      // text-shadow: Outline
      var outline = ['1px 1px', '1px -1px', '-1px 1px', '-1px -1px']
        .map(function(e) {
          return e + ' ' + Model.toRGBA(s['OutlineColour']);
        }).join(', ');

      // text-align, top/bottom: Alignment
      var align;
      switch (s['Alignment'] % 3) {
      case 0:
        align = 'right';
        break;
      case 1:
        align = 'left';
        break;
      case 2:
        align = 'center';
        break;
      }

      var posTop = 'auto';
      var posBottom = 'auto';
      switch (Math.ceil(s['Alignment'] / 3)) {
      case 1:
        posBottom = '5%';
        break;
      case 2:
        posTop = '50%';
        break;
      case 3:
        posTop = '5%';
        break;
      }

      var wrapSelector = '.' + s['Name'];
      var wrapStyles = {
        'color': Model.toRGBA(s['PrimaryColour']),
        'font-family': s['Fontname'],
        'font-weight': s['Bold'] === '1' ? 'bold' : 'normal',
        'font-style': s['Italic'] === '1' ? 'italic' : 'normal',
        'text-align': align,
        'text-decoration': decorations,
        'text-shadow': outline,
        'text-spacing': s['Spacing'] + ' px',
        'top': posTop,
        'bottom': posBottom
      };

      var lineSelector = wrapSelector + ' ' + subsLineClass;
      var lineStyles = {
        'background-color': Model.toRGBA(s['BackColour'])
      };

      css[wrapSelector] = wrapStyles;
      css[lineSelector] = lineStyles;
    }

    return css;
  };

  Model.delay = function(ms) {
    delayMs += ms;
  };
  
  Model.resetDelay = function() {
    delayMs = 0;
  };

  Model.updateRunningTime = function(ms) {
    runningTime = ms;
  };

  Model.updateEventIndex = function() {
    for (var i = 0; i < timeTableLength; i++) {
      if (runningTime === timeTable[i].start) {
        eventIndex = i;
        break;
      } else if (runningTime < timeTable[i].start) {
        eventIndex = i === 0 ? i : i - 1;
        break;
      }
    }
  };

  Model.initRunningTime = function() {
    runningTime = 0;
  };

  Model.initEventIndex = function() {
    eventIndex = 0;
  };

  Model.updateStatus = function(st) {
    status = st;
  };

  Model.toRGBA = function(str) {
    var r, g, b, a;
    
    if (str.length === 10) {
      a = 1 - parseInt(str.substring(2,4), 16) / 256;
      r = parseInt(str.substring(4,6), 16);
      g = parseInt(str.substring(6,8), 16);
      b = parseInt(str.substring(8,10), 16);
      return 'rgba(' + [r,g,b,a].join(', ') + ')';
    } else {
      r = parseInt(str.substring(2,4), 16);
      g = parseInt(str.substring(4,6), 16);
      b = parseInt(str.substring(6,8), 16);
      return 'rgb(' + [r,g,b].join(', ') + ')';
    }
  };

  Model.getExtension = function(str) {
    return str.replace(/.*\.([a-z0-9])/i, '$1');
  };

  //
  // Views
  //
  var View = {};

  View.createSubsRoot = function() {
    var root = document.createElement('div');
    root.id = subsRootId;
    playerContainer.appendChild(root);
  };

  View.modPlayerObject = function() {
    playerObject.setAttribute('wmode', 'transparent');
  };

  View.modPlayerContainer = function() {
    playerContainer.style.position = 'relative';
  };

  View.createUi = function() {
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
  };
  
  View.removeUi = function() {
    var uiObj = document.getElementById("chrome-subtitles-ui-wrap");
    if (!uiObj) return false;
    document.body.removeChild(uiObj);
    return true;
  };

  View.createControllers = function() {
    var ctrlWrap = document.createElement('div');
    ctrlWrap.id = 'chrome-subtitles-controllers';

    var ctrlForm = document.createElement('form');
    ctrlForm.id = 'chrome-subtitles-form';

    var ctrlPlay = document.createElement('input');
    ctrlPlay.id = 'chrome-subtitles-play';
    ctrlPlay.type = 'button';
    ctrlPlay.value = '▶';
    ctrlPlay.title = 'Play';
    ctrlForm.appendChild(ctrlPlay);

    if (domain === 'www.hulu.jp' || domain === 'www.hulu.com') {
      var ctrlClickToPlay = document.createElement('input');
      ctrlClickToPlay.id = 'chrome-subtitles-click-to-play';
      ctrlClickToPlay.type = 'button';
      ctrlClickToPlay.value = '...';
      ctrlClickToPlay.title = 'Enable Click To Play';
      ctrlForm.appendChild(ctrlClickToPlay);
    }

    var ctrlPlayTime = document.createElement('input');
    ctrlPlayTime.id = 'chrome-subtitles-play-time';
    ctrlPlayTime.type = 'text';
    ctrlPlayTime.value = '00:00';
    ctrlPlayTime.title = 'Current Time';
    ctrlForm.appendChild(ctrlPlayTime);

    var ctrlAdvance = document.createElement('input');
    ctrlAdvance.id = 'chrome-subtitles-adjust-advance';
    ctrlAdvance.type = 'button';
    ctrlAdvance.value = '-';
    ctrlAdvance.title = 'Delay -100 ms';
    ctrlForm.appendChild(ctrlAdvance);
    var ctrlReset = document.createElement('input');
    ctrlReset.id = 'chrome-subtitles-adjust-reset';
    ctrlReset.type = 'button';
    ctrlReset.value = '=';
    ctrlReset.title = 'Reset Delay';
    ctrlForm.appendChild(ctrlReset);
    var ctrlDelay = document.createElement('input');
    ctrlDelay.id = 'chrome-subtitles-adjust-delay';
    ctrlDelay.type = 'button';
    ctrlDelay.value = '+';
    ctrlDelay.title = 'Delay + 100 ms';
    ctrlForm.appendChild(ctrlDelay);

    ctrlWrap.appendChild(ctrlForm);
    document.body.appendChild(ctrlWrap);
  };

  View.removeControllers = function() {
    var ctrlObj = document.getElementById('chrome-subtitles-controllers');
    if (!ctrlObj) return false;
    document.body.removeChild(ctrlObj);
    return true;
  };

  View.toggleCtpActive = function() {
    var elem = document.getElementById('chrome-subtitles-click-to-play');

    if (elem.className.indexOf('active') === -1) {
      elem.className += ' active';
      elem.title = 'Disable Click to Play';
      Controller.addCtpListener();
    } else {
      elem.className = elem.className.replace(/\s?active/, '');
      elem.title = 'Enable Click to Play';
      Controller.removeCtpListener();
    }
  };

  View.appendStyles = function(styles) {
    var styleElem = document.createElement('style');
    document.head.appendChild(styleElem);
    var css = styleElem.sheet || styleElem.styleSheet;

    for (var selector in styles) {
      var s = selector + ' {';
      var d = styles[selector];
      for (var k in d) {
        s += k +':' + d[k] + ';';
      }
      s += '}';
      css.insertRule(s, css.cssRules.length);
    }    
  };

  View.togglePausePlayButton = function() {
    var elem = document.getElementById('chrome-subtitles-play');
    if (elem.className.indexOf('active') === -1) {
      elem.className += ' active';
      elem.value = '❙❙';
      elem.title = 'Pause';
    } else {
      elem.className = elem.className.replace(/\s?active/, '');
      elem.value = '▶';
      elem.title = 'Play';
    }    
  };

  View.updateTimeBox = function() {
    var m, s;
    m = Math.floor(runningTime / 1000 / 60);
    m = m < 10 ? '0' + m : m;
    s = Math.floor(runningTime / 1000) % 60;
    s = s < 10 ? '0' + s : s;
    currentTimeBox.value = m + ':' + s;
  };

  View.removeAllSubs = function() {
    var elem = document.getElementById(subsRootId);
    if (elem) elem.innerHTML = null;
  };
  
  // 
  // Controllers
  // 
  var Controller = {};

  Controller.initialize = function() {
    Model.initRunningTime();
    Model.initEventIndex();
    Model.resetDelay();
    Model.updateStatus('init');

    Model.setPlayerObject();
    Model.setPlayerContainerObject();

    View.createSubsRoot();
    View.modPlayerObject();
    View.modPlayerContainer();
    
    Model.setRootElementToSubtitle(document.getElementById(subsRootId));
  };

  Controller.addEventListenersForUi = function() {
    var fileReciever = 
          document.getElementById('chrome-subtitles-ui-file-selector');
    fileReciever.addEventListener('change', function() {
      var file = fileReciever.files[0];
      var fname = file.name;
      var r = new FileReader();
      
      r.addEventListener('load', function(e) {
        var result;

        switch (Model.getExtension(fname).toLowerCase()) {
        case 'ass':
          result = Model.assParser(r.result);
          break;
        case 'srt':
          result = Model.srtParser(r.result);
          break;
        default:
          result = {'events': []};
        }

        Model.setTimeTable(result.events);
        if (result.styles) {
          var css = Model.v4pToCss(result.styles);
          View.appendStyles(css);
        }
        Model.updateStatus('ready');
      }, true);
      r.readAsText(file, 'UTF-8');

      View.removeUi();
      View.removeControllers();
      View.createControllers();
      Controller.addEventListenersForControllers();
    });
  };

  Controller.addEventListenersForControllers = function() {
    // global
    currentTimeBox = document.getElementById('chrome-subtitles-play-time');

    var playButton = document.getElementById('chrome-subtitles-play');
    playButton.addEventListener('click', function() {
      switch (status) {
      case 'ready':
      case 'pause':
        Controller.play();
        Controller.playVideo();
        break;
      case 'playing':
        Controller.pause();
        Controller.pauseVideo();
        break;
      }
    });
    var delayButton = document.getElementById('chrome-subtitles-adjust-delay');
    delayButton.addEventListener('click', function() {
      Model.delay(100);
      console.log(delayMs + 'ms delay');
    });
    var advButton = document.getElementById('chrome-subtitles-adjust-advance');
    advButton.addEventListener('click', function() {
      Model.delay(-100);
      console.log(delayMs + 'ms delay');
    });
    var resetButton = document.getElementById('chrome-subtitles-adjust-reset');
    resetButton.addEventListener('click', function() {
      Model.resetDelay();
      console.log('no delay');
    });

    if (domain === 'www.hulu.jp' || domain === 'www.hulu.com') {
      var syncButton = 
            document.getElementById('chrome-subtitles-click-to-play');
      syncButton.addEventListener('click', View.toggleCtpActive);
    }

    var wrapForm = document.getElementById('chrome-subtitles-form');
    wrapForm.addEventListener('submit', function(e) {
      var t, sec, rtime;
      e.preventDefault();
      t = document.getElementById('chrome-subtitles-play-time')
        .value.split(':').map(parseFloat);
      sec = t[0] * 60 + t[1];
      rtime = sec * 1000;

      switch (domain) {
      case 'www.hulu.jp':
      case 'www.hulu.com':
        Controller.hulu.seek(sec);
        break;
      case 'www.youtube.com':
        Controller.youtube.seek(sec);
        rtime = playerObject.getCurrentTime() * 1000;
        break;
      }

      Model.updateRunningTime(rtime);
      Model.updateEventIndex();
      Model.updateStatus('pause');
    });
  };

  Controller.addCtpListener = function() {
    playerObject.addEventListener('mouseup', Controller.togglePausePlay);
  };

  Controller.removeCtpListener = function() {
    playerObject.removeEventListener('mouseup', Controller.togglePausePlay);
  };

  Controller.mainLoop = function() {
    var time, target;

    currentTime = new Date();
    runningTime += currentTime - previousTime;
    previousTime = currentTime;
    View.updateTimeBox();

    time = Math.floor((runningTime - delayMs) / 100) * 100;
    target = timeTable[eventIndex];

    while(target && time >= target.start) {
      if (time > target.start) {
        console.info('id: ' + target.id + ' skipped');
      } else if (time === target.start) {
        target.action();
      }
      target = timeTable[++eventIndex];
    }
    if (!target) {
      Controller.pause();
      Model.updateStatus('ready');
      Model.initEventIndex();
    }
  };

  Controller.play = function() {
    if(!timeTable) return false;

    View.removeAllSubs();

    if (status === 'ready') {
      Model.initRunningTime();
      Model.initEventIndex();
    }

    Model.updateStatus('playing');
    View.togglePausePlayButton();
    console.log('play');
    previousTime = new Date();
    timerId = setInterval(Controller.mainLoop, 50);

    return true;
  };

  Controller.pause = function() {
    if (status != 'playing') return false;
    
    clearInterval(timerId);
    Model.updateStatus('pause');
    View.togglePausePlayButton();
    console.log('pause');
    console.log('running time(ms): ' + runningTime);

    return true;
  };

  Controller.togglePausePlay = function() {
    switch (status) {
    case 'ready':
    case 'pause':
      Controller.play();
      break;
    case 'playing':
      Controller.pause();
      break;
    }
  };

  Controller.playVideo = function() {
    switch (domain) {
    case 'www.hulu.jp':
    case 'www.hulu.com':
      Controller.hulu.play();
      break;
    case 'www.youtube.com':
      Controller.youtube.play();
      break;
    }
  };
  
  Controller.pauseVideo = function() {
    switch (domain) {
    case 'www.youtube.com':
      Controller.youtube.pause();
      break;
    }
  };

  // Youtube
  Controller.youtube = {};

  Controller.youtube.togglePausePlay = function() {
    switch (playerObject.getPlayerState()){
    case 1:
      playerObject.pauseVideo();
      break;
    default:
      playerObject.playVideo();
    }
  };
  
  Controller.youtube.play = function() {
    playerObject.playVideo();
  };

  Controller.youtube.pause = function() {
    playerObject.pauseVideo();
  };

  Controller.youtube.seek = function(sec) {
    playerObject.seekTo(sec);
  };

  // hulu
  Controller.hulu = {};

  Controller.hulu.play = function() {
    playerObject.resumeVideo();
  };

  Controller.hulu.seek = function(sec) {
    playerObject.seekVideo(sec);
  };


  // 
  // main
  // 
  main();

})();
