function onBuiltinSurveyLoad() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  let eid = parseInt(getUrlParam("eid"));
  let task = TestPilotSetup.getTaskById(eid);
  let contentDiv = document.getElementById("survey-contents");

  let surveyQuestions = task.surveyQuestions;
  let i;
  for (i = 0; i < surveyQuestions.length; i++) {
    let question = surveyQuestions[i].question;
    let elem = document.createElement("h2");
    elem.innerHTML = i + ". " + question;
    contentDiv.appendChild(elem);
    // TODO create form controls depending on surveyQuestions[i].type and
    // surveyQuestions[i].choices.
  }
}

function onBuiltinSurveySubmit() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  let eid = parseInt(getUrlParam("eid"));
  let task = TestPilotSetup.getTaskById(eid);

  // TODO
}