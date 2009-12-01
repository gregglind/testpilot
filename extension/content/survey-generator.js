const MULTIPLE_CHOICE = 0;
const CHECK_BOXES_WITH_FREE_ENTRY = 1;
const SCALE = 2;
const FREE_ENTRY = 3;
const CHECK_BOXES = 4;

function onBuiltinSurveyLoad() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);
  let title = document.getElementById("survey-title");
  title.innerHTML = task.title;
  let contentDiv = document.getElementById("survey-contents");

  let surveyQuestions = task.surveyQuestions;
  let i;
  for (i = 0; i < surveyQuestions.length; i++) {
    let question = surveyQuestions[i].question;
    let elem = document.createElement("h3");
    elem.innerHTML = (i+1) + ". " + question;
    contentDiv.appendChild(elem);
    // TODO create form controls depending on surveyQuestions[i].type and
    // surveyQuestions[i].choices.
    let j;
    let choices = surveyQuestions[i].choices;
    switch (surveyQuestions[i].type) {
    case MULTIPLE_CHOICE:
      for (j = 0; j < choices.length; j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newRadio);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      break;
    case CHECK_BOXES_WITH_FREE_ENTRY:
      for (j = 0; j < choices.length; j++) {
        let newCheck = document.createElement("input");
        newCheck.setAttribute("type", "checkbox");
        newCheck.setAttribute("name", "answer_to_" + i);
        newCheck.setAttribute("value", j);
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newCheck);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      if (surveyQuestions[i].free_entry) {
        let label = document.createElement("span");
        label.innerHTML = surveyQuestions[i].free_entry + "&nbsp";
        contentDiv.appendChild(label);
        let inputBox = document.createElement("textarea");
        inputBox.setAttribute("name", i + "_free");
        inputBox.setAttribute("valign", "bottom");
        contentDiv.appendChild(inputBox);
      }
      break;
    case SCALE:
      let label = document.createElement("span");
      label.innerHTML = surveyQuestions[i].min_label;
      contentDiv.appendChild(label);
      for (j = surveyQuestions[i].scale_minimum;
           j <= surveyQuestions[i].scale_maximum;
           j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        contentDiv.appendChild(newRadio);
      }
      label = document.createElement("span");
      label.innerHTML = surveyQuestions[i].max_label;
      contentDiv.appendChild(label);
      break;
    case FREE_ENTRY:
      // TODO LATER
      break;
    case CHECK_BOXES:
      // TODO LATER
      break;
    }
  }
}

function onBuiltinSurveySubmit() {
  dump("Submitting survey...\n");
  Components.utils.import("resource://testpilot/modules/setup.js");
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);

  // Read all values from form...
  let answers = [];
  let surveyQuestions = task.surveyQuestions;
  let i;
  for (i = 0; i < surveyQuestions.length; i++) {
    dump("Answer to question " + i + ":\n");
    let elems = document.getElementsByName("answer_to_" + i);
    for each (let elem in elems) {
      if (elem.checked) {
        dump(elem.value + "\n");
      }
    }
  }

}