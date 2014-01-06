// SubtitleParser, Subtitle, SubtitlePlayer

var SubtitleParser = (function() {
  return {
    assParser: assParser,
    srtParser: srtParser
  };

  function assParser(fileContent) {
    var reStr = 
          '\\[(.+)\\]' + '(?:\\r\\n|\\n\\r|\\r|\\n)' +
          '((?:' + '[^\[]+' + '(?:\\r\\n|\\n\\r|\\r|\\n)+' + ')+)';
    var blocks = getBlocks(reStr, fileContent);

    // events
    var eventsBlock = blocks['Events'];
    var events = assEventsParser(eventsBlock);
    // styles
    var stylesBlock = blocks['V4+ Styles'] || blocks["V4 Styles"];
    var styles = assStylesParser(stylesBlock);

    return {'events': events, 'styles': styles};
  };

  function srtParser(fileContent) {
    var reStr = 
          '([0-9]+)' + '(?:\\r\\n|\\n\\r|\\r|\\n)' +
          '(' + 
          '[0-9:,]+' + '\\s-->\\s' + '[0-9:,]+' +
          '(?:\\r\\n|\\n\\r|\\r|\\n)' +
          '(?:' + '.+' + '(?:\\r\\n|\\n\\r|\\r|\\n)' + ')+' + 
          ')';
    var eventBlocks =  getBlocks(reStr, fileContent);
    var events = srtEventsParser(eventBlocks);
    return {'events': events};
  };


  function strip(str) {
    return str.replace(/^\s*(.*?)\s*$/, '$1');
  }

  function sortByTime(a, b) {
    return (a.start > b.start) ? 1 : -1;
  }

  function stringToMilliseconds(str) {
    var times, h, m, s;
    times = str.split(':');
    h = parseFloat(times[0]) * 60 * 60 * 1000;
    m = parseFloat(times[1]) * 60 * 1000;
    s = Math.round(parseFloat(times[2]) * 10) * 100;
    return Math.floor(h + m + s);
  }

  function removeAssInlineCommands(str) {
    return str.replace(/{\\[^}]+}/g, '');
  }

  function getBlocks(reStr, string) {
    var result = {};
    var r = new RegExp(reStr, 'g');
    var m = r.exec(string);
    while (m) {
      result[m[1]] = m[2];
      m = r.exec(string);
    }
    return result;
  }

  function assEventsParser(blockContent) {
    var lines = blockContent.split(/\r\n|\r|\n/g).filter(function (e) {
      return e != '';
    });

    var line, values, times, texts, id, className;
    var events = [];
    for (var i = 1; i < lines.length; i++) {
      line = lines[i].replace(/Dialogue:\s*/i, '');
      values = line.split(',').map(strip);
      times = values.slice(1,3).map(stringToMilliseconds);
      texts = values[9].split('\\N').filter(function(e) {
        return e != ''; }).map(removeAssInlineCommands);
      id = 'subtitle-' + values[1].replace(/[:\.]/g, '-');
      className = values[3].toLowerCase();
      events.push({
        start: times[0], 
        end: times[1],
        texts: texts,
        id: id,
        className: className
      });
    }
    
    events.sort(sortByTime);
    return events;
  }

  function srtEventsParser(blocks) {
    var lines, timeStrs, times, id, texts;
    var events = [];
    for (var k in blocks) {
      lines = blocks[k].split(/\r\n|\r|\n/g);
      timeStrs = lines[0].replace(',', '.').split(" --> ").map(strip);
      times = timeStrs.map(stringToMilliseconds);
      texts = lines.slice(1).map(strip).filter(function(e) {
        return e != '';
      });
      id = 'subtitle-' + timeStrs[0].replace(/[:,]/g, '-');
      events.push({
        start: times[0],
        end: times[1],
        texts: texts,
        id: id
      });
    }
    events.sort(sortByTime);
    return events;
  }

  function assStylesParser(blockContent) {
    function getValues(str) {
      return str.replace(/^[a-z]+\s*:\s*/i, '').split(',').map(strip);
    }
    var lines = blockContent.split(/\r\n|\r|\n/g).filter(function (e) {
      return e != '';
    });
    var keys = getValues(lines[0]);
    
    var styles = [];
    var values, d;
    for (var i = 1; i < lines.length; i++) {
      d = {};
      values = getValues(lines[i]);
      for (var j = 0; j < keys.length; j++) {
        d[keys[j]] = values[j];
      }
      styles.push(d);
    }
    return styles;
  }
})();


