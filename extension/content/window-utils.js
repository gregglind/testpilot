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

const ALL_STUDIES_WINDOW_NAME = "theTestPilotAllStudiesWindow";
const ALL_STUDIES_WINDOW_TYPE = "extensions:testpilot:all_studies_window";

var TestPilotWindowUtils = {
  openAllStudiesWindow: function() {
    // If the window is not already open, open it; but if it is open,
    // focus it instead.
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator);
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
  },

  openInTab: function(url) {
    // TODO if already open in a tab, go to that tab rather than re-opening
    var browser = window.getBrowser();
    var tab = browser.addTab(url);
    browser.selectedTab = tab;
  },

  openChromeless: function(url) {
    var win = window.open(url, "TestPilotStudyDetailWindow",
                         "chrome,centerscreen,resizable=yes,scrollbars=yes," +
                         "status=no,width=900,height=600");
    win.focus();
  }
};