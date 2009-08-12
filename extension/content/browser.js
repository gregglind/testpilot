(function() {
   function notifyTestPilot() {
     var jsm = {};
     Components.utils.import("resource://testpilot/modules/setup.js",
                             jsm);
     jsm.TestPilotSetup.onBrowserWindowLoaded(window);
   }

   window.addEventListener(
     "load",
     function onWindowLoad(event) {
       window.removeEventListener("load", onWindowLoad, false);
       gBrowser.addEventListener(
         "load",
         function onBrowserLoad(event) {
           gBrowser.removeEventListener("load", onBrowserLoad, false);
           notifyTestPilot();
         },
         false);
     },
     false
   );
 })();

function openAboutTestPilotPage() {
  var url = "http://testpilot.mozillalabs.com";
  var browser = window.getBrowser();
  var tab = browser.addTab(url);
  browser.selectedTab = tab;
}
