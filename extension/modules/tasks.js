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

EXPORTED_SYMBOLS = ["TaskConstants", "TestPilotSurvey", "TestPilotExperiment"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://testpilot/modules/Observers.js");
Components.utils.import("resource://testpilot/modules/metadata.js");

const STATUS_PREF_PREFIX = "extensions.testpilot.taskstatus.";
const DATA_UPLOAD_URL = "https://testpilot.mozillalabs.com/upload/index.php";

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

const TaskConstants = {
 STATUS_NEW: 0,
 STATUS_PENDING : 1,
 STATUS_IN_PROGRESS : 2,
 STATUS_FINISHED : 3,
 STATUS_CANCELLED : 4,
 STATUS_SUBMITTED : 5,
 STATUS_RESULTS : 6, // Test finished AND final results visible somewhere

 TYPE_EXPERIMENT : 1,
 TYPE_SURVEY : 2
};

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

// Prototype for both TestPilotSurvey and TestPilotExperiment.
var TestPilotTask = {
  _id: null,
  _title: null,
  _status: null,
  _url: null,
  _browser: null,

  _taskInit: function TestPilotTask__taskInit(id, title, infoPageUrl) {
    this._id = id;
    this._title = title;
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id,
                                              TaskConstants.STATUS_NEW);
    this._url = infoPageUrl;
  },

  get title() {
    return this._title;
  },

  get isNew() {
    return (this._status == TaskConstants.STATUS_NEW);
  },

  get taskType() {
    return null;
  },

  get status() {
    return this._status;
  },

  get infoPageUrl() {
    return this._url;
  },

  onNewWindow: function TestPilotTask_setWindow(window) {
    this._browser = window.getBrowser();
  },

  onUrlLoad: function TestPilotTask_onUrlLoad(url) {
  },

  changeStatus: function TPS_changeStatus(newStatus) {
    this._status = newStatus;
    // Set the pref:
    Application.prefs.setValue(STATUS_PREF_PREFIX + this._id, newStatus);
    // Stop the blinking/ regenerate the menu items
    Observers.notify("testpilot:task:changed", "", null);
  },

  executeTask: function TestPilotTask_upload() {
    let tab = this._browser.addTab(this.infoPageUrl);
    this._browser.selectedTab = tab;
    if (this._status == TaskConstants.STATUS_NEW) {
      this.changeStatus(TaskConstants.STATUS_PENDING);
    }
  }
};

function TestPilotExperiment(id, title, url, dataStore, observer, startDate, endDate) {
  this._init(id, title, url, dataStore, observer, startDate, endDate);
}
TestPilotExperiment.prototype = {
  _init: function TestPilotExperiment__init(id,
					    title,
                                            url,
					    dataStore,
					    observer,
					    startDate,
					    endDate) {
    this._taskInit(id, title, url);
    this._dataStore = dataStore;
    // Observer is a constructor.  Constructing one will install it in the
    // window too.
    this._observerConstructor = observer;
    // TODO: Install this only if it date is between startDate and endDate.
  },

  get taskType() {
    return TaskConstants.TYPE_EXPERIMENT;
  },

  onNewWindow: function TestPilotExperiment_setWindow(window) {
    // TODO make it so this can be called multiple times, once per window...
    this._browser = window.getBrowser();
    let Observer = this._observerConstructor;
    this._observer = new Observer(window);
  },

  upload: function TestPilotExperiment_upload() {
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
TestPilotExperiment.prototype.__proto__ = TestPilotTask;


function TestPilotSurvey(id, title, url) {
  this._init(id, title, url);
}
TestPilotSurvey.prototype = {
 _init: function TestPilotSurvey__init(id, title, url) {
    this._taskInit(id, title, url);
    if (this._status < TaskConstants.STATUS_SUBMITTED) {
      this.checkForCompletion();
    }
  },

  get taskType() {
    return TaskConstants.TYPE_SURVEY;
  },

  checkForCompletion: function TestPilotSurvey_checkForCompletion() {
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
	    self.changeStatus( TaskConstants.STATUS_SUBMITTED );
	  }
        } else {
          dump("Error loading page\n");
	}
      }
    };
    req.send(null);
  },

  onUrlLoad: function TPS_onUrlLoad(url) {
    if (url == this._url && this._status == TaskConstants.STATUS_NEW) {
      this.changeStatus( TaskConstants.STATUS_PENDING );
    }
  }

};
TestPilotSurvey.prototype.__proto__ = TestPilotTask;
