/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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

  this.listAllFiles = function() {
    let data = this.get();
    let filename;
    return [filename for (filename in data.fs)];
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

exports.RemoteExperimentLoader = function(log4moz, fileGetterFunction ) {
  /* fileGetterFunction is an optional stub function for unit testing.  Pass in
   * nothing to have it use the default behavior of downloading the files from the
   * Test Pilot server.  FileGetterFunction must take (url, callback).*/
  this._init(log4moz, fileGetterFunction);
};

exports.RemoteExperimentLoader.prototype = {
  _init: function(log4moz, fileGetterFunction) {
    this._logger = log4moz.repository.getLogger("TestPilot.Loader");
    this._expLogger = log4moz.repository.getLogger("TestPilot.RemoteCode");
    this._studyResults = [];
    if (fileGetterFunction != undefined) {
      this._fileGetter = fileGetterFunction;
    } else {
      this._fileGetter = downloadFile;
    }
    this._logger.trace("About to instantiate preferences store.");
    this._codeStorage = new PreferencesStore("extensions.testpilot.experiment.codeFs");
    this._libraryNames = [];
    let self = this;

    /* Use a composite file system here, compositing codeStorage and a new
     * local file system so that securable modules loaded remotely can
     * themselves require modules in the cuddlefish lib. */
    this._logger.trace("About to instantiate cuddlefish loader.");
    this._refreshLoader();
    // set up the unloading
    require("unload").when( function() {
                              self._loader.unload();
                            });
    this._logger.trace("Done instantiating remoteExperimentLoader.");
  },

  _refreshLoader: function() {
    if (this._loader) {
      this._loader.unload();
    }
    /* Pass in "TestPilot.experiment" logger as the console object for
     * all remote modules loaded through cuddlefish, so they will log their
     * stuff to the same file as all other modules.  This logger is not
     * technically a console object but as long as it has .debug, .info,
     * .warn, and .error methods, it will work fine.*/
    this._loader = Cuddlefish.Loader(
      {fs: new SecurableModule.CompositeFileSystem(
         [this._codeStorage, Cuddlefish.parentLoader.fs]),
       console: this._expLogger
      });
  },

  checkForUpdates: function(callback) {
    /* Callback will be called with true or false
     * to let us know whether there are any updates, so that client code can
     * restart any experiment whose code has changed. */
    let prefs = require("preferences-service");
    let indexFileName = prefs.get("extensions.testpilot.indexFileName",
                                  "index.json");
    let self = this;
    // Unload everything before checking for updates, to be sure we
    // get the newest stuff.
    this._logger.info("Unloading everything to prepare to check for updates.");
    this._refreshLoader();

    // Check for surveys and studies
    self._fileGetter(resolveUrl(BASE_URL, indexFileName), function onDone(data) {
      if (data) {
        try {
          data = JSON.parse(data);
        } catch (e) {
          self._logger.warn("Error parsing index.json: " + e );
          callback(false);
          return;
        }

        // Cache study results...
        self._studyResults = data.results;

        /* Go through each file indicated in index.json, attempt to load it into
         * codeStorage (replacing any older version there)
         */
        let libNames = [ x.filename for each (x in data.libraries)];
        self._libraryNames = libNames;
        let expNames = [ x.filename for each (x in data.experiments)];
        let filenames = libNames.concat(expNames);
        let numFilesToDload = filenames.length;
        for each (let f in filenames) {
          let filename = f;
          self._logger.trace("I'm gonna go try to get the code for " + filename);
          let modDate = self._codeStorage.getFileModifiedDate(filename);
          self._fileGetter( resolveUrl(BASE_URL, filename),
            function onDone(code) {
              // code will be non-null if there is actually new code to download.
              if (code) {
                self._logger.info("Downloaded new code for " + filename);
                self._codeStorage.setFile(filename, code);
                self._logger.trace("Saved code for: " + filename);
              } else {
                self._logger.info("Nothing to download for " + filename);
              }
              numFilesToDload --;
              if (numFilesToDload == 0) {
                self._logger.trace("Calling callback.");
                callback(true);
              }
            }, modDate);
        }
      } else {
        self._logger.warn("Could not download index.json from test pilot server.");
        callback(false);
      }
    });
  },

  // Filename might be something like "bookmarks01/experiment.js"

  getExperiments: function() {
    // Load up and return all experiments (not libraries)
    // already stored in codeStorage
    this._logger.trace("GetExperiments called.");
    let remoteExperiments = {};
    dump( "Loading all files: \n");
    for each (let filename in this._codeStorage.listAllFiles()) {
      if (this._libraryNames.indexOf(filename) != -1) {
        dump(filename + " is a library, skipping.\n");
        continue;
      }
      dump("Loading " + filename + "\n");
      this._logger.debug("GetExperiments is loading " + filename);
      try {
        remoteExperiments[filename] = this._loader.require(filename);
        this._logger.info("Loaded " + filename + " OK.");
      } catch(e) {
        this._logger.warn("Error loading " + filename);
        this._logger.warn(e);
      }
    }
    return remoteExperiments;
  },

  getStudyResults: function() {
    return this._studyResults;
  }
};