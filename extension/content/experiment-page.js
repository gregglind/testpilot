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
        uploadStatus.innerHTML = "Error!";
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

  function loadExperimentPage(status) {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var contentDiv = document.getElementById("intro");
    // Get experimentID from the GET args of page
    var eid = parseInt(getUrlParam("eid"));
    var experiment = TestPilotSetup.getTaskById(eid);
    if (!experiment) {
      // Possible that experiments aren't done loading yet.  Try again in
      // a few seconds.
      contentDiv.innerHTML = "Loading, please wait a moment...";
      window.setTimeout(function() { loadExperimentPage(status);}, 2000);
      return;
    }
    var webContentHtml;
    // TODO maybe get status from the task itself and merge pages?
    if (status == "in-progress") {
      webContentHtml = experiment.webContent.inProgressHtml;
    } else if (status == "completed") {
      webContentHtml = experiment.webContent.completedHtml;
    } else if (status == "upcoming") {
      webContentHtml = experiment.webContent.upcomingHtml;
    }

    contentDiv.innerHTML = webContentHtml;

    // TODO create a menu (tab-styled?) to switch between all current
    // experiments!!

    // Metadata and start/end date should be filled in for every experiment:
    showMetaData();
    getTestEndingDate(eid);

    // Do whatever the experiment's web content wants done on load:
    var graphUtils = {drawPieChart: drawPieChart,
                      drawTimeSeriesGraph: drawTimeSeriesGraph};
    experiment.webContent.onPageLoad(experiment, document, graphUtils);
  }
