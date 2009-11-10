
function PreferencesStore(prefName) {
  var prefs = require("preferences-service");

  this.get = function get() {
    return JSON.parse(prefs.get(prefName, "{}"));
  };

  this.set = function set(newStore) {
    prefs.set(prefName, JSON.stringify(newStore));
  };

  this.setFile = function setFile(filename, contents) {
    let data = this.get();
    if (!("fs" in data))
      data.fs = {};
    if (!("modifiedDates" in data))
      data.modifiedDates = {};
    data.fs[filename] = contents;
    data.modifiedDates[filename] = (new Date).getTime();
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

  this.getFileModifiedDate = function(path) {
    let data = this.get();
    let dates = data["modifiedDates"] || {};
    return dates[path];
  };
}

exports.PreferencesStore = PreferencesStore;

function downloadFile(url, cb, lastModified) {
  // lastModified is a timestamp (ms since epoch); if provided, then the file
  // will not be downloaded unless it is newer than this.
  var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
              .createInstance( Ci.nsIXMLHttpRequest );
  req.open('GET', url, true);
  if (lastModified != undefined) {
    let d = new Date();
    d.setTime(lastModified);
    // example header: If-Modified-Since: Sat, 29 Oct 1994 19:43:31 GMT
    req.setRequestHeader("If-Modified-Since", d.toGMTString());
    console.info("Setting if-modified-since header to " + d.toGMTString());
  }
  req.onreadystatechange = function(aEvt) {
    if (req.readyState == 4) {
      if (req.status == 200) {
	cb(req.responseText);
      } else if (req.status == 304) {
        // 304 is "Not Modified", which we can get because we send an
        // If-Modified-Since header.
        console.info("File " + url + " not modified; using cached version.");
        cb(null);
        // calling back with null lets the RemoteExperimentLoader know it should
        // keep using the old cached version of the code.
      } else {
        // Some kind of error.
        console.warn("Got a " + req.status + " error code downloading " + url);
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

var resolveUrl = require("url").resolve;

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
         [this._codeStorage, Cuddlefish.parentLoader.fs])
      });
  },

  _recursiveUpdate: function(experimentList, finalCallback) {
    if (experimentList.length == 0) {
      // If there are no more files to download, call the final callback to report
      // success:
      finalCallback(true);
      return;
    }

    // Split off the array: load the first one now, and load the rest (recursively)
    // when the callback is finished.
    let first = experimentList[0];
    let rest = experimentList.slice(1);
    let self = this;
    let filename = first.filename;
    let modificationDate = this._codeStorage.getFileModifiedDate(filename);
    self._fileGetter( resolveUrl(BASE_URL, filename),
      function onDone(code) {
        // code will be non-null if there is actually new code to download.
        if (code) {
          console.info("Downloaded new code for " + filename);
          self._codeStorage.setFile(filename, code);
          console.warn("Saved code for: " + filename);
        }
        // Now do the next file load...
        self._recursiveUpdate(rest, finalCallback);
      },
      modificationDate);
  },

  checkForUpdates: function(callback) {
    /* Callback will be called with true or false
     * to let us know whether there are any updates, so that client code can
     * restart any experiment whose code has changed. */
    let prefs = require("preferences-service");
    let indexFileName = prefs.get("extensions.testpilot.indexFileName",
                                  "index.json");
    let self = this;
    // Just added: Unload everything before checking for updates, to be sure we
    // get the newest stuff.
    console.warn("Unloading everything to prepare to check for updates.");
    this._refreshLoader();

    self._fileGetter(resolveUrl(BASE_URL, indexFileName), function onDone(data) {
      if (data) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.warn("JSON parsing error: " + e );
          callback(false);
          return;
        }
        /* Go through each file indicated in index.json, attempt to load it into
         * codeStorage (replacing any older version there)
         */
        self._recursiveUpdate(data.experiments, callback);
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
    let remoteExperiments = {};
    for (let filename in experimentsJson.fs) {
      try {
        remoteExperiments[filename] = this._loader.require(filename);
      } catch(e) {
        console.warn("Error loading " + filename);
        console.warn(e);
      }
    }

    return remoteExperiments;
  }
};