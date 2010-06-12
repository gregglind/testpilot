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
 *   Atul Varma <atul@mozilla.com>
 *   Jono X <jono@mozilla.com>
 *   Raymond Lee <raymond@appcoast.com>
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

EXPORTED_SYMBOLS = ["TestPilotSetup", "POPUP_SHOW_ON_NEW",
                    "POPUP_SHOW_ON_FINISH", "POPUP_SHOW_ON_RESULTS",
                    "ALWAYS_SUBMIT_DATA", "RUN_AT_ALL_PREF"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var Cuddlefish = {};
Components.utils.import("resource://testpilot/modules/lib/cuddlefish.js",
                        Cuddlefish);
Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
Components.utils.import("resource://testpilot/modules/tasks.js");
Components.utils.import("resource://testpilot/modules/extension-update.js");
Components.utils.import("resource://testpilot/modules/log4moz.js");

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const RUN_AT_ALL_PREF = "extensions.testpilot.runStudies";
const POPUP_SHOW_ON_NEW = "extensions.testpilot.popup.showOnNewStudy";
const POPUP_SHOW_ON_FINISH = "extensions.testpilot.popup.showOnStudyFinished";
const POPUP_SHOW_ON_RESULTS = "extensions.testpilot.popup.showOnNewResults";
const POPUP_CHECK_INTERVAL = "extensions.testpilot.popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "extensions.testpilot.popup.timeBetweenChecks";
const ALWAYS_SUBMIT_DATA = "extensions.testpilot.alwaysSubmitData";
const LOG_FILE_NAME = "TestPilotErrorLog.log";

// TODO move homepage to a pref?
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

let TestPilotSetup = {
  didReminderAfterStartup: false,
  startupComplete: false,
  _shortTimer: null,
  _longTimer: null,
  _loader: null,
  _remoteExperimentLoader: null,
  _obs: null,
  _stringBundle: null,
  taskList: [],
  version: "",

  _initLogging: function TPS__initLogging() {
    let props = Cc["@mozilla.org/file/directory_service;1"].
                  getService(Ci.nsIProperties);
    let logFile = props.get("ProfD", Components.interfaces.nsIFile);
    logFile.append(LOG_FILE_NAME);
    let formatter = new Log4Moz.BasicFormatter;
    let root = Log4Moz.repository.rootLogger;
    root.level = Log4Moz.Level["All"];
    let appender = new Log4Moz.RotatingFileAppender(logFile, formatter);
    root.addAppender(appender);
  },

  _isFfx4BetaVersion: function TPS__isFfx4BetaVersion() {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare("3.7a1pre", Application.version);
    if (result < 0) {
      return true;
    } else {
      return false;
    }
  },

  globalStartup: function TPS__doGlobalSetup() {
    // Only ever run this stuff ONCE, on the first window restore.
    // Should get called by the Test Pilot component.
    if (!Application.prefs.getValue(RUN_AT_ALL_PREF, true)) {
      // User has disabled test pilot; don't start up.
      return;
    }
    this._initLogging();
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    logger.trace("TestPilotSetup.globalStartup was called.");

    this._stringBundle =
      Cc["@mozilla.org/intl/stringbundle;1"].
        getService(Ci.nsIStringBundleService).
          createBundle("chrome://testpilot/locale/main.properties");

    try {
    logger.trace("Making new cuddlefish loader:");
    this._loader = new Cuddlefish.Loader(
      {rootPaths: ["resource://testpilot/modules/",
                   "resource://testpilot/modules/lib/"],
       console: Log4Moz.repository.getLogger("TestPilot.Loader")
      });
    logger.trace("Made new cuddlefish loader.");
    this._obs = this._loader.require("observer-service");
    // Set up observation for task state changes
    var self = this;
    this._obs.add("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.add(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    // Set up observation for application shutdown.
    this._obs.add("quit-application", this.globalShutdown, self);
    // Set up observation for enter/exit private browsing:
    this._obs.add("private-browsing", this.onPrivateBrowsingMode, self);

    // Set up timers to remind user x minutes after startup
    // and once per day thereafter.  Use nsITimer so it doesn't belong to
    // any one window.
    logger.trace("Setting interval for showing reminders...");

    this._shortTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._shortTimer.initWithCallback(
      { notify: function(timer) { self._doHousekeeping();} },
      Application.prefs.getValue(POPUP_CHECK_INTERVAL, 180000),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._longTimer.initWithCallback(
      { notify: function(timer) {
          self.reloadRemoteExperiments(function() {
            self._notifyUserOfTasks();
	  });
      }}, Application.prefs.getValue(POPUP_REMINDER_INTERVAL, 86400000),
      Ci.nsITimer.TYPE_REPEATING_SLACK);

      this.getVersion(function() {
      // Show first run page (in front window) if newly installed or upgraded.
        let currVersion = Application.prefs.getValue(VERSION_PREF, "firstrun");
        // Don't show first run page in ffx4 beta version
        if (currVersion != self.version && !self._isFfx4BetaVersion()) {
          Application.prefs.setValue(VERSION_PREF, self.version);
          let browser = self._getFrontBrowserWindow().getBrowser();
          let url = Application.prefs.getValue(FIRST_RUN_PREF, "");
          let tab = browser.addTab(url);
          browser.selectedTab = tab;
        }

        // Install tasks. (This requires knowing the version, so it is
        // inside the callback from getVersion.)
        self.checkForTasks(function() {
          /* Callback to complete startup after we finish
           * checking for tasks. */
         self.startupComplete = true;
         logger.trace("I'm in the callback from checkForTasks.");
         // Send startup message to each task:
         for (let i = 0; i < self.taskList.length; i++) {
           self.taskList[i].onAppStartup();
         }
         self._obs.notify("testpilot:startup:complete", "", null);
         /* onWindowLoad gets called once for each window,
          * but only after we fire this notification. */
         logger.trace("Testpilot startup complete.");
      });
    });
    } catch(e) {
      dump("Error in TestPilot startup: " + e + "\n");
      logger.error("Error in testPilot startup: " + e);
    }
  },

  globalShutdown: function TPS_globalShutdown() {
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    logger.trace("Global shutdown.  Unregistering everything.");
    let self = this;
    for (let i = 0; i < self.taskList.length; i++) {
      self.taskList[i].onAppShutdown();
      self.taskList[i].onExperimentShutdown();
    }
    this._obs.remove("testpilot:task:changed", this.onTaskStatusChanged, self);
    this._obs.remove(
      "testpilot:task:dataAutoSubmitted", this._onTaskDataAutoSubmitted, self);
    this._obs.remove("quit-application", this.globalShutdown, self);
    this._obs.remove("private-browsing", this.onPrivateBrowsingMode, self);
    this._loader.unload();
    this._shortTimer.cancel();
    this._longTimer.cancel();
    logger.trace("Done unregistering everything.");
  },

  _getFrontBrowserWindow: function TPS__getFrontWindow() {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"].
               getService(Ci.nsIWindowMediator);
    // TODO Is "most recent" the same as "front"?
    return wm.getMostRecentWindow("navigator:browser");
  },

  onPrivateBrowsingMode: function TPS_onPrivateBrowsingMode(topic, data) {
    for (let i = 0; i < this.taskList.length; i++) {
      if (data == "enter") {
        this.taskList[i].onEnterPrivateBrowsing();
      } else if (data == "exit") {
        this.taskList[i].onExitPrivateBrowsing();
      }
    }
  },

  onWindowUnload: function TPS__onWindowRegistered(window) {
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    logger.trace("Called TestPilotSetup.onWindow unload!");
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onWindowClosed(window);
    }
  },

  onWindowLoad: function TPS_onWindowLoad(window) {
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    logger.trace("Called TestPilotSetup.onWindowLoad!");
    // Run this stuff once per window...
    let self = this;

    // Register listener for URL loads, that will notify all tasks about
    // new page:
    let appcontent = window.document.getElementById("appcontent");
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", function(event) {
        let newUrl =  event.originalTarget.URL;
        for (i = 0; i < self.taskList.length; i++) {
          self.taskList[i].onUrlLoad(newUrl, event);
        }
      }, true);
    }

    // Let each task know about the new window.
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onNewWindow(window);
    }
  },

  addTask: function TPS_addTask(testPilotTask) {
    this.taskList.push(testPilotTask);
  },

  _showNotification: function TPS__showNotification(task, fragile, text, title,
                                                    iconClass, showSubmit,
						    showAlwaysSubmitCheckbox,
                                                    linkText, linkUrl,
						    isExtensionUpdate) {
    // If there are multiple windows, show notifications in the frontmost
    // window.
    let doc = this._getFrontBrowserWindow().document;

    let popup = doc.getElementById("pilot-notification-popup");
    let taskbarIcon = doc.getElementById("pilot-notifications-button");
    let textLabel = doc.getElementById("pilot-notification-text");
    let titleLabel = doc.getElementById("pilot-notification-title");
    let icon = doc.getElementById("pilot-notification-icon");
    let submitBtn = doc.getElementById("pilot-notification-submit");
    let closeBtn = doc.getElementById("pilot-notification-close");
    let link = doc.getElementById("pilot-notification-link");
    let alwaysSubmitCheckbox =
      doc.getElementById("pilot-notification-always-submit-checkbox");
    let self = this;

    // Set all appropriate attributes on popup:
    if (isExtensionUpdate) {
      popup.setAttribute("tpisextensionupdate", "true");
    }
    popup.setAttribute("noautohide", !fragile);
    titleLabel.setAttribute("value", title);
    while (textLabel.lastChild) {
      textLabel.removeChild(textLabel.lastChild);
    }
    textLabel.appendChild(doc.createTextNode(text));
    if (iconClass) {
      // css will set the image url based on the class.
      icon.setAttribute("class", iconClass);
    }

    alwaysSubmitCheckbox.setAttribute("hidden", !showAlwaysSubmitCheckbox);
    if (showSubmit) {
      if (isExtensionUpdate) {
        submitBtn.setAttribute("label",
	  this._stringBundle.GetStringFromName(
	    "testpilot.notification.update"));
	submitBtn.onclick = function() {
	  TestPilotExtensionUpdate.check(EXTENSION_ID);
          self._hideNotification();
	};
      } else {
        submitBtn.setAttribute("label",
	  this._stringBundle.GetStringFromName("testpilot.submit"));
        // Functionality for submit button:
        submitBtn.onclick = function() {
          self._hideNotification();
          if (showAlwaysSubmitCheckbox && alwaysSubmitCheckbox.checked) {
            Application.prefs.setValue(ALWAYS_SUBMIT_DATA, true);
          }
          task.upload( function(success) {
            if (success) {
              self._showNotification(
		task, true,
                self._stringBundle.GetStringFromName(
		  "testpilot.notification.thankYouForUploadingData.message"),
                self._stringBundle.GetStringFromName(
		  "testpilot.notification.thankYouForUploadingData"),
		"study-submitted", false, false,
                self._stringBundle.GetStringFromName("testpilot.moreInfo"),
		task.defaultUrl);
            } else {
              // TODO any point in showing an error message here?
            }
          });
        };
      }
    }
    submitBtn.setAttribute("hidden", !showSubmit);

    // Create the link if specified:
    if (linkText && (linkUrl || task)) {
      link.setAttribute("value", linkText);
      link.setAttribute("class", "notification-link");
      link.onclick = function(event) {
        if (event.button == 0) {
	  if (task) {
            task.loadPage();
	  } else {
            self._openChromeless(linkUrl);
	  }
          self._hideNotification();
        }
      };
      link.setAttribute("hidden", false);
    } else {
      link.setAttribute("hidden", true);
    }

    closeBtn.onclick = function() {
      self._hideNotification();
    };

    // Show the popup:
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.openPopup( taskbarIcon, "after_end");
  },

  _openChromeless: function TPS__openChromeless(url) {
    let window = this._getFrontBrowserWindow();
    window.TestPilotWindowUtils.openChromeless(url);
  },

  _hideNotification: function TPS__hideNotification() {
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.removeAttribute("tpisextensionupdate");
    popup.hidePopup();
  },

  _isShowingUpdateNotification : function() {
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");

    return popup.hasAttribute("tpisextensionupdate");
  },

  _notifyUserOfTasks: function TPS__notifyUser() {
    // Check whether there are tasks needing attention, and if any are
    // found, show the popup door-hanger thingy.
    let i, task;

    // if showing extension update notification, don't do anything.
    if (this._isShowingUpdateNotification()) {
      return;
    }

    // Highest priority is if there is a finished test (needs a decision)
    if (Application.prefs.getValue(POPUP_SHOW_ON_FINISH, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_FINISHED) {
          if (!Application.prefs.getValue(ALWAYS_SUBMIT_DATA, false)) {
            this._showNotification(
	      task, false,
	      this._stringBundle.formatStringFromName(
		"testpilot.notification.readyToSubmit.message", [task.title],
		1),
	      this._stringBundle.GetStringFromName(
		"testpilot.notification.readyToSubmit"),
	      "study-finished", true, true,
	      this._stringBundle.GetStringFromName("testpilot.moreInfo"),
	      task.defaultUrl);
            // We return after showing something, because it only makes
            // sense to show one notification at a time!
            return;
          }
        }
      }
    }

    // If there's no finished test, next highest priority is new tests that
    // are starting...
    if (Application.prefs.getValue(POPUP_SHOW_ON_NEW, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_STARTING ||
            task.status == TaskConstants.STATUS_NEW) {
          if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
	    this._showNotification(
	      task, true,
	      this._stringBundle.formatStringFromName(
		"testpilot.notification.newTestPilotStudy.message",
		[task.title], 1),
	      this._stringBundle.GetStringFromName(
		"testpilot.notification.newTestPilotStudy"),
	      "new-study", false, false,
	      this._stringBundle.GetStringFromName("testpilot.moreInfo"),
	      task.defaultUrl);
            return;
          } else if (task.taskType == TaskConstants.TYPE_SURVEY) {
	    this._showNotification(
	      task, true,
	      this._stringBundle.formatStringFromName(
		"testpilot.notification.newTestPilotSurvey.message",
		[task.title], 1),
              this._stringBundle.GetStringFromName(
		"testpilot.notification.newTestPilotSurvey"),
	      "new-study", false, false,
	      this._stringBundle.GetStringFromName("testpilot.moreInfo"),
	      task.defaultUrl);
            return;
          }
        }
      }
    }

    // And finally, new experiment results:
    if (Application.prefs.getValue(POPUP_SHOW_ON_RESULTS, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.taskType == TaskConstants.TYPE_RESULTS &&
            task.status == TaskConstants.STATUS_NEW) {
          title = "New Test Pilot Results";
          text = "New results are now available for the Test Pilot \"" +
            task.title + "\" study.";
	  this._showNotification(
	    task, true,
	    this._stringBundle.formatStringFromName(
	      "testpilot.notification.newTestPilotResults.message",
	      [task.title], 1),
            this._stringBundle.GetStringFromName(
	      "testpilot.notification.newTestPilotResults"),
	    "new-results", false, false,
	    this._stringBundle.GetStringFromName("testpilot.moreInfo"),
	    task.defaultUrl);
          return;
        }
      }
    }
  },

  _doHousekeeping: function TPS__doHousekeeping() {
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    // check date on all tasks:
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      task.checkDate();
    }
    // Do a full reminder -- but at most once per browser session
    if (!this.didReminderAfterStartup) {
      logger.trace("Doing reminder after startup...");
      this.didReminderAfterStartup = true;
      this._notifyUserOfTasks();
    }
  },

  onTaskStatusChanged: function TPS_onTaskStatusChanged() {
    this._notifyUserOfTasks();
  },

  _onTaskDataAutoSubmitted: function(subject, data) {
    this._showNotification(
      subject, true,
      this._stringBundle.formatStringFromName(
	"testpilot.notification.autoUploadedData.message",
	[subject.title], 1),
      this._stringBundle.GetStringFromName(
	"testpilot.notification.autoUploadedData"),
      "study-submitted", false, false,
      this._stringBundle.GetStringFromName("testpilot.moreInfo"),
      subject.defaultUrl);
  },

  getVersion: function TPS_getVersion(callback) {
    // Application.extensions undefined in Firefox 4; will use the new
    // asynchrounous API, store string in this.version, and call the
    // callback when done.
    if (Application.extensions) {
      this.version = Application.extensions.get(EXTENSION_ID).version;
      callback();
    } else {
      let self = this;
      Application.getExtensions(function(extensions) {
        self.version = extensions.get(EXTENSION_ID).version;
        callback();
      });
    }
  },

  _isNewerThanMe: function TPS__isNewerThanMe(versionString) {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(this.version, versionString);
    if (result < 0) {
      return true; // versionString is newer than my version
    } else {
      return false; // versionString is the same as or older than my version
    }
  },

  _isNewerThanFirefox: function TPS__isNewerThanFirefox(versionString) {
    let result = Cc["@mozilla.org/xpcom/version-comparator;1"]
                   .getService(Ci.nsIVersionComparator)
                   .compare(Application.version, versionString);
    if (result < 0) {
      return true; // versionString is newer than Firefox
    } else {
      return false; // versionString is the same as or older than Firefox
    }
  },

  _experimentRequirementsAreMet: function TPS__requirementsMet(experiment) {
    // Returns true if we we meet the requirements to run this experiment
    // (e.g. meet the minimum Test Pilot version and Firefox version)
    // false if not.
    // If the experiment doesn't specify minimum versions, attempt to run it.
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    try {
      let minTpVer, minFxVer, expName;
      if (experiment.experimentInfo) {
        minTpVer = experiment.experimentInfo.minTPVersion;
        minFxVer = experiment.experimentInfo.minFXVersion;
        expName =  experiment.experimentInfo.testName;
      } else if (experiment.surveyInfo) {
        minTpVer = experiment.surveyInfo.minTPVersion;
        minFxVer = experiment.surveyInfo.minFXVersion;
        expName = experiment.surveyInfo.surveyName;
      }

      // Minimum test pilot version:
      if (minTpVer && this._isNewerThanMe(minTpVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Test Pilot version " + minTpVer);

        // Let user know there is a newer version of Test Pilot available:
        if (!this._isShowingUpdateNotification()) {
          this._showNotification(
	    null, false,
	    this._stringBundle.GetStringFromName(
	      "testpilot.notification.extensionUpdate.message"),
	    this._stringBundle.GetStringFromName(
	      "testpilot.notification.extensionUpdate"),
	    "update-extension", true, false, "", "", true);
	}
        return false;
      }

      // Minimum firefox version:
      if (minFxVer && this._isNewerThanFirefox(minFxVer)) {
        logger.warn("Not loading " + expName);
        logger.warn("Because it requires Firefox version " + minFxVer);
        return false;
      }
    } catch (e) {
      logger.warn("Error in requirements check " + expName + ": " +  e);
    }
    return true;
  },

  checkForTasks: function TPS_checkForTasks(callback) {
    let logger = Log4Moz.repository.getLogger("TestPilot.Setup");
    if (! this._remoteExperimentLoader ) {
      logger.trace("Now requiring remote experiment loader:");
      let remoteLoaderModule = this._loader.require("remote-experiment-loader");
      logger.trace("Now instantiating remoteExperimentLoader:");
      let rel = new remoteLoaderModule.RemoteExperimentLoader(Log4Moz);
      this._remoteExperimentLoader = rel;
    }

    let self = this;
    this._remoteExperimentLoader.checkForUpdates(
      function(success) {
        logger.info("Getting updated experiments... Success? " + success);
        // Actually, we do exactly the same thing whether we succeeded in
        // downloading new contents or not...
        let experiments = self._remoteExperimentLoader.getExperiments();

        for (let filename in experiments) {
          if (!self._experimentRequirementsAreMet(experiments[filename])) {
            continue;
          }
          try {
            // The try-catch ensures that if something goes wrong in loading one
            // experiment, the other experiments after that one still get loaded.
            logger.trace("Attempting to load experiment " + filename);

            let task;
            // Could be a survey: check if surveyInfo is exported:
            if (experiments[filename].surveyInfo != undefined) {
              let sInfo = experiments[filename].surveyInfo;
              // If it supplies questions, it's a built-in survey.
              // If not, it's a web-based survey.
              if (!sInfo.surveyQuestions) {
                task = new TestPilotWebSurvey(sInfo);
              } else {
                task = new TestPilotBuiltinSurvey(sInfo);
              }
            } else {
              // This one must be an experiment.
              let expInfo = experiments[filename].experimentInfo;
              let dsInfo = experiments[filename].dataStoreInfo;
              let dataStore = new ExperimentDataStore( dsInfo.fileName,
                                                       dsInfo.tableName,
                                                       dsInfo.columns );
              let webContent = experiments[filename].webContent;
              task = new TestPilotExperiment(expInfo,
                                             dataStore,
                                             experiments[filename].handlers,
                                             webContent);
            }
            self.addTask(task);
            logger.info("Loaded task " + filename);
          } catch (e) {
            logger.warn("Failed to load task " + filename + ": " + e);
          }
        } // end for filename in experiments

        // Handling new results is much simpler:
        let results = self._remoteExperimentLoader.getStudyResults();
        for (let r in results) {
          let studyResult = new TestPilotStudyResults(results[r]);
          self.addTask(studyResult);
        }

        /* Legacy studies = stuff we no longer have the code for, but
         * if the user participated in it we want to keep that metadata. */
        let legacyStudies = self._remoteExperimentLoader.getLegacyStudies();
        for (let l in legacyStudies) {
          let legacyStudy = new TestPilotLegacyStudy(legacyStudies[l]);
          self.addTask(legacyStudy);
        }

        if (callback) {
          callback();
        }
      }
    );
  },

  reloadRemoteExperiments: function TPS_reloadRemoteExperiments(callback) {
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onExperimentShutdown();
    }

    this.taskList = [];
    this._loader.unload();

    this.checkForTasks(callback);
  },

  getTaskById: function TPS_getTaskById(id) {
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      if (task.id == id) {
	return task;
      }
    }
    return null;
  },

  getAllTasks: function TPS_getAllTasks() {
    return this.taskList;
  }
};
