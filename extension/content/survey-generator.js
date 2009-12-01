const MULTIPLE_CHOICE = 0;
const CHECK_BOXES_WITH_FREE_ENTRY = 1;
const SCALE = 2;
const FREE_ENTRY = 3;
const CHECK_BOXES = 4;

function onBuiltinSurveyLoad() {
  Components.utils.import("resource://testpilot/modules/setup.js");
  Components.utils.import("resource://testpilot/modules/tasks.js");
  let eid = getUrlParam("eid");
  let task = TestPilotSetup.getTaskById(eid);
  let contentDiv = document.getElementById("survey-contents");
  if (!task) {
    // Tasks haven't all loaded yet.  Try again in a few seconds.
    contentDiv.innerHTML = "Loading, please wait a moment...";
    window.setTimeout(function() {onBuiltinSurveyLoad();}, 2000);
    return;
  }

  let title = document.getElementById("survey-title");
  title.innerHTML = task.title;

  if (task.status == TaskConstants.STATUS_SUBMITTED) {
    contentDiv.innerHTML = "<p>Thank you for finishing this survey. Your " +
    "answers will be uploaded along with the next set of experimental data.</p>" +
    "<p>If you would like to review or change your answers, you can do so at " +
    "any time using the button below.</p>";
    let submitButton = document.getElementById("survey-submit");
    submitButton.setAttribute("style", "display:none");
    let changeButton = document.getElementById("change-answers");
    changeButton.setAttribute("style", "");
    changeButton.addEventListener("click", function() {
                                    drawSurveyForm(task, contentDiv);},
                                  false);
  } else {
    drawSurveyForm(task, contentDiv);
  }
}

function drawSurveyForm(task, contentDiv) {
  let oldAnswers = task.oldAnswers;
  let surveyQuestions = task.surveyQuestions;
  let i;

  let submitButton = document.getElementById("survey-submit");
  submitButton.setAttribute("style", "");
  let changeButton = document.getElementById("change-answers");
  changeButton.setAttribute("style", "display:none");
  // Loop through questions and render html form input elements for each
  // one.
  for (i = 0; i < surveyQuestions.length; i++) {
    let question = surveyQuestions[i].question;
    let elem = document.createElement("h3");
    elem.innerHTML = (i+1) + ". " + question;
    contentDiv.appendChild(elem);
    // If you've done this survey before, preset all inputs using old answers
    let j;
    let choices = surveyQuestions[i].choices;
    switch (surveyQuestions[i].type) {
    case MULTIPLE_CHOICE:
      for (j = 0; j < choices.length; j++) {
        let newRadio = document.createElement("input");
        newRadio.setAttribute("type", "radio");
        newRadio.setAttribute("name", "answer_to_" + i);
        newRadio.setAttribute("value", j);
        if (oldAnswers && oldAnswers[i] == j) {
          newRadio.setAttribute("checked", "true");
        }
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newRadio);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      break;
    case CHECK_BOXES_WITH_FREE_ENTRY:
      // Check boxes:
      for (j = 0; j < choices.length; j++) {
        let newCheck = document.createElement("input");
        newCheck.setAttribute("type", "checkbox");
        newCheck.setAttribute("name", "answer_to_" + i);
        newCheck.setAttribute("value", j);
        if (oldAnswers && oldAnswers[i]) {
          for each (let an in oldAnswers[i]) {
            if (an == j) {
              newCheck.setAttribute("checked", "true");
            }
          }
        }
        let label = document.createElement("span");
        label.innerHTML = choices[j];
        contentDiv.appendChild(newCheck);
        contentDiv.appendChild(label);
        contentDiv.appendChild(document.createElement("br"));
      }
      // Text area:
      if (surveyQuestions[i].free_entry) {
        let label = document.createElement("span");
        label.innerHTML = surveyQuestions[i].free_entry + "&nbsp";
        contentDiv.appendChild(label);
        let inputBox = document.createElement("textarea");
        inputBox.setAttribute("id", "freeform_" + i);
        contentDiv.appendChild(inputBox);
        if (oldAnswers && oldAnswers[i]) {
          for each (let an in oldAnswers[i]) {
            if (isNaN(parseInt(an))) {
              inputBox.innerHTML = an;
            } else {
            }
          }
        }
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
        if (oldAnswers && oldAnswers[i] == j) {
          newRadio.setAttribute("checked", "true");
        }
        contentDiv.appendChild(newRadio);
      }
      label = document.createElement("span");
      label.innerHTML = surveyQuestions[i].max_label;
      contentDiv.appendChild(label);
      break;
    case FREE_ENTRY:
      // TODO LATER - kind of redundant since it's just the
      // check-box-plus-free-entry case with zero check boxes.
      break;
    case CHECK_BOXES:
      // TODO LATER - kind of redundant since it's just the
      // check-box-plus-free-entry case without the free entry.
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
    let elems = document.getElementsByName("answer_to_" + i);
    let anAnswer = [];
    for each (let elem in elems) {
      if (elem.checked) {
        anAnswer.push(elem.value);
      }
    }
    let freeEntry = document.getElementById("freeform_" + i);
    if (freeEntry) {
      anAnswer.push(freeEntry.value);
    }
    answers.push(anAnswer);
  }
  dump("Answers is " + answers + "\n");
  dump("Answers as json is " + JSON.stringify(answers) + "\n");
  task.store(answers);
  // Reload page to show submitted status:
  onBuiltinSurveyLoad();
}