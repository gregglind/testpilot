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
const START_DATE_PREF_PREFIX = "extensions.testpilot.startDate.";
const RECUR_PREF_PREFIX = "extensions.testpilot.reSubmit.";
const RETRY_INTERVAL_PREF = "extensions.testpilot.uploadRetryInterval";
const DATA_UPLOAD_URL = "https://testpilot.mozillalabs.com/upload/index.php";


const TaskConstants = {
 STATUS_NEW: 0, // It's new and you haven't seen it yet.
 STATUS_PENDING : 1,  // You've seen it but it hasn't started.
 STATUS_STARTING: 2,  // Data collection started but notification not shown.
 STATUS_IN_PROGRESS : 3, // Started and notification shown.
 STATUS_FINISHED : 4, // Finished and awaiting your choice.
 STATUS_CANCELLED : 5, // You've opted out and not submitted anything.
 STATUS_SUBMITTED : 6, // You've submitted your data.
 STATUS_RESULTS : 7, // Test finished AND final results visible somewhere
 STATUS_ARCHIVED: 8, // You've seen the results; there's nothing more to do.

 TYPE_EXPERIMENT : 1,
 TYPE_SURVEY : 2,

 ALWAYS_SUBMIT: 1,
 NEVER_SUBMIT: -1,
 ASK_EACH_TIME: 0
};
/* Note that experiments use all 9 status codes, but surveys don't have a
 * data collection period so they are never STARTING or IN_PROGRESS or
 * FINISHED, they go straight from PENDING to SUBMITTED or CANCELED. */

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);

// Prototype for both TestPilotSurvey and TestPilotExperiment.
var TestPilotTask = {
  _id: null,
  _title: null,
  _status: null,
  _url: null,

  _taskInit: function TestPilotTask__taskInit(id, title, infoPageUrl, webContent) {
    this._id = id;
    this._title = title;
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id,
                                              TaskConstants.STATUS_NEW);
    this._url = infoPageUrl;
    this._webContent = webContent;
  },

  get title() {
    return this._title;
  },

  get id() {
    return this._id;
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

  get webContent() {
    return this._webContent;
  },

  get resultsUrl() {
    return undefined;
  },

  onExperimentStartup: function TestPilotTask_onExperimentStartup() {
  },

  onExperimentShutdown: function TestPilotTask_onExperimentShutdown() {
  },

  onAppStartup: function TestPilotTask_onAppStartup() {
    // Called by extension core when startup is complete.
  },

  onAppShutdown: function TestPilotTask_onAppShutdown() {
    // TODO: not implemented - should be called when firefox is ready to
    // shut down.
  },

  onEnterPrivateBrowsing: function TestPilotTask_onEnterPrivate() {
    // TODO: not implemented - should be called when firefox enters
    // private browsing mode.
  },

  onExitPrivateBrowsing: function TestPilotTask_onExitPrivate() {
    // TODO: not implemented - should be called when firefox returns from
    // private browsing mode.
  },

  onNewWindow: function TestPilotTask_onNewWindow(window) {
  },

  onWindowClosed: function TestPilotTask_onWindowClosed(window) {
  },

  onUrlLoad: function TestPilotTask_onUrlLoad(url) {
  },

  checkDate: function TestPilotTask_checkDate() {
  },

  changeStatus: function TPS_changeStatus(newStatus, suppressNotification) {
    dump("Changing status to " + newStatus + "\n");
    this._status = newStatus;
    // Set the pref:
    Application.prefs.setValue(STATUS_PREF_PREFIX + this._id, newStatus);
    // Notify user of status change:
    if (!suppressNotification) {
      Observers.notify("testpilot:task:changed", "", null);
    }
  },

  loadPage: function TestPilotTask_loadPage() {
    // TODO if the URL is already open in a tab, it should switch
    // to that tab instead of opening another copy.
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Ci.nsIWindowMediator);
    // TODO Is "most recent" the same as "front"?
    let window = wm.getMostRecentWindow("navigator:browser");
    let browser = window.getBrowser();
    let tab = browser.addTab(this.infoPageUrl);
    browser.selectedTab = tab;
    /* Advance the status when the user sees the page, so that we can stop
     * notifying them about stuff they've seen. */
    if (this._status == TaskConstants.STATUS_NEW) {
      this.changeStatus(TaskConstants.STATUS_PENDING);
    } else if (this._status == TaskConstants.STATUS_STARTING) {
      this.changeStatus(TaskConstants.STATUS_IN_PROGRESS);
    } else if (this._status == TaskConstants.STATUS_RESULTS) {
      this.changeStatus( TaskConstants.STATUS_ARCHIVED );
    }

  }
};

