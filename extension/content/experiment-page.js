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

  function makeLinksToAllExperiments() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    dump("Making links to all experiments...\n");
    let experiments = TestPilotSetup.getExperimentNamesAndUrls();
    let list = document.getElementById("experiment-links-menu");
    dump("Experiments length is " + experiments.length + "\n");
    for (let i = 0; i < experiments.length; i++) {
      let listItem = document.createElement("li");
      list.appendChild(listItem);
      let link = document.createElement("a");
      link.setAttribute("href", experiments[i].url);
      link.innerHTML = experiments[i].name;
      listItem.appendChild(link);
    }
    dump("Done making links to all experiments.\n");
  }

  function quitExperiment(experimentId) {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var reason = document.getElementById("reason-for-quit").value;
    var task = TestPilotSetup.getTaskById(experimentId);
    task.optOut(reason);
    // load the you-are-canceleed page.
    window.location = "chrome://testpilot/content/status-cancelled.html";
  }

  function loadExperimentPage() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var contentDiv = document.getElementById("intro");
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

    // TODO have link back to menu (i.e. status.html with no eid)

    // Do whatever the experiment's web content wants done on load:
    var graphUtils = {drawPieChart: drawPieChart,
                      drawTimeSeriesGraph: drawTimeSeriesGraph};
    experiment.webContent.onPageLoad(experiment, document, graphUtils);
  }

  function onStatusPageLoad() {
    var eidString = getUrlParam("eid");
    if (eidString == "") {
      // No EID provided - show status menu page.
      var contentDiv = document.getElementById("intro");
      makeLinksToAllExperiments();
    } else {
      loadExperimentPage();
    }
  }