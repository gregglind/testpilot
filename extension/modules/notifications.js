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

// let's be DISENTANGLEBUDDIES

// The TestPilotSetup object will choose one of these implementations to instantiate

EXPORTED_SYMBOLS = ["OldNotificationManager", "NewNotificationManager", "AndroidNotificationManager"];

function BaseNotificationManager() {
}
BaseNotificationManager.prototype = {
  showNotification: function TP_BaseNotfn_showNotification(window, task, options, callback) {
  },

  hideNotification: function TP_BaseNotfn_hideNotification(window, callback) {
  }
};

// The one where they come up from the Test Pilot icon in the addon bar.  For 3.6.
function OldNotificationManager(anchorToFeedbackButton) {
  this._anchorToFeedback = anchorToFeedbackButton;
}
OldNotificationManager.prototype = {
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

    // Set all appropriate attributes on popup:
    if (options.isExtensionUpdate) {
      popup.setAttribute("tpisextensionupdate", "true");
    }
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

    alwaysSubmitCheckbox.setAttribute("hidden", !options.showAlwaysSubmitCheckbox);
    if (options.showSubmit) {
      submitBtn.setAttribute("label", options.submitButtonLabel);
      submitBtn.onclick = function() {
        if (event.button == 0) {
          options.submitButtonCallback();
          self.hideNotification(window, options.closeCallback);
        }
      };
    }
    submitBtn.setAttribute("hidden", !options.showSubmit);

    // Create the link if specified:
    if (options.linkText && (options.linkCallback)) {
      link.setAttribute("value", options.linkText);
      link.setAttribute("class", "notification-link");
      link.onclick = function(event) {
        if (event.button == 0) {
          options.linkCallback();
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
    dump("Opened popup.\n");
  },

  hideNotification: function TP_OldNotfn_hideNotification(window, callback) {
    let popup = window.document.getElementById("pilot-notification-popup");
    popup.hidden = true;
    popup.setAttribute("open", "false");
    popup.removeAttribute("tpisextensionupdate");
    popup.hidePopup();
    if (callback) {
      callback();
    }
  }
};
OldNotificationManager.prototype.__proto__ = new BaseNotificationManager();

// For Fx 4.0 + , uses the built-in doorhanger notification system (but with my own anchor icon)
function NewNotificationManager() {
  // TODO this is recreating PopupNotifications every time... shoudl create once and store ref, but
  // can we do that without the window ref?
}
NewNotificationManager.prototype = {
  showNotification: function TP_NewNotfn_showNotification(window, options) {
    Components.utils.import("resource://gre/modules/PopupNotifications.jsm");
    let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
                getService(Components.interfaces.nsIWindowMediator);
    let win = wm.getMostRecentWindow("navigator:browser");
    let tabbrowser = window.getBrowser();
    let panel = win.document.getElementById("notification-popup"); // borrowing the built-in panel
    let iconBox = win.document.getElementById("tp-notification-popup-box");
    let pn = new PopupNotifications(tabbrowser, panel, iconBox);

    let popupId = "tp-complete-popup";
    if (options.iconClass) {
      popupId = "tp-" + options.iconClass + "-popup";
    }

    let moreInfoOption = null;
    let defaultOption = null;
    let additionalOptions = [];

    // There must be at least one of submit button and link, otherwise this doesn't work.
    if (options.linkText) {
      moreInfoOption = {label: options.linkText,
                        accessKey: "M",
                        callback: options.linkCallback};
    }

    if (options.showSubmit) {
      defaultOption = { label: options.submitButtonLabel,
                        accessKey: "S",
                        callback: options.submitButtonCallback};
      if (moreInfoOption) {
        additionalOptions.push(moreInfoOption);
      }
      // If there's a submit button, there needs to be a cancel button:
      // TODO info for cancel button needs to be provided!!
      additionalOptions.push({ label: "Cancel",
                               accessKey: "C",
                               callback: function() {
                               } });
      // Instead of checkbox, put an 'always submit' option:
      additionalOptions.push({ label: "Submit automatically (stop asking)",
                               callback: function() {
                                 // TODO this needs to come from somewhere??
                               } });

    } else if (moreInfoOption) {
      // If submit not provided, use the 'more info' as the default button.
      defaultOption = moreInfoOption;
    }

    pn.show(window.getBrowser().selectedBrowser,
            popupId,
            options.title + options.text,  // TODO how to make title look.... title-y?
            "tp-notification-popup-icon", // All TP notifications use this icon
            defaultOption,
            additionalOptions,
            {persistWhileVisible: true});

    // Options Currently Unimplemented:  options.closeCallback, options.fragile,
    // options.isExtensionUpdate.
  },

  hideNotification: function TP_NewNotfn_hideNotification() {
  }
};
NewNotificationManager.prototype.__proto__ = new BaseNotificationManager();

// The one where it goes into Android notification bar.
function AndroidNotificationManager() {
}
AndroidNotificationManager.prototype = {
  showNotification: function TP_AndNotfn_showNotification(window, options) {
  },

  hideNotification: function TP_AndNotfn_hideNotification() {
  }
};
AndroidNotificationManager.prototype.__proto__ = new BaseNotificationManager();