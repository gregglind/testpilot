
/* TODO layout:
 * 4. Background colors depending on status?
 * 7. How do we draw numerical badge on the Finished Studies tab icon?
 *
 */

// TODO more better links

// TODO fix layout in notification
// TODO add links to notification
// TODO make notification for "new survey"

// TODO Show individual status page in new chromeless window as html with
// background color set to "moz-dialog".

// TODO the whole menu bar disappears when the XUL window is up!  What's up
// with that?

// TODO double-click on the <richlistitem> should open the page too?

// TODO general-purpose link to website's page of Upcoming Studies or what
// have you.

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
    this.addLabel(parent, "Now uploading, one moment please...");
    let self = this;

    task.upload( function(success) {
      while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
      }
      if (success) {
        self.addImg(parent, "study-submitted");
        self.addLabel(parent, "Thank you for submitting!");
      } else {
        // TODO a better error message?
        self.addLabel(parent, "Unable to reach Mozilla; try again later.");
      }
    });

  },

  addXulLink: function (container, text, url) {
    let link = document.createElement("label");
    link.setAttribute("value", text);
    link.setAttribute("class", "text-link");
    link.setAttribute("onclick",
      "if (event.button==0) {TestPilotXulWindow.openURL('" + url + "');}");
    container.appendChild(link);
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

  addThumbnail: function(container, imgUrl) {
    let newImg = document.createElement("image");
    newImg.setAttribute("src", imgUrl);
    newImg.setAttribute("class", "results-thumbnail");
    container.appendChild(newImg);
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
    //TODO... repeated calls to this should open the new URLs in the
    //same window, not open new windows!

    // Window title should just be "Mozilla Labs Test Pilot" not
    // chrome://testpilot - Mozilla Labs Test Pilot.

    // Make the window smaller and dialog-boxier
    // Links to discussion group, twitter, etc should open in new
    // tab in main browser window, if we have these links here at all!!
    // Maybe just one link to the main Test Pilot website.

    // TODO this window opening triggers studies' window-open code.
    // Is that what we want or not?
    let win = window.open(url, "TestPilotStudyDetailWindow",
                         "resizable=yes,scrollbars=yes,status=no");
  },

  onLoad: function () {
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");

    let experiments = TestPilotSetup.getAllTasks();

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
        this.addLabel(statusVbox, "You opted out.");
      }
      if (task.status == TaskConstants.STATUS_NEW ||
          task.status == TaskConstants.STATUS_PENDING ) {
            if (task.taskType == TaskConstants.TYPE_SURVEY) {
              this.addButton( statusVBox, "Take Survey", "survey-button", "");
            }
            if (task.startDate) {
            this.addLabel(statusVbox, "Will start " +
                          (new Date(task.startDate)).toDateString());
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
      if (task.status == TaskConstants.STATUS_SUBMITTED) {
        this.addImg(statusVbox, "study-finished");
        this.addLabel(statusVbox, "Thank you for submitting!");
      }
      let spacer = document.createElement("spacer");
      spacer.setAttribute("flex", "1");
      newRow.appendChild(spacer);
      newRow.appendChild(statusVbox);


      // Use status to decide which panel to add this to:
      let rowset;
      if (task.taskType == TaskConstants.TYPE_RESULTS) {
        rowset = document.getElementById("study-results-listbox");
      } else if (task.status == TaskConstants.STATUS_SUBMITTED ||
                 task.status == TaskConstants.STATUS_CANCELLED) {
         rowset = document.getElementById("finished-studies-listbox");
      } else {
         rowset = document.getElementById("current-studies-listbox");
      }

      // TODO further distinguish by background colors.
      rowset.appendChild(newRow);
    }
  },

  focusPane: function(paneIndex) {
    document.getElementById("tp-xulwindow-deck").selectedIndex = paneIndex;
  }
};

    // Show links for:
   // task.currentStatusUrl
    // task.infoPageUrl
    // task.resultsUrl // may not exist
    // task.defaultUrl points to one of these!

  // If there are no experiments here, it must be because we're
  // not done loading yet... try again in a few seconds.
  // (YES this can still happen!  If you pick the menu item during startup!)

  /*  if (experiments.length == 0 ) {
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { showStatusMenuPage();}, 2000);
      return;
    }
  */
