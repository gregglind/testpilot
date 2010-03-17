
// TODO make sure this works when there are a lot of items (i.e. does scroll
// bar appear?)

var TestPilotXulWindow = {
  onSubmitButton: function(experimentID) {
    // TODO implement
    dump("You clicked the XUL submit button for study id " + experimentID + "!\n");
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

  addImg: function(container, src) {
    let newImg = document.createElement("image");
    newImg.setAttribute("src", "chrome://testpilot/skin/" + src);
    container.appendChild(newImg);
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
      let newRow = document.createElement("row");

      this.addImg(newRow, "new_study_48x48.png");

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
        statusVbox.appendChild(submitButton);
      }
      if (task.status == TaskConstants.STATUS_IN_PROGRESS ||
          task.status == TaskConstants.STATUS_STARTING ) {

        this.addLabel(statusVbox, "Started on " +
                                 (new Date(task.startDate)).toDateString());

       /* let progressBar = document.createElement();
        vbox.appendChild(progressBar);*/

        this.addLabel(statusVbox, "Will end on " +
                                 (new Date(task.endDate)).toDateString());
      }
      if (task.status == TaskConstants.STATUS_SUBMITTED ||
          task.status == TaskConstants.STATUS_RESULTS ||
          task.status == TaskConstants.STATUS_ARCHIVED) {

        this.addImg(statusVbox, "ready_submit_48x48.png");
        this.addLabel(statusVbox, "Thank you for submitting!");
      }

      newRow.appendChild(statusVbox);

      // Use status to decide which panel to add this to:
      let rowset;
      switch (task.status) {
      case TaskConstants.STATUS_NEW:
      case TaskConstants.STATUS_PENDING:
        rowset = document.getElementById("upcoming-studies-rowset");
      break;
      case TaskConstants.STATUS_STARTING:
      case TaskConstants.STATUS_IN_PROGRESS:
      case TaskConstants.STATUS_FINISHED:
        rowset = document.getElementById("current-studies-rowset");
      break;
      case TaskConstants.STATUS_SUBMITTED:
      case TaskConstants.STATUS_RESULTS:
      case TaskConstants.STATUS_ARCHIVED:
      case TaskConstants.STATUS_CANCELLED:
        rowset = document.getElementById("finished-studies-rowset");
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
    // Links in add-ons manager are just
    // <label class="text-link" onclick="if (event.button ==0) {
    // openURL(this.getAttribute('homepageURL'));}"
    // homepageURL = "http://whatever"/>
    // styles for text-link are defined in skin/classic/global/console.css
    // and skin/classic/global/global.css
    //
    // (I think we can just link to href="chrome://global/skin/" type="text/css"
    //if (experiments[i].taskType == TaskConstants.TYPE_EXPERIMENT)


  // If there are no experiments here, it must be because we're
  // not done loading yet... try again in a few seconds.
  /*  if (experiments.length == 0 ) {
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { showStatusMenuPage();}, 2000);
      return;
    }
  */
