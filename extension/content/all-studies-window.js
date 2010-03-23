
// TODO make sure this works when there are a lot of items (i.e. does scroll
// bar appear?)

/* TODO layout:
 * 1. don't scale images - fix their dimensions
 * 2. Word-wrap title if it's too long, instead of pushing stuff out
 * 3. Fix width of the left and right columns
 * 4. Background colors depending on status?
 * 5. Adjust window size?
 */

// Addons manager doesn't use a grid, it uses a richlistbox id=extensionsView
// containing a xul:scrollbox containing richlistitems...


// TODO more better links

// TODO insert text (a new blurb, to be specified in task.webContent?)

// TODO fix layout in notification
// TODO add links to notification


// TODO Make click on the "more info" link open detail view on study...
// which is also a XUL window?  Or what?

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

  addProgressBar: function(container, percent) {
    let progBar = document.createElement("progressmeter");
    progBar.setAttribute("mode", "determined");
    progBar.setAttribute("value", Math.ceil(percent).toString());
    container.appendChild(progBar);
  },

  openURL: function(url) {
    let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                        .getService(Components.interfaces.nsIWindowMediator);
    let win = wm.getMostRecentWindow("navigator:browser");
    var browser = win.getBrowser();
    var tab = browser.addTab(url);
    browser.selectedTab = tab;
  },

  onLoad: function () {
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");

    let experiments = TestPilotSetup.getAllTasks();

    for (let i = 0; i < experiments.length; i++) {
      let task = experiments[i];
      let newRow = document.createElement("richlistitem");

      this.addImg(newRow, "new-study");

      let textVbox = document.createElement("vbox");
      newRow.appendChild(textVbox);
      this.addLabel(textVbox, task.title, "pilot-title");
      this.addXulLink(textVbox, "More Info", task.defaultUrl);


      // Create the rightmost status area, depending on status:
      let statusVbox = document.createElement("vbox");
      if (task.status == TaskConstants.STATUS_FINISHED) {
        this.addLabel( statusVbox, "Finished on " +
                                   (new Date(task.endDate)).toDateString());

        let submitButton = document.createElement("button");
        submitButton.setAttribute("label", "Submit");
        submitButton.setAttribute("oncommand",
          "TestPilotXulWindow.onSubmitButton(" + task.id + ");");
        submitButton.setAttribute("id", "submit-button-" + task.id);
        statusVbox.appendChild(submitButton);
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
      if (task.status == TaskConstants.STATUS_SUBMITTED ||
          task.status == TaskConstants.STATUS_RESULTS ||
          task.status == TaskConstants.STATUS_ARCHIVED) {

        this.addImg(statusVbox, "study-finished");
        this.addLabel(statusVbox, "Thank you for submitting!");
      }

      newRow.appendChild(statusVbox);

      // Use status to decide which panel to add this to:
      let rowset;
      dump("Datatype of status is " + typeof(task.status) + "\n");
      switch (task.status) {
      case TaskConstants.STATUS_NEW:
      case TaskConstants.STATUS_PENDING:
        rowset = document.getElementById("upcoming-studies-listbox");
      break;
      case TaskConstants.STATUS_STARTING:
      case TaskConstants.STATUS_IN_PROGRESS:
      case TaskConstants.STATUS_FINISHED:
        rowset = document.getElementById("current-studies-listbox");
      break;
      case TaskConstants.STATUS_SUBMITTED:
      case TaskConstants.STATUS_RESULTS:
      case TaskConstants.STATUS_ARCHIVED:
      case TaskConstants.STATUS_CANCELLED:
        rowset = document.getElementById("finished-studies-listbox");
      break;
      }
      rowset.appendChild(newRow);
    }
  }
}

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
