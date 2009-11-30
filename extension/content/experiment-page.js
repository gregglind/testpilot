  function showRawData(experimentId) {
    window.openDialog("chrome://testpilot/content/raw-data-dialog.xul",
                      "Test Pilot: Raw Tab Usage Data",
                      "chrome,centerscreen,resizable,scrollbars",
                      experimentId);
  }

  function getUrlParam(name) {
    // from http://www.netlobo.com/url_query_string_javascript.html
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
      return "";
    else
      return results[1];
  }

  function wipeDb() {
    Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
    TabsExperimentDataStore.wipeAllData();
    var debug = document.getElementById("debug");
    debug.innerHTML = "Wiped!";
  }

  // For Debug Purposes Only
  function makeThereBeAPopup() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var task = TestPilotSetup.getTaskById(1);
    var text = "Results are now available for " + task.title;
    TestPilotSetup._showNotification(text, task);
  }

  function uploadData() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var task = TestPilotSetup.getTaskById(1);
    var uploadStatus = document.getElementById("upload-status");
    uploadStatus.innerHTML = "Now uploading data...";
    task.upload( function(success) {
      if (success) {
        window.location = "chrome://testpilot/content/status-thanks.html";
      } else {
        uploadStatus.innerHTML = "<p>Oops!  There was an error connecting to "
          + "the Mozilla servers.  Maybe your network connection is down?</p>"
          + "<p>Test Pilot will retry automatically, so it's OK to close this"
          + " page now.</p>";
      }
    });
  }

  function getTestEndingDate(experimentId) {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var task = TestPilotSetup.getTaskById(experimentId);
    var endDate = new Date(task.endDate);
    var diff = endDate - Date.now();
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
                  "Sep", "Oct", "Nov", "Dec"];
    var span = document.getElementById("test-end-time");
    if (!span) {
      return;
    }
    if (diff < 0) {
      span.innerHTML = "(It has already ended and you should not be seeing this page.)";
      return;
    }
    var hours = diff / (60 * 60 * 1000);
    if (hours < 24) {
      span.innerHTML = " today, at " + endDate.toLocaleTimeString();
    } else {
      span.innerHTML = " on " + days[endDate.getDay()] + ", "
	+ months[endDate.getMonth()] + " " + endDate.getDate() + ", "
        + endDate.getFullYear();
    }
  }

  function showMetaData() {
    Components.utils.import("resource://testpilot/modules/metadata.js");
    var md = MetadataCollector.getMetadata();
    var mdLocale = document.getElementById("md-locale");
    if (mdLocale)
      mdLocale.innerHTML = md.location;
    var mdVersion = document.getElementById("md-version");
    if (mdVersion)
      mdVersion.innerHTML = md.version;
    var mdOs = document.getElementById("md-os");
    if (mdOs)
      mdOs.innerHTML = md.operatingSystem;
    var mdNumExt = document.getElementById("md-num-ext");
    if (mdNumExt) {
      var numExt = md.extensions.length;
      if (numExt == 1) {
	mdNumExt.innerHTML = numExt + " extension";
      } else {
	mdNumExt.innerHTML = numExt + " extensions";
      }
    }
  }

  function quitExperiment(experimentId) {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var reason = document.getElementById("reason-for-quit").value;
    var task = TestPilotSetup.getTaskById(experimentId);
    task.optOut(reason);
    // load the you-are-canceleed page.
    window.location = "chrome://testpilot/content/status-cancelled.html";
  }

  function updateRecurSettings() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    let eid = parseInt(getUrlParam("eid"));
    let experiment = TestPilotSetup.getTaskById(eid);
    let recurSelector = document.getElementById("recur-selector");
    let value = recurSelector.options[recurSelector.selectedIndex].value;
    experiment.setRecurPref(value);
  }

  function showRecurControls(experiment) {
    Components.utils.import("resource://testpilot/modules/tasks.js");
    let recurPrefSpan = document.getElementById("recur-pref");
    if (!recurPrefSpan) {
      return;
    }
    let days = experiment._recurrenceInterval;
    recurPrefSpan.innerHTML = "This test recurs every " + days +
        " days.  Each time it completes: ";

    let controls = document.getElementById("recur-controls");
    let selector = document.createElement("select");
    controls.appendChild(selector);
    selector.setAttribute("onchange", "updateRecurSettings();");
    selector.setAttribute("id", "recur-selector");

    let option = document.createElement("option");
    option.setAttribute("value", TaskConstants.ASK_EACH_TIME);
    if (experiment.recurPref == TaskConstants.ASK_EACH_TIME) {
      option.setAttribute("selected", "true");
    }
    option.innerHTML = "Ask me whether I want to submit my data.";
    selector.appendChild(option);

    option = document.createElement("option");
    option.setAttribute("value", TaskConstants.ALWAYS_SUBMIT);
    if (experiment.recurPref == TaskConstants.ALWAYS_SUBMIT) {
      option.setAttribute("selected", "true");
    }
    option.innerHTML = "Always submit my data, and don't ask me about it.";
    selector.appendChild(option);

    option = document.createElement("option");
    option.setAttribute("value", TaskConstants.NEVER_SUBMIT);
    if (experiment.recurPref == TaskConstants.NEVER_SUBMIT) {
      option.setAttribute("selected", "true");
    }
    option.innerHTML = "Never submit my data, and don't ask me about it.";
    selector.appendChild(option);
  }

  function loadExperimentPage() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");
    var contentDiv = document.getElementById("experiment-specific-text");
    // Get experimentID from the GET args of page
    var eid = parseInt(getUrlParam("eid"));
    var experiment = TestPilotSetup.getTaskById(eid);
    if (!experiment) {
      // Possible that experiments aren't done loading yet.  Try again in
      // a few seconds.
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { loadExperimentPage();}, 2000);
      return;
    }

    contentDiv.innerHTML = experiment.getWebContent();

    // Metadata and start/end date should be filled in for every experiment:
    showMetaData();
    getTestEndingDate(eid);
    if (experiment._recursAutomatically) {
      showRecurControls(experiment);
    }

    // TODO have link back to menu (i.e. status.html with no eid)

    // Do whatever the experiment's web content wants done on load:
    var graphUtils = {drawPieChart: drawPieChart,
                      drawTimeSeriesGraph: drawTimeSeriesGraph};
    experiment.webContent.onPageLoad(experiment, document, graphUtils);
  }

  function showStatusMenuPage() {
    var contentDiv = document.getElementById("experiment-specific-text");
    contentDiv.innerHTML = "";
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");
    // Get all tasks, sort them by status.

    dump("Making links to all experiments...\n");
    let experiments = TestPilotSetup.getAllTasks();
    let runningExperiments = [];
    let completedExperiments = [];
    let upcomingExperiments = [];
    let quitExperiments = [];
    let currentSurveys = [];
    let completedSurveys = [];

    // If there are no experiments here, it must be because we're
    // not done loading yet... try again in a few seconds.
    if (experiments.length == 0 ) {
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { showStatusMenuPage();}, 2000);
      return;
    }

    dump("There are " + experiments.length + " experiments.\n");
    for (let i = 0; i < experiments.length; i++) {
      if (experiments[i].taskType == TaskConstants.TYPE_EXPERIMENT) {
        switch (experiments[i].status) {
        case TaskConstants.STATUS_NEW:
        case TaskConstants.STATUS_PENDING:
          upcomingExperiments.push(experiments[i]);
        break;
        case TaskConstants.STATUS_STARTING:
        case TaskConstants.STATUS_IN_PROGRESS:
        case TaskConstants.STATUS_FINISHED:
          runningExperiments.push(experiments[i]);
        break;
        case TaskConstants.STATUS_SUBMITTED:
        case TaskConstants.STATUS_RESULTS:
        case TaskConstants.STATUS_ARCHIVED:
          completedExperiments.push(experiments[i]);
        break;
        case TaskConstants.STATUS_CANCELLED:
          quitExperiments.push(experiments[i]);
        break;
        }
      } else {
        switch (experiments[i].status) {
        case TaskConstants.STATUS_NEW:
        case TaskConstants.STATUS_PENDING:
        case TaskConstants.STATUS_STARTING:
        case TaskConstants.STATUS_IN_PROGRESS:
          currentSurveys.push(experiments[i]);
          break;
        case TaskConstants.STATUS_FINISHED:
        case TaskConstants.STATUS_SUBMITTED:
        case TaskConstants.STATUS_RESULTS:
        case TaskConstants.STATUS_ARCHIVED:
          completedSurveys.push(experiments[i]);
        break;
        }
      }
    }

    function addSubMenu( title, experiments ) {
      // Don't add the submenu if it would be empty:
      if (experiments.length == 0) {
        return;
      }
      dump("Adding submenu called " + title + "\n");
      let titleElem = document.createElement("h2");
      titleElem.innerHTML = title;
      contentDiv.appendChild(titleElem);
      let list = document.createElement("ul");
      contentDiv.appendChild(list);
      dump("There are " + experiments.length + " experiments.\n");
      for each (let experiment in experiments) {
        let listItem = document.createElement("li");
        list.appendChild(listItem);
        let link = document.createElement("a");
        link.setAttribute("href", experiment.infoPageUrl);
        link.innerHTML = experiment.title;
        listItem.appendChild(link);

        if (experiment.status == TaskConstants.STATUS_FINISHED) {
          let span = document.createElement("span");
          span.innerHTML = " &mdash; Finished and ready to submit data!";
          listItem.appendChild(span);
        }

        let resultsUrl = experiment.resultsUrl;
        if (resultsUrl) {
          let span = document.createElement("span");
          span.innerHTML = " &mdash; Study Complete: ";
          listItem.appendChild(span);
          let resultsLink = document.createElement("a");
          resultsLink.setAttribute("href", resultsUrl);
          resultsLink.innerHTML = "See Analysis";
          listItem.appendChild(resultsLink);
        }

        if (experiment.endDate) {
          let dateSpan = document.createElement("span");
          dateSpan.innerHTML = "<br/>Ending Date: ";
          dateSpan.innerHTML += (new Date(experiment.endDate)).toDateString();
          if (experiment._recursAutomatically) {
            dateSpan.innerHTML += " (Recurs automatically.)";
          }
          listItem.appendChild(dateSpan);
        }
      }
      // TODO: Show start dates too?
    }
    addSubMenu("Tests In Progress:", runningExperiments);
    addSubMenu("Current Surveys:", currentSurveys);
    addSubMenu("Completed Tests:", completedExperiments);
    addSubMenu("Completed Surveys:", completedSurveys);
    addSubMenu("Upcoming Tests:", upcomingExperiments);
    addSubMenu("Cancelled Tests:", quitExperiments);
    // TODO: Link to proposals for future tests?
  }

  function onStatusPageLoad() {
    /* If an experiment ID (eid) is provided in the url params, show status
     * for that experiment.  If not, show the main menu with status for all
     * installed experiments. */
    var eidString = getUrlParam("eid");
    if (eidString == "") {
      showStatusMenuPage();
    } else {
      loadExperimentPage();
    }
  }