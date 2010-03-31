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

const ALL_STUDIES_WINDOW_NAME = "theTestPilotAllStudiesWindow";
const ALL_STUDIES_WINDOW_TYPE = "extensions:testpilot:all_studies_window";

Cu.import("resource://testpilot/modules/setup.js");


// Namespace object
var TestPilotMenuUtils = {
  openPage: function(url) {
    // TODO if already open in a tab, go to that tab rather than re-opening
    var browser = window.getBrowser();
    var tab = browser.addTab(url);
    browser.selectedTab = tab;
  },

  updateSubmenu: function() {
    var ntfyMenuFin = document.getElementById("notify-menu-finished");
    var ntfyMenuNew = document.getElementById("notify-menu-new");
    var ntfyMenuResults = document.getElementById("notify-menu-results");
    var Application = Cc["@mozilla.org/fuel/application;1"]
                    .getService(Ci.fuelIApplication);
    ntfyMenuFin.setAttribute("checked", Application.prefs.getValue(
                               POPUP_SHOW_ON_FINISH, false));
    ntfyMenuNew.setAttribute("checked", Application.prefs.getValue(
                               POPUP_SHOW_ON_NEW, false));
    ntfyMenuResults.setAttribute("checked", Application.prefs.getValue(
                               POPUP_SHOW_ON_RESULTS, false));
  },

  toggleNotiPref: function(id) {
    var prefName = "extensions.testpilot.popup." + id;
    var oldVal = Application.prefs.getValue(prefName, false);
    Application.prefs.setValue( prefName, !oldVal);
  },

  onPopupHiding: function() {
    var menuPopup = document.getElementById('pilot-menu-popup');
    var menu = document.getElementById('pilot-menu');
    if (menuPopup.parentNode != menu)
      menu.appendChild(menuPopup);
  },

  onMenuButtonMouseDown: function() {
    var menuPopup = document.getElementById('pilot-menu-popup');
    var menuButton = document.getElementById("pilot-notifications-button");

    if (menuPopup.parentNode != menuButton)
      menuButton.appendChild(menuPopup);

    menuPopup.openPopup(menuButton, "before_start", 0, 0, true);
  },

  openAllStudiesWindow: function() {
    // If the window is not already open, open it; but if it is open,
    // focus it instead.
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Ci.nsIWindowMediator);
    var allStudiesWindow = wm.getMostRecentWindow(ALL_STUDIES_WINDOW_TYPE);

    if (allStudiesWindow) {
      allStudiesWindow.focus();
    } else {
      allStudiesWindow = window.open(
        "chrome://testpilot/content/all-studies-window.xul",
        ALL_STUDIES_WINDOW_NAME,
        "chrome,centerscreen,resizable=no,scrollbars=yes,status=no,width=650,height=600"
      );
    }
  }
};


var TestPilotWindowHandlers = {
  onWindowLoad: function() {
    /* "Hold" window load events for TestPilotSetup, passing them along only
     * after startup is complete.  It's hacky, but the benefit is that
     * TestPilotSetup.onWindowLoad can treat all windows the same no matter
     * whether they opened with Firefox on startup or were opened later. */
    if (TestPilotSetup.startupComplete) {
      TestPilotSetup.onWindowLoad(window);
    } else {
      var observerSvc = Cc["@mozilla.org/observer-service;1"]
                           .getService(Ci.nsIObserverService);
      var observer = {
        observe: function(subject, topic, data) {
          observerSvc.removeObserver(this, "testpilot:startup:complete");
          TestPilotSetup.onWindowLoad(window);
        }
      };
      observerSvc.addObserver(observer, "testpilot:startup:complete", false);
    }
  },

  onWindowUnload: function() {
    TestPilotSetup.onWindowUnload(window);
  }
};

window.addEventListener("load", TestPilotWindowHandlers.onWindowLoad, false);
window.addEventListener("unload", TestPilotWindowHandlers.onWindowUnload, false);
