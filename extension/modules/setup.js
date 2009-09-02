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

Components.utils.import("resource://testpilot/modules/Observers.js");
Components.utils.import("resource://testpilot/modules/tabs_observer.js");
Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
Components.utils.import("resource://testpilot/modules/tasks.js");

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const POPUP_CHECK_INTERVAL = "extensions.testpilot.popup.delayAfterStartup";
const POPUP_REMINDER_INTERVAL = "extensions.testpilot.popup.timeBetweenChecks";
const POPUP_LAST_CHECK_TIME = "extensions.testpilot.popup.lastCheck";

const HIGH_PRIORITY_ONLY = 1;
const HIGH_AND_MEDIUM_PRIORITY = 2;
const ANY_PRIORITY = 3;

// TODO move homepage to a pref?
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";


// TODO this stuff shouldn't be hard-coded here:
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";
const EXPERIMENT_URL = "chrome://testpilot/content/datastore.html";


let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

/* TODO observe for private browsing start and stop:  this is done with the observer notifications
 * topic = "private-browsing" data = "enter"
 * and topic = "private-browsing" data = "exit"
 */

let TestPilotSetup = {
  isNewlyInstalledOrUpgraded: false,
  isSetupComplete: false,
  didReminderAfterStartup: false,
  notificationsButton: null,
  window: null,
  taskList: [],

  addTask: function TPS_addTask(testPilotTask) {
    this.taskList.push(testPilotTask);
  },

  onBrowserWindowLoaded: function TPS_onBrowserWindowLoaded() {
    if (!this.isSetupComplete) {
      try {
      // Compare the version in our preferences from our version in the
      // install.rdf.

	dump("Doing setup...\n");
       var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Ci.nsIWindowMediator);
       var window = wm.getMostRecentWindow("navigator:browser");

      let currVersion = Application.prefs.getValue(VERSION_PREF, "firstrun");
      if (currVersion != this.version) {
        Application.prefs.setValue(VERSION_PREF, this.version);
        this.isNewlyInstalledOrUpgraded = true;

        let browser = window.getBrowser();
        let url = Application.prefs.getValue(FIRST_RUN_PREF, "");
        let tab = browser.addTab(url);
        browser.selectedTab = tab;
      }
      this.window = window;
      this.notificationsButton = window.document
          .getElementById("pilot-notifications-button");
      this.notificationsMenu = window.document
          .getElementById("pilot-menu");
      this.popup = window.document
          .getElementById("pilot-notification-popup");


      var self = this;
      Observers.add("testpilot:task:changed", this.onTaskStatusChanged,
                    self);

      this.notificationsMenu.addEventListener("command", this.onMenuSelection, false);
      // add listener for "DOMContentLoaded", gets passed event,
      // look at event.originalTarget.URL
      var appcontent = window.document.getElementById("appcontent");
      if (appcontent) {
	appcontent.addEventListener("DOMContentLoaded", function(event) {
          var newUrl =  event.originalTarget.URL;
          for (i = 0; i < self.taskList.length; i++) {
            self.taskList[i].onUrlLoad(newUrl, event);
          }
	}, true);
      }

       // Set up timers to remind user x minutes after startup
       // and once per day thereafter...
       dump("Setting interval for showing reminders...\n");
       let interval = Application.prefs.getValue(POPUP_CHECK_INTERVAL, 180000);
       this.window.setInterval(function() {
                                 self._doHousekeeping();
                               }, interval);
	let longInterval = Application.prefs.getValue(POPUP_REMINDER_INTERVAL,
                                                       86400000);
        this.window.setInterval( function() {
                                   self._notifyUserOfTasks(HIGH_PRIORITY_ONLY);
                                 }, longInterval);
       dump("Checking for tasks...\n");
       this.checkForTasks();
	dump("Notifying tasks of new window...\n");
       this.onNewWindow(this.window);
       dump("Gonna populate menu now.\n");
       this.populateMenu();
       dump("Populated menu.\n");
       this.isSetupComplete = true;
      } catch (e) {
	dump("Error in TP startup: " + e + "\n");
      }
    }
  },
  // TODO need an uninstall method that calls TabsExperimentObserver.uninstall();.

  populateMenu: function TPS_populateMenu() {
    // Create a menu entry for each task:
    for (let i=0; i<this.taskList.length; i++) {
      let task = this.taskList[i];

      // First remove any existing menu item for this task.
      // TODO is there a less inefficient way of doing this?
      for (let j = 0; j < this.notificationsMenu.childNodes.length; j++) {
	let childNode = this.notificationsMenu.childNodes[j];
	if (childNode.taskObject == task) {
	  this.notificationsMenu.removeChild(childNode);
	  break;
	}
      }

      let newMenuItem = this.window.document.createElement("menuitem");
      newMenuItem.setAttribute("label", "  " + task.title);
      if (task.status == TaskConstants.STATUS_NEW) {
	// Give it a new icon
        newMenuItem.setAttribute("class", "menuitem-iconic");
        newMenuItem.setAttribute("image", "chrome://testpilot/skin/new.png");
      }
      if (task.status >= TaskConstants.STATUS_CANCELLED) {
	// Disable it if it's cancelled or submitted
        newMenuItem.setAttribute("disabled", true);
        newMenuItem.setAttribute("label", "  (Completed)" + task.title);
      }
      // TODO other variations of icon and label for other statuses?

      newMenuItem.taskObject = task;
      let refElement = null;
      if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
        // Hide the 'no-tests-yet' menu item, because there is a test:
        this.window.document.getElementById("no-tests-yet").hidden = true;
        refElement = this.window.document.getElementById("test-menu-separator");
      } else if (task.taskType == TaskConstants.TYPE_SURVEY) {
        refElement = this.window.document.getElementById("survey-menu-separator");
      }
      this.notificationsMenu.insertBefore(newMenuItem, refElement);
    }
  },

  onNewWindow: function TPS_onNewWindow(window) {
    // TODO call this on every window open
    // TODO also handle whatever needs to be done to put the identical menu
    // into every window.
    for (let i = 0; i < this.taskList.length; i++) {
      this.taskList[i].onNewWindow(window);
    }
  },

  _hideNotification: function TPS__hideNotification(text) {
    this.popup.hidden = true;
    this.popup.setAttribute("open", "false");
    this.popup.hidePopup();
  },

  _showNotification: function TPS__showNotification(text, task) {
    var self = this;
    this.popup.hidden = false;
    this.popup.setAttribute("open", "true");
    this.popup.getElementsByTagName("label")[0].setAttribute("value", text);
    this.popup.onclick = function() {
      self._hideNotification();
      if (task) {
        task.loadPage();
      }
    };
    this.popup.openPopup( this.notificationsButton, "after_end"); // ??
  },

  _notifyUserOfTasks: function TPS__notifyUser(priority) {
    // Show door-hanger thingy if there are new tasks.
    let i, task, text;

    // Highest priority is if there is a finished test (needs a decision)
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_FINISHED) {
        let text = "An experiment is complete: " 
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
	text = "An experiment is now in progress: " + task.title;
	this._showNotification(text, task);
	return;
      }
    }

    // Then new tests and surveys...
    for (i = 0; i < this.taskList.length; i++) {
      task = this.taskList[i];
      if (task.status == TaskConstants.STATUS_NEW) {
	if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
	  text = "A new experiment has been scheduled: " + task.title;
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
      task = this.taskList[i];
      task.checkDate();
    }
    // Do a full reminder -- but at most once per browser session
    if (!this.didReminderAfterStartup) {
      this.didReminderAfterStartup = true;
      Application.prefs.setValue( POPUP_LAST_CHECK_TIME, Date.now());
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
    // TODO look at RSS feed for new tasks and their start and end dates.
    // 8 = september (it's 0-indexed)
    var startDate = Date.UTC(2009, 8, 1);
    var endDate = Date.UTC(2009, 8, 2);


    TestPilotSetup.addTask(new TestPilotSurvey("survey_for_new_pilots",                          
                                               "Survey For New Test Pilots",
                                               SURVEY_URL));

    TestPilotSetup.addTask(new TestPilotExperiment(1,
						   "Tab Open/Close Experiment",
						   EXPERIMENT_URL,
					           TabsExperimentDataStore,
					           TabsExperimentObserver,
					           startDate,
                                                   endDate));
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



