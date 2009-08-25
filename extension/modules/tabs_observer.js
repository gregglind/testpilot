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

EXPORTED_SYMBOLS = ["TabsExperimentObserver"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://testpilot/modules/experiment_data_store.js");

// TODO make sure this can be correctly installed on multiple windows!!!
var TabsExperimentObserver = {
  install: function TabsExperimentObserver_install(browser) {
    let container = browser.tabContainer;
    container.addEventListener("TabOpen", this.onTabOpened, false);
    container.addEventListener("TabClose", this.onTabClosed, false);
    container.addEventListener("TabSelect", this.onTabSelected, false);

    // TODO what other events can we listen for here?
  },

  uninstall: function TabsExperimentObserver_uninstall(browser) {
    let container = browser.tabContainer;
    container.removeEventListener("TabOpen", this.onTabOpened, false);
    container.removeEventListener("TabClose", this.onTabClosed, false);
    container.removeEventListener("TabSelect", this.onTabSelected, false);
  },

  onTabOpened: function TabsExperimentObserver_onTabOpened(event) {
    // What else can I grab out of this event?
    // have we got event.button?  event.charCode or keyCode?

    // And the tab URL, which I would then chop/hash/compare to figure out what's up
    /* let i;
    for (i in event) {
      dump("  Event." + i + " = " + event[i] + "\n");
      }*/
    let index = event.target.parentNode.getIndexOfItem(event.target);  
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.OPEN_EVENT,
	  timestamp: Date.now(),
	  tab_position: index
    });
    // TODO add tab_position, tab_parent_position, tab_window, tab_parent_window,
    // ui_method, tab_site_hash, and num_tabs.
    // event has properties:
    // target, originalTarget, currentTarget, type.
    // Maybe target is the tab XUL element?
  },

  onTabClosed: function TabsExperimentObserver_onTabClosed(event) {
    let index = event.target.parentNode.getIndexOfItem(event.target);  
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.CLOSE_EVENT,
	  timestamp: Date.now(),
	  tab_position: index
    });
  },

  onTabSelected: function TabsExperimentObserver_onTabSelected(event) {
    let index = event.target.parentNode.getIndexOfItem(event.target);  
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.SWITCH_EVENT,
	  timestamp: Date.now(),
	  tab_position: index
    });
  }
};
