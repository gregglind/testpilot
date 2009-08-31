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

var g_nextWindowId = 1;

// TODO make sure this can be correctly installed on multiple windows!!!
function TabsExperimentObserver(window) {
  this._init(window);
}
TabsExperimentObserver.prototype = {
  _init: function TabsExperimentObserver__init(window) {
    this._lastEventWasClick = null;
    this._window = window;
    this._windowId = g_nextWindowId;
    g_nextWindowId ++;
    this.install();
  },

  install: function TabsExperimentObserver_install() {
    let browser = this._window.getBrowser() 
    let container = browser.tabContainer;
    // Can we catch the click event during the capturing phase??
    // last argument of addEventListener is true to catch during capture, false to catch during bubbling.
    var self = this;
    container.addEventListener("TabOpen",
                               function(event) {self.onTabOpened(event);},
                               false);
    container.addEventListener("TabClose",
                               function(event) {self.onTabClosed(event);},
                               false);
    container.addEventListener("TabSelect",
                               function(event) {self.onTabSelected(event);},
                               false);

    // TODO what other events can we listen for here?  What if we put the
    // listener on the browser or the window?

    container.addEventListener("mousedown",
                               function(event) {self.onClick(event);},
                               true);
    container.addEventListener("mouseup",
                               function(event) {self.onMouseUp(event);},
                               true);
    container.addEventListener("keydown",
                               function(event) {self.onKey(event);},
                               true);
  },

  uninstall: function TabsExperimentObserver_uninstall(browser) {
    // TODO this is Never actually called...
    let container = browser.tabContainer;
    container.removeEventListener("TabOpen", this.onTabOpened, false);
    container.removeEventListener("TabClose", this.onTabClosed, false);
    container.removeEventListener("TabSelect", this.onTabSelected, false);
    container.removeEventListener("mousedown", this.onClick, true);
    container.removeEventListener("mouseup", this.onMouseUp, true);
    container.removeEventListener("keydown", this.onKey, true);

  },

  onClick: function TabsExperimentObserver_onClick(event) {
    dump("You clicked on tabs bar.\n");
    this._lastEventWasClick = true;
  },
  
  onMouseUp: function TabsExperimentObserver_onMouseUp(event) {
    dump("You released your click on the tabs bar.\n");
    this._lastEventWasClick = false;
  },

  getUrlInTab: function TabsExperimentObserver_getUrlInTab(index) {
    var tabbrowser = this._window.getBrowser();
    var currentBrowser = tabbrowser.getBrowserAtIndex(index);
    if (!currentBrowser.currentURI) {
      return null;
    }
    return currentBrowser.currentURI.spec;
  },

  onTabOpened: function TabsExperimentObserver_onTabOpened(event) {
    dump("Tab opened. Last event was click? " + this._lastEventWasClick + "\n");
    // TODO Not registering click here on open events -- because mouse up and
    // mousedown both happen before the tab open event.
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;
    dump("Recording uiMethod of " + uiMethod + "\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    let url = this.getUrlInTab(index);
    if (url == "about:blank") {
      // Url will be undefined if you open a new blank tab, but it will be
      // "about:blank" if you opened the tab through a link (or by opening a
      // recently-closed tab from the history menu).  Go figure.
      uiMethod = TabsExperimentConstants.UI_LINK;
    }
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.OPEN_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
    // TODO add tab_position, tab_parent_position, tab_window, tab_parent_window,
    // ui_method, tab_site_hash, and num_tabs.
    // event has properties:
    // target, originalTarget, currentTarget, type.
    // Target is the tab.  currentTarget is the tabset (xul:tabs).
  },

  onTabClosed: function TabsExperimentObserver_onTabClosed(event) {
    dump("Tab closed.\n");
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    // TODO not registering click here on close events.
    // cuz mouseup and mousedown both happen before the tab open event.
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.CLOSE_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
  },

  onTabSelected: function TabsExperimentObserver_onTabSelected(event) {
    // TODO there is an automatic tab-selection event after each open and
    // after each close.  Right now these get listed as 'keyboard', which is
    // not accurate.  Should we try to figure them out and mark them as auto-
    // matic?
    let index = event.target.parentNode.getIndexOfItem(event.target);
    let windowId = this._windowId;
    dump("Tab selected.  Last event was click? " + this._lastEventWasClick + "\n");
    let uiMethod = this._lastEventWasClick ? TabsExperimentConstants.UI_CLICK:TabsExperimentConstants.UI_KEYBOARD;

    dump("Recording uiMethod of " + uiMethod + "\n");
    TabsExperimentDataStore.storeEvent({
      event_code: TabsExperimentConstants.SWITCH_EVENT,
      timestamp: Date.now(),
      tab_position: index,
      num_tabs: event.target.parentNode.itemCount,
      ui_method: uiMethod,
      tab_window: windowId
    });
  }
};