function TestPilotExperiment(expInfo, dataStore, handlers, webContent) {
  // All four of these are objects defined in the remoet experiment file
  this._init(expInfo, dataStore, handlers, webContent);
}
TestPilotExperiment.prototype = {
  _init: function TestPilotExperiment__init(expInfo,
					    dataStore,
					    handlers,
                                            webContent) {
    /* expInfo is a dictionary defined in the remote experiment code, which
     * should have the following properties:
     * startDate (string representation of date)
     * duration (number of days)
     * testName (human-readable string)
     * testId (int)
     * testInfoUrl (url)
     * testResultsUrl (url)
     * optInRequired  (boolean)
     * recursAutomatically (boolean)
     * recurrenceInterval (number of days)
     * versionNumber (int) */
    this._taskInit(expInfo.testId, expInfo.testName,
                   expInfo.testInfoUrl, webContent);
    this._dataStore = dataStore;
    this._testResultsUrl = expInfo.testResultsUrl;
    this._versionNumber = expInfo.versionNumber;
    this._optInRequired = expInfo.optInRequired;
    // TODO implement opt-in interface for tests that require opt-in.
    this._recursAutomatically = expInfo.recursAutomatically;
    this._recurrenceInterval = expInfo.recurrenceInterval;

    let prefName = START_DATE_PREF_PREFIX + this._id;
    let startDateString = Application.prefs.getValue(prefName, false);
    if (startDateString) {
      // If this isn't the first time we're starting, use the start date
      // already stored in prefs.
      this._startDate = Date.parse(startDateString);
    } else {
      // If a start date is provided in expInfo, use that.
      // Otherwise, start immediately!
      if (expInfo.startDate) {
        this._startDate = Date.parse(expInfo.startDate);
        Application.prefs.setValue(prefName, expInfo.startDate);
      } else {
        this._startDate = Date.now();
        Application.prefs.setValue(prefName, (new Date()).toString());
      }
    }

    // Duration is specified in days:
    let duration = expInfo.duration || 7; // default 1 week
    this._endDate = this._startDate + duration * (24 * 60 * 60 * 1000);
    dump("Start date is " + this._startDate.toString() + "\n");
    dump("End date is " + this._endDate.toString() + "\n");

    this._handlers = handlers;
    this._uploadRetryTimer = null;

    // checkDate will see what our status is with regards to the start and
    // end dates, and set status appropriately.
    this.checkDate();

    if (this.experimentIsRunning) {
      this.onExperimentStartup();
    }
  },

  get taskType() {
    return TaskConstants.TYPE_EXPERIMENT;
  },

  get endDate() {
    return this._endDate;
  },

  get dataStore() {
    return this._dataStore;
  },

  get dataStoreAsJSON() {
    return this._dataStore.getAllDataAsJSON();
  },

  get infoPageUrl() {
    let param = "?eid=" + this._id;
    switch (this._status) {
      case TaskConstants.STATUS_NEW:
      case TaskConstants.STATUS_PENDING:
      case TaskConstants.STATUS_STARTING:
      case TaskConstants.STATUS_IN_PROGRESS:
      case TaskConstants.STATUS_FINISHED:
        return "chrome://testpilot/content/status.html" + param;
      break;
      case TaskConstants.STATUS_CANCELLED:
        return "chrome://testpilot/content/status-cancelled.html" + param;
      break;
      case TaskConstants.STATUS_SUBMITTED:
        return "chrome://testpilot/content/status-thanks.html" + param;
      break;
      case TaskConstants.STATUS_RESULTS:
      case TaskConstants.STATUS_ARCHIVED:
        // Return the results page, if we have one...
      if (this._testResultsUrl != undefined) {
        return this._testResultsUrl;
      } else {
        return "chrome://testpilot/content/status-thanks.html" + param;
      }
      break;
    }
    return this._url;
  },

  get resultsUrl() {
    return this._testResultsUrl;
  },

  get recurPref() {
    let prefName = RECUR_PREF_PREFIX + this._id;
    return Application.prefs.getValue(prefName, TaskConstants.ASK_EACH_TIME);
  },

  getWebContent: function TestPilotExperiment_getWebContent() {
    switch (this._status) {
      case TaskConstants.STATUS_NEW:
      case TaskConstants.STATUS_PENDING:
        return this.webContent.upcomingHtml;
      break;
      case TaskConstants.STATUS_STARTING:
      case TaskConstants.STATUS_IN_PROGRESS:
        return this.webContent.inProgressHtml;
      break;
      case TaskConstants.STATUS_FINISHED:
        return this.webContent.completedHtml;
      break;
    }
    // TODO what to do if status is cancelled, submitted, results, or archived?
    return "";
  },

  experimentIsRunning: function TestPilotExperiment_isRunning() {
    if (this._optInRequired) {
      return (this._status == TaskConstants.STATUS_STARTING ||
              this._status == TaskConstants.STATUS_IN_PROGRESS );
    } else {
      // Tests that don't require extra opt-in should start running even
      // if you haven't seen them yet.
      return (this._status < TaskConstants.STATUS_FINISHED);
    }
  },

  // Pass events along to handlers:
  onNewWindow: function TestPilotExperiment_onNewWindow(window) {
    dump("Experiment.onNewWindow called.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onNewWindow(window);
    }
  },

  onWindowClosed: function TestPilotExperiment_onWindowClosed(window) {
    dump("Experiment.onWindowClosed called.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onWindowClosed(window);
    }
  },

  onAppStartup: function TestPilotExperiment_onAppStartup() {
    dump("Experiment.onAppStartup called.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onAppStartup();
    }
  },

  onAppShutdown: function TestPilotExperiment_onAppShutdown() {
    dump("Experiment.onAppShutdown called.\n");
    // TODO the caller for this is not yet implemented
    if (this.experimentIsRunning()) {
      this._handlers.onAppShutdown();
    }
  },

  onExperimentStartup: function TestPilotExperiment_onStartup() {
    dump("Experiment.onExperimentStartup called.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onExperimentStartup(this._dataStore);
    }
  },

  onExperimentShutdown: function TestPilotExperiment_onShutdown() {
    dump("Experiment.onExperimentShutdown called.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onExperimentShutdown();
    }
  },

  onEnterPrivateBrowsing: function TestPilotExperiment_onEnterPrivate() {
    dump("Task is entering private browsing.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onEnterPrivateBrowsing();
    }
  },

  onExitPrivateBrowsing: function TestPilotExperiment_onExitPrivate() {
    dump("Task is exiting private browsing.\n");
    if (this.experimentIsRunning()) {
      this._handlers.onExitPrivateBrowsing();
    }
  },

  _reschedule: function TestPilotExperiment_reschedule() {
    // Schedule next run of test:
    // add recurrence interval to start date and store!
    let ms = this._recurrenceInterval * (24 * 60 * 60 * 1000);
    // recurrenceInterval is in days, convert to milliseconds:
    this._startDate += ms;
    this._endDate += ms;
    let prefName = START_DATE_PREF_PREFIX + this._id;
    Application.prefs.setValue(prefName,
                               (new Date(this._startDate)).toString());
  },

  checkDate: function TestPilotExperiment_checkDate() {
    // This method handles all date-related status changes and should be
    // called periodically.
    let currentDate = Date.now();

    // Reset automatically recurring tests:
    if (this._recursAutomatically &&
        this._status >= TaskConstants.STATUS_FINISHED &&
        currentDate >= this._startDate &&
        currentDate <= this._endDate ) {
      // if we've done a permanent opt-out, then don't start over-
      // just keep rescheduling.
      if (this.recurPref == TaskConstants.NEVER_SUBMIT) {
        this._reschedule();
      } else {
        // Normal case is reset to new.
        this.changeStatus(TaskConstants.STATUS_NEW);
      }
    }

    // No-opt-in required tests skip PENDING and go straight to STARTING.
    if (!this._optInRequired &&
        this._status < TaskConstants.STATUS_STARTING &&
        currentDate >= this._startDate &&
        currentDate <= this._endDate){
      this.changeStatus(TaskConstants.STATUS_STARTING);
      this._handlers.onExperimentStartup();
    }

    // What happens when a test finishes:
    if (this._status < TaskConstants.STATUS_FINISHED &&
	currentDate >= this._endDate ) {
      dump("Passed End Date - Switched Task Status to Finished\n");
      this.changeStatus( TaskConstants.STATUS_FINISHED );
      this._handlers.onExperimentShutdown();

      if (this._recursAutomatically) {
        this._reschedule();
        // A recurring experiment may have been set to automatically submit. If
        // so, submit now!
        if (this.recurPref == TaskConstants.ALWAYS_SUBMIT) {
          this.upload( function() {} );
        }
      }
    }

    if (this._status == TaskConstants.STATUS_SUBMITTED &&
        this._testResultsUrl != undefined) {
      // If we've submitted data and a results URL is defined, bump status
      // up to RESULTS and let user know that the results are now available.
      this.changeStatus( TaskConstants.STATUS_RESULTS );
    }
  },

  _appendMetadataToCSV: function TestPilotExperiment__appendMetadata() {
    let rows = this._dataStore.getAllDataAsCSV();
    let metadata = MetadataCollector.getMetadata();
    rows[0] = rows[0] + ", extensions, location, fx_version, os, exp_version";
    if (metadata.extensions.length > 0) {
      rows[1] = rows[1] + ", " + metadata.extensions[0];
    }
    rows[1] = rows[1] + ", " + metadata.location + ", " + metadata.version + ", ";
    rows[1] = rows[1] + metadata.operatingSystem + ", " + this._versionNumber;

    for (let i = 1; i < metadata.extensions.length; i++) {
      rows[i + 1] = rows[i + 1] + metadata.extensions[i];
    }
    return rows.join("\n");
  },

  // Note: When we have multiple experiments running, the uploads
  // are separate files.
  upload: function TestPilotExperiment_upload(callback) {
    // Callback is a function that will be called back with true or false
    // on success or failure.

    /* If we've already uploaded, and the user tries to upload again for
     * some reason (they could navigate back to the status.html page,
     * for instance), then proceed without uploading: */
    if (this._status >= TaskConstants.STATUS_SUBMITTED) {
      callback(true);
      return;
    }

    let dataString = this._appendMetadataToCSV();

    let params = "testid=" + this._id + "&data=" + encodeURI(dataString);
    // TODO note there is an 8MB max on POST data in PHP, so if we have a REALLY big
    // pile we may need to do multiple posts.
    var self = this;

    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
    req.open('POST', DATA_UPLOAD_URL, true);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Content-length", params.length);
    req.setRequestHeader("Connection", "close");
    req.onreadystatechange = function(aEvt) {
      if (req.readyState == 4) {
	if (req.status == 200) {
	  dump("DATA WAS POSTED SUCCESSFULLY " + req.responseText + "\n");
          if (self._uploadRetryTimer) {
            self._uploadRetryTimer.cancel(); // Stop retrying - it worked!
          }
          self.changeStatus( TaskConstants.STATUS_SUBMITTED );
	  dump("I did changeStatus, now wiping...\n");
	  self._dataStore.wipeAllData();
	  dump("I wiped, now doing callback...\n");
          callback(true);
	} else {
	  dump("ERROR POSTING DATA: " + req.responseText + "\n");
          /* Something went wrong with the upload?
           * Exit for now, but try again in an hour; maybe the network will
           * be working better by then.  Note that this means Test Pilot will
           * retry once an hour until either Firefox is restarted or until
           * we succeed.
           */
          self._uploadRetryTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
          let interval = Application.prefs.getValue(RETRY_INTERVAL_PREF,
                                                    3600000); // 1 hour
          self._uploadRetryTimer.initWithCallback(
            {notify: function(timer) {self.upload(function() {});}},
            interval, Ci.nsITimer.TYPE_ONE_SHOT);
	  callback(false);
	}
      }
    };
    req.send( params );
  },

  optOut: function TestPilotExperiment_optOut(reason) {
    this.changeStatus(TaskConstants.STATUS_CANCELLED);
    this._dataStore.wipeAllData();
    dump("Opting out of test with reason " + reason + "\n");
    if (reason) {
      // Send us the reason...
      let params = "testid=" + this._id + "&data=" + encodeURI(reason);
      var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
      dump("Posting " + params + " to " + DATA_UPLOAD_URL + "\n");
      req.open('POST', DATA_UPLOAD_URL, true);
      req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      req.setRequestHeader("Content-length", params.length);
      req.setRequestHeader("Connection", "close");
      req.onreadystatechange = function(aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
	    dump("Quit reason posted successfully " + req.responseText + "\n");
	  } else {
	    dump(req.status + " posting error " + req.responseText +"\n");
	  }
	}
      };
      dump("Sending quit reason.\n");
      req.send( params );
    }
  },

  setRecurPref: function TPE_setRecurPrefs(value) {
    // value is NEVER_SUBMIT, ALWAYS_SUBMIT, or ASK_EACH_TIME
    let prefName = RECUR_PREF_PREFIX + this._id;
    Application.prefs.setValue(prefName, value);
  }
};
TestPilotExperiment.prototype.__proto__ = TestPilotTask;


