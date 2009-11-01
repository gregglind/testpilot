
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
    if (path.slice(-3) != ".js") {
      path = path + ".js";
    }
    if (path in fs) {
      return path;
    }
    return null;
  };

  this.getFile = function(path) {
    let data = this.get();
    let fs = data["fs"] || {};
    return {contents: fs[path]};
  };
}

exports.PreferencesStore = PreferencesStore;

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
// Cuddlefish.Loader and Cuddlefish.loader (.parentLoader ?)
// .fs property exposes filesystem object.

var SecurableModule = require("securable-module");
// example contents of extensions.testpilot.experiment.codeFs:
// {'fs': {"bookmark01/experiment": "<plain-text code @ bookmarks.js>"}}
// sample code
    // example data:
    // {'experiments': [{'name': 'Bookmark Experiment',
    //                           'filename': 'bookmarks.js'}]}

exports.RemoteExperimentLoader = function( fileGetterFunction ) {
  /* fileGetterFunction is an optional stub function for unit testing.  Pass in
   * nothing to have it use the default behavior of downloading the files from the
   * Test Pilot server.  FileGetterFunction must take (url, callback).*/
  this._init(fileGetterFunction);
};

exports.RemoteExperimentLoader.prototype = {
  _init: function(fileGetterFunction) {
    if (fileGetterFunction != undefined) {
      this._fileGetter = fileGetterFunction;
    } else {
      this._fileGetter = downloadFile;
    }
    console.info("About to instantiate preferences store.");
    this._codeStorage = new PreferencesStore("extensions.testpilot.experiment.codeFs");
    this._remoteExperiments = {};
    let self = this;

    /* Use a composite file system here, compositing codeStorage and a new
     * local file system so that securable modules loaded remotely can
     * themselves require modules in the cuddlefish lib. */
    console.info("About to instantiate cuddlefish loader.");
    this._refreshLoader();
    // set up the unloading
    require("unload").when( function() {
                              self._loader.unload();
                            });
    console.info("Done instantiating remoteExperimentLoader.");
  },

  _refreshLoader: function() {
    if (this._loader) {
      this._loader.unload();
    }
    this._loader = Cuddlefish.Loader(
      {fs: new SecurableModule.CompositeFileSystem(
         [self._codeStorage, Cuddlefish.parentLoader.fs])
      });
  },

  checkForUpdates: function(callback) {
    // Run this like once per day.  Callback will be called with true or false
    // to let us know whether there are any updates, so that client code can
    // restart any experiment whose code has changed.
    var url = require("url");
    let self = this;
    // Just added: Unload everything before checking for updates, to be sure we
    // get the newest stuff.
    console.warn("Unloading everything to prepare to check for updates.");
    this._refreshLoader();

    self._fileGetter(url.resolve(BASE_URL, "index.json"), function onDone(data) {
      if (data) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.warn("JSON parsing error: " + e );
          callback(false);
        }
        // Go through each file indicated in index.json, attempt to load it,
        // and if we get it, replace the one in self._remoteExperiments with
        // the new module.
        // TODO include dates in index.json, only pull files if they're newer
        // than what we already have.
        for (let i = 0; i < data.experiments.length; i++) {
          let filename = data.experiments[i].filename;
          self._fileGetter(
            url.resolve(BASE_URL, data.experiments[0].filename),
            function onDone(code) {
              if (code) {
                console.info("Downloaded code for " + filename);
                self._codeStorage.setFile(filename, code);
                console.warn("Attempting to load file: " + filename);
                self._remoteExperiments[filename] = self._loader.require(filename);
                console.warn("Finished loading file: " + filename);
              } else {
                console.warn("Could not download " + filename );
              }
            });
        }
        console.warn("Done with for loop now.\n");
        // TODO:I think this callback(true) is happening in the wrong place.  It
        // shouldn't get called until all of the calls to fileGetter that are triggered
        // inside the for loop have all returned!!  But how do we do that?
        callback(true);
      } else {
        console.warn("Could not download index.json from test pilot server.");
        callback(false);
      }
    });
  },

  // Filename might be something like "bookmarks01/experiment.js"

  getExperiments: function() {
    // Load up anything already stored in codeStorage...
    console.info("About to call codeStorage.get.");
    let experimentsJson = this._codeStorage.get();
    console.info("About to iterate filenames in json.");
    for (let filename in experimentsJson.fs) {
      try {
        this._remoteExperiments[filename] = this._loader.require(filename);
      } catch(e) {
        console.warn("Error loading " + filename);
        console.warn(e);
      }
    }

    return this._remoteExperiments;
  }
};