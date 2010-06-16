pref("extensions.testpilot.firstRunUrl",
     "chrome://testpilot/content/welcome.html");
pref("extensions.testpilot.popup.delayAfterStartup", 180000); // 3 minutes
pref("extensions.testpilot.popup.timeBetweenChecks", 86400000); // 24 hours
pref("extensions.testpilot.uploadRetryInterval", 3600000); // 1 hour
pref("extensions.testpilot.indexBaseURL", "https://testpilot.mozillalabs.com/testcases/");
pref("extensions.testpilot.indexFileName", "index.json");
pref("extensions.testpilot.popup.showOnNewStudy", false);
pref("extensions.testpilot.popup.showOnStudyFinished", true);
pref("extensions.testpilot.popup.showOnNewResults", false);
pref("extensions.testpilot.alwaysSubmitData", false);
pref("extensions.testpilot.runStudies", true);
pref("extensions.testpilot.happyURL", "http://feedback.mozilla.org/happy.html?ua=${USER_AGENT}&url=${URL}");
pref("extensions.testpilot.sadURL", "http://feedback.mozilla.org/sad.html?ua=${USER_AGENT}&url=${URL}");
pref("extensions.testpilot.dataUploadURL", "https://testpilot.mozillalabs.com/submit/");
