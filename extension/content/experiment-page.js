  function showRawData() {
    window.openDialog("chrome://testpilot/content/raw-data-dialog.xul",
                      "Test Pilot: Raw Tab Usage Data", "chrome,centerscreen,resizable,scrollbars");
  }

  // TODO handle the case where there's no data.
  function getDbContents() {
    Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
    return TabsExperimentDataStore.barfAllData();
  }

  function drawSomeGraphs() {
    var rawData = getDbContents();
    var canvas1 = document.getElementById("tabs-over-time-canvas");
    drawTabsOverTimeGraph(canvas1, rawData, 40, 210, 400, 200);
    var canvas2 = document.getElementById("tab-close-pie-chart-canvas");
    drawCloseTabPieChart(canvas2, rawData, 125, 125, 100);
  }

  // TODO replace this with an opt-out button.
  function wipeDb() {
    Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
    TabsExperimentDataStore.wipeAllData();
    var debug = document.getElementById("debug");
    debug.innerHTML = "Wiped!";
  }

  function makeThereBeAPopup() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    var task = TestPilotSetup.getTaskById(1);
    TestPilotSetup._showNotification("This is a test notification.", task);
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

  function loadExperimentPage(experimentId) {
    drawSomeGraphs();
    showMetaData();
    getTestEndingDate(experimentId);
  }
