(function() {
  chrome.tabs.onUpdated.addListener(function(tabid, inf, tab) {
    if (inf.status === 'complete') {
      var rs = [
        /^file:\/\//,
        /^https?:\/\/www\.youtube\.com\/watch/,
        /^https?:\/\/www\.hulu\.(jp|com)\/watch\//
      ];
      for (var i = 0; i < rs.length; i++) {
        if (rs[i].test(tab.url)) {
          chrome.pageAction.show(tabid);
          break;
        }
      }
    }
  });
  chrome.pageAction.onClicked.addListener(function(tab) {
    chrome.tabs.insertCSS(null, {file: "content.css"});
    chrome.tabs.executeScript(null, {file: "parser.js"});
    chrome.tabs.executeScript(null, {file: "content.js"});
  });

})();
