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

EXPORTED_SYMBOLS = ["TaskConstants", "TestPilotBuiltinSurvey",
                    "TestPilotExperiment", "TestPilotStudyResults"];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://testpilot/modules/Observers.js");
Components.utils.import("resource://testpilot/modules/metadata.js");
Components.utils.import("resource://testpilot/modules/log4moz.js");

const STATUS_PREF_PREFIX = "extensions.testpilot.taskstatus.";
const START_DATE_PREF_PREFIX = "extensions.testpilot.startDate.";
const RECUR_PREF_PREFIX = "extensions.testpilot.reSubmit.";
const RECUR_TIMES_PREF_PREFIX = "extensions.testpilot.recurCount.";
const SURVEY_ANSWER_PREFIX = "extensions.testpilot.surveyAnswers.";
const EXPIRATION_DATE_FOR_DATA_SUBMISSION_PREFIX =
  "extensions.testpilot.expirationDateForDataSubmission.";
const RETRY_INTERVAL_PREF = "extensions.testpilot.uploadRetryInterval";
const DATA_UPLOAD_URL = "https://testpilot.mozillalabs.com/upload/index.php";
const EXPIRATION_TIME_FOR_DATA_SUBMISSION = 7 * (24 * 60 * 60 * 1000); // 7 days
const DEFAULT_THUMBNAIL_URL = "chrome://testpilot/skin/new_study_48x48.png";

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
 TYPE_RESULTS : 3,

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

  _taskInit: function TestPilotTask__taskInit(id, title, url, summary, thumb) {
    this._id = id;
    this._title = title;
    this._status = Application.prefs.getValue(STATUS_PREF_PREFIX + this._id,
                                              TaskConstants.STATUS_NEW);
    this._url = url;
    this._summary = summary;
    this._thumbnail = thumb;
    this._logger = Log4Moz.repository.getLogger("TestPilot.Task_"+this._id);
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

  get webContent() {
    return this._webContent;
  },

  get summary() {
    if (this._summary) {
      return this._summary;
    } else {
      return this._title;
    }
  },

  get thumbnail() {
    if (this._thumbnail) {
      return this._thumbnail;
    } else {
      return DEFAULT_THUMBNAIL_URL;
    }
  },

  // urls:

  get infoPageUrl() {
    return this._url;
  },

  get currentStatusUrl() {
    return this._url;
  },

  get defaultUrl() {
    return this.infoPageUrl;
  },

  // event handlers:

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
  },

  onExitPrivateBrowsing: function TestPilotTask_onExitPrivate() {
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
    let logger = Log4Moz.repository.getLogger("TestPilot.Task");
    logger.info("Changing task " + this._id + " status to " + newStatus);
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
    let tab = browser.addTab(this.defaultUrl);
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
     * summary (string - couple of sentences explaining study)
     * thumbnail (url of an image representing the study)
     * optInRequired  (boolean)
     * recursAutomatically (boolean)
     * recurrenceInterval (number of days)
     * versionNumber (int) */
    this._taskInit(expInfo.testId, expInfo.testName, expInfo.testInfoUrl,
                   expInfo.summary, expInfo.thumbnail);
    this._webContent = webContent;
    this._dataStore = dataStore;
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
    this._logger.info("Start date is " + this._startDate.toString());
    this._logger.info("End date is " + this._endDate.toString());

    this._handlers = handlers;
    this._uploadRetryTimer = null;
    this._startedUpHandlers = false;

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

  get startDate() {
    return this._startDate;
  },

  get dataStore() {
    return this._dataStore;
  },

  get dataStoreAsJSON() {
    return this._dataStore.getAllDataAsJSON();
  },

  get currentStatusUrl() {
    let param = "?eid=" + this._id;
    return "chrome://testpilot/content/status.html" + param;
  },

  get defaultUrl() {
    return this.currentStatusUrl;
  },

  get recurPref() {
    let prefName = RECUR_PREF_PREFIX + this._id;
    return Application.prefs.getValue(prefName, TaskConstants.ASK_EACH_TIME);
  },

  getWebContent: function TestPilotExperiment_getWebContent() {
    let content;

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
      case TaskConstants.STATUS_CANCELLED:
        content = '<h2>You have quit the <a href="' + this.infoPageUrl +
          '">&quot;' + this.title + '&quot;</a> study.</h2>';
	if (this._dataStore.haveData() && this.webContent.remainDataHtml) {
          content += this.webContent.remainDataHtml;
	} else {
	  content += '<p>All data related to this study has been deleted from your computer.</p>';
	}
	content += '<p>Test Pilot will offer you new studies and surveys as they become available.</p>';
        return content;
      break;
      case TaskConstants.STATUS_SUBMITTED:
        content = '<h2>Thank you for submitting your ' +
          '<a href="' + this.infoPageUrl + '">&quot;' + this.title +
          '&quot;</a> study data!</h2>';
	if (this._dataStore.haveData() && this.webContent.remainDataHtml) {
          content += this.webContent.remainDataHtml;
	}
	content += '<h3>More tests are coming soon.  Stay tuned.</h3>' +
	  '<p>Test Pilot is no longer collecting data.  All the data that was collected has been transmitted to Mozilla and deleted from your computer.</p>' +
	  '<p>The results of the study will be available soon.  When they are ready to view, Test Pilot will let you know.</p>';
        return content;
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
    this._logger.trace("Experiment.onNewWindow called.");
    if (this.experimentIsRunning()) {
      this._handlers.onNewWindow(window);
    }
  },

  onWindowClosed: function TestPilotExperiment_onWindowClosed(window) {
    this._logger.trace("Experiment.onWindowClosed called.");
    if (this.experimentIsRunning()) {
      this._handlers.onWindowClosed(window);
    }
  },

  onAppStartup: function TestPilotExperiment_onAppStartup() {
    this._logger.trace("Experiment.onAppStartup called.");
    if (this.experimentIsRunning()) {
      this._handlers.onAppStartup();
    }
  },

  onAppShutdown: function TestPilotExperiment_onAppShutdown() {
    this._logger.trace("Experiment.onAppShutdown called.");
    // TODO the caller for this is not yet implemented
    if (this.experimentIsRunning()) {
      this._handlers.onAppShutdown();
    }
  },

  onExperimentStartup: function TestPilotExperiment_onStartup() {
    this._logger.trace("Experiment.onExperimentStartup called.");
    // Make sure not to call this if it's already been called:
    if (this.experimentIsRunning() && !this._startedUpHandlers) {
      this._logger.trace("  ... starting up handlers!");
      this._handlers.onExperimentStartup(this._dataStore);
      this._startedUpHandlers = true;
    }
  },

  onExperimentShutdown: function TestPilotExperiment_onShutdown() {
    this._logger.trace("Experiment.onExperimentShutdown called.");
    if (this.experimentIsRunning() && this._startedUpHandlers) {
      this._handlers.onExperimentShutdown();
      this._startedUpHandlers = false;
    }
  },

  onEnterPrivateBrowsing: function TestPilotExperiment_onEnterPrivate() {
    this._logger.trace("Task is entering private browsing.");
    if (this.experimentIsRunning()) {
      this._handlers.onEnterPrivateBrowsing();
    }
  },

  onExitPrivateBrowsing: function TestPilotExperiment_onExitPrivate() {
    this._logger.trace("Task is exiting private browsing.");
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

  get _numTimesRun() {
    // For automatically recurring tests, this is the number of times it
    // has recurred - it will be 1 on the first run, 2 on the second run,
    // etc.
    if (this._recursAutomatically) {
      return Application.prefs.getValue(RECUR_TIMES_PREF_PREFIX + this._id,
                                        1);
    } else {
      return 0;
    }
  },

  set _expirationDateForDataSubmission(date) {
    Application.prefs.setValue(
      EXPIRATION_DATE_FOR_DATA_SUBMISSION_PREFIX + this._id,
      (new Date(date)).toString());
  },

  get _expirationDateForDataSubmission() {
    let expirationDate = Date.now() + EXPIRATION_TIME_FOR_DATA_SUBMISSION;

    return Application.prefs.getValue(
      EXPIRATION_DATE_FOR_DATA_SUBMISSION_PREFIX + this._id,
      (new Date(expirationDate)).toString());
  },

  checkDate: function TestPilotExperiment_checkDate() {
    // This method handles all date-related status changes and should be
    // called periodically.
    let currentDate = Date.now();

    // Reset automatically recurring tests:
    if (this._recursAutomatically &&
        this._status >= TaskConstants.STATUS_FINISHED &&
        currentDate >= this._startDate &&
	currentDate <= this._endDate) {
      // if we've done a permanent opt-out, then don't start over-
      // just keep rescheduling.
      if (this.recurPref == TaskConstants.NEVER_SUBMIT) {
        this._logger.info("recurPref is never submit, so I'm rescheduling.");
        this._reschedule();
      } else {
        // Normal case is reset to new.
        this.changeStatus(TaskConstants.STATUS_NEW);

        // increment count of how many times this recurring test has run
        let numTimesRun = this._numTimesRun;
        numTimesRun++;
        this._logger.trace("Test recurring... incrementing " + RECUR_TIMES_PREF_PREFIX + this._id + " to " + numTimesRun);
        Application.prefs.setValue( RECUR_TIMES_PREF_PREFIX + this._id,
                                    numTimesRun );
        this._logger.trace("Incremented it.");
      }
    }

    // No-opt-in required tests skip PENDING and go straight to STARTING.
    if (!this._optInRequired &&
        this._status < TaskConstants.STATUS_STARTING &&
        currentDate >= this._startDate &&
        currentDate <= this._endDate) {
      // clear the data before starting.
      this._dataStore.wipeAllData();
      this.changeStatus(TaskConstants.STATUS_STARTING);
      this.onExperimentStartup();
    }

    // What happens when a test finishes:
    if (this._status < TaskConstants.STATUS_FINISHED &&
	currentDate > this._endDate) {
      this._logger.info("Passed End Date - Switched Task Status to Finished");
      this.changeStatus( TaskConstants.STATUS_FINISHED );
      this.onExperimentShutdown();

      if (this._recursAutomatically) {
        this._reschedule();
        // A recurring experiment may have been set to automatically submit. If
        // so, submit now!
        if (this.recurPref == TaskConstants.ALWAYS_SUBMIT) {
          this._logger.info("Automatically Uploading Data");
          this.upload( function() {} );
        } else if (this.recurPref == TaskConstants.NEVER_SUBMIT) {
          this._logger.info("Automatically opting out of uploading data");
          this.changeStatus( TaskConstants.STATUS_CANCELLED, true);
        } else {
          // set the expiration date for date submission
	  this._expirationDateForDataSubmission =
	    currentDate + EXPIRATION_TIME_FOR_DATA_SUBMISSION;
	}
      } else {
        // set the expiration date for date submission
	this._expirationDateForDataSubmission =
	  currentDate + EXPIRATION_TIME_FOR_DATA_SUBMISSION;
      }
    } else {
      // only do this if the state is already finished.
      if (this._status == TaskConstants.STATUS_FINISHED) {
	let expirationDate = Date.parse(this._expirationDateForDataSubmission);
	if (currentDate > expirationDate) {
          this.changeStatus(TaskConstants.STATUS_CANCELLED, true);
	}
      }
    }
  },

  _prependMetadataToCSV: function TestPilotExperiment__prependMetadata() {
    let rows = this._dataStore.getAllDataAsCSV();
    let metadata = MetadataCollector.getMetadata();
    let extLength = metadata.extensions.length;
    let accLength = metadata.accessibilities.length;
    let header = [];
    let enabledExtensions = [];
    let disabledExtensions = [];
    let accessibilityNames = [];
    let isAccEnabled = [];
    let extension;
    let accessibility;
    let i;

    for (i = 0; i < extLength; i++) {
      extension = metadata.extensions[i];
      if (extension.isEnabled) {
        enabledExtensions.push(extension.id);
      } else {
        disabledExtensions.push(extension.id);
      }
    }
    for (i = 0; i < accLength; i++) {
      accessibility = metadata.accessibilities[i];
      accessibilityNames.push(accessibility.name);
      isAccEnabled.push(accessibility.value);
    }
    header.push("fx_version, tp_version, exp_version, location, os, recurCount");
    header.push([metadata.fxVersion, metadata.tpVersion,
                 this._versionNumber, metadata.location,
                 metadata.operatingSystem, this._numTimesRun].join(", "));
    header.push("enabled_extensions");
    header.push(enabledExtensions.join(", "));
    header.push("disabled_extensions");
    header.push(disabledExtensions.join(", "));
    header.push("accessibilities");
    header.push(accessibilityNames.join(", "));
    header.push(isAccEnabled.join(", "));
    header.push("survey_answers");
    header.push(metadata.surveyAnswers);
    header.push("experiment_data");
    rows = header.concat(rows);
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

    let dataString = this._prependMetadataToCSV();

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
	  self._logger.info("DATA WAS POSTED SUCCESSFULLY " + req.responseText);
          if (self._uploadRetryTimer) {
            self._uploadRetryTimer.cancel(); // Stop retrying - it worked!
          }
          self.changeStatus( TaskConstants.STATUS_SUBMITTED );
	  // self._dataStore.wipeAllData();
          callback(true);
	} else {
	  self._logger.warn("ERROR POSTING DATA: " + req.responseText);
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

  optOut: function TestPilotExperiment_optOut(reason, callback) {
    let logger = this._logger;
    this.changeStatus(TaskConstants.STATUS_CANCELLED);
    logger.info("Opting out of test with reason " + reason);
    if (reason) {
      // Send us the reason...
      let params = "testid=" + this._id + "&data=" + encodeURI(reason);
      var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
      logger.trace("Posting " + params + " to " + DATA_UPLOAD_URL);
      req.open('POST', DATA_UPLOAD_URL, true);
      req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      req.setRequestHeader("Content-length", params.length);
      req.setRequestHeader("Connection", "close");
      req.onreadystatechange = function(aEvt) {
        if (req.readyState == 4) {
          if (req.status == 200) {
	    logger.info("Quit reason posted successfully " + req.responseText);
    	    callback(true);
	  } else {
	    logger.warn(req.status + " posting error " + req.responseText);
	    callback(false);
	  }
	}
      };
      logger.trace("Sending quit reason.");
      req.send( params );
    } else {
      callback(false);
    }
  },

  setRecurPref: function TPE_setRecurPrefs(value) {
    // value is NEVER_SUBMIT, ALWAYS_SUBMIT, or ASK_EACH_TIME
    let prefName = RECUR_PREF_PREFIX + this._id;
    this._logger.info("Setting recur pref to " + value);
    Application.prefs.setValue(prefName, value);
  }
};
TestPilotExperiment.prototype.__proto__ = TestPilotTask;

function TestPilotBuiltinSurvey(surveyInfo) {
  this._init(surveyInfo);
}
TestPilotBuiltinSurvey.prototype = {
  _init: function TestPilotBuiltinSurvey__init(surveyInfo) {
    this._taskInit(surveyInfo.surveyId,
                   surveyInfo.surveyName,
                   surveyInfo.surveyUrl,
                   surveyInfo.summary,
                   surveyInfo.thumbnail);
    this._questions = surveyInfo.surveyQuestions;
    this._explanation = surveyInfo.surveyExplanation;
  },

  get taskType() {
    return TaskConstants.TYPE_SURVEY;
  },

  get surveyExplanation() {
    return this._explanation;
  },

  get surveyQuestions() {
    return this._questions;
  },

  get currentStatusUrl() {
    let param = "?eid=" + this._id;
    return "chrome://testpilot/content/take-survey.html" + param;
  },

  get defaultUrl() {
    return this.currentStatusUrl;
  },

  onUrlLoad: function TPS_onUrlLoad(url) {
    /* Viewing the appropriate URL makes survey status progress from
     * NEW (havent' seen survey) to PENDING (seen it but not done it).
     * So we can stop notifying people about the survey once they've seen it.*/
    if (url == this._url && this._status == TaskConstants.STATUS_NEW) {
      this.changeStatus( TaskConstants.STATUS_PENDING );
    }
  },

  get oldAnswers() {
    let prefName = SURVEY_ANSWER_PREFIX + this._id;
    let answers = Application.prefs.getValue(prefName, null);
    if (!answers) {
      return null;
    } else {
      this._logger.info("Trying to json.parse this: " + answers);
      return JSON.parse(answers);
    }
  },

  store: function( answers ) {
    // Store answers in appropriate data store...
    // such as preferences store?
    let prefName = SURVEY_ANSWER_PREFIX + this._id;
    Application.prefs.setValue(prefName, JSON.stringify(answers));
    this.changeStatus( TaskConstants.STATUS_SUBMITTED);
  }
};
TestPilotBuiltinSurvey.prototype.__proto__ = TestPilotTask;

function TestPilotStudyResults(resultsInfo) {
  this._init(resultsInfo);
};
TestPilotStudyResults.prototype = {
  _init: function TestPilotStudyResults__init(resultsInfo) {
    this._taskInit( resultsInfo.id,
                    resultsInfo.title,
                    resultsInfo.url,
                    resultsInfo.summary,
                    resultsInfo.thumbnail);
    this._studyId = resultsInfo.studyId; // what study do we belong to
  },

  get taskType() {
    return TaskConstants.TYPE_RESULTS;
  }
};
TestPilotStudyResults.prototype.__proto__ = TestPilotTask;

