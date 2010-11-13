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

/* Dynamically construct interface for bootstrapping add-on.
 * Decide based on Firefox version and update channel settings whether
 * to construct 1. the 3.5 / 3.6 Test Pilot UI;
 * 2. the Feedback UI;
 * 3. the 4.0 final Test Pilot UI (with icon in new add-on bar?)
 */

// A lot of the stuff that's currently in browser.js can get moved here.

EXPORTED_SYMBOLS = ["TestPilotUIBuilder"];

const Cc = Components.classes;
const Ci = Components.interfaces;

var TestPilotUIBuilder = {
  _makeElement: function(window, tagName, attributes) {
    let elem =  window.document.createElement(tagName);
    for (let x in attributes) {
      let value = attributes[x];
      if (value.indexOf("&") == 0 &&
          value.indexOf(";") == value.length -1) {
        value = this._getTextFromDtd(value);
      }
      let attrName = x;
      if (attrName == "className") {
        attrName = "class";
      }
      elem.setAttribute(attrName, value);
    }
    return elem;
  },

  _getTextFromDtd: function() {
    // TODO how do I do this?
  },

  buildNotificationPopup: function(window) {
    let self = this;
    let newElem = function( tagName, attrs) {
      return self._makeElement(window, tagName, attrs);
    };
    let panel = newElem("panel",  {id: "pilot-notification-popup",
                                   hidden: "true",
                                   noautofocus: "true",
                                   level: "parent",
                                   position: "after_start"});
    let vbox = newElem("vbox", {className: "pilot-notification-popup-container"});
    panel.appendChild(vbox);
    let hbox = newElem("hbox", {className: "pilot-notification-toprow"});
    vbox.appendChild(hbox);
    hbox.appendChild(newElem("image", {id: "pilot-notification-icon"}));
    let vbox2 = newElem("vbox", {pack: "center"});
    hbox.appendChild(vbox2);
    vbox2.appendChild(newElem("label", {id: "pilot-notification-title",
                                        className: "pilot-title"}));
    hbox.appendChild(newElem("spacer", {flex: "1"}));
    let vbox3 = newElem("vbox", {pack: "start"});
    vbox3.appendChild(newElem("image",
                              {id: "pilot-notification-close",
                              tooltiptext: "&testpilot.notification.close.tooltip;"
                              }));
    vbox.appendChild(newElem("description", {id: "pilot-notification-text"}));
    let hbox2 = newElem("hbox", {align: "right"});
    hbox2.appendChild(newElem("label", {id: "pilot-notification-link"}));
    vbox.appendChild(hbox2);
    let hbox3 = newElem("hbox", {});
    hbox3.appendChild(newElem("checkbox",
                              {id: "pilot-notification-always-submit-checkbox",
                               label: "&testpilot.settings.alwaysSubmitData.label"
                              }));
    hbox3.appendChild(newElem("spacer", {flex: "1"}));
    vbox.appendChild(hbox3);
    let hbox4 = newElem("hbox", {align: "right"});
    hbox4.appendChild(newElem("button", {id: "pilot-notification-submit"}));

    return panel;
  },

  buildFeedbackMenu: function(window) {
    let self = this;
    let newElem = function( tagName, attrs) {
      return self._makeElement(window, tagName, attrs);
    };
    let menu = newElem("menu", {
                         id: "pilot-menu",
                         className: "menu-iconic",
                         label: "&testpilot.feedbackbutton.label;",
                         insertafter: "addonsManager"});
    let popup = newElem("menupopup", {
                          id: "pilot-menu-popup",
                          onpopupshowing: "TestPilotMenuUtils.onPopupShowing(event);",
                          onpopuphiding: "TestPilotMenuUtils.onPopupHiding(event);"
                        });
    menu.appendChild(popup);
    popup.appendChild(newElem("menuitem", {
                                 id: "feedback-menu-happy-button",
                                 className: "menuitem-iconic",
                                 image: "chrome://testpilot-os/skin/feedback-smile-16x16.png",
                                 label: "&testpilot.happy.label;",
                                 oncommand: "TestPilotWindowUtils.openFeedbackPage(true);"
                               }));
    popup.appendChild(newElem("menuitem", {
                                 id: "feedback-menu-sad-button",
                                 className: "menuitem-iconic",
                                 image: "chrome://testpilot-os/skin/feedback-frown-16x16.png",
                                 label: "&testpilot.sad.label;",
                                 oncommand: "TestPilotWindowUtils.openFeedbackPage(false);"
                               }));
    popup.appendChild(newElem("menuseparator"));
    popup.appendChild(newElem("menuitem", {
                                id: "feedback-menu-show-studies",
                                label: "&testpilot.allYourStudies.label;",
                                oncommand: "TestPilotWindowUtils.openAllStudiesWindow();"
                              }));
    popup.appendChild(newElem("menuitem", {
                                id: "feedback-menu-enable-studies",
                                label: "&testpilot.enable.label;",
                                oncommand: "TestPilotMenuUtils.togglePref('runStudies');"
                              }));
    return menu;
  },

  buildTestPilotMenu: function(window) {
    let self = this;
    let newElem = function( tagName, attrs) {
      return self._makeElement(window, tagName, attrs);
    };
    let menu = newElem("menu", {
                         id: "pilot-menu",
                         className: "menu-iconic",
                         label: "&testpilot.brand.label;",
                         insertafter: "addonsManager",
                         image: "chrome://testpilot/skin/testpilot_16x16.png"
                       });
    let popup = newElem("menupopup", {
                          id: "pilot-menu-popup",
                          onpopuphiding: "TestPilotMenuUtils.onPopupHiding(event);"
                        });
    menu.appendChild(popup);
    let subMenu = newElem("menu", {
                             id: "pilot-notification-settings",
                             label: "&testpilot.settings.label;"
                          });
    popup.appendChild(subMenu);
    let subPopup = newElem("menupopup", {
                             onpopupshowing: "TestPilotMenuUtils.updateSubmenu();"
                           });
    subMenu.appendChild(subPopup);
    subPopup.appendChild(newElem("menuitem", {
                                  className: "pilot-notify-me-when",
                                  label: "&testpilot.settings.notifyWhen.label;",
                                  disabled: "true"}));
    subPopup.appendChild(newElem("menuitem", {
                                  id: "pilot-menu-notify-finished",
                                  label: "&testpilot.settings.readyToSubmit.label;",
                                  type: "checkbox",
                                  oncommand: "TestPilotMenuUtils.togglePref('popup.showOnStudyFinished');"
                                }));
    subPopup.appendChild(newElem("menuitem", {
                                  id: "pilot-menu-notify-new",
                                  label: "&testpilot.settings.newStudy.label;",
                                  type: "checkbox",
                                  oncommand: "TestPilotMenuUtils.togglePref('popup.showOnNewStudy');"
                                }));
    subPopup.appendChild(newElem("menuitem", {
                                  id: "pilot-menu-notify-results",
                                  label: "&testpilot.settings.hasNewResults.label;",
                                  type: "checkbox",
                                  oncommand: "TestPilotMenuUtils.togglePref('popup.showOnNewResults');"
                                }));
    subPopup.appendChild(newElem("menuseparator", {}));
    subPopup.appendChild(newElem("menuitem", {
                                  id: "pilot-menu-always-submit-data",
                                  label: "&testpilot.settings.alwaysSubmitData.label;",
                                  type: "checkbox",
                                   oncommand: "TestPilotMenuUtils.togglePref('alwaysSubmitData');"
                                }));
    popup.appendChild(newElem("menuitem", {
                                label: "&testpilot.allYourStudies.label;",
                                oncommand: "TestPilotWindowUtils.openAllStudiesWindow();"
                              }));
    popup.appendChild(newElem("menuitem", {
                                label: "&testpilot.about.label;",
                                oncommand: "TestPilotWindowUtils.openHomepage();"
                              }));
    return menu;
  },

  addFeedbackButton: function(window) {
    let self = this;
    let newElem = function( tagName, attrs) {
      return self._makeElement(window, tagName, attrs);
    };

    let button = newElem("toolbarbutton",
                         { type: "menu",
                           id: "feedback-menu-button",
                           className: "toolbarbutton-1",
                           label: "&testpilot.feedbackbutton.label;",
                           onmousedown: "event.preventDefault();\
                           TestPilotMenuUtils.onMenuButtonMouseDown('feedback-menu-button');"
                         });
    let palette = window.document.getElementById("BrowserToolbarPalette");
    palette.appendChild(button);
  },

  addTestPilotButton: function(window) {
    let self = this;
    let newElem = function( tagName, attrs) {
      return self._makeElement(window, tagName, attrs);
    };
    let notificationPopup = this.buildNotificationPopup();

    let properties = {id: "pilot-notifications-button",
                      className: "statusbarpanel-iconic",
                      insertbefore: "security-button",
                      onmousedown: "event.preventDefault();\
                      TestPilotMenuUtils.onMenuButtonMouseDown();",
                      image: "chrome://testpilot/skin/testpilot_16x16.png"
                     };
    // Add to either add-on bar or status bar, whichever is present:
    let addOnBar = window.document.getElementById("addon-bar");
    let statusBar = window.document.getElementById("status-bar");
    if (addOnBar) {
      let button = newElem("toolbaritem", properties);
      addOnBar.appendChild(button);
      addOnBar.appendChild(notificationPopup);
    } else if (statusBar) {
      let button = newElem("statusbarpanel", properties);
      statusBar.appendChild(button);
      statusBar.appendChild(notificationPopup);
    }
  },

  buildTestPilotInterface: function(window) {
    this.addTestPilotButton(window);
    let menu = this.buildTestPilotMenu(window);
    // Insert this menu into
    // id="menu_ToolsPopup" right after "menu_openAddons":
    let toolsMenu = window.document.getElementById("menu_ToolsPopup");
    if (toolsMenu) {
      let prevChild = window.document.getElementById("menu_openAddons");
      toolsMenu.insertBefore(menu, prevChild.nextSibling);
    }

    // In firefox 4 on Windows, there may not be any menu tools popup!!
    // Where do we put it then?

    // TODO apply chrome://testpilot/content/browser.css
    // TODO get chrome://testpilot/content/browser.js and window-utils.js
  },

  buildFeedbackInterface: function(window) {
    this.addFeedbackButton(window);

    // TODO apply chrome://testpilot/content/browser.css
    // TODO apply chrome://testpilot-os/skin/feedback.css
    // TODO get chrome://testpilot/content/browser.js and window-utils.js

  },

  buildCorrectInterface: function(window) {
  }
};