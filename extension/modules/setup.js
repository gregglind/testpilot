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

/* These constants represent the status of a user task.  User tasks can either
 * be surveys or tests.  A task is either NEW (the user has never seen it before
 * and needs to be somehow notified that it exists), PENDING (user has seen it but
 * has neither chosen to participate nor to opt out), IN_PROGRESS (data is currently
 * being collected), CANCELED (user has opted out), SUBMITTED (user has submitted data).
 * FINISHED is a test which has ended but which the user has neither canceled nor submitted
 * yet; we'll keep prompting for a certain period of time, but if it's an opt-out test then
 * it will automatically submit at the end of that time.
 * A task can never go backwards in this sequence, so we can do > and < comparisons on them.
 * Status of a task will be stored in a preference called extensions.testpilot.taskstatus.(taskname).
 */

const TASK_STATUS_NEW = 0;
const TASK_STATUS_PENDING = 1;
const TASK_STATUS_IN_PROGRESS = 2;
const TASK_STATUS_FINISHED = 3;
const TASK_STATUS_CANCELLED = 4;
const TASK_STATUS_SUBMITTED = 5;

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const STATUS_PREF_PREFIX = "extensions.testpilot.taskstatus.";
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);


function TestPilotSurvey(surveyUrl, surveyTitle, surveyId, window, menu) {
  this._init(surveyUrl, surveyTitle, surveyId, window, menu);
}
TestPilotSurvey.prototype = {
  _init: function TestPilotSurvey__init(surveyUrl, surveyTitle, surveyId, window, menu) {
    this._surveyUrl = surveyUrl;
    this._surveyTitle = surveyTitle;
    this._id = surveyId;
    this._menuItem = null;
    this._browser = window.getBrowser();

    // Check prefs for status, default to NEW
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id, TASK_STATUS_NEW);
    // Add menu item for myself:
    this.addMenuItem(window, menu);

    if (this._status < TASK_STATUS_SUBMITTED) {
      this.checkForCompletion();
    }
  },

  get title() {
    return this._surveyTitle;
  },

  get isNew() {
    dump("Called isNew() for a task.  This task status is " + this._status + "\n");
    return (this._status == TASK_STATUS_NEW);
  },

  checkForCompletion: function TestPilotSurvey_checkForCompletion(window, menu) {
    var self = this;
    dump("Checking for survey completion...\n");
    // Note, the following depends on SurveyMonkey and will break if
    // SurveyMonkey changes their 'survey complete' page.
    let surveyCompletedText = "Thank you for completing our survey!";
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
    req.open('GET', self._surveyUrl, true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          if (req.responseText.indexOf(surveyCompletedText) > -1) {
            dump("Survey is completed.\n");
	    self.changeStatus( TASK_STATUS_SUBMITTED );
	  }
        } else {
          dump("Error loading page\n");
	}
      }
    };
    req.send(null);
  },

  changeStatus: function TPS_changeStatus(newStatus) {
    this._status = newStatus;
    // Set the pref:
    Application.prefs.setValue(STATUS_PREF_PREFIX + this._id, newStatus);

    // Change menu item if there is one:
    if (this._menuItem) {
      if (newStatus > TASK_STATUS_NEW) {
	// Take off "new" icon if we're not new anymore:
        this._menuItem.removeAttribute("class");
        this._menuItem.removeAttribute("icon");
      }
      if (newStatus == TASK_STATUS_SUBMITTED) {
	// Disable menu item, change name to show it is completed:
	this._menuItem.setAttribute("disabled", true);
	this._menuItem.setAttribute("label", "  (Completed)" + this._surveyTitle);
      }
    }

    // Stop the blinking!
    Observers.notify("testpilot:task:changed", "", null);
  },

  addMenuItem: function TPS_addMenuItem(window, menu) {

    let newMenuItem = window.document.createElement("menuitem");
    newMenuItem.setAttribute("label", "  " + this._surveyTitle);

    if (this._status == TASK_STATUS_NEW) {
      newMenuItem.setAttribute("class", "menuitem-iconic");
      newMenuItem.setAttribute("image", "chrome://testpilot/skin/new.png");
    }
    if (this._status == TASK_STATUS_SUBMITTED) {
      newMenuItem.setAttribute("disabled", true);
      newMenuItem.setAttribute("label", "  (Completed)" + this._surveyTitle);
    }
    newMenuItem.taskObject = this;
    let refElement = window.document.getElementById("survey-menu-separator");
    let insertedElement = menu.insertBefore(newMenuItem, refElement);
    
    this._menuItem = newMenuItem;
  },

  takeSurvey: function TPS_takeSurvy(event) {
    let tab = this._browser.addTab(this._surveyUrl);
    this._browser.selectedTab = tab;
    if (this._status == TASK_STATUS_NEW) {
      this.changeStatus(TASK_STATUS_PENDING);
    }
  },

  onUrlLoad: function TPS_onUrlLoad(url) {
    if (url == this._surveyUrl && this._status == TASK_STATUS_NEW) {
      this.changeStatus( TASK_STATUS_PENDING );
    }
  }

};


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

      var self = this;
      Observers.add("testpilot:task:changed", this.onTaskStatusChanged,
                    self);

      dump("Adding event listner.\n");
      try {
      this.notificationsMenu.addEventListener("command", this.onMenuSelection, false);
      var appcontent = window.document.getElementById("appcontent");
      if (appcontent) {
	appcontent.addEventListener("DOMContentLoaded", function(event) {
          var newUrl =  event.originalTarget.URL;
          for (i = 0; i < self.taskList.length; i++) {
            self.taskList[i].onUrlLoad(newUrl);
          }
	}, true);
      } } catch ( e ) {
        dump("Error: " + e + "\n");
      }
      dump("event listner added.\n");

      // TODO take this out of here and put it somewhere else... or hit a
      // Test Pilot Central site and download a list of tasks.
      TestPilotSetup.addTask(new TestPilotSurvey(SURVEY_URL,
                                                 "Survey For New Test Pilots",
                                                 "survey_for_new_pilots",
                                                 this.window,
                                                 this.notificationsMenu));

      this.checkForTasks();
      this.isSetupComplete = true;

       // TODO This is just temporary; ultimately the TabsExperiment needs to be wrapped in a
       // Task with a start date and an end date.
       TabsExperimentObserver.install(window.getBrowser());
      } catch (e) {
	dump("Error in TP startup: " + e + "\n");
      }
    }

    // add listener for "DOMContentLoaded", gets passed event, look at event.originalTarget.URL
  },

  // TODO need an uninstall method that calls TabsExperimentObserver.uninstall();.

  thereAreNewTasks: function TPS_thereAreNewTasks() {
    dump("taskList.length is " + this.taskList.length + "\n");
    for (i = 0; i < this.taskList.length; i++) {
      if (this.taskList[i].isNew) {
	return true;
      }
    }
    return false;
  },

  onTaskStatusChanged: function TPS_onTaskRemoved() {
    // Blink menu if there are new tasks; stop blinking if there are not.
    if (this.thereAreNewTasks()) {
      dump("There are new tasks.  I will blink.\n");
      if (!this._blinker) {
        var theButton = this.notificationsButton;
        var rotation = false;
        this._blinker = this.window.setInterval(
          function() {
            rotation = !(rotation);
            if (rotation)
              theButton.image = "chrome://testpilot/skin/new.png";
            else
              theButton.image = "chrome://testpilot/skin/testpilot_16x16.png";
          }, 1000 );
      }
    } else {
      if (this._blinker) {
        this.window.clearInterval(this._blinker);
        this.notificationsButton.image = "chrome://testpilot/skin/testpilot_16x16.png";
        this._blinker = null;
      }
    }
  },

  onMenuSelection: function TPS_onMenuSelection(event) {
    let label = event.target.getAttribute("label");
    dump("You selected menu item with label " + label + "\n");
    if (event.target.taskObject) {
      event.target.taskObject.takeSurvey();
    }
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
    // TODO look at RSS feed for new tasks.
  }
};



