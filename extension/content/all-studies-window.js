
function xulSubmitButtonHandler(experimentId) {
  dump("You clicked the XUL submit button!\n");

}

function onLoadAllStudiesWindow() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  Components.utils.import("resource://testpilot/modules/tasks.js");

  var currStudiesRowset = document.getElementById("current-studies-rowset");
  var finishedStudiesRowset = document.getElementById("finished-studies-rowset");
  var upcomingStudiesRowset = document.getElementById("upcoming-studies-rowset");

  let experiments = TestPilotSetup.getAllTasks();

  for (let i = 0; i < experiments.length; i++) {
    let task = experiments[i];
    let newRow = document.createElement("row");
    let newImg = document.createElement("image");
    newImg.setAttribute("src",
      "chrome://testpilot/skin/new_study_48x48.png");
    newRow.appendChild(newImg);
    let newLabel = document.createElement("label");
    newLabel.setAttribute("value", task.title);
    newLabel.setAttribute("class", "pilot-title");
    newRow.appendChild(newLabel);

    if (task.status == TaskConstants.STATUS_FINISHED) {
      let vbox = document.createElement("vbox");
      let endDateLabel = document.createElement("label");
      endDateLabel.setAttribute("value", "Finished on " +
                                  (new Date(task.endDate)).toDateString());
      vbox.appendChild(endDateLabel);

      let submitButton = document.createElement("button");
      submitButton.setAttribute("label", "Submit");
      submitButton.setAttribute("oncommand",
                                "xulSubmitButtonHandler(" + task.id + ");");
      vbox.appendChild(submitButton);
      newRow.appendChild(vbox);
    }

    if (task.status == TaskConstants.IN_PROGRESS ||
        task.status == TaskConstants.STARTING ) {
      let vbox = document.createElement("vbox");
      newRow.appendChild(vbox);

      let startDateLabel = document.createElement("label");
      startDateLabel.setAttribute("value", "Started on " +
                                  (new Date(task.startDate)).toDateString());
      vbox.appendChild(startDateLabel);

     /* let progressBar = document.createElement();
      vbox.appendChild(progressBar);*/

      let endDateLabel = document.createElement("label");
      endDateLabel.setAttribute("value", "Will end on " +
                                  (new Date(task.endDate)).toDateString());
      vbox.appendChild(endDateLabel);
    }

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


    // Show links for:
   // task.currentStatusUrl
    // task.infoPageUrl
    // task.resultsUrl // may not exist
    // task.defaultUrl points to one of these!
    //if (experiments[i].taskType == TaskConstants.TYPE_EXPERIMENT)

  }
}

  // If there are no experiments here, it must be because we're
  // not done loading yet... try again in a few seconds.
  /*  if (experiments.length == 0 ) {
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { showStatusMenuPage();}, 2000);
      return;
    }
  */
