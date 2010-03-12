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
                    "POPUP_SHOW_ON_FINISH", "POPUP_SHOW_ON_RESULTS"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var Cuddlefish = {};
Components.utils.import("resource://testpilot/modules/lib/cuddlefish.js",
                        Cuddlefish);
Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
Components.utils.import("resource://testpilot/modules/tasks.js");

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const POPUP_SHOW_ON_NEW = "extensions.testpilot.popup.showOnNewStudy";
const POPUP_SHOW_ON_FINISH = "extensions.testpilot.popup.showOnStudyFinished";
const POPUP_SHOW_ON_RESULTS = "extensions.testpilot.popup.showOnNewResults";
const POPUP_CHECK_INTERVAL = "extensions.testpilot.popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "extensions.testpilot.popup.timeBetweenChecks";

const HIGH_PRIORITY_ONLY = 1;
const HIGH_AND_MEDIUM_PRIORITY = 2;
const ANY_PRIORITY = 3;

// TODO move homepage to a pref?
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

let TestPilotSetup = {
  isNewlyInstalledOrUpgraded: false,
  didReminderAfterStartup: false,
  startupComplete: false,
  _shortTimer: null,
  _longTimer: null,
  _loader: null,
  _remoteExperimentLoader: null,
  _obs: null,
  taskList: [],

  globalStartup: function TPS__doGlobalSetup() {
    // Only ever run this stuff ONCE, on the first window restore.
    // Should get called by the Test Pilot component.
    dump("TestPilotSetup.globalStartup was called.\n");

    try {
    dump("Making new cuddlefish loader:\n");
    this._loader = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                                    "resource://testpilot/modules/lib/"]});
    dump("Made new cuddlefish loader.\n");
    this._obs = this._loader.require("observer-service");

    // Show first run page (in front window) if newly installed or upgraded.
    let currVersion = Application.prefs.getValue(VERSION_PREF, "firstrun");
    if (currVersion != this.version) {
      Application.prefs.setValue(VERSION_PREF, this.version);
      this.isNewlyInstalledOrUpgraded = true;
      let browser = this._getFrontBrowserWindow().getBrowser();
      let url = Application.prefs.getValue(FIRST_RUN_PREF, "");
      let tab = browser.addTab(url);
      browser.selectedTab = tab;
    }

    // Set up observation for task state changes
    var self = this;
    this._obs.add("testpilot:task:changed", this.onTaskStatusChanged,
                  self);
    // Set up observation for application shutdown.
    this._obs.add("quit-application", this.globalShutdown, self);
    // Set up observation for enter/exit private browsing:
    this._obs.add("private-browsing", this.onPrivateBrowsingMode, self);

    // Set up timers to remind user x minutes after startup
    // and once per day thereafter.  Use nsITimer so it doesn't belong to
    // any one window.
    dump("Setting interval for showing reminders...\n");

    this._shortTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._shortTimer.initWithCallback(
      { notify: function(timer) { self._doHousekeeping();} },
      Application.prefs.getValue(POPUP_CHECK_INTERVAL, 180000),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );
    this._longTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._longTimer.initWithCallback(
      { notify: function(timer) {
          self._notifyUserOfTasks(HIGH_PRIORITY_ONLY);
          self.reloadRemoteExperiments();
      }},
      Application.prefs.getValue(POPUP_REMINDER_INTERVAL, 86400000),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );

    // Install tasks.
    this.checkForTasks(function() {
      /* Callback to complete startup after we finish
       * checking for tasks. */
      self.startupComplete = true;
      dump("I'm in the callback from checkForTasks!!!!\n");
      // Send startup message to each task:
      for (let i = 0; i < self.taskList.length; i++) {
        self.taskList[i].onAppStartup();
      }
      self._obs.notify("testpilot:startup:complete", "", null);
      /* onWindowLoad gets called once for each window,
       * but only after we fire this notification. */
    });
    dump("Testpilot startup complete.\n");
    } catch(e) {
      dump("Error in testPilot startup: " + e +"\n");
    }
  },

  globalShutdown: function TPS_globalShutdown() {
    dump("Global shutdown.  Unregistering everything.\n");
    let self = this;
    for (let i = 0; i < self.taskList.length; i++) {
      self.taskList[i].onAppShutdown();
      self.taskList[i].onExperimentShutdown();
    }
    this._obs.remove("testpilot:task:changed", this.onTaskStatusChanged,
                  self);
    this._obs.remove("quit-application", this.globalShutdown, self);
    this._obs.remove("private-browsing", this.onPrivateBrowsingMode, self);
    this._loader.unload();
    this._shortTimer.cancel();
    this._longTimer.cancel();
    dump("Done unregistering everything.\n");
  },

  _getFrontBrowserWindow: function TPS__getFrontWindow() {
    let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Ci.nsIWindowMediator);
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
    dump("Called TestPilotSetup.onWindow unload!\n");
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onWindowClosed(window);
    }
  },

  onWindowLoad: function TPS_onWindowLoad(window) {
    dump("Called TestPilotSetup.onWindowLoad!\n");
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
                                                    iconSrc, showSubmit,
                                                    showClose, linkText,
                                                    linkUrl) {
    // If there are multiple windows, show notifications in the frontmost
    // window.

    // If fragile is true, a click anywhere dismisses the popup.  If
    // fragile is false, only a click on the close box dismisses it.
    let doc = this._getFrontBrowserWindow().document;

    let popup = doc.getElementById("pilot-notification-popup");
    let taskbarIcon = doc.getElementById("pilot-notifications-button");
    let textLabel = doc.getElementById("pilot-notification-text");
    let titleLabel = doc.getElementById("pilot-notification-title");
    let icon = doc.getElementById("pilot-notification-icon");
    let closeBtn = doc.getElementById("pilot-notification-close");
    let submitBtn = doc.getElementById("pilot-notification-submit");
    var self = this;

    // Set all appropriate attributes on popup:
    popup.setAttribute("noautohide", !fragile);
    textLabel.setAttribute("value", text);
    titleLabel.setAttribute("value", title);
    icon.setAttribute("src", iconSrc);
    closeBtn.setAttribute("hidden", !showClose);
    submitBtn.setAttribute("hidden", !showSubmit);

    if (fragile) {
      popup.onclick = function() {
        self._hideNotification();
        if (task) {
          task.loadPage();
        }
      };
    } else {
      closeBtn.onclick = function() {
        self._hideNotification();
      };
    }

    // Show the popup:
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.openPopup( taskbarIcon, "after_end");
  },

  _hideNotification: function TPS__hideNotification(text) {
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.hidePopup();
  },

  _notifyUserOfTasks: function TPS__notifyUser(priority) {
    // Check whether there are tasks needing attention, and if any are
    // found, show the popup door-hanger thingy.
    let i, task, title, text;

    // Highest priority is if there is a finished test (needs a decision)
    if (Application.prefs.getValue(POPUP_SHOW_ON_FINISH, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_FINISHED) {
          title = "Ready to Submit";
          text = "The Test Pilot " + task.title + " study is finished " +
                       "gathering data and is ready to submit.";
	  this._showNotification(task, false, text, title,
                                 "chrome://testpilot/skin/ready_submit_48x48.png",
                                 true, "linkText", "linkUrl");
          // We return after showing something, because it only makes
          // sense to show one notification at a time!
	  return;
        }
      }
    }

    // If we only want to show highest priority stuff, end here.
    if (priority == HIGH_PRIORITY_ONLY) {
      return;
    }

    // If there's no finished test, next highest priority is new tests that
    // are starting...
    if (Application.prefs.getValue(POPUP_SHOW_ON_NEW, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_STARTING ||
            task.status == TaskConstants.STATUS_NEW) {
          title = "New Test Pilot Study";
          text = "The Test Pilot " + task.title + " study is now beginning.";
	  this._showNotification(task, true, text, title,
                                 "chrome://testpilot/skin/new_study_48x48.png",
                                 false, false, "linkText", "linkUrl");
	  return;
        }
      }
    }

    // And finally, new experiment results:
    if (Application.prefs.getValue(POPUP_SHOW_ON_RESULTS, false)) {
      for (i = 0; i < this.taskList.length; i++) {
        task = this.taskList[i];
        if (task.status == TaskConstants.STATUS_RESULTS) {
          title = "New Test Pilot Results";
          text = "New results are now available for the Test Pilot " +
            task.title + " study.";
	  this._showNotification(task, true, text, title,
                                 "chrome://testpilot/skin/new_results_48x48.png",
                                 false, false, "linkText", "linkUrl");
        }
        return;
      }
    }

    // High and medium priority stuff ends here.
    if ( priority == HIGH_AND_MEDIUM_PRIORITY ) {
      return;
    }

    // TODO:
    // We could notify users of FINISHED -> SUBMITTED here, or
    // FINISHED -> CANCELED, but it seems kind of pointless when they
    // are already looking at a page that gives feedback about that.
  },

  _doHousekeeping: function TPS__doHousekeeping() {
    // check date on all tasks:
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      task.checkDate();
    }
    // Do a full reminder -- but at most once per browser session
    if (!this.didReminderAfterStartup) {
      dump("Doing reminder after startup...\n");
      this.didReminderAfterStartup = true;
      this._notifyUserOfTasks(HIGH_AND_MEDIUM_PRIORITY);
    }
  },

  onTaskStatusChanged: function TPS_onTaskStatusChanged() {
    this._notifyUserOfTasks(ANY_PRIORITY);
  },

  get version() {
    return Application.extensions.get(EXTENSION_ID).version;
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

  checkForTasks: function TPS_checkForTasks(callback) {
    if (! this._remoteExperimentLoader ) {
      dump("Now requiring remote experiment loader:\n");
      let remoteLoaderModule = this._loader.require("remote-experiment-loader");
      dump("Now instantiating remoteExperimentLoader:");
      let rel = new remoteLoaderModule.RemoteExperimentLoader();
      this._remoteExperimentLoader = rel;
    }

    let self = this;
    this._remoteExperimentLoader.checkForUpdates(
      function(success) {
        dump("Getting updated experiments... Success? " + success + "\n");
        // Actually, we do exactly the same thing whether we succeeded in
        // downloading new contents or not...
        let experiments = self._remoteExperimentLoader.getExperiments();

        for (let filename in experiments) {
          /* If the experiment specifies a minimum version, and if that
           * minimum version is higher than our version, don't try to
           * load the experiment: */
          let minVer = experiments[filename].experimentInfo.minTPVersion;
          if (minVer && self._isNewerThanMe(minVer)) {
            dump("Not loading " + filename + "\n");
            dump("Because it requires version " + minVer + "\n");
            // TODO If this happens, we should tell user to update
            // their extension.
            continue;
          }
          try {
            // The try-catch ensures that if something goes wrong in loading one
            // experiment, the other experiments after that one still get loaded.
            dump("Attempting to load experiment " + filename + "\n");

            let task;
            // Could be a survey: check if surveyInfo is exported:
            if (experiments[filename].surveyInfo != undefined) {
              let sInfo = experiments[filename].surveyInfo;
              // survey is either a web survey (specifies a url) or
              // a built-in survey (specifies surveyQuestions.)
              if (sInfo.surveyQuestions != undefined) {
                task = new TestPilotBuiltinSurvey(sInfo);
              } else {
                task = new TestPilotWebSurvey(sInfo);
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
            TestPilotSetup.addTask(task);
            dump("Loaded task " + filename + "\n");
          } catch (e) {
            dump("Failed to load task " + filename + ": " + e + "\n");
          }
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
      // TODO anything needed to shut down the experiment's data store?
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