var Subtitle = function(start, end ,texts, id, opt_className) {
  this.start = start;
  this.end = end;
  this.texts = texts;
  this.id = id;
  this.className = opt_className || undefined;
};
Subtitle.prototype = {
  rootId: 'subtitle-root',
  wrapClassName: 'subtitle-wrap',
  textClassName: 'subtitle-text',
  lineClassName: 'subtitle-line',
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
      this.texts.join('</span><br><span class="' + this.lineClassName + '">') 
      + '</span>';
    text.innerHTML = lines;
    wrap.appendChild(text);
    this.rootElement.appendChild(wrap);
    setTimeout(function(p, c) { if (c) p.removeChild(c); },
               this.end - this.start,
               this.rootElement, wrap);
  }
};


var SubtitlePlayer = function(rawEvents) {
  var state = 'ready';
  var events = buildEventsTable(rawEvents);
  var idx = 0;
  var delay = 0;
  var timerId;
  var oldTime;
  var currentTime = 0;
  var listeners = {
    'onStateChange': [],
    'onPlaying': []
  };

  this.play = play;
  this.pause = pause;
  this.stop = stop;
  this.seekTo = seekTo;
  this.reset = reset;
  this.getCurrentTime = getCurrentTime;
  this.getDelay = getDelay;
  this.setDelay = setDelay;
  this.getPlayerState = getPlayerState;
  this.addEventListener = addEventListener;
  this.removeEventListener = removeEventListener;


  // public methods

  function play() {
    oldTime = new Date();
    timerId = setInterval(loop, 50);
    updateState('playing');
  }

  function pause() {
    clearInterval(timerId);
    updateState('pause');
  }

  function stop() {
    reset();
    clearInterval(timerId);
    updateState('ready');
  }

  function reset() {
    idx = 0;
    currentTime = 0;
  }

  function seekTo(ms) {
    currentTime = ms;
    for (var i = 0; i < events.length; i++) {
      if (currentTime === events[i].start) {
        idx = 1;
        break;
      } else if (currentTime < events[i].start) {
        idx = i === 0 ? i : i - 1;
        break;
      }
    }
    updateState('pause');
  }

  function getPlayerState() {
    return state;
  }

  function getCurrentTime() {
    return currentTime;
  }

  function getDelay() {
    return delay;
  }

  function setDelay(ms) {
    delay = ms;
  }

  function addEventListener(event, listener) {
    listeners[event].push(listener);
  }

  function removeEventListener(event, listener) {
    var ls = listeners[event];
    for (var i = 0; i < ls.length; i++) {
      if (ls[i] === listener) {
        ls.splice(i, 1);
        break;
      }
    }
  }


  // private methods

  function loop() {
    var time, event;
    var newTime = new Date();
    currentTime += newTime - oldTime;
    oldTime = newTime;

    time = Math.floor((currentTime - delay) / 100) * 100;
    event = events[idx];

    while (event && time >= event.start) {
      if (time == event.start) event.action();
      event = events[++idx];
    }

    var ls = listeners['onPlaying'];
    for (var i = 0; i < ls.length; i++) {
      ls[i]();
    }

    if (!event) stop();
  }

  function updateState(newState) {
    if (state === newState) return false;

    state = newState;
    var ls = listeners['onStateChange'];
    for (var i = 0; i < ls.length; i++) {
      ls[i]();
    }
    return true;
  }

  function buildEventsTable(es) {
    var table = [];
    for (var i = 0; i < es.length; i++) {
      var e = es[i];
      table.push(new Subtitle(e.start, e.end, e.texts, e.id, e.className));
    }
    return table;
  }
};
