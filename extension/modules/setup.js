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

EXPORTED_SYMBOLS = ["TestPilotSetup"];

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
const POPUP_CHECK_INTERVAL = "extensions.testpilot.popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "extensions.testpilot.popup.timeBetweenChecks";

const HIGH_PRIORITY_ONLY = 1;
const HIGH_AND_MEDIUM_PRIORITY = 2;
const ANY_PRIORITY = 3;

// TODO move homepage to a pref?
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";

// TODO this stuff shouldn't be hard-coded here:
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

/* TODO observe for private browsing start and stop:  this is done with the observer notifications
 * topic = "private-browsing" data = "enter"
 * and topic = "private-browsing" data = "exit"
 */

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
      // TODO this is one of two loaders we create... only need one!
    let loader = new Cuddlefish.Loader({rootPath: "resource://testpilot/modules/lib/"});
    this._obs = loader.require("observer-service");

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
	  self._notifyUserOfTasks(HIGH_PRIORITY_ONLY); }},
      Application.prefs.getValue(POPUP_REMINDER_INTERVAL, 86400000),
      Ci.nsITimer.TYPE_REPEATING_SLACK
    );

    // Install tasks.
    this.checkForTasks();
    this.startupComplete = true;
    this._obs.notify("testpilot:startup:complete", "", null);
    // onWindowLoad gets called once for each window, but only after we fire this
    // notification.
    dump("Testpilot startup complete.\n");
    } catch(e) {
      dump("Error in testPilot startup: " + e +"\n");
    }
  },

  globalShutdown: function TPS_globalShutdown() {
    dump("Global shutdown.  Unregistering everything.\n");
    this._shortTimer.cancel();
    this._longTimer.cancel();
    let self = this;
    this._obs.remove("testpilot:task:changed", this.onTaskStatusChanged,
                  self);
    this._obs.remove("quit-application", this.globalShutdown, self);
    dump("Done unregistering everything.\n");
  },

  _getFrontBrowserWindow: function TPS__getFrontWindow() {
    let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Ci.nsIWindowMediator);
    // TODO Is "most recent" the same as "front"?
    return wm.getMostRecentWindow("navigator:browser");
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

    // TODO can this next line happen in the overlay instead of here?
    let menu = window.document.getElementById("pilot-menu-popup");
    menu.addEventListener("command", this.onMenuSelection, false);

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

  populateMenu: function TPS_populateMenu(window) {
    // This is called from an onPopup handler, so it is called right before the menu
    // is drawn.
    let menu = window.document.getElementById("pilot-menu-popup");
    // Create a menu entry for each task:
    for (let i=0; i<this.taskList.length; i++) {
      let task = this.taskList[i];

      // First remove any existing menu item for this task, to prevent duplicate entries.
      // TODO is there a less inefficient way of doing this?
      for (let j = 0; j < menu.childNodes.length; j++) {
	let childNode = menu.childNodes[j];
	if (childNode.taskObject == task) {
	  menu.removeChild(childNode);
	  break;
	}
      }

      let newMenuItem = window.document.createElement("menuitem");
      newMenuItem.setAttribute("label", "  " + task.title);
      if (task.status == TaskConstants.STATUS_NEW) {
	// Give it a new icon
        newMenuItem.setAttribute("class", "menuitem-iconic");
        newMenuItem.setAttribute("image", "chrome://testpilot/skin/new.png");
      }
      if (task.status >= TaskConstants.STATUS_SUBMITTED) {
	// Disable it if it's cancelled or submitted
        newMenuItem.setAttribute("disabled", true);
        newMenuItem.setAttribute("label", "  (Completed) " + task.title);
      }
      if (task.status == TaskConstants.STATUS_CANCELLED) {
	// Disable it if it's cancelled or submitted
        newMenuItem.setAttribute("disabled", true);
        newMenuItem.setAttribute("label", "  (Quit) " + task.title);
      }
      // TODO other variations of icon and label for other statuses?

      newMenuItem.taskObject = task;
      let refElement = null;
      if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
        // Hide the 'no-tests-yet' menu item, because there is a test:
        window.document.getElementById("no-tests-yet").hidden = true;
        refElement = window.document.getElementById("test-menu-separator");
      } else if (task.taskType == TaskConstants.TYPE_SURVEY) {
        refElement = window.document.getElementById("survey-menu-separator");
      }
      menu.insertBefore(newMenuItem, refElement);
    }
  },

  _showNotification: function TPS__showNotification(text, task) {
    // If there are multiple windows, show notifications in the frontmost
    // window.
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");
    let button = window.document.getElementById("pilot-notifications-button");
    var self = this;
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.getElementsByTagName("label")[0].setAttribute("value", text);
    popup.onclick = function() {
      self._hideNotification();
      if (task) {
        task.loadPage();
      }
    };
    popup.openPopup( button, "after_end");
  },

  _hideNotification: function TPS__hideNotification(text) {
    let window = this._getFrontBrowserWindow();
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.hidePopup();
  },

  _notifyUserOfTasks: function TPS__notifyUser(priority) {
    // Show door-hanger thingy if there are new tasks.
    let i, task, text;

    // Highest priority is if there is a finished test (needs a decision)
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_FINISHED) {
        let text = "A Test Pilot study has completed: "
                   + task.title + " needs your attention.";
	this._showNotification(text, task);
	return;
      }
    }

    // If we only want to show highest priority stuff, end here.
    if (priority == HIGH_PRIORITY_ONLY) {
      return;
    }

    // If there's no finished test, next highest priority is tests that
    // have started since last time...
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_STARTING) {
	text = "A study is now in progress: " + task.title;
	this._showNotification(text, task);
	return;
      }
    }

    // Then new tests and surveys...
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_NEW) {
	if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
	  text = "A new study has been scheduled: " + task.title;
	} else {
	  text = "There is a new survey for you: " + task.title;
	}
	this._showNotification(text, task);
	return;
      }
    }

    // And finally, new experiment results:
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_RESULTS) {
	text = "Results are now available for " + task.title;
	this._showNotification(text, task);
      }
    }
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
    dump("Task status changed!\n");
    this._notifyUserOfTasks(ANY_PRIORITY);
    // TODO notify of lower-priority state changes using observer message
    // FINISHED -> SUBMITTED: "Your data has been submitted successfully."
    // FINISHED -> CANCELED: "You have opted out of an experiment."
    this.populateMenu();
  },

  onMenuSelection: function TPS_onMenuSelection(event) {
    let label = event.target.getAttribute("label");
    if (event.target.taskObject) {
      event.target.taskObject.loadPage();
    }
  },

  get version() {
    return Application.extensions.get(EXTENSION_ID).version;
  },

  checkForTasks: function TPS_checkForTasks() {
    dump("In checkForTasks!\n");
    if (! this._loader) {
      dump("Making new cuddlefish loader:\n");
      // TODO this is the other of the two loaders we create... only need
      // one!!
      this._loader = new Cuddlefish.Loader({rootPaths: ["resource://testpilot/modules/",
                                                    "resource://testpilot/modules/lib/"]});
      dump("Made new cuddlefish loader.\n");
    }

    if (! this._remoteExperimentLoader ) {
      dump("Now requiring remote experiment loader:\n");
      let remoteLoaderModule = this._loader.require("remote-experiment-loader");
      dump("Now instantiating remoteExperimentLoader:");
      let rel = new remoteLoaderModule.RemoteExperimentLoader();
      this._remoteExperimentLoader = rel;
    }

    dump("Initing the survery.\n");
    TestPilotSetup.addTask(new TestPilotSurvey("survey_for_new_pilots",
                                               "Survey For New Test Pilots",
                                               SURVEY_URL));

    let self = this;
    this._remoteExperimentLoader.checkForUpdates(
      function(success) {
        dump("Getting updated experiments... Success? " + success + "\n");
        // Actually, we do exactly the same thing whether we succeeded in
        // downloading new contents or not...
        let experiments = self._remoteExperimentLoader.getExperiments();

        for (let filename in experiments) {
          dump("Attempting to load experiment " + filename + "\n");
          // TODO also pull additional info from experimentInfo, such as
          // basicPanel, optInRequired, versionNumber, startDate, and duration.
          let expInfo = experiments[filename].experimentInfo;
          let dsInfo = experiments[filename].dataStoreInfo;
          let dataStore = new ExperimentDataStore( dsInfo.fileName,
                                                   dsInfo.tableName,
                                                   dsInfo.columns );
          let webContent = experiments[filename].webContent;
          let task = new TestPilotExperiment(expInfo.testId,
                                             expInfo.testName,
                                             expInfo.testInfoUrl,
                                             dataStore,
                                             experiments[filename].Observer,
                                             webContent);
          TestPilotSetup.addTask(task);
          dump("Loaded experiment " + filename + "\n");
        }
      }
    );
  },

  reloadRemoteExperiments: function TPS_reloadRemoteExperiments() {
    for (let i = 0; i < this.taskList.length; i++) {
      // TODO is there anything that needs to be done on shutdown for either
      // the TestPilotExperiment (the task) or the ExperimentDataStore
      // instances?
    }

    this.taskList = [];
    this._loader.unload();

    this.checkForTasks();
  },

  getTaskById: function TPS_getTaskById(id) {
    for (let i = 0; i < this.taskList.length; i++) {
      let task = this.taskList[i];
      if (task.id == id) {
	return task;
      }
    }
    return null;
  }
};



