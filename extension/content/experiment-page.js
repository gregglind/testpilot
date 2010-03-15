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

  function uploadData() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    let eid = parseInt(getUrlParam("eid"));
    var task = TestPilotSetup.getTaskById(eid);

    // If always-submit-checkbox is checked, set the pref
    if (task._recursAutomatically) {
      let checkBox = document.getElementById("always-submit-checkbox");
      if (checkBox && checkBox.checked) {
        task.setRecurPref(TaskConstants.ALWAYS_SUBMIT);
      }
    }

    var uploadStatus = document.getElementById("upload-status");
    uploadStatus.innerHTML = "Now uploading data...";
    task.upload( function(success) {
      if (success) {
        window.location = "chrome://testpilot/content/status.html"
                            + "?eid=" + eid;
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

  function onQuitPageLoad() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    let eid = parseInt(getUrlParam("eid"));
    let task = TestPilotSetup.getTaskById(eid);
    let span = document.getElementById("exp-name");
    span.innerHTML = task.title;

    if (task._recursAutomatically) {
      let recurOptions = document.getElementById("recur-options");
      recurOptions.setAttribute("style", "");
    }
  }

  function quitExperiment() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    Components.utils.import("resource://testpilot/modules/tasks.js");
    let eid = parseInt(getUrlParam("eid"));
    let reason = document.getElementById("reason-for-quit").value;
    let task = TestPilotSetup.getTaskById(eid);
    task.optOut(reason);

    // If opt-out-forever checkbox is checked, opt out forever!
    if (task._recursAutomatically) {
      let checkBox = document.getElementById("opt-out-forever");
      if (checkBox.checked) {
        task.setRecurPref(TaskConstants.NEVER_SUBMIT);
      }
    }
    // load the you-are-canceleed page.
    let url = "chrome://testpilot/content/status.html?eid=" + eid;
    window.location = url;
  }

  function updateRecurSettings() {
    Components.utils.import("resource://testpilot/modules/setup.js");
    let eid = parseInt(getUrlParam("eid"));
    let experiment = TestPilotSetup.getTaskById(eid);
    let recurSelector = document.getElementById("recur-selector");
    let newValue = recurSelector.options[recurSelector.selectedIndex].value;
    experiment.setRecurPref(parseInt(newValue));
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
    if (experiment._recursAutomatically &&
        experiment.status != TaskConstants.STATUS_FINISHED) {
      showRecurControls(experiment);
    }

    // Do whatever the experiment's web content wants done on load:
    experiment.webContent.onPageLoad(experiment, document, jQuery);
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