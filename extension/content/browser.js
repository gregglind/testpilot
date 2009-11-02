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

Components.utils.import("resource://testpilot/modules/setup.js");

function openAboutTestPilotPage() {
  var url = "http://testpilot.mozillalabs.com";
  var browser = window.getBrowser();
  var tab = browser.addTab(url);
  browser.selectedTab = tab;
}

function openUpcomingTestsPage() {
  var url = "https://wiki.mozilla.org/Labs/Test_Pilot";
  var browser = window.getBrowser();
  var tab = browser.addTab(url);
  browser.selectedTab = tab;
}

/* For support of taskbar-button menu: */
function doPopup(event) {
  TestPilotSetup.populateMenu(window);
}

function onMenuPopupHiding() {
  var menuPopup = document.getElementById('pilot-menu-popup');
  var menu = document.getElementById('pilot-menu');
  if (menuPopup.parentNode != menu)
    menu.appendChild(menuPopup);
}

function onMenuButtonMouseDown() {
  var menuPopup = document.getElementById('pilot-menu-popup');
  var menuButton = document.getElementById("pilot-notifications-button");

  if (menuPopup.parentNode != menuButton)
    menuButton.appendChild(menuPopup);

  menuPopup.openPopup(menuButton, "before_start", 0, 0, true);
}

function window_onLoad() {
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
        dump("Oh hey, startup is done, now I can tell test pilot about my window.\n");
        observerSvc.removeObserver(this, "testpilot:startup:complete");
        TestPilotSetup.onWindowLoad(window);
      }
    };
    dump("We're still starting up so I can't tell test pilot about my window yet.\n");
    observerSvc.addObserver(observer, "testpilot:startup:complete", false);
  }
}

function window_onUnload() {
  TestPilotSetup.onWindowUnload(window);
}

window.addEventListener("load", window_onLoad, false);
window.addEventListener("unload", window_onUnload, false);
