(function() {
  var subsRootId = 'chrome-subtitles-root';
  var subsWrapClass = 'chrome-subtitles-wrap';
  var subsTextClass = 'chrome-subtitles-text';
  var subsLineClass = 'chrome-subtitles-line';
  var domain = location.href.match(/(?:http|file)s?:\/\/([a-z.]+)/)[1];

  var currentTimeBox;

  function main() {
    Controller.initialize();

    View.removeControllers();
    View.removeUi();
    View.createUi();

    Controller.addEventListenersForUi();
    View.removeAllSubs();
  }


  // 
  // Models
  // 
  var Model = {};

  Model.Subtitle = Subtitle;
  Model.assParser = SubtitleParser.assParser;
  Model.srtParser = SubtitleParser.srtParser;

  Model.initSubtitle = function() {
    Model.Subtitle.prototype.rootId = subsRootId;
    Model.Subtitle.prototype.wrapClassName = subsWrapClass,
    Model.Subtitle.prototype.textClassName = subsTextClass,
    Model.Subtitle.prototype.lineClassName = subsLineClass,
    Model.Subtitle.prototype.rootElement = document.getElementById(subsRootId);
  };

  Model.initPlayer = function(events) {
    Model.player = new SubtitlePlayer(events);
  };

  Model.setRootElementToSubtitle = function(elem) {
    Model.Subtitle.init({
      rootId: subsRootId,
      wrapClassName: subsWrapClass,
      textClassName: subsTextClass,
      lineClassName: subsLineClass,
      rootelement: document.getElementById(subsRootId)
    });
  };

  Model.setVideoPlayer = function() {
    var o, c;
    switch (domain) {
    case 'www.hulu.jp':
    case 'www.hulu.com':
      o = document.getElementById('player');
      c = document.getElementById('player-container');
      Model.videoPlayer = {
        object: o,
        container: c,
        play: o.resumeVideo,
        pause: function() {},
        seek: o.seekTo,
        getCurrentTime: function() {},
        getPlayerState: function() {}
      };
      break;
    case 'www.youtube.com':
      o = document.getElementById('movie_player');
      c = document.getElementById('player-api');
      Model.videoPlayer = {
        object: o,
        container: c,
        play: o.playVideo,
        pause: o.pauseVideo,
        seek: o.seekTo,
        getCurrentTime: o.getCurrentTime,
        getPlayerState: o.getPlayerState
      };
      break;
    default:
      o = document.getElementById('player-object');
      c = document.getElementById("player-container");
      Model.videoPlayer = {
        object: o,
        container: c,
        play: function() {},
        pause: function() {},
        seek: function() {},
        getCurrentTime: function() {},
        getPlayerState: function() {}
      };
    }
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
    Model.videoPlayer.container.appendChild(root);
  };

  View.modVideoPlayerObject = function() {
    Model.videoPlayer.object.setAttribute('wmode', 'transparent');
    Model.videoPlayer.container.style.position = 'relative';
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

    switch (Model.player.getPlayerState()) {
    case 'playing':
      elem.className += ' active';
      elem.value = '❙❙';
      elem.title = 'Pause';
      break;
    case 'ready':
    case 'pause':
      elem.className = elem.className.replace(/\s?active/, '');
      elem.value = '▶';
      elem.title = 'Play';
      break;
    }
  };

  View.updateTimeBox = function() {
    var m, s;
    var time = Model.player.getCurrentTime();
    m = Math.floor(time / 1000 / 60);
    m = m < 10 ? '0' + m : m;
    s = Math.floor(time / 1000) % 60;
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
    Model.setVideoPlayer();

    View.createSubsRoot();
    View.modVideoPlayerObject();

    Model.initSubtitle();
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

        Model.initPlayer(result.events);
        Controller.addListenerToPlayer();
        if (result.styles) {
          var css = Model.v4pToCss(result.styles);
          View.appendStyles(css);
        }
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
      switch (Model.player.getPlayerState()) {
      case 'ready':
      case 'pause':
        Model.player.play();
        Model.videoPlayer.play();
        break;
      case 'playing':
        Model.player.pause();
        Model.videoPlayer.pause();
        break;
      }
    });
    var delayButton = document.getElementById('chrome-subtitles-adjust-delay');
    delayButton.addEventListener('click', function() {
      var newDelay = Model.player.getDelay() + 100;
      Model.player.setDelay(newDelay);
      console.log(newDelay + 'ms delay');
    });
    var advButton = document.getElementById('chrome-subtitles-adjust-advance');
    advButton.addEventListener('click', function() {
      var newDelay = Model.player.getDelay() - 100;
      Model.palyer.setDelay(newDelay);
      console.log(newDelay + 'ms delay');
    });
    var resetButton = document.getElementById('chrome-subtitles-adjust-reset');
    resetButton.addEventListener('click', function() {
      Model.player.setDelay(0);
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

      Model.videoPlayer.seek(sec);
      
      if (domain === 'www.youtube.com')
        rtime = Model.videoPlayer.getCurrentTime() * 1000;

      Model.player.seekTo(rtime);
    });
  };

  Controller.addListenerToPlayer = function() {
    Model.player.addEventListener('onPlaying', View.updateTimeBox);
    Model.player.addEventListener('onStateChange', View.togglePausePlayButton);
  };

  Controller.addCtpListener = function() {
    Model.videoPlayer.object
      .addEventListener('mouseup', Controller.togglePausePlay);
  };

  Controller.removeCtpListener = function() {
    Model.videoPlayer.object
      .removeEventListener('mouseup', Controller.togglePausePlay);
  };

  Controller.togglePausePlay = function() {
    switch (Model.player.getPlayerState()) {
    case 'ready':
    case 'pause':
      Model.player.play();
      break;
    case 'playing':
      Model.player.pause();
      break;
    }
  };

  Controller.togglePausePlayVideo = function() {
    switch (Model.videoPlayer.getPlayerState()){
    case 1:
      Model.videoPlayer.pause();
      break;
    default:
      Model.videoPlayer.play();
    }
  };

  // 
  // main
  // 
  main();

})();
