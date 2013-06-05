var SubtitleParser = function() {
  function strip(str) {
    return str.replace(/^\s*(.*?)\s*$/, '$1');
  }

  function sortByTime(a, b) {
    return (a.time > b.time) ? 1 : -1;
  }

  function stringToMilliseconds(str) {
    var times, h, m, s;
    times = str.split(':');
    h = parseFloat(times[0]) * 60 * 60 * 1000;
    m = parseFloat(times[1]) * 60 * 1000;
    s = Math.round(parseFloat(times[2]) * 10) * 100;
    return Math.floor(h + m + s);
  }

  function toWebHex(str) {
    return '#' + str.substring(4);
  }

  function toRGBA(str) {
    var r, g, b, a, colors;
    if (str.length == 10) {
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

    var line, values, times, id;
    var events = [];
    for (var i = 1; i < lines.length; i++) {
      line = lines[i].replace(/Dialogue:\s*/i, '');
      values = line.split(',').map(strip);
      times = values.slice(1,3).map(stringToMilliseconds);
      id = 'subtitle-' + values[1].replace(/[:\.]/g, '-');
      events.push({
        event: 'start',
        time: times[0],
        id: id,
        className: values[3].toLowerCase(),
        texts: values[9].split('\\N').filter(function (e) {
          return e != ''; }).map(removeAssInlineCommands)
      });
      events.push({
        event: 'end',
        time: times[1],
        id: id
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
        event: 'start',
        time: times[0],
        id: id,
        texts: texts
      });
      events.push({
        event: 'end',
        time: times[1],
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
    function getObjs(str) {
      var lines = str.split(/\r\n|\r|\n/g).filter(function (e) {
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

    var styleObjs = getObjs(blockContent);
    var deco, decos, outline, o, style;
    var outlineColourName = 'OutlineColour' in styleObjs[0] ?
          'OutlineColour' : 'TertiaryColour';

    var cssObj = {};
    for (var i = 0; i < styleObjs.length; i++) {
      o = styleObjs[i];
      
      decos = [];
      if (o['Underline'] == '1') decos.push('underline');
      if (o['StrikeOut'] == '1') decos.push('line-through');
      deco = decos == [] ? 'none' : decos.join(' ');

      outline = ['1px 1px', '1px -1px', '-1px 1px', '-1px -1px']
        .map(function (e) {
          return e + ' ' + toRGBA(o[outlineColourName]);
        }).join(', ');
      
      cssObj[o['Name'].toLowerCase()] = {
        'font-family': o['Fontname'],
        'color': toRGBA(o['PrimaryColour']),
        'text-shadow': outline,
        'background-color': toRGBA(o['BackColour']),
        'font-weight': o['Bold'] == '1' ? 'bold' : 'normal',
        'font-style': o['Italic'] == '1' ? 'italic' : 'normal',
        'text-decoration': deco,
        'text-spacing': o['Spacing'] + ' px'
      };
    }

    return cssObj;
  }

  this.assParser = function(fileContent) {
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

  this.srtParser = function(fileContent) {
    var reStr = 
          '([0-9]+)' + '(?:\\r\\n|\\n\\r|\\r|\\n)' +
          '(' + 
          '[0-9:,]+' + '\\s-->\\s' + '[0-9:,]+' +
          '(?:\\r\\n|\\n\\r|\\r|\\n)' +
          '(?:' + '.+' + '(?:\\r\\n|\\n\\r|\\r|\\n)' + ')+' + 
          ')';
    var eventBlocks =  getBlocks(reStr, fileContent);
    var events = srtEventsParser(eventBlocks);
    return {events: events};
  };

  return this;
};
