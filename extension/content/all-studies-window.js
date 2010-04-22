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

// TODO link to task.infoPageUrl?

// TODO fix layout in notification
// TODO add links to notification
// TODO make notification for "new survey"

// TODO Show individual status page in new chromeless window as html with
// background color set to "moz-dialog".

// TODO the whole menu bar disappears when the XUL window is up!  What's up
// with that?

// TODO general-purpose link to website's page of Upcoming Studies or what
// have you.

const NO_STUDIES_MSG = "We are working on a new study now, and it will\
 knock on your door soon! Stay Tuned!";
const NO_STUDIES_IMG = "chrome://testpilot/skin/testPilot_200x200.png";

var TestPilotXulWindow = {
  onSubmitButton: function(experimentId) {
    Components.utils.import("resource://testpilot/modules/setup.js");
    let task = TestPilotSetup.getTaskById(experimentId);
    let button = document.getElementById("submit-button-" + task.id);

    // Hide the upload button so it doesn't get clicked again...
    let parent = button.parentNode;
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
    // Replace it with a message:
    this.addLabel(parent, "Uploading...");
    let self = this;

    task.upload( function(success) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
      if (success) {
        self.addThanksMessage(parent);
        // TODO or should we move it to 'finished studies' immediately?
      } else {
        // TODO a better error message?
        self.addLabel(parent, "Unable to reach Mozilla; try again later.");
      }
    });

  },

  addThanksMessage: function(container) {
    // Fill in status box with icon and message to show success
    let hbox = document.createElement("hbox");
    container.appendChild(this.makeSpacer());
    container.appendChild(hbox);
    this.addLabel(container, "Thanks for contributing!");
    container.appendChild(this.makeSpacer());
    hbox.appendChild(this.makeSpacer());
    this.addImg(hbox, "study-submitted");
    hbox.appendChild(this.makeSpacer());
  },

  addXulLink: function (container, text, url) {
    let linkContainer = document.createElement("hbox");
    let link = document.createElement("label");
    let spacer = document.createElement("spacer");
    link.setAttribute("value", text);
    link.setAttribute("class", "text-link");
    link.setAttribute("onclick",
      "if (event.button==0) {TestPilotXulWindow.openURL('" + url + "');}");
    linkContainer.appendChild(link);
    spacer.setAttribute("flex", "1");
    linkContainer.appendChild(spacer);
    container.appendChild(linkContainer);
  },

  addLabel: function(container, text, styleClass) {
    let label = document.createElement("label");
    label.setAttribute("value", text);
    if (styleClass) {
      label.setAttribute("class", styleClass);
    }
    container.appendChild(label);
  },

  addImg: function(container, iconClass) {
    let newImg = document.createElement("image");
    newImg.setAttribute("class", iconClass);
    container.appendChild(newImg);
  },

  makeSpacer: function() {
    let spacer = document.createElement("spacer");
    spacer.setAttribute("flex", "1");
    return spacer;
  },

  addThumbnail: function(container, imgUrl) {
    let boundingBox = document.createElement("vbox");
    boundingBox.setAttribute("class", "results-thumbnail");
    let bBox2 = document.createElement("hbox");

    boundingBox.appendChild(this.makeSpacer());
    boundingBox.appendChild(bBox2);
    boundingBox.appendChild(this.makeSpacer());

    bBox2.appendChild(this.makeSpacer());
    let newImg = document.createElement("image");
    newImg.setAttribute("src", imgUrl);
    newImg.setAttribute("class", "results-thumbnail");
    bBox2.appendChild(newImg);
    bBox2.appendChild(this.makeSpacer());

    container.appendChild(boundingBox);
  },

  addProgressBar: function(container, percent) {
    let progBar = document.createElement("progressmeter");
    progBar.setAttribute("mode", "determined");
    progBar.setAttribute("value", Math.ceil(percent).toString());
    container.appendChild(progBar);
  },

  addDescription: function(container, title, paragraph) {
    let desc = document.createElement("description");
    desc.setAttribute("class", "study-title");
    let txtNode = document.createTextNode(title);
    desc.appendChild(txtNode);
    container.appendChild(desc);

    desc = document.createElement("description");
    desc.setAttribute("class", "study-description");
    desc.setAttribute("crop", "none");
    txtNode = document.createTextNode(paragraph);
    desc.appendChild(txtNode);
    container.appendChild(desc);
  },

  addButton: function(container, label, id, onClickHandler) {
    let button = document.createElement("button");
    button.setAttribute("label", label);
    button.setAttribute("id", id);
    button.setAttribute("oncommand", onClickHandler);
    container.appendChild(button);
  },

  openURL: function(url) {
    // Make the window smaller and dialog-boxier
    // Links to discussion group, twitter, etc should open in new
    // tab in main browser window, if we have these links here at all!!
    // Maybe just one link to the main Test Pilot website.

    // TODO this window opening triggers studies' window-open code.
    // Is that what we want or not?
    let win = window.open(url, "TestPilotStudyDetailWindow",
                         "chrome,centerscreen,resizable=yes,scrollbars=yes," +
                         "status=no,width=900,height=600");
    win.focus();
  },

  _sortNewestFirst: function(experiments) {
    experiments.sort(
      function sortFunc(a, b) {
        if (a.endDate && b.endDate) {
          return b.endDate - a.endDate;
        }
        if (a.publishDate && b.publishDate) {
          if (isNaN(a.publishDate) || isNaN(b.publishDate)) {
            return 0;
          }
          return b.publishDate - a.publishDate;
        }
        return 0;
      });
    return experiments;
  },

  onLoad: function () {
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");

    let numFinishedStudies = 0;
    let numCurrentStudies = 0;
    let experiments = TestPilotSetup.getAllTasks();

    if (experiments.length == 0 ) {
      // Can happen if this window opens before all tasks are done loading
      window.setTimeout(function() { TestPilotXulWindow.onLoad();}, 2000);
      return;
    }

    experiments = this._sortNewestFirst(experiments);

    for (let i = 0; i < experiments.length; i++) {
      let task = experiments[i];
      let newRow = document.createElement("richlistitem");
      newRow.setAttribute("class", "tp-study-list");

      this.addThumbnail(newRow, task.thumbnail);

      let textVbox = document.createElement("vbox");
      newRow.appendChild(textVbox);

      this.addDescription(textVbox, task.title, task.summary);
      this.addXulLink(textVbox, "More Info", task.defaultUrl);


      // Create the rightmost status area, depending on status:
      let statusVbox = document.createElement("vbox");
      if (task.status == TaskConstants.STATUS_FINISHED) {
        this.addLabel( statusVbox, "Finished on " +
                                   (new Date(task.endDate)).toDateString());
        this.addButton( statusVbox, "Submit", "submit-button-" + task.id,
          "TestPilotXulWindow.onSubmitButton(" + task.id + ");");
      }
      if (task.status == TaskConstants.STATUS_CANCELLED) {
        newRow.setAttribute("class", "tp-opted-out");
        statusVbox.appendChild(this.makeSpacer());
        this.addLabel(statusVbox, "(You canceled this study.)");
        statusVbox.appendChild(this.makeSpacer());
      }
      if (task.status == TaskConstants.STATUS_NEW ||
          task.status == TaskConstants.STATUS_PENDING ) {
            newRow.setAttribute("class", "tp-new-results");

            if (task.taskType == TaskConstants.TYPE_SURVEY) {
              this.addButton( statusVbox, "Take Survey", "survey-button",
                 "TestPilotXulWindow.openURL('" + task.defaultUrl + "');");
            } else if (task.taskType == TaskConstants.TYPE_EXPERIMENT) {
              if (task.startDate) {
                this.addLabel(statusVbox, "Will start " +
                            (new Date(task.startDate)).toDateString());
              }
            }
      }
      if (task.status == TaskConstants.STATUS_IN_PROGRESS ||
          task.status == TaskConstants.STATUS_STARTING ) {

        this.addLabel(statusVbox, "Currently Gathering Data.");
        let now = (new Date()).getTime();
        let progress = 100* (now - task.startDate) / (task.endDate - task.startDate);
        this.addProgressBar(statusVbox, progress);
        this.addLabel(statusVbox, "Will finish " +
                                 (new Date(task.endDate)).toDateString());
      }
      if (task.status >= TaskConstants.STATUS_SUBMITTED &&
         task.taskType != TaskConstants.TYPE_RESULTS) {
        this.addThanksMessage(statusVbox);
        numFinishedStudies ++;
      }
      let spacer = document.createElement("spacer");
      spacer.setAttribute("flex", "1");
      newRow.appendChild(spacer);
      newRow.appendChild(statusVbox);


      // Use status to decide which panel to add this to:
      let rowset;
      if (task.taskType == TaskConstants.TYPE_RESULTS) {
        rowset = document.getElementById("study-results-listbox");
      } else if (task.status > TaskConstants.STATUS_FINISHED) {
        rowset = document.getElementById("finished-studies-listbox");
      } else {
        rowset = document.getElementById("current-studies-listbox");
        numCurrentStudies++;
      }

      // TODO further distinguish by background colors.
      rowset.appendChild(newRow);
    }

    // If there are no current studies, show a message about upcoming
    // studies:
    if (numCurrentStudies == 0) {
      let newRow = document.createElement("richlistitem");
      newRow.setAttribute("class", "tp-study-list");
      this.addThumbnail(newRow, NO_STUDIES_IMG);
      let textVbox = document.createElement("vbox");
      textVbox.setAttribute("class", "pilot-largetext");
      newRow.appendChild(textVbox);
      this.addDescription(textVbox, "", NO_STUDIES_MSG);
      document.getElementById("current-studies-listbox").appendChild(newRow);
    }

    // Show number of studies the user finished on badge:
    document.getElementById("num-finished-badge").setAttribute(
      "value", numFinishedStudies);
  },

  focusPane: function(paneIndex) {
    document.getElementById("tp-xulwindow-deck").selectedIndex = paneIndex;

    // When you focus the 'study findings' tab, any results there which
    // are still marked "new" should have their status changed as the user
    // is considered to have seen them.
    if (paneIndex == 2) {
      Components.utils.import("resource://testpilot/modules/setup.js");
      Components.utils.import("resource://testpilot/modules/tasks.js");

      let experiments = TestPilotSetup.getAllTasks();
      for each (let experiment in experiments) {
        if (experiment.taskType == TaskConstants.TYPE_RESULTS) {
          if (experiment.status == TaskConstants.STATUS_NEW) {
            experiment.changeStatus(TaskConstants.STATUS_ARCHIVED, true);
          }
        }
      }
    }
  }
};
