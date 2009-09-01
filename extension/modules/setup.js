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
const TASK_STATUS_RESULTS = 6; // Test finished AND final results visible somewhere

const TASK_TYPE_EXPERIMENT = 1;
const TASK_TYPE_SURVEY = 2;

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const STATUS_PREF_PREFIX = "extensions.testpilot.taskstatus.";
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";

const DATA_UPLOAD_URL = "https://testpilot.mozillalabs.com/upload/index.php";

// TODO this stuff shouldn't be hard-coded here:
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";
const START_DATE = "";
const END_DATE = "";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);


function TestPilotExperiment(id, title, dataStore, observer, startDate, endDate, window, menu) {
  this._init(id, title, dataStore, observer, startDate, endDate, window, menu);
}
TestPilotExperiment.prototype = {
  _init: function TestPilotExperiment__init(id,
					    title,
					    dataStore,
					    observer,
					    startDate,
					    endDate,
					    window,
					    menu) {
    this._id = id;
    this._title = title;
    this._dataStore = dataStore;
    // Observer is a constructor.  Constructing one will install it in the
    // window too.
    this._observer = new observer(window);
    // TODO: Install this only if it date is between startDate and endDate.
    // TODO This is just temporary; ultimately the TabsExperiment needs to be wrapped in a
    // Task with a start date and an end date.

    // TODO implement state-changing for TestPilotExperiments
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id,
                                              TASK_STATUS_NEW);
  },

  // Duplicated from survey
  get title() {
    return this._title;
  },

  // duplicated from survey
  get isNew() {
    return (this._status == TASK_STATUS_NEW);
  },

  get taskType() {
    return TASK_TYPE_EXPERIMENT;
  },

  get status() {
    return this._status;
  },

  get infoPageUrl() {
    return "chrome://testpilot/content/datastore.html";
  },

  onUrlLoad: function TestPilotExperiment_onUrlLoad() {
    // TODO leave blank?
  },

  executeTask: function TestPilotExperiment_execute() {
    this._upload();
  },

  _upload: function TestPilotExperiment_upload() {
    let uploadData = MetadataCollector.getMetadata();
    uploadData.contents = this._dataStore.barfAllData();
    let dataString = encodeURI(JSON.stringify(uploadData));

    let params = "testid=" + this._id + "&data=" + dataString;
    // TODO note there is an 8MB max on POST data in PHP, so if we have a REALLY big
    // pile we may need to do multiple posts.

    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
    req.open('POST', DATA_UPLOAD_URL, true);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-length", params.length);
    req.setRequestHeader("Connection", "close");
    req.onreadystatechange = function(aEvt) {
      if (req.readyState == 4) {
	if (req.status == 200) {
	  // TODO handle success by changing task state
	  dump("DATA WAS POSTED SUCCESSFULLY " + req.responseText + "\n");
	} else {
	  // TODO handle failure by notifying user or scheduling a retry
	  dump("ERROR POSTING DATA: " + req.responseText + "\n");
	}
      }
    }
    req.send( params );
  },

  delete: function TestPilotExperiment_delete() {
    this._dataStore.wipeAllData();
  }
};


function TestPilotSurvey(surveyUrl, surveyTitle, surveyId, window, menu) {
  this._init(surveyUrl, surveyTitle, surveyId, window, menu);
}
TestPilotSurvey.prototype = {
  _init: function TestPilotSurvey__init(surveyUrl, surveyTitle, surveyId, window, menu) {
    this._surveyUrl = surveyUrl;
    this._surveyTitle = surveyTitle;
    this._id = surveyId;
    this._browser = window.getBrowser();

    // Check prefs for status, default to NEW
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id, TASK_STATUS_NEW);

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

  get taskType() {
    return TASK_TYPE_SURVEY;
  },

  get status() {
    return this._status;
  },

  get infoPageUrl() {
    return this._surveyUrl;
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
    // Stop the blinking/ regenerate the menu items
    Observers.notify("testpilot:task:changed", "", null);
  },

  executeTask: function TestPilotExperiment_upload() {
    this._takeSurvey();
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

let MetadataCollector = {
  // Collects metadata such as what country you're in, what extensions you have installed, etc.
  getExtensions: function MetadataCollector_getExtensions() {
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/extensions/public/nsIExtensionManager.idl
    //http://lxr.mozilla.org/aviarybranch/source/toolkit/mozapps/update/public/nsIUpdateService.idl#45
    var ExtManager = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
    var nsIUpdateItem = Ci.nsIUpdateItem;
    var items = [];
    var names = [];
    items = ExtManager.getItemList(nsIUpdateItem.TYPE_EXTENSION,{});
    for (var i = 0; i < items.length; ++i) {
      names.push(items[i].name);
    }
    return names;
  },

  getLocation: function MetadataCollector_getLocation() {
    //navitagor.geolocation; // or nsIDOMGeoGeolocation
    // we don't want the lat/long, we just want the country
    return "us"; // TODO
  },

  getVersion: function MetadataCollector_getVersion() {
    // Detects firefox version.
    return "3.5"; // TODO
  },

  // TODO: OS version
  // Locale (not the same as geolocation neccessarily)
  // Number of bookmarks?
  // TODO if we make a GUID for the user, we keep it here.

  getMetadata: function MetadataCollector_getMetadata() {
    return { extensions: MetadataCollector.getExtensions(),
	     location: MetadataCollector.getLocation(),
	     version: MetadataCollector.getVersion() };
  }

};


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
      let newMenuItem = this.window.document.createElement("menuitem");
      newMenuItem.setAttribute("label", "  " + task.title);
      if (task.status == TASK_STATUS_NEW) {
	// Give it a new icon
        newMenuItem.setAttribute("class", "menuitem-iconic");
        newMenuItem.setAttribute("image", "chrome://testpilot/skin/new.png");
      }
      if (task.status >= TASK_STATUS_CANCELLED) {
	// Disable it if it's cancelled or submitted
        newMenuItem.setAttribute("disabled", true);
        newMenuItem.setAttribute("label", "  (Completed)" + task.title);
      }
      newMenuItem.taskObject = task;
      let refElement = null;
      if (task.taskType == TASK_TYPE_EXPERIMENT) {
        // Hide the 'no-tests-yet' menu item, because there is a test:
        this.window.document.getElementById("no-tests-yet").hidden = true;
        refElement = window.document.getElementById("test-menu-separator");
      } else if (task.taskType == TASK_TYPE_SURVEY) {
        refElement = window.document.getElementById("survey-menu-separator");
      }
      this.notificationsMenu.insertBefore(newMenuItem, refElement);
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

    // Regenerate that menu
    // TODO clear the menu here...
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
    TestPilotSetup.addTask(new TestPilotSurvey(SURVEY_URL,
                                               "Survey For New Test Pilots",
                                               "survey_for_new_pilots",
                                               this.window,
                                               this.notificationsMenu));

    TestPilotSetup.addTask(new TestPilotExperiment(1,
						   "Tab Open/Close Experiment",
					           TabsExperimentDataStore,
					           TabsExperimentObserver,
					           START_DATE,
                                                   END_DATE,
                                                   this.window,
						   this.notificationsMenu));
  }
};



