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

EXPORTED_SYMBOLS = ["TestPilotSetup", "TestPilotSurvey"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://testpilot/modules/Observers.js");
Components.utils.import("resource://testpilot/modules/tabs_observer.js");
Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
Components.utils.import("resource://testpilot/modules/tasks.js");

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";


// TODO this stuff shouldn't be hard-coded here:
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";
const EXPERIMENT_URL = "chrome://testpilot/content/datastore.html";
const START_DATE = "";
const END_DATE = "";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

/* TODO observe for private browsing start and stop:  this is done with the observer notifications
 * topic = "private-browsing" data = "enter"
 * and topic = "private-browsing" data = "exit"
 */

let TestPilotSetup = {
  isNewlyInstalledOrUpgraded: false,
  isSetupComplete: false,
  notificationsButton: null,
  window: null,
  taskList: [],

  addTask: function TPS_addTask(testPilotTask) {
    this.taskList.push(testPilotTask);
    this.onTaskStatusChanged();
  },

  onBrowserWindowLoaded: function TPS_onBrowserWindowLoaded() {
    if (!this.isSetupComplete) {
      try {
      // Compare the version in our preferences from our version in the
      // install.rdf.

       var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Ci.nsIWindowMediator);
       var window = wm.getMostRecentWindow("navigator:browser");
       dump("Window is " + window + "\n");

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

      dump("Adding event listner.\n");
      try {
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
      } } catch ( e ) {
        dump("Error: " + e + "\n");
      }
      dump("event listner added.\n");

       this.checkForTasks();
       this.onNewWindow(this.window);
       this.populateMenu();
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

  thereAreNewTasks: function TPS_thereAreNewTasks() {
    dump("taskList.length is " + this.taskList.length + "\n");
    for (let i = 0; i < this.taskList.length; i++) {
      if (this.taskList[i].isNew) {
	return this.taskList[i].title;
      }
    }
    return false;
  },

  onTaskStatusChanged: function TPS_onTaskRemoved() {
    // Show door-hanger thingy if there are new tasks.
    let taskTitle = this.thereAreNewTasks();
    if (taskTitle) {
      /* TODO this is not the right logic anymore.  Something might need attention not
       * just if it's NEW, but also if it's got a state change it thinks you need to
       * know about, like going from pending to in progress, or in progress to finished.
       * Especially FINISHED.
       * TODO make door-hanger appear x minutes after browser start if there's an older
       * state change that you still haven't seen... */
      this.popup.hidden = false;
      this.popup.setAttribute("open", "true");
      let text = "Test Pilot: \"" + taskTitle + "\" wants your attention.";
      this.popup.getElementsByTagName("label")[0].setAttribute("value", text);
      this.popup.openPopup( this.notificationsButton, "after_end"); // ??
    }

    // Regenerate that menu to reflect new task status...
    this.populateMenu();
  },

  onMenuSelection: function TPS_onMenuSelection(event) {
    let label = event.target.getAttribute("label");
    dump("You selected menu item with label " + label + "\n");
    if (event.target.taskObject) {
      dump("Calling executeTask\n");
      event.target.taskObject.executeTask();
    } else
      dump("No taskObject.\n");
  },

  get iconLeftPos() {
    return this.notificationsButton.boxObject.x;
  },

  get iconTopPos() {
    return this.notificationsButton.boxObject.y;
  },

  get version() {
    return Application.extensions.get(EXTENSION_ID).version;
  },

  checkForTasks: function TPS_checkForTasks() {
    // TODO look at RSS feed for new tasks and their start and end dates.
    TestPilotSetup.addTask(new TestPilotSurvey("survey_for_new_pilots",                          
                                               "Survey For New Test Pilots",
                                               SURVEY_URL));

    TestPilotSetup.addTask(new TestPilotExperiment(1,
						   "Tab Open/Close Experiment",
						   EXPERIMENT_URL,
					           TabsExperimentDataStore,
					           TabsExperimentObserver,
					           START_DATE,
                                                   END_DATE));
  }
};



