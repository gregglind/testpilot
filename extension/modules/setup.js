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

Components.utils.import("resource://testpilot/modules/notifications.js");
Components.utils.import("resource://testpilot/modules/Observers.js");

const EXTENSION_ID = "testpilot@labs.mozilla.com";
const VERSION_PREF ="extensions.testpilot.lastversion";
const FIRST_RUN_PREF ="extensions.testpilot.firstRunUrl";
const TEST_PILOT_HOME_PAGE = "http://testpilot.mozillalabs.com";
const SURVEY_URL = "http://www.surveymonkey.com/s.aspx?sm=bxR0HNhByEBfugh8GPASvQ_3d_3d";

let Application = Cc["@mozilla.org/fuel/application;1"]
                  .getService(Ci.fuelIApplication);


function TestPilotSurvey(surveyUrl) {
  this._init(surveyUrl);
}
TestPilotSurvey.prototype = {
  _init: function TestPilotSurvey__init(surveyUrl) {
    this._surveyUrl = surveyUrl;
  },

  checkStatus: function TestPilotSurvey_isTaskComplete(window) {
    var self = this;
    // Note, the following depends on SurveyMonkey and will break if
    // SurveyMonkey changes their 'survey complete' page.
    let surveyCompletedText = "Thanks for taking the survey.";
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance( Ci.nsIXMLHttpRequest );
    req.open('GET', self._surveyUrl, true);
    req.onreadystatechange = function (aEvt) {
      if (req.readyState == 4) {
        if (req.status == 200)
          if (req.responseText.indexOf(surveyCompletedText) == -1) {
            self.addTaskNotification(window);
          }
        else
          dump("Error loading page\n");
      }
    };
    req.send(null);
  },

  addTaskNotification: function TPS_addTaskNotification(window) {
    let desc = "There is a Test Pilot survey for you to take.";
    let browser = window.getBrowser();
    let surveyUrl = this._surveyUrl;

    let takeSurvey = function() {
      let tab = browser.addTab(surveyUrl);
      browser.selectedTab = tab;
      return true;
    };

    let takeSurveyButton = new NotificationButton(
      "Take it now",
      "T",
      takeSurvey
    );
    let notification = new Notification("Test Pilot Survey", desc, null,
                                        Notifications.PRIORITY_INFO,
                                        [takeSurveyButton]);
    Notifications.replaceTitle(notification);
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
  },

  onBrowserWindowLoaded: function TPS_onBrowserWindowLoaded(window) {
    if (!this.isSetupComplete) {
      // Compare the version in our preferences from our version in the
      // install.rdf.
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
      this.isSetupComplete = true;
      var self = this;
      Observers.add("testpilot:notification:added", this.onNotificationAdded,
                    self);
      Observers.add("testpilot:notification:removed", this.onNotificationRemoved,
                    self);

      this.setClickHandler();

      // TODO take this out of here and put it somewhere else... or hit a
      // Test Pilot Central site and download a list of tasks.
      TestPilotSetup.addTask(new TestPilotSurvey(SURVEY_URL));

      this.checkForTasks();
    }
  },

  onNotificationAdded: function TPS_onNotificationAdded() {
    // Begin blinking icon
    if (!this._blinker) {
      var theButton = this.notificationsButton;
      var rotation = false;
      this._blinker = this.window.setInterval( function() {
                                                 rotation = !(rotation);
                                                 if (rotation)
                                                   theButton.image = "chrome://global/skin/icons/information-16.png";
                                                 else
                                                   theButton.image = "chrome://testpilot/skin/testpilot_16x16.png";
                                               }, 1000 );
    }
    this.removeClickHandler();
  },

  onNotificationRemoved: function TPS_onNotificationRemoved() {
    // If notifications are gone, stop blinking icon.
    if (Notifications.notifications.length == 0) {
      if (this._blinker) {
        this.window.clearInterval(this._blinker);
        this.notificationsButton.image = "chrome://testpilot/skin/testpilot_16x16.png";
        this._blinker = null;
      }
      this.setClickHandler();
    }
  },

  setClickHandler: function() {
    var browser = this.window.getBrowser();
    this.notificationsButton.onclick = function() {
      let tab = browser.addTab( TEST_PILOT_HOME_PAGE );
      browser.selectedTab = tab;
      return false;
    };
    this.notificationsButton.popup = "";
  },

  removeClickHandler: function() {
    this.notificationsButton.onclick = null;
    this.notificationsButton.popup = "pilot-notifications-panel";
    //this.window.document.getElementById("pilot-notifications-panel");
  },

  get version() {
    return Application.extensions.get(EXTENSION_ID).version;
  },

  checkForTasks: function TPS_checkForTasks() {
    let i;
    for (i = 0; i < this.taskList.length; i++) {
      this.taskList[i].checkStatus(this.window);
    }
  }
};



