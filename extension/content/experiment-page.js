  function showRawData() {
    window.openDialog("chrome://testpilot/content/raw-data-dialog.xul",
                      "Test Pilot: Raw Tab Usage Data", "chrome,centerscreen,resizable,scrollbars");
  }

  // TODO handle the case where there's no data.
  function getDbContents() {
    Components.utils.import("resource://testpilot/modules/experiment_data_store.js");
    return TabsExperimentDataStore.barfAllData();
  }

  function debugMetadata() {
    Components.utils.import("resource://testpilot/modules/metadata.js");
    var md = MetadataCollector.getMetadata();
    document.getElementById("debug").innerHTML = JSON.stringify( md );
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
    var debugElem = document.getElementById("debug");
    task.upload( function(success) {
      debugElem.innerHTML = "Callback called.";
      if (success) {
        document.getElementById("debug").innerHTML = "Upload Successful!";
        // TODO change whole page to reflect that this is a finished test now.
        // And don't let them submit the same data multiple times!!
      } else {
        document.getElementById("debug").innerHTML = "Upload Failed; Please try again later.";
      }
    });
  }


  function getTestEndingDate(experimentId) {
            
  }
  function loadExperimentPage(experimentId) {
    drawSomeGraphs();
    getTestEndingDate(experimentId);
  }