function TestPilotWebSurvey(id, title, url, resultsUrl) {
  this._init(id, title, url, resultsUrl);
}
TestPilotWebSurvey.prototype = {
  _init: function TestPilotWebSurvey__init(id, title, url, resultsUrl) {
    this._taskInit(id, title, url);
    this._resultsUrl = resultsUrl;
    dump("Initing survey.  This._status is " + this._status + "\n");
    if (this._status < TaskConstants.STATUS_RESULTS) {
      this.checkForCompletion();
    }
  },

  get taskType() {
    return TaskConstants.TYPE_SURVEY;
  },

  get infoPageUrl() {
    if (this._status >= TaskConstants.STATUS_RESULTS &&
        this._resultsUrl != undefined) {
      return this._resultsUrl;
    } else {
      return this._url;
    }
  },

  get resultsUrl() {
    return this._resultsUrl;
  },

  checkForCompletion: function TestPilotWebSurvey_checkForCompletion() {
    var self = this;
    dump("Checking for survey completion...\n");
    // Note, the following depends on SurveyMonkey and will break if
    // SurveyMonkey changes their 'survey complete' page.
    let surveyCompletedText = "Thank you for completing our survey!";
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
    req.open('GET', self._url, true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if (req.status == 200) {
          if (req.responseText.indexOf(surveyCompletedText) > -1) {
            dump("Survey is completed.\n");
            if (self._resultsUrl != undefined) {
              dump("Setting survey status to RESULTS\n");
              self.changeStatus( TaskConstants.STATUS_RESULTS, true );
            } else {
              dump("Setting survey status to SUBMITTED\n");
              self.changeStatus( TaskConstants.STATUS_SUBMITTED, true );
            }
            dump("Survey status is now " + self._status + "\n");
	  }
        } else {
          dump("Error loading page\n");
	}
      }
    };
    req.send(null);
  },

  onUrlLoad: function TPS_onUrlLoad(url) {
    /* Viewing the appropriate URL makes survey status progress from
     * NEW (havent' seen survey) to PENDING (seen it but not done it).
     * So we can stop notifying people about the survey once they've seen it.*/
    if (url == this._url && this._status == TaskConstants.STATUS_NEW) {
      this.changeStatus( TaskConstants.STATUS_PENDING );
    }
  }

};
TestPilotWebSurvey.prototype.__proto__ = TestPilotTask;


function TestPilotBuiltinSurvey(id, title, questions, resultsUrl) {
  this._init(id, title, questions, resultsUrl);
}
TestPilotBuiltinSurvey.prototype = {
  _init: function TestPilotBuiltinSurvey__init(id, title, questions, resultsUrl) {
    //TODO
  },

  get taskType() {
    return TaskConstants.TYPE_SURVEY;
  },

  get infoPageUrl() {
    // TODO - something like chrome/content/takesurvey.html?eid= myid
  },

  get resultsUrl() {
    // TODO
  },

  checkForCompletion: function() {
    // TODO
  },

  onUrlLoad: function() {
    // TODO
  }
  // TODO upload, or store for upload along with associated study.
};