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

// The TestPilotSetup object will choose one of these implementations to instantiate

EXPORTED_SYMBOLS = ["CustomNotificationManager", "PopupNotificationManager"];

/* The notification manager interface looks like this:
  showNotification: function(window, task, options, callback) {},
  hideNotification: function(window, callback) {}
*/

/* CustomNotificationManager: the one where notifications
 * come up from the Test Pilot icon in the addon bar.  For Firefox 3.6. */
function CustomNotificationManager(anchorToFeedbackButton) {
  this._anchorToFeedback = anchorToFeedbackButton;
}
CustomNotificationManager.prototype = {
  showNotification: function TP_OldNotfn_showNotification(window, options) {
    let doc = window.document;
    let popup = doc.getElementById("pilot-notification-popup");
    let anchor;
    if (this._anchorToFeedback) {
      /* If we're in the Ffx4Beta version, popups come down from feedback
       * button, but if we're in the standalone extension version, they
       * come up from status bar icon. */
      anchor = doc.getElementById("feedback-menu-button");
      popup.setAttribute("class", "tail-up");
    } else {
      anchor = doc.getElementById("pilot-notifications-button");
      popup.setAttribute("class", "tail-down");
    }
    let textLabel = doc.getElementById("pilot-notification-text");
    let titleLabel = doc.getElementById("pilot-notification-title");
    let icon = doc.getElementById("pilot-notification-icon");
    let submitBtn = doc.getElementById("pilot-notification-submit");
    let closeBtn = doc.getElementById("pilot-notification-close");
    let link = doc.getElementById("pilot-notification-link");
    let alwaysSubmitCheckbox =
      doc.getElementById("pilot-notification-always-submit-checkbox");
    let self = this;

    popup.setAttribute("noautohide", !(options.fragile));
    if (options.title) {
      titleLabel.setAttribute("value", options.title);
    }
    while (textLabel.lastChild) {
      textLabel.removeChild(textLabel.lastChild);
    }
    if (options.text) {
      textLabel.appendChild(doc.createTextNode(options.text));
    }
    if (options.iconClass) {
      // css will set the image url based on the class.
      icon.setAttribute("class", options.iconClass);
    }

    if (options.submitLabel && options.alwaysSubmitLabel) {
      alwaysSubmitCheckbox.setAttribute("hidden", false);
      alwaysSubmitCheckbox.setAttribute("label", options.alwaysSubmitLabel);
    } else {
      alwaysSubmitCheckbox.setAttribute("hidden", true);
    }

    if (options.submitLabel) {
      submitBtn.setAttribute("label", options.submitLabel);
      submitBtn.onclick = function(event) {
        if (event.button == 0) {
          if (alwaysSubmitCheckbox.checked && options.alwaysSubmitCallback) {
            options.alwaysSubmitCallback();
          }
          options.submitCallback();
          self.hideNotification(window, options.closeCallback);
        }
      };
    }
    submitBtn.setAttribute("hidden", !options.submitLabel);

    // Create the link if specified:
    if (options.moreInfoLabel) {
      link.setAttribute("value", options.moreInfoLabel);
      link.setAttribute("class", "notification-link");
      link.onclick = function(event) {
        if (event.button == 0) {
          options.moreInfoCallback();
          self.hideNotification(window, options.closeCallback);
        }
      };
      link.setAttribute("hidden", false);
    } else {
      link.setAttribute("hidden", true);
    }

    closeBtn.onclick = function() {
      self.hideNotification(window, options.closeCallback);
    };

    // Show the popup:
    popup.hidden = false;
    popup.setAttribute("open", "true");
    popup.openPopup( anchor, "after_end");
  },

  hideNotification: function TP_OldNotfn_hideNotification(window, callback) {
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.hidePopup();
    if (callback) {
      callback();
    }
  }
};

// For Fx 4.0 + , uses the built-in doorhanger notification system (but with my own anchor icon)
function PopupNotificationManager(anchorToFeedbackButton) {
  this._popupModule = {};
  Components.utils.import("resource://gre/modules/PopupNotifications.jsm", this._popupModule);
  this._anchorToFeedbackButton = anchorToFeedbackButton;
  this._pn = null;
}
PopupNotificationManager.prototype = {
  showNotification: function TP_NewNotfn_showNotification(window, options) {
    // hide any existing notification so we don't get a weird stack
    this.hideNotification();
    let self = this;

    let tabbrowser = window.getBrowser();
    let panel = window.document.getElementById("testpilot-notification-popup");
    let iconBox = window.document.getElementById("tp-notification-popup-box");

    // TODO this is recreating PopupNotifications every time... should create once and store ref, but
    // can we do that without the window ref?
    this._pn = new this._popupModule.PopupNotifications(tabbrowser, panel, iconBox);

    let popupId = options.iconClass ? options.iconClass : "study-submitted";
    let moreInfoOption = null;
    let defaultOption = null;
    let additionalOptions = [];

    // There must be at least one of submit button and link, otherwise this doesn't work.
    if (options.moreInfoLabel) {
      moreInfoOption = {label: options.moreInfoLabel,
                        accessKey: "M",
                        callback: function() {
                          options.moreInfoCallback();
                          self.hideNotification();
                        }};
    }

    if (options.submitLabel) {
      defaultOption = { label: options.submitLabel,
                        accessKey: "S",
                        callback: function() {
                          options.submitCallback();
                          self.hideNotification();
                        }};
    } else if (moreInfoOption) {
      // If submit not provided, use the 'more info' as the default button.
      defaultOption = moreInfoOption;
    }

    if (options.submitLabel && moreInfoOption) {
      additionalOptions.push(moreInfoOption);
    }

    if (options.seeAllStudiesLabel) {
      additionalOptions.push({ label: options.seeAllStudiesLabel,
                               accessKey: "A",
                               callback: function() {
                                 options.seeAllStudiesCallback();
                                 self.hideNotification();
                               }});

    }

    if (options.alwaysSubmitLabel) {
      additionalOptions.push({ label: options.alwaysSubmitLabel,
                               accessKey: "D",
                               callback: function() {
                                 options.alwaysSubmitCallback();
                                 if (options.submitCallback) {
                                   options.submitCallback();
                                 }
                                 self.hideNotification();
                               }});
    }

    if (options.cancelLabel) {
      additionalOptions.push({ label: options.cancelLabel,
                               accessKey: "C",
                               callback: function() {
                                 options.cancelCallback();
                                 self.hideNotification();
                               }});
    }

    this._notifRef = this._pn.show(window.getBrowser().selectedBrowser,
                             popupId,
                             options.text,
                             "tp-notification-popup-icon", // All TP notifications use this icon
                             defaultOption,
                             additionalOptions,
                             {persistWhileVisible: true,
                              timeout: 5000,
                              removeOnDismissal: !(!options.fragile),
                              title: options.title,
                              closeButtonFunc: function() {
                                self.hideNotification();
                              },
                              eventCallback: function(stateChange){
                                /* Note - closeCallback() will be called AFTER the button handler,
                                 * and will be called no matter whether the notification is closed via
                                 * close button or a menu button item.
                                 */
                                if (stateChange == "removed" && options.closeCallback) {
                                  options.closeCallback();
                                }
                              }}); // should make it not disappear for at least 5s?
    // See http://mxr.mozilla.org/mozilla-central/source/toolkit/content/PopupNotifications.jsm
  },

  hideNotification: function TP_NewNotfn_hideNotification() {
    if (this._notifRef && this._pn) {
      this._pn.remove(this._notifRef);
    }
  }
};
