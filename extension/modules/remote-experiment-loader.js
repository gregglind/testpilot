
function PreferencesStore(prefName) {
  var prefs = require("preferences-service");

  this.get = function get() {
    return JSON.parse(prefs.get(prefName, "{}"));
  };

  this.set = function set(newStore) {
    prefs.set(prefName, JSON.stringify(newStore));
  };

  this.setFile = function setFile(filename, contents) {
    var data = this.get();
    if (!("fs" in data))
      data.fs = {};
    data.fs[filename] = contents;
    this.set(data);
  };

  this.resolveModule = function resolveModule(root, path) {
    let data = this.get();
    let fs = data["fs"] || {};
    if ((path+".js") in fs)
      return path;
    return null;
  };

  this.getFile = function(path) {
    let data = this.get();
    let fs = data["fs"] || {};
    return {contents: fs[path]};
  };
}

function downloadFile(url, cb) {
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance( Ci.nsIXMLHttpRequest );
  req.open('GET', url, true);
  req.onreadystatechange = function(aEvt) {
    if (req.readyState == 4) {
      if (req.status == 200) {
	cb(req.responseText);
      } else {
	cb(null);
      }
    }
  };
  req.send();
}

const BASE_URL = "https://testpilot.mozillalabs.com/testcases/";
var Cuddlefish = require("cuddlefish");
var SecurableModule = require("securable-module");
// example contents of extensions.testpilot.experiment.codeFs:
// {'fs': {"bookmark01/experiment": "<plain-text code @ bookmarks.js>"}}
// sample code
    // example data:
    // {'experiments': [{'name': 'Bookmark Experiment',
    //                           'filename': 'bookmarks.js'}]}

exports.RemoteExperimentLoader = function() {
  this._init();
};

exports.RemoteExperimentLoader.prototype = {

  _init: function() {
    this._codeStorage = new PreferencesStore("extensions.testpilot.experiment.codeFs");
    this._remoteExperiments = {};
    let self = this;

    // Load up anything already stored in codeStorage...
    let experimentsJson = this._codeStorage.get();
    dump("In remoteExperimentLoader, self._codeStorage is " + self._codeStorage + "\n");
    // Use a composite file system here, compositing codeStorage and a new
    // local file system so that securable modules loaded remotely can
    // themselves require modules in the cuddlefish lib.
    this._loader = Cuddlefish.Loader(
      {fs: new SecurableModule.CompositeFileSystem(
         [self._codeStorage,
          new SecurableModule.LocalFileSystem("resource://testpilot/modules/lib/")])
      });
    for (let filename in experimentsJson.fs) {
      this._remoteExperiments[filename] = loader.require(filename);
    }
  },

  checkForUpdates: function(callback) {
    // Run this like once per day.  Callback will be called with true or false
    // to let us know whether there are any updates, so that client code can
    // restart any experiment whose code has changed.
    var url = require("url");
    let self = this;
    downloadFile(url.resolve(BASE_URL, "index.json"), function onDone(data) {
      if (data) {
        data = JSON.parse(data);
        // Go through each file indicated in index.json, attempt to load it,
        // and if we get it, replace the one in self._remoteExperiments with
        // the new module.
        // TODO include dates in index.json, only pull files if they're newer
        // than what we already have.
        for (let i = 0; i < data.experiments.length; i++) {
          let filename = data.experiments[i].filename;
          downloadFile(
            url(BASE_URL, data.experiments[0].filename),
            function onDone(code) {
              if (code) {
                codeStorage.setFile(filename, code);
                self._remoteExperiments[filename] = self._loader.require(filename);
              } else {
                console.warn("Could not download " + filename );
              }
            });
        }
        callback(true);
      } else {
        console.warn("Could not download index.json from test pilot server.");
        callback(false);
      }
    });
  },

  // Filename might be something like "bookmarks01/experiment.js"

  getExperiments: function() {
    return this._remoteExperiments;
  }
};