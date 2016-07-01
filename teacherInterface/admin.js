/* Copyright (c) 2012 Association France-ioi, MIT License http://opensource.org/licenses/MIT */

// TODO: avoid using undefined as a value, use null instead.

var loggedUser;
var contests;
var questions;
var questionsKeysToIds;
var schools;
var groups;
var filterSchoolID = "0";
var filterGroupID = "0";
var tasks = [];
var generating = false;
var gradePackSize = 20;
var curGradingData = null;
var curGradingBebras = null;
var curGradingScoreCache = {};
var models = null;

var t = i18n.t;

/**
 * Old IE versions does not implement the Array.indexOf function
 * Setting it in Array.prototype.indexOf makes IE crash
 * So the graders are using this inArray function
 * 
 * @param {array} arr
 * @param {type} value
 * @returns {int}
 */
function inArray(arr, value) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == value) {
            return i;
        }
    }
    
    return -1;
}

function isAdmin() {
   return ((loggedUser !== undefined) && (loggedUser.isAdmin === "1"));
}

function disableButton(buttonId, withOverlay) {
   var button = $("#" + buttonId);
   if (button.attr("disabled")) {
      return false;
   }
   button.attr("disabled", true);
   return true;
}

function enableButton(buttonId) {
   var button = $("#" + buttonId);
   button.attr("disabled", false);
}

function initErrorHandler() {
   $( "body" ).ajaxError(function(e, jqxhr, settings, exception) {
     if (settings.url.substring(0,4) == 'i18n' || settings.url.substring(settings.url.length - 12) == 'domains.json') {
        return;
     }
     if (exception === "") {
        if (confirm(t("server_not_responding"))) {
           $.post(settings.url, settings.data, settings.success, settings.dataType);
        }
     } else if (jqxhr.responseText.indexOf(t("extract_error_message")) > 0) {
        alert(t("session_expired"));
        window.location.href = t("index_url");
     } else {
        $("#contentError").html(t("exception") + exception + "<br/><br/>" + t("server_response") + "<br/>" + jqxhr.responseText);
        $("#divError").show();
     }
   });
}


function getRegionsObjects(isFilter) {
   var choices = "";
   if (isFilter)
      choices += "_NOF_:" + t("option_no_filter") + ";";
   for (var key in regions) {
      if (regions.hasOwnProperty(key)) {
         choices += key + ":" + regions[key] + ";";
      }
   }
   // Remove the last ';'
   choices = choices.substring(0, choices.length-1);
   return choices;
}

function getGroupsColModel() {
   var model = {
      tableName: "group",
      fields: {
         schoolID: {
            label: t("group_schoolID_label"), required: true,
            editable: true, edittype: "select", stype: "select", editoptions: { value:getItemNames(schools)},
            searchoptions: { value:getItemNames(schools, true)},
            width: 150
         },
         userLastName: {label: t("school_admin_1_lastName"),
            editable: false,
            width:100
         },
         userFirstName: {label: t("school_admin_1_firstName"),
            editable: false,
            width:100
         },
         contestID: {label: t("contestID_label"),
            editable: true, edittype: "select", editoptions: { value:getItemNames(contests)},
            stype: "select", searchoptions: { value:getItemNames(contests, true)},
            required: true, 
            width: 260, comment: t("contestID_comment")},
         grade: {label: "Classe", editable: true, edittype: "select", width: 100, required: true, editoptions:{
            value:{
               "4": t("grade_4"),
               "5": t("grade_5"),
               "6": t("grade_6"),
               "7": t("grade_7"),
               "8": t("grade_8"),
               "9": t("grade_9"),
               "10": t("grade_10"),
               "13": t("grade_10_pro"),
               "11": t("grade_11"),
               "14": t("grade_11_pro"),
               "12": t("grade_12"),
               "15": t("grade_12_pro")
            }}},
         participationType: {label: t("participationType_label"), longLabel: t("participationType_long_label"), editable: true, required: true, edittype: "select", width: 100, editoptions:{ value:{"Official": t("participationType_official"), "Unofficial": t("participationType_unofficial")}}, comment: t("participationType_comment")},
         expectedStartTime: {label: t("expectedStartTime_label"), longLabel: t("expectedStartTime_long_label"),
            formatter:'date', formatoptions:{ srcformat:'Y-m-d H:i:s', newformat:'d/m/Y H:i'},
            editable:true, edittype: "datetime", width: 150, comment:t("expectedStartTime_comment")},
         name: {label: t("group_name_label"), longLabel: t("group_name_long_label"), editable: true, edittype: "text", width: 200, required: true, comment: t("group_name_comment")},
/*         gradeDetail: {label: "Préciser", editable: true, edittype: "text", width: 200, required: false, comment: "Information qui nous aidera à estimer la diffusion du concours dans les différentes filières et niveaux éducatifs"},*/
         code: {label: t("group_code_label"), width: 100},
         password: {label: t("group_password_label"), width: 100},
         nbTeamsEffective: {label: t("group_nbTeamsEffective_label"), width: 100},
         nbStudentsEffective: {label: t("group_nbStudentsEffective_label"), width: 100},
         nbStudents: {label: t("group_nbStudents_label"), longLabel: t("group_nbStudents_long_label"), editable: true, required: true, edittype: "text", subtype:"positiveint", width: 100, comment: t("group_nbStudents_comment")},
         userID: {hidden: true, visible: false, hiddenlg: true},
         contestPrintCertificates: {hidden: true, visible: false, hiddenlg: true},
      }
   };
   return model;
}

function groupLoadComplete() {
   $.each($("#grid_group").find("tr"), function(i, row) {
      var id = row.id;
      if(id) {
          var nbStudents = jQuery("#grid_group").jqGrid("getRowData", id).nbStudentsEffective;
          if (nbStudents > 0) {
             $(row).addClass("usedGroup");
          }
      }
   });
}

function getContestQuestionsColModel() {
   return {
      tableName: "contest_question",
      fields: {
         contestID: {label: t("contest_question_contestID_label"),
            editable: true, edittype: "select", editoptions: { value:getItemNames(contests)},
            stype: "select", searchoptions: { value:getItemNames(contests, true)},
            width: 300},
         questionID: {label: t("contest_question_questionID_label"),
            editable: true, edittype: "select", editoptions: { value:getItemNames(questions)},
            stype: "select", searchoptions: { value:getItemNames(questions, true)},
            width: 300},
         minScore: {label: t("contest_question_minScore_label"), editable: true, edittype: "text", width: 120},
         noAnswerScore: {label: t("contest_question_noAnswerScore_label"), editable: true, edittype: "text", width: 120},
         maxScore: {label: t("contest_question_maxScore_label"), editable: true, edittype: "text", width: 120},
         options: {label: t("contest_question_options_label"), editable: true, edittype: "text", width: 250},
         order: {label: t("contest_question_order_label"), editable: true, edittype: "text", subtype:"int", width: 80}
      }
   };
}

function initModels(isLogged) {
   var groupStype;
   var groupSearchOptions;
   var groupEditOptions;
   if (isAdmin()) {
      groupStype = "text";
      groupSearchOptions = {};
      groupEditOptions = {};
   } else {
      groupStype = "select";
      groupSearchOptions = { value:getItemNames(groups, true) };
      groupEditOptions = { value:getItemNames(groups)};
   }
   var editYesNo = { value:{"1": t("option_yes"), "0": t("option_no")}};
   var searchYesNo = { value:"_NOF_:" + t("option_no_filter") + ";1:" + t("option_yes") + ";0:" + t("option_no")};
   var officialEmailEditType = "text";
   if (config.forceOfficialEmailDomain) {
      officialEmailEditType = "ac-email";
   }
   models = {
      award1: {
         tableName: "award1",
         fields: {
            schoolID: {label: t("contestant_school"), editable: false, search: false, width: 250, edittype: "select", editoptions: { value:getItemNames(schools)}},
            contestID: {label: t("contestant_contestID_label"), editable: false, search: false, width: 300, edittype: "select", editoptions: { value:getItemNames(contests)}},
            groupField: {label: t("contestant_name_label"), width: 300,
               editable: false, edittype: groupStype, editoptions: groupEditOptions,
               search: false },
            firstName: {label: t("contestant_firstName_label"), editable: false, search: false, width:200},
            lastName: {label: t("contestant_lastName_label"), editable: false, search: false, width:200},
            genre: {label: t("contestant_genre_label"),
               editable: true, edittype: "select", editoptions:{ value:{"1": t("option_female"), "2": t("option_male")}},
               search: false, width: 120},
            score: {label: t("contestant_score_label"), editable: false, search: false, width:100},
            rank: {label: t("contestant_rank_label"), editable: false, search: false, width:100},
            country: {hidden: true, visible: false, hiddenlg: true},
            city: {hidden: true, visible: false, hiddenlg: true},
            name: {hidden: true, visible: false, hiddenlg: true},
            algoreaCode: {hidden: true, visible: false, hiddenlg: true},
            loginID: {label: t("awards_loginID_label"), editable: false, search: false, width:130, sortable: false}
         }
      },
      contestant: {
         tableName: "contestant",
         fields: {
            schoolID: {label: t("contestant_school"),
               editable: false, edittype: "select", editoptions: { value:getItemNames(schools)},
               stype: "select", searchoptions: { value:getItemNames(schools, true)},
               width: 250},
            contestID: {label: t("contestant_contestID_label"),
               editable: false, edittype: "select", editoptions: { value:getItemNames(contests)},
               stype: "select", searchoptions: { value:getItemNames(contests, true)},
               width: 300},
            groupField: {label: t("contestant_name_label"), width: 300,
               editable: false, edittype: groupStype, editoptions: groupEditOptions,
               stype: groupStype, searchoptions: groupSearchOptions },
            saniValid: {label: t("contestant_saniValid_label"),
                        editable: false, width:120,
                        edittype: "select", editoptions: editYesNo,
                        stype: "select", searchoptions: searchYesNo
                       },
            firstName: {label: t("contestant_firstName_label"), editable: true, edittype: "text", width:150},
            lastName: {label: t("contestant_lastName_label"), editable: true, edittype: "text", width:150},
            genre: {label: t("contestant_genre_label"),
               editable: true, edittype: "select", editoptions:{ value:{"1": t("option_female"), "2": t("option_male")}},
               stype: "select", searchoptions:{ value:"_NOF_:" + t("option_no_filter") + ";1:" + t("option_female") + ";2:" + t("option_male")},
               width: 75},
            //contestants: {label: "Équipe", editable: false, width:300},
            grade: {label: "Classe", editable: true, edittype: "select", width: 100, required: true, editoptions:{
               value:{
                  "-1": t("grade_-1"),
                  "-4": t("grade_-4"),
                  "4": t("grade_4"),
                  "5": t("grade_5"),
                  "6": t("grade_6"),
                  "7": t("grade_7"),
                  "8": t("grade_8"),
                  "9": t("grade_9"),
                  "10": t("grade_10"),
                  "13": t("grade_10_pro"),
                  "11": t("grade_11"),
                  "14": t("grade_11_pro"),
                  "12": t("grade_12"),
                  "15": t("grade_12_pro")
               }}, searchoptions:{ value:"_NOF_:" + t("option_no_filter") +
                  ";-1:" + t("grade_-1") +
                  ";-4:" + t("grade_-4") +
                  ";4:" + t("grade_4") +
                  ";5:" + t("grade_5") +
                  ";6:" + t("grade_6") +
                  ";7:" + t("grade_7") +
                  ";8:" + t("grade_8") +
                  ";9:" + t("grade_9") +
                  ";10:" + t("grade_10") +
                  ";13:" + t("grade_10_pro") +
                  ";11:" + t("grade_11") +
                  ";14:" + t("grade_11_pro") +
                  ";12:" + t("grade_12") +
                  ";15:" + t("grade_12_pro")
               },
               stype: "select", width:75},
            score: {label: t("contestant_score_label"), editable: false, width:75},
            nbContestants: {label: t("contestant_nbContestants_label"), editable: false, width:60, editoptions:{
               value:{
                  "1": t("nbContestants_1"),
                  "2": t("nbContestants_2"),
               }}, searchoptions:{ value:"_NOF_:" + t("option_no_filter") +
                  ";1:" + t("nbContestants_1") +
                  ";2:" + t("nbContestants_2")
               },
               edittype: "select", stype: "select"},
            rank: {label: t("contestant_rank_label"), editable: false, width:150}
         }
      },
      school: {
         tableName: "school",
         fields: {
            name: {label: t("school_name_label"), editable: true, edittype: "text", width: 250, required: true},
            region: {label: t("school_region_label"),
               editable: true, edittype: "select", width: 120, editoptions:{ value:getRegionsObjects() },
               stype: "select", searchoptions:{ value:getRegionsObjects(true) },
               comment: t("school_region_comment"),
               required: true
            },
            address: {label: t("school_address_label"), editable: true, edittype: "text", width: 150, required: true},
            city: {label: t("school_city_label"), editable: true, edittype: "text", width: 200, required: true},
            zipcode: {label: t("school_zipcode_label"), longLabel: t("school_zipcode_long_label"), editable: true, edittype: "text", width: 120, required: true},
            country: {label: t("school_country_label"), editable: true, edittype: "text", width: 100, required: true},
            nbStudents: {label: t("school_nbStudents_label"), longLabel: "Taille", editable: true, edittype: "text", subtype:"positiveint", width: 100, comment:t("school_nbStudents_comment"), required: true}
         }
      },
      school_search: {
         tableName: "school_search",
         fields: {
            name: {label: t("school_name_label"), width: 250},
            region: {label: t("school_region_label"),
               editable: false, edittype: "select", width: 120, editoptions:{ value:getRegionsObjects() },
               stype: "select", searchoptions:{ value:getRegionsObjects(true) },
               comment: t("school_region_comment")
            },
            address: {label: t("school_address_label"), width: 150},
            city: {label: t("school_city_label"), width: 200},
            zipcode: {label: t("school_zipcode_label"), width: 120},
            country: {label: t("school_country_label"), width: 100}
         }
      },
      colleagues: {
         tableName: "colleagues",
         fields: {
            lastName: {label: t("user_lastName_label") , editable: false, width: 250},
            firstName: {label: t("user_firstName_label") , editable: false, width: 250},
            accessTypeGiven: {label: t("colleagues_access_given"),
               editable: true, edittype: "select", editoptions:{ value:{"none": t("colleagues_access_none"), "read": t("colleagues_access_read"), "write": t("colleagues_access_write")}},
               stype: "select", searchoptions:{ value:"_NOF_:" + t("option_no_filter") + ";none:" + t("colleagues_access_none") + ";read:" + t("colleagues_access_read") + ";write:" + t("colleagues_access_write")},
               width: 150},
            accessTypeReceived: {label: t("colleagues_access_received"),
               editable: false,edittype: "select", editoptions:{ value:{"none": t("colleagues_access_none"), "read": t("colleagues_access_read"), "write": t("colleagues_access_write")}},
               stype: "select", searchoptions:{ value:"_NOF_:" + t("option_no_filter") + ";none:" + t("colleagues_access_none") + ";read:" + t("colleagues_access_read") + ";write:" + t("colleagues_access_write")},
               width: 150}
         }
      },
      user: {
         tableName: "user",
         fields: {
            saniValid: {label: t("user_saniValid_label"), 
                        editable: false, width:120,
                        edittype: "select", editoptions: editYesNo,
                        stype: "select", searchoptions: searchYesNo
                       },
            gender: {label: t("user_gender_label"), editable: true, edittype: "select", width: 50, editoptions:{ value:{"F": t("user_gender_female"), "M": t("user_gender_male")}}},
            lastName: {label: t("user_lastName_label"), editable: true, edittype: "text", width: 90},
            firstName: {label: t("user_firstName_label"), editable: true, edittype: "text", width: 90},
            officialEmail: {label: t("user_officialEmail_label"), editable: true, edittype: "text", width: 200},
            officialEmailValidated: {label: t("user_officialEmailValidated_label"), editable: true, edittype: "select", width: 50, editoptions: editYesNo, stype: "select", searchoptions: searchYesNo},
            alternativeEmail: {label: t("user_alternativeEmail_label"), editable: true, edittype: "text", width: 200},
            validated: {label: t("user_validated_label"), editable: true, edittype: "select", width: 60, editoptions: editYesNo},
            allowMultipleSchools: {label: t("user_allowMultipleSchools_label"), editable: true, edittype: "select", width: 90, editoptions: editYesNo, stype: "select", searchoptions: searchYesNo},
            registrationDate: {label: t("user_registrationDate_label"), editable: false, width: 170},
            lastLoginDate: {label: t("user_lastLoginDate_label"), editable: false, width: 170},
            awardPrintingDate: {label: t("user_awardPrintingDate_label"), editable: false, width: 170},
            isAdmin: {label: t("user_isAdmin_label"), editable: true, edittype: "select", width: 60, editoptions: editYesNo, stype: "select", searchoptions: searchYesNo},
            comment: {label: t("user_comment_label"), editable: true, edittype: "textarea", width: 450, editoptions:{rows:"8",cols:"40"}}
         }
      },
      user_create: {
         tableName: "user",
         fields: {
            gender: {label: t("user_gender_label"), editable: true, edittype: "select", width: 20, editoptions:{ value:{"F": "Mme.", "M": "M."}}, required:true},
            lastName: {label: t("user_lastName_label"), editable: true, edittype: "text", width: 90, required: true},
            firstName: {label: t("user_firstName_label"), editable: true, edittype: "text", width: 90, required: true},
            officialEmail: {label: t("user_officialEmail_label"), editable: true, edittype: officialEmailEditType, width: 90, required: true},
            alternativeEmail: {label: t("user_alternativeEmail_label"), editable: true, edittype: "text", width: 90},
            password: {label: t("user_password_label"), editable: true, edittype: "password", width: 90, required: true},
            password2: {label: t("user_password_confirm_label"), editable: true, edittype: "password", width: 90, required: true}
         }
      },
      user_edit: {
         tableName: "user",
         fields: {
            gender: {label: t("user_gender_label"), editable: true, edittype: "select", width: 20, editoptions:{ value:{"F": "Mme.", "M": "M."}}, required:true},
            lastName: {label: t("user_lastName_label"), editable: true, edittype: "text", width: 90, required: true},
            firstName: {label: t("user_firstName_label"), editable: true, edittype: "text", width: 90, required: true},
            officialEmail: {label: t("user_officialEmail_label"), editable: true, edittype: officialEmailEditType, width: 90, required: true},
            alternativeEmail: {label: t("user_alternativeEmail_label"), editable: true, edittype: "text", width: 90},
            old_password: {label: t("user_old_password_label"), editable: true, edittype: "password", width: 90, comment:"Si vous souhaitez modifier votre mot de passe, remplissez les 3 derniers champs. Sinon, laissez-les vides."},
            password: {label: t("user_new_password_label"), editable: true, edittype: "password", width: 90},
            password2: {label: t("user_new_password_confirm_label"), editable: true, edittype: "password", width: 90}
         }
      },
      team_view: {
         tableName: "team_view",
         fields: {
            schoolID: {label: t("team_view_school"),
               editable: false, edittype: "select", editoptions: { value:getItemNames(schools)},
               stype: "select", searchoptions: { value:getItemNames(schools, true)},
               width: 250},
            contestID: {label: t("contestant_contestID_label"),
               editable: false, edittype: "select", editoptions: { value:getItemNames(contests)},
               stype: "select", searchoptions: { value:getItemNames(contests, true)},
               width: 300},
            name: {label: t("team_view_name_label"), editable: false, width: 300,
               stype: groupStype, searchoptions: groupSearchOptions},
            contestants: {label: t("team_view_contestants_label"), editable: false, width: 500},
            password: {label: t("team_view_password_label"), editable: false, width: 100, search: false},
            startTime: {label: t("team_view_startTime_label"), editable: false, width: 180, search: false},
            score: {label: t("team_view_score_label"), editable: false, width: 100, search: false},
            participationType: {label: t("participationType_label"), longLabel: t("participationType_long_label"), editable: false, required: false, edittype: "select", width: 130, editoptions:{ value:{"Official": t("participationType_official"), "Unofficial": t("participationType_unofficial")}}, comment: t("participationType_comment")},
         }
      },
      contest: {
         tableName: "contest",
         fields: {
            name: {label: t("contest_name_label"), editable: true, edittype: "text", width:350},
            level: {label: t("contest_level_label"), editable: true, edittype: "select", width: 100,
               editoptions:{ value:{
                  "0": t("option_undefined"),
                  "1": t("option_grades_6_7"),
                  "2": t("option_grades_8_9"),
                  "3": t("option_grades_10"),
                  "4": t("option_grades_11_12"),
                  "5": t("option_grades_10_pro"),
                  "6": t("option_grades_11_12_pro")
               }},
               searchoptions:{ value:"_NOF_:" + t("option_no_filter") +
                     ";0:" + t("option_undefined") +
                     ";1:" + t("option_grades_6_7") +
                     ";2:" + t("option_grades_8_9") +
                     ";3:" + t("option_grades_10") +
                     ";4:" + t("option_grades_10_pro") +
                     ";5:" + t("option_grades_11_12") +
                     ";6:" + t("option_grades_11_12_pro")
                     },
               stype: "select"
            },
            year: {label: t("contest_year_label"), editable: true, edittype: "text", subtype:"int", width: 100},
            status: {label: t("contest_status_label"), editable: true, edittype: "select", width: 100,
               editoptions:{
                  value:{
                     "FutureContest": t("option_future_contest"),
                     "RunningContest": t("option_running_contest"),
                     "PreRanking": t("option_preranking_contest"),
                     "PastContest": t("option_past_contest"),
                     "Other": t("option_other_contest"),
                     "Closed": t("option_closed_contest"),
                     "Hidden": t("option_hidden_contest")
                   }
               },
               search: false
            },
            nbMinutes: {label: t("contest_nbMinutes_label"), editable: true, edittype: "text", subtype:"int", width: 100},
            bonusScore: {label: t("contest_bonusScore_label"), editable: true, edittype: "text", subtype:"int", width: 100},
            allowTeamsOfTwo: {
               label: t("contest_allowTeamsOfTwo_label"),
               editable: true,
               edittype: "select", editoptions: editYesNo,
               stype: "select", searchoptions: searchYesNo,
               width: 100
            },
            newInterface: {
               label: t("contest_newInterface_label"),
               editable: true,
               edittype: "select", editoptions: editYesNo,
               stype: "select", searchoptions: searchYesNo,
               width: 100
            },
            fullFeedback: {
               label: t("contest_fullFeedback_label"),
               editable: true,
               edittype: "select", editoptions: editYesNo,
               stype: "select", searchoptions: searchYesNo,
               width: 100
            },
            nextQuestionAuto: {
               label: t("contest_nextQuestionAuto_label"),
               editable: true,
               edittype: "select", editoptions: editYesNo,
               stype: "select", searchoptions: searchYesNo,
               width: 100
            },
            folder: {label: t("contest_folder_label"), editable: true, edittype: "text", width:350}
         }
      },
      question: {
         tableName: "question",
         fields: {
            key: {label: t("question_key_label"), editable: true, edittype: "text", width: 120},
            folder: {label: t("question_folder_label"), editable: true, edittype: "text", width: 100},
            name: {label: t("question_name_label"), editable: true, edittype: "text", width: 400},
            answerType: {label: t("question_answerType_label"), editable: true, edittype: "select", width: 150,
               editoptions:{ value:{"0": t("option_multiple_choice"), "1": t("option_free_input"), "2": t("option_evaluated")}}},
            expectedAnswer: {label: t("question_expectedAnswer_label"), editable: true, edittype: "text", width: 200}
         }
      },
      school_user: {
         tableName: "school_user",
         fields: {
            userID: {editable: true},
            schoolID: {editable: true},
            confirmed: {editable: true},
            awardsReceivedYear: {editable: true}
         }
      },
      school_year: {
         tableName: "school_year",
         fields: {
            schoolID: {editable: false},
            userID: {editable: false},
            year: {editable: false},
            nbOfficialContestants: {editable: false},
            awarded: {editable: false}
         }
      }
   };
   // These fields are only needed if your are an admin
   if (isAdmin())
   {
       models.school.fields.lastName = {label: t("school_admin_1_lastName"), editable: false, width: 150};
       models.school.fields.firstName = {label: t("school_admin_1_firstName"), editable: false, width: 150};
       models.school.fields.saniValid = 
           {label: t("school_saniValid_label"), 
                        editable: false, width:120,
                        edittype: "select", editoptions: editYesNo,
                        stype: "select", searchoptions: searchYesNo,
           };
       models.school.fields.saniMsg = {label: t("school_saniMsg_label"), editable: true, edittype: "text", width: 200};
       models.school.fields.coords = {label: t("school_coords_label"), editable: false, edittype: "text", width: 150};
   }
   if (isLogged) {
      models.group = getGroupsColModel();
      models.contest_question = getContestQuestionsColModel();
   }
}

function jqGridNames(modelName) {
   var fields = models[modelName].fields;
   var names = [];
   for (var fieldName in fields) {
      if (!fields[fieldName].label) {
         fields[fieldName].label = '';
      }
      names.push(fields[fieldName].label);
   }
   return names;
}

function jqGridModel(modelName) {
   var fields = models[modelName].fields;
   var res = [];
   for (var fieldName in fields) {
      var field = fields[fieldName];
      var jqGridField = {
         name: fieldName,
         index: fieldName,
         width: field.width,
         editable: field.editable,
         edittype: field.edittype,
         editoptions: field.editoptions,
         formatter: field.formatter,
         formatoptions: field.formatoptions,
         searchoptions: field.searchoptions,
         stype: field.stype,
         search: field.search
      };
      if (field.edittype === "select") {
         jqGridField.formatter = "select";
      }
      if (typeof field.sortable !== 'undefined') {
         jqGridField.sortable = field.sortable;
      }
      if (field.hidden) {
         jqGridField.hidden = true;
         jqGridField.visible= false;
         jqGridField.hiddenlg= true;
      }
      res.push(jqGridField);
   }
   return res;
}

function teamViewMakeUnofficial(id) {
   if (confirm(t("confirm_make_team_unofficial"))) {
      jQuery("#grid_team_view").jqGrid('setCell',id,'participationType', 'Unofficial');
      jQuery("#grid_team_view").saveCell(id, 'participationType'); // doesn't work, no idea why...
      var item = {id: id, participationType: 'Unofficial'};
      $.post("jqGridData.php", {tableName:"team_view", oper: "update", record: item});
   }
}

function teamViewLoadComplete() {
   $.each($("#grid_team_view").find("tr"), function(i, row) {
      var id = row.id;
      if(id) {
          var participationType = jQuery("#grid_team_view").jqGrid("getRowData", id).participationType;
          if (participationType == 'Official') {
             $(row).find('td:last').append("<input style='height:22px;width:20px;' type='button' value='X' onclick=\"teamViewMakeUnofficial('"+id+"');\" />");
          }
      }
   });
}

function loadGrid(modelName, sortName, rowNum, rowList, onSelectRow, withToolbar) {
  var lastSel = 0;
  var loadComplete;
  if (modelName == "group") {
     loadComplete = groupLoadComplete;
  } else if (modelName == 'team_view') {
     loadComplete = teamViewLoadComplete;
  }

  var tableName = models[modelName].tableName;
//  console.error($("#grid_" + modelName));
  $("#grid_" + modelName).jqGrid({
    url: "jqGridData.php?tableName=" + tableName,
    datatype: 'xml',
    mtype: 'GET',
    colNames: jqGridNames(modelName),
    colModel: jqGridModel(modelName),
    pager: "#pager_" + modelName,
    rowNum: rowNum,
    rowList: rowList,
    sortname: sortName,
    sortorder: 'asc',
    regional : config.defaultLanguage,
    viewrecords: true,
    gridview: true,
    width: "100%",
    height: "100%",
    caption: '',
    onSelectRow: function(id){
       if(id && (id !== lastSel)){ 
          $('#grid_' + modelName).saveRow(lastSel); 
          lastSel = id; 
          onSelectRow(id);
       } else {
          if (modelName === "school") {
              var school = schools[id];
              if (school.nbUsers > 1) {
                 alert(t("alert_school_has_multiple_coordinators", { nbUsers: school.nbUsers, infoEmail: config.infoEmail }));
                 return;
              }
              /*
              if (school.userID !== loggedUser.ID) {
                 alert("Seul le créateur de cet établissement (" + school.userLastName + " " + school.userFirstName + ") peut l'éditer");
                 return;
              }
              */
          }
          if (modelName !== "group") { // TODO: clean
             $('#grid_' + modelName).editRow(id, true);
          }
       }
    },
    editurl: "jqGridData.php?tableName=" + tableName,
    loadComplete: loadComplete
  }); 
  if (withToolbar) {
     $("#grid_" + modelName).jqGrid('filterToolbar', {autosearch:true, searchOnEnter:true});
  }
}

function loadCustomAwards() {
   $.post("nextContestData.php", {}, function(res) {
      if (!res.success) return;
      var data = res.data;
      $('#custom_award_title').html(data.title);
      $('#custom_award_help').html(data.help);
      var table = '<table class="ui-common-table" style="border-spacing:0px 0px;"><thead><tr class="ui-jqgrid-labels">';
      var iCol, iRow;
      for (iCol = 0 ; iCol < data.colNames.length; iCol++) {
         table += '<th style="width: '+data.colNames[iCol].width+'; border: 1px solid gray;">';
         table += data.colNames[iCol].name;
         table += '</th>'
      }
      table +="</tr></thead><tbody>";
      for (rowID in data.colData) {
         var row = data.colData[rowID];
         table += '<tr style="border: 1px solid gray;">';
         for (iCol = 0 ; iCol < data.colNames.length; iCol++) {
            table += '<td style="border: 1px solid gray;'+data.colNames[iCol].style+'">'+row[iCol]+'</td>'
         }
         table += '</tr>';
      }
      table += '</tbody></table>';
      $('#custom_award_data').html(table);
   }, 'json');
}

function loadContestants() {
   loadGrid("contestant", "", 20, [20, 50, 200, 500], function() {}, true);
}

function loadListAwards() {
   loadGrid("award1", "", 20, [20, 50, 200, 500], function() {}, true);
   loadCustomAwards();
}

function loadSchoolSearch() {
   loadGrid("school_search", "", 20, [20, 50, 200, 500], function() {}, true);
}

function loadTeams() {
   loadGrid("team_view", "startTime", 20, [20, 50, 200, 500], function() {}, true);
}

function loadUsers() {
   loadGrid("user", "lastName", 20, [20, 50, 200, 500], function() {}, true);
}

var contestID;
var contestFolder;
function loadListContests() {
   loadGrid("contest", "name", 10, [10, 20, 30], function(id) {
      contestID = id;
      $('#grid_contest_question').jqGrid('setGridParam', {
         url:'jqGridData.php?tableName=contest_question&contestID=' + id
      }).trigger('reloadGrid');
   
   }, true);
}

var questionID;
function loadListQuestions() {
   loadGrid("question", "key", 20, [20, 50, 200], function(id) {
      questionID = id;
      var url = "bebras-tasks/" + questions[id].folder + "/" + questions[id].key + "/index.html";
      $("#preview_question").attr("src", url);
   }, true);
}

function loadListSchools() {
   loadGrid("school", "name", 20, [20, 50, 200, 500], function() {}, isAdmin());
}

function loadListColleagues() {
   loadGrid("colleagues", "lastName", 20, [20, 50, 200], function() {}, false);
}

function loadContestQuestions() {
   loadGrid("contest_question", "order", 20, [20, 50, 200], function() {}, true);
}

var groupID;
function loadListGroups() {
   loadGrid("group", "name", 20, [10, 20, 50], function(id) {groupID = id;}, isAdmin());
}

function filterSchool() {
   filterSchoolID = jQuery("#grid_school").jqGrid('getGridParam','selrow');
   if (filterSchoolID === "null") {
      filterSchoolID = "0";
      jqAlert(t("warning_no_school_selected"));
   }
   updateFilters();
}

function filterGroup() {
   filterGroupID = jQuery("#grid_group").jqGrid('getGridParam','selrow');
   if (filterGroupID === "null") {
      filterGroupID = "0";
      jqAlert(t("warning_no_group_selected"));
   }
   updateFilters();
}

function cancelFilterGroup() {
   filterGroupID = "0";
   updateFilters();
}

function cancelFilterSchool() {
   filterSchoolID = "0";
   updateFilters();
}

function updateFilters() {
   var html = "";
   if (filterSchoolID !== "0") {
      html += "<b>" + t("filter_school") + "</b> " + schools[filterSchoolID].name + " <input type='button' onclick='cancelFilterSchool()' value='" + t("filter_remove") + "' /><br/>";
   }
   if (filterGroupID !== "0") {
      html += "<b>" + t("filter_group") + "</b> " + groups[filterGroupID].name + " <input type='button' onclick='cancelFilterGroup ()' value='" + t("filter_remove") + "' /><br/>";
   }
   html += "<br/>";
   $("#filters").html(html);
   reloadGrids();
}

function exportCSV(tableName) {
   var urlFilters = "";
   if (filterSchoolID != "0") {
      urlFilters += "&schoolID=" + filterSchoolID;
   }
   if (filterGroupID != "0") {
      urlFilters += "&filterGroupID=" + filterGroupID;
   }
   window.location.href = "jqGridData.php?tableName=" + tableName + urlFilters + "&format=csv&sidx&sord&page=1&rows=50000";
}

function reloadGrids() {
   var urlFilters = "";
   if (filterSchoolID != "0") {
      urlFilters += "&schoolID=" + filterSchoolID;
   }
   if (filterGroupID != "0") {
      urlFilters += "&filterGroupID=" + filterGroupID;
   }
   $('#grid_group').jqGrid('setGridParam', {
      url: "jqGridData.php?tableName=group" + urlFilters
   }).trigger('reloadGrid');
   $('#grid_contestant').jqGrid('setGridParam', {
      url:'jqGridData.php?tableName=contestant' + urlFilters
   }).trigger('reloadGrid');
   $('#grid_team_view').jqGrid('setGridParam', {
      url:'jqGridData.php?tableName=team_view' + urlFilters
   }).trigger('reloadGrid');
}


function refreshGrid(model) {
     $("#grid_" + model).trigger('reloadGrid');
}

function isLogged() {
   return $.post("login.php", {isLogged: 1},
      function(data) {
         if (data.success) {
            logUser(data.user);
         } else {
            $("#loading").hide();
            $("#login_form").show();
            initModels(false);
         }
      }, "json"
   );
}

function loadUser(user) {
   var gender = '';
   if (user.gender == 'F')
       gender = 'Mme.';
   if (user.gender == 'M')
       gender = 'M.';

   $("#user-gender").html(gender);
   $("#user-lastName").html(user.lastName);
   $("#user-firstName").html(user.firstName);
   if (user.officialEmail !== "") {
      var strValidated = " (" + t("not_confirmed") + ")";
      if (user.officialEmailValidated === "1") {
         strValidated = " (" + t("confirmed") + ")";
      }
      $("#user-officialEmail").html(user.officialEmail + strValidated);
   }
   $("#user-alternativeEmail").html(user.alternativeEmail);
}

function continueLogUser() {
   var state = 'normal';
   var spreadCastorBox = false;
   loadSchoolsUsers();
   $("#login_form").hide();
   $("#loading").hide();
   initModels(true);
   $("#logoutLink").show();
   $("#headerWarning").show();
   loadListSchools();
   loadListColleagues();
   if (!spreadCastorBox) {
      $("#spread-castor").hide();
   }
   if (isAdmin()) {
      $("#title").html(t("title_administrator"));
      loadUsers();
      loadListContests();
      loadListQuestions();
      loadContestQuestions();
      if (state !== 'normal') {
         loadContestants();
         loadTeams();
         loadListAwards();
      }
      initDeleteButton("user");
      initDeleteButton("contest");
      initDeleteButton("question");
      initDeleteButton("contest_question");
      initDeleteButton("contestant");
      initDeleteButton("team_view");
      $("#buttonDeleteSelected_contestant").show();
      $("#buttonDeleteSelected_team_view").show();
      $("#advSchools").show();
      $("#buttonRefreshUsers").show();
      $("#buttonRefreshSchools").show();
      $("#linkExportUsers").show();
      $("#linkExportSchools").show();
      $("#buttonComputeCoords_school").show().click(function(){
         computeCoordsSchools();
      });
      $("#buttonDeleteSelected_school").click(function() {
         jqAlert(t('admin_cannot_delete_school'));
      });
   } else {
      //if (loggedUser.allowMultipleSchools === "1") {
         //$("#singleSchool").hide();
         //$("#multipleSchools").show();
         $("#advSchools").show();
      //}
      if (spreadCastorBox) {
         initSpreadCastor();
      }
      initDeleteButton("school", function() { $('#grid_colleagues').trigger('reloadGrid'); return [true];});
      $("#li-tabs-questions").hide();
      $("#li-tabs-contests").hide();
      if (state === 'contest') {
         $("#li-tabs-contestants").hide();
         $("#li-tabs-teams").hide();
         $("#tabs-contestants").hide();
         $("#tabs-teams").hide();
      }
      if (state !== 'normal') {
         $("#li-tabs-awards").hide();
         $("#li-tabs-certificates").hide();
         $("#tabs-certificates").hide();
      }      
      $("#tabs-questions").hide();
      $("#tabs-contests").hide();
   }
   $("#admin_view").tabs();
   $("#admin_view").show();
   loadListGroups();
   if (state !== 'contest') {
      loadContestants();
      loadTeams();
   }
   if (state === 'normal') {
      loadListAwards();
   }
   initDeleteButton("group");
}

function getPersonalCode() {
   $.post('personalQualificationCode.php', {}, function(data) {
      if (!data.success) {
         $('#noPersonalCode').hide();
         $('#withPersonalCode').hide();
         console.error(data.error);
      } else {
         if (data.code === false) {
            $('#noPersonalCode').hide();
            $('#withPersonalCode').hide();
         } else if (!data.code){
            $('#withPersonalCode').hide();
         } else {
            $('#personalCode').html(data.code);
            $('#noPersonalCode').hide();
         }
      }
   }, 'json');
}

function generatePersonalCode() {
    $.post('personalQualificationCode.php', {create: true}, function(data) {
      if (!data.code) {
         $('#withPersonalCode').hide();
      } else {
         $('#personalCode').html(data.code);
         $('#noPersonalCode').hide();
         $('#withPersonalCode').show();
      }
   }, 'json');
}

function logUser(user) {
   loggedUser = user;
   loadUser(user);
   getPersonalCode();
   loadSchools().done(function() {
      loadContests().done(function() {
         if (isAdmin()) {
            loadQuestions().done(function() {
               continueLogUser();
            });
         } else {
            loadGroups().done(function() {
               continueLogUser();
            });
         }
      });
   });
}

function logout() {
   return $.post("login.php", {logout: 1}, 
      function(data) {
         if (data.success) {
            window.location.reload();
         }
      }, "json"
   );   
}

function initSpreadCastor() {
   $("#spread-castor-send").click(function() {
      $("#spread-castor-send").attr("disabled", "disabled");
      var email = $("#spread-castor-email").val();
      $.get("recommendSystem.php", {recommendTo: email}, 
         function(data) {
            $("#spread-castor-send").removeAttr("disabled"); 
            if (!data.success) {
               alert("ERROR for sendMessage");
            } else {
               jqAlert(t("spread_castor_" + data.message));
               if (data.message == "successful_email") {
                  $("#spread-castor-email").val('');
               }
            }
         }, "json"
     );
   });

   $.get("recommendSystem.php", {nearby: 1},
      function(data) {
         if (! data.success) {
            alert("ERROR for nearbySchools");
            return;
         }
         var names = data.nearbySchools;
         var url = data.fullListURL;
         // for debug:
         // var names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
         // var url = "recommendSystem.php?academieID=4&level=Lycee";
         var nb = names.length;
         var s = '';
         s += "<div>" + t("schools_without_coordinator")+ "</div>";
         s += "<table class='spread-castor-table'><tr><td><ul>";
         for (var i = 0; i < Math.min(5, nb); i++) {
            s += "<li>" + names[i] + "</li>";
         }
         s += "</ul></td><td><ul>";
         for (i = 5; i < Math.min(9, nb); i++) {
            s += "<li>" + names[i] + "</li>";
         }
         s += "<li>... <span style='font-size: small'><a href='" + url + "'>" + t("schools_view_all") + "</a></span></li>";
         s += "</ul></td></tr></table>";
         $("#spread-castor-table").html(s);
      }, "json"
   );
}

function initDeleteButton(modelName, afterSubmit) {
   $("#buttonDeleteSelected_" + modelName).show();
   $("#buttonDeleteSelected_" + modelName).click(function(){
      var gr = jQuery("#grid_" + modelName).jqGrid('getGridParam','selrow');
      if( gr ) {
         if (modelName === "school") {
         }
         if (modelName === "group") {
             var nbStudents = jQuery("#grid_group").jqGrid("getRowData", gr).nbStudentsEffective;
             if ((nbStudents !== "0") && (loggedUser.isAdmin !== "1")) {
                jqAlert(t("number_of_participants_1") + nbStudents + t("number_of_participants_2"));
                return;
             }
         }
         jQuery("#grid_" + modelName).jqGrid('delGridRow',gr,{reloadAfterSubmit:false,     afterSubmit: afterSubmit});
      } else {
         jqAlert(t("select_record_to_delete"));
      }
   });
}

function loadData(tableName, callback) {
   return $.post("jqGridData.php", {oper: "select", tableName: tableName},
      function(data) {
         if (data.success) {
            callback(data.items);
         } else {
            jqAlert(t("error_while_loading"));
         }
      }, "json"
   );
}

function getItemNames(items, withUnselect) {
   var itemNames = "";
   if (withUnselect) {
      itemNames += "_NOF_:" + t("option_no_filter") + ";";
   }
   var toSort = [];
   for (var itemID in items) {
      toSort.push({ID : itemID, name: items[itemID].name});
   }
   toSort.sort(function(itemA, itemB) {
      if (itemA.name < itemB.name) {
         return -1;
      }
      if (itemA.name === itemB.name) {
         return 0;
      }
      return 1;
   });
   for (var iItem = 0;iItem < toSort.length; iItem++) {
      var item = toSort[iItem];
      itemNames += item.ID + ":" + item.name;
      if (iItem < toSort.length - 1) {
         itemNames += ";";
      }
   }
   return itemNames;
}

function loadContests() {
   return loadData("contest", function(items) {
      contests = items;
      if (!window.config.allowCertificates) {
         $('#buttonPrintCertificates_group').hide();
         $('#school_print_certificates_help').hide();
         $('#school_print_certificates_title').hide();
         return;
      }
      var contestList = '<ul>';
      var nbContests = 0;
      for (var contestID in contests) {
         var contest = contests[contestID];
         if (contest.printCertificates == 1) {
            nbContests += 1;
            contestList += '<li><button onclick="printSchoolCertificates(\''+contest.ID+'\')">'+contest.name+'</button></li>';
         }
      }
      contestList += "</ul>";
      if (nbContests == 0) {
         $('#buttonPrintCertificates_group').hide();
         $('#school_print_certificates_help').hide();
         $('#school_print_certificates_title').hide();
      } else {
         $('#school_print_certificates_contests').html(contestList);
      }
   }
   );
}

function loadQuestions() {
   return loadData("question", function(items) {
      questions = items;
      questionsKeysToIds = {};
      for (var questionID in questions) {
         var question = questions[questionID];
         questionsKeysToIds[question.key] = questionID;
      }
   });
}

function loadGroups() {
   return loadData("group", function(items) {
      groups = items;
   });
}

function loadSchoolsYears(school_users) {
//   return; // disabled; keeps displaying in some cases (ex : Mauras du liban)
   if (isAdmin()) {
      return;
   }
   return loadData("school_year", function(items) {
      var school_user_by_school = {};
      var school_user;
      for (var school_userID in school_users) {
         school_user = school_users[school_userID];
         school_user_by_school[school_user.schoolID] = school_user;
      }
      for (var itemID in items) {
         var school_year = items[itemID];
         school_user = school_user_by_school[school_year.schoolID];
         school_year.awarded = parseInt(school_year.awarded);
         school_year.year = parseInt(school_year.year);
         if (school_user.awardsReceivedYear) {
            school_user.awardsReceivedYear = parseInt(school_user.awardsReceivedYear);
         }
         if (school_user && ((!school_user.awardsReceivedYear) || (school_user.awardsReceivedYear < school_year.year)) && (school_year.awarded > 0) && (school_year.year > 2013)) {
            var buttons =  [ { text: "Oui", click: function() {
               school_user.awardsReceivedYear = Math.max(school_user.awardsReceivedYear, school_year.year);
               $.post("jqGridData.php", {tableName:"school_user", oper: "update", record:school_user}, function(data) {});
               $(this).dialog( "close" );
            }},
            { text: "Non", click: function() {
               if (!school_user.awardsReceivedYear) {
                  school_user.awardsReceivedYear = 0;
               $.post("jqGridData.php", {tableName:"school_user", oper: "update", record:school_user}, function(data) {});
               }
               $(this).dialog( "close" );
            }}];
            //jqAlert(t("alert_awards_received"), null, buttons); // TODO : paramètre pour le nb de lots, établissement
         }
      }
   });
}

function loadSchoolsUsers() {
   return loadData("school_user", function(items) {
      if (isAdmin()) {
         return;
      }
      var toSave = {};
      var toDelete = [];
      for (var itemID in items) {
         var school_user = items[itemID];
         if (school_user.confirmed != 1) {
            var schoolName = schools[school_user.schoolID].name;
            if (confirm(t("still_school_user") + schoolName)) {
               school_user.confirmed = 1;
               toSave[itemID] = school_user;
               $.post("jqGridData.php", {tableName:"school_user", oper: "update", record:school_user},
                  function(data) {}
               );
            } else {
               $.post("jqGridData.php", {tableName:"school_user", oper: "del", record:school_user},
                  function(data) {}
               );
            }
         }
      }
      loadSchoolsYears(items);
   });
}

function loadSchools() {
   return loadData("school", function(items) {
      schools = items;
   });
}

function objectHasProperties(object) {
   for (var iProperty in object) {
      return true;
   }
   return false;
}

function newGroup() {
   if (isAdmin()) {
      jqAlert(t('admin_cannot_create_group'));
      return;
   }
   if (!objectHasProperties(schools)) {
      jqAlert(t("school_not_provided"));
      return;
   }
   newForm("group", t("create_group"), t("create_group_comment"));
}

function newContestQuestion() {
   newItem("contest_question", {contestID: contestID});
}

function newItem(modelName, params, callback) {
   if (params === undefined) {
      params = {};
   }
   var tableName = models[modelName].tableName;
   params.oper = "insert";
   params.tableName = tableName;
   if (!callback) {
      callback = function(data) {
         $('#grid_' + modelName).trigger('reloadGrid');   
      };
   }
   $.post("jqGridData.php", params, callback);
}

function loopGradeContest(curContestID, curGroupID) {
   // Retrieve the list of questions of the contest
   $.post('questions.php', { contestID: curContestID, groupID: curGroupID }, function(data) {
      if (data.status === 'success') {
         var selectorState = curGroupID ? '#gradeGroupState' : '#gradeContestState';
         $(selectorState).html('<span class="nbCurrent">0</span> / <span class="nbTotal">' + data.questionKeys.length + '</span> - ' + t("grading_current_question") + ' : <span class="current"></span> <span class="gradeprogressing"></span>');
         grade(curContestID, groupID, data.questionKeys, data.questionFolders, 0);
      }
      else {
         jqAlert(data.message);
         return;
      }
   }, 'json');
}

function grade(curContestID, curGroupID, questionKeys, questionFolders, curIndex)
{
   var selectorState = curGroupID ? '#gradeGroupState' : '#gradeContestState';
   if (curIndex >= questionKeys.length) {
      $(selectorState).html(t("grading_compute_total_scores") + '<span class="gradeprogressing"></span>');
      computeScores(curContestID, curGroupID, 0);
      
      return;
   }
   
   $(selectorState+' .nbCurrent').text(parseInt(curIndex) + 1);
   $(selectorState+' .current').text(questionKeys[curIndex]);
   
   // Retrieve the bebras/grader of the current question
   $.post('grader.php', { contestID: curContestID, groupID: curGroupID, questionKey: questionKeys[curIndex] },function(data) {
      if (data.status === 'success') {
         var url = "bebras-tasks/" + questionFolders[curIndex] + "/" + questionKeys[curIndex] + "/index.html";
         $("#preview_question").attr("src", url);
         
         // Retrieve bebras
         generating = true;
         $('#preview_question').load(function() {
            $('#preview_question').unbind('load');
            generating = false;
            curGradingData = data;
            curGradingData.noScore = curGradingData.noAnswerScore;
            // will be filled later
            curGradingData.randomSeed = 0;
            
            // Reset answers score cache
            curGradingScoreCache = {};
            try {
               TaskProxyManager.getTaskProxy('preview_question', function(task) {
                  var platform = new Platform(task);
                  platform.getTaskParams = function(key, defaultValue, success, error) {
                     var res = {};
                     if (key) {
                        if (key !== 'options' && key in curGradingData) {
                           res = curGradingData[key];
                        } else if (curGradingData.options && key in curGradingData.options) {
                           res = curGradingData.options[key];
                        } else {
                           res = (typeof defaultValue !== 'undefined') ? defaultValue : null;
                        }
                     } else {
                        res = curGradingData;
                     }
                     if (success) {
                        success(res);
                     } else {
                        return res;
                     }
                  };
                  TaskProxyManager.setPlatform(task, platform);
                  task.getResources(function(bebras) {
                     curGradingBebras = bebras;
                     task.load({'task': true, 'grader': true}, function() {
                        gradeQuestion(task, curContestID, groupID, questionKeys, questionFolders, curIndex);
                     });
                  });
               }, true);
            } catch (e) {
               console.log('Task loading error catched : questionKey='+questionKeys[curIndex]);
               console.log(e);
            }
         });
      }
      else {
         jqAlert(data.message);
         return;
      }
   }, 'json');
}

function gradeQuestionPack(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex) {
   var selectorState = curGroupID ? '#gradeGroupState' : '#gradeContestState';
   // Compute scores of a pack
   if (curPackIndex >= curGradingData.teamQuestions.length) {
      $(selectorState+' .gradeprogressing').text('');
      grade(curContestID, curGroupID, questionKeys, questionFolders, curIndex + 1);
      return;
   }
   
   var packEndIndex = curPackIndex + gradePackSize;
   if (packEndIndex > curGradingData.teamQuestions.length) {
      packEndIndex = curGradingData.teamQuestions.length;
   }
   
   var scores = {};
   var i = 0;
   var answersToGrade = {};
   for (var curTeamQuestion = curPackIndex; curTeamQuestion < packEndIndex; curTeamQuestion++) {
      var teamQuestion = curGradingData.teamQuestions[curTeamQuestion];

      // XXX : must be in sync with common.js!!!
      curGradingData.randomSeed = teamQuestion.teamID;
      var usesRandomSeed = (('usesRandomSeed' in curGradingBebras) && curGradingBebras.usesRandomSeed);
      // If the answer is in cache and the task doesn't use randomSeed, we use the cached score
      if ((!usesRandomSeed) && 'cache_'+teamQuestion.answer in curGradingScoreCache) {
         continue;
      }
      
      scores[i] = {};
      // in some cases, score cannot be computed because the answer is invalid, so we have this default score
      // that will output "NULL" in the database
      scores[i].score = '';
      scores[i].questionID = teamQuestion.questionID;
      scores[i].teamID = teamQuestion.teamID;
      if (teamQuestion.answer.length < 100) {
         scores[i].answer = teamQuestion.answer;
      }
      scores[i].contestID = curContestID;
      scores[i].groupID = curGroupID;
      scores[i].usesRandomSeed = usesRandomSeed;
      // No answer
      if (teamQuestion.answer == '') {
         scores[i].score = parseInt(curGradingData.noAnswerScore);
      }
      else if (curGradingBebras.acceptedAnswers && curGradingBebras.acceptedAnswers[0]) {
         if (curGradingBebras.acceptedAnswers.indexOf($.trim(teamQuestion.answer)) > -1) {
            scores[i].score = curGradingData.maxScore;
         }
         else {
            scores[i].score = curGradingData.minScore;
         }
      }
      else {
         try {
            if (teamQuestion.answer.length > 200000) {
               scores[i].score = 0;
               console.log('Answer too long scored 0 : questionID='+teamQuestion.questionID+' teamID='+teamQuestion.teamID);
            }
            else {
               answersToGrade[i] = $.trim(teamQuestion.answer);
            }
         }
         catch (e) {
            console.log('Grading error catched : questionID='+teamQuestion.questionID+' teamID='+teamQuestion.teamID);
            console.log(e);
            console.log(teamQuestion.answer);
         }
      }

      // Cache the current answer's score
      if (!usesRandomSeed) {
         curGradingScoreCache['cache_'+teamQuestion.answer] = scores[i].score;
      }

      i++;
   }
   
   // If not score need to be send, go to the next packet directly
   if (!i) {
      $(selectorState+' .gradeprogressing').text($(selectorState+' .gradeprogressing').text()+'.');
      gradeQuestionPack(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex + gradePackSize);
      return;
   }
   
   gradeOneAnswer(task, answersToGrade, 0, scores, function() {
      gradeQuestionPackEnd(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex, scores, selectorState);
   });
}

function gradeOneAnswer(task, answers, i, scores, finalCallback) {
   if (!scores[i]) {
      finalCallback();
      return;
   }
   answer = answers[i];
   if (!answer) {
      gradeOneAnswer(task, answers, i+1, scores, finalCallback);
      return;
   }
   task.gradeAnswer(answer, null, function(score) {
      scores[i].score = score;
      setTimeout(function() {
         gradeOneAnswer(task, answers, i+1, scores, finalCallback);
      },0);
   });
}

function gradeQuestionPackEnd(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex, scores, selectorState) {
      // Send the computed scores to the platform
   $.post('scores.php', { scores: scores, questionKey: curGradingData.questionKey, groupMode: (typeof curGroupID !== 'undefined') },function(data) {
      if (data.status !== 'success') {
         jqAlert('Something went wrong while sending those scores : '+JSON.stringify(scores));
         return false;
      }
      /**
       * Timeout each 25 packs to make the garbage collector work
       */
      if (parseInt(curPackIndex / gradePackSize) % 25 === 0) {
         setTimeout(function() {
            $(selectorState+' .gradeprogressing').text($(selectorState+' .gradeprogressing').text()+'.');
            gradeQuestionPack(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex + gradePackSize);
         }, 5000);
      }
      else {
         $(selectorState+' .gradeprogressing').text($(selectorState+' .gradeprogressing').text()+'.');
         gradeQuestionPack(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, curPackIndex + gradePackSize);
      }
   }, 'json').fail(function() {
      jqAlert('Something went wrong while sending scores...');
      return false;
   });
}

function gradeQuestion(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex) {
   // Compute all scores by pack
   if (curGradingBebras.grader[0] && curGradingBebras.grader[0].content) {
      $('#preview_question')[0].contentWindow.eval($('#preview_question')[0].contentWindow.eval(curGradingBebras.grader[0].content));
   }
   
   gradeQuestionPack(task, curContestID, curGroupID, questionKeys, questionFolders, curIndex, 0);
}

/**
 * Compute the scores of a contest packet
 * 
 * @param {int} curContestID
 * @param {int} packetNumber
 */
function computeScores(curContestID, curGroupID, packetNumber)
{
   // Compute teams total score
   $.post('totalScores.php', { contestID: curContestID, groupID: curGroupID, begin: packetNumber },function(data) {
      var selectorButton = curGroupID ? '#buttonGradeGroup' : '#buttonGradeContest';
      var selectorState = curGroupID ? '#gradeGroupState' : '#gradeContestState';
      if (data.status === 'success') {
         if (data.finished) {
            $(selectorState).html('');
            var button = $(selectorButton);
            var msg = t("grading_scores_computed");
            if (typeof data.differences !== 'undefined') {
               var differences = parseInt(data.differences);
               if (!differences) {
                  msg += " " + t("grading_scores_no_difference");
               } else if (differences === 1) {
                  msg += " " + t("grading_scores_one_difference");
               } else if (differences > 1) {
                  msg += " " + t("grading_scores_with_differences", {nbDifferences: differences});
               }
            }
            jqAlert(msg);
            button.attr("disabled", false);
         }
         else {
            $(selectorState+' .gradeprogressing').html($(selectorState+' .gradeprogressing').html()+'.');
            computeScores(curContestID, curGroupID, packetNumber + 1);
         }
      }
      else {
         jqAlert(data.message);
         return;
      }
   }, 'json');
}

function checkContestSelectedAndConfirm() {
   if (contestID === "0" || contestID === undefined) {
      jqAlert(t("select_contest"));
      return false;
   }
   if (!confirm(t("confirm_contest_operation"))) {
      return false;
   }
   return true;
}

function checkGroupSelectedAndConfirm() {
   if (groupID === "0" || groupID === undefined) {
      jqAlert(t("select_group"));
      return false;
   }
   if (!confirm(t("confirm_group_operation"))) {
      return false;
   }
   return true;
}

function computeCoordsSchools() {
   $.get("actions.php", {action: "getSchoolList"},
      function(data) {
         if (!data.success)
            return;
         computeCoords(0, data.schools);
      }, "json"
   );
}

function computeCoords(cur, schools) {
   if (cur == schools.length) {
      $("#computeCoordsLog").html("");
      return;
   }
    $.get("actions.php", {action: "computeCoordinates", schoolID: schools[cur].ID},
      function(data) {
         if (!data.success)
            alert("ERROR for computeCoords");
      }, "json"
   );

   $("#computeCoordsLog").html(t("compute_school_coords") + " " +(cur+1) + " / " + schools.length + " : " + schools[cur].name);
   setTimeout(function(){ computeCoords(cur+1, schools); }, 1000);
}


function gradeContest() {
   if (!checkContestSelectedAndConfirm()) {
      return;
   }
   var button = $("#buttonGradeContest");
   button.attr("disabled", true);
   var curContestID = contestID;
   loopGradeContest(curContestID, undefined);
}

function gradeGroup() {
   if (!checkGroupSelectedAndConfirm()) {
      return;
   }
   $("#buttonGradeGroup").attr("disabled", true);
   var curGroupID = groupID;
   loopGradeContest(undefined, curGroupID);
}

function rankContest() {
   if (!checkContestSelectedAndConfirm()) {
      return;
   }
   var button = $("#buttonRankContest");
   button.attr("disabled", true);
   $.post("rankContest.php", {contestID: contestID}, 
      function(data) {
         if (!data.success) {
            jqAlert(data.message);
            return;
         }
         var button = $("#buttonRankContest");
         jqAlert(t("ranks_computed"));
         button.attr("disabled", false);
      }, "json"
   );
}

function generateAlgoreaCodes() {
   if (!checkContestSelectedAndConfirm()) {
      return;
   }
   var button = $("#buttonGenerateAlgoreaCodes");
   button.attr("disabled", true);
   $.post("generateAlgoreaCodes.php", {contestID: contestID}, 
      function(data) {
         if (!data.success) {
            jqAlert(data.message);
            return;
         }
         var button = $("#buttonGenerateAlgoreaCodes");
         jqAlert(t("codes_computed"));
         button.attr("disabled", false);
      }, "json"
   );
}

function genContest() {
   if (contestID === "0" || contestID === undefined) {
      jqAlert(t("select_contest"));
      return;
   }
   var button = $("#generateContest");
   button.attr("disabled", true);
   
   tasks = []; // Reinit
   loadContests().done(function() {
      // Retrieve the tasks' list
      $.post("generateContest.php", {contestID: contestID, contestFolder: contests[contestID].folder}, function(data) {
         // Generate each tasks
         genTasks(data.questionsUrl, 0);
      }, 'json');
   });
}

// Unused, keep it 'til 100% sure
function genQuestion() {
   if (questionID === "0" || questionID === undefined) {
      jqAlert(t("select_question"));
      return;
   }
   
   var button = $("#generateQuestion");
   button.attr("disabled", true);
   
   tasks = []; // Reinit
   var url = "bebras-tasks/" + questions[questionID].folder + "/" + questions[questionID].key + "/";
   $("#preview_question").attr("src", url);
   
   // Retrieve bebras
   generating = true;
   $('#preview_question').load(function() {
      $('#preview_question').unbind('load');
      
      var bebras = $('#preview_question')[0].contentWindow.task.getResources();
      tasks.push({
         'bebras': bebras,
         'url': questions[questionID].folder + "/" + questions[questionID].key + "/"
      });
      
      generating = false;
      
      // Compilation
      tasks = JSON.stringify(tasks);
      $.post("generateContest.php", { contestID: questions[questionID].key, contestFolder: questions[questionID].key, 'tasks': tasks }, function(data) {
         if (data.success) {
            jqAlert(t("question_generated"));
         } else {
            jqAlert(t("question_generation_failed"));
         }
         button.attr("disabled", false);
      }, 'json').fail(function() {
         jqAlert(t("question_generation_failed"));
         button.attr("disabled", false);
      });
   });
}

function genTasks(questionsUrl, curIndex)
{
   if (curIndex >= questionsUrl.length) {
      var button = $("#generateContest");
      
      tasks = JSON.stringify(tasks);
      // XXX: status is needed only because of https://github.com/aws/aws-sdk-php/
      $.post("generateContest.php", { contestID: contestID, contestFolder: contests[contestID].folder, 'tasks': tasks, fullFeedback: contests[contestID].fullFeedback, status: contests[contestID].status}, function(data) {
         if (data.success) {
            jqAlert(t("contest_generated"));
         } else {
            jqAlert(t("contest_generation_failed"));
         }
         button.attr("disabled", false);
      }, 'json').fail(function() {
         jqAlert(t("contest_generation_failed"));
         button.attr("disabled", false);
      });
      
      return;
   }
   
   var url = "bebras-tasks/" + questionsUrl[curIndex];
   $("#preview_question").attr("src", url);
   generating = true;
   $('#preview_question').load(function() {
      $('#preview_question').unbind('load');
      TaskProxyManager.getTaskProxy('preview_question', function(task) {
         task.getResources(function(bebras) {
            tasks.push({
               'bebras': bebras,
               'url': questionsUrl[curIndex]
            });
            
            generating = false;
            
            genTasks(questionsUrl, curIndex + 1);
         });
      }, true);
   });
}

function showForm(modelName) {
   $("#buttonValidate_" + modelName).removeAttr("disabled");
   $("#buttonCancel_" + modelName).removeAttr("disabled");
   $("#edit_form").show();
   $("#main_screen").hide();
   $("#headerWarning").hide();
   $("#divSchoolSearch").hide();
}

function getSelectHours(fieldId) {
   var html = "<select id='" + fieldId + "_hours' type='text' style='width:50px'>";
   for (var h = 0; h < 24; h++) {
      html += "<option value='" + h + "'>" + h + "</option>";
   }
   html += "</select>";
   return html;
}

function getSelectMinutes(fieldId) {
   var html = "<select id='" + fieldId + "_minutes' type='text' style='width:50px'>";
   for (var m = 0; m < 60; m += 5) {
      html += "<option value='" + m + "'>" + m + "</option>";
   }
   html += "</select>";
   return html;
}

function getContestFromID(ID) {
   for (var contestID in contests) {
      if (contestID == ID) {
         return contests[contestID];
      }
   }
   return null;
}

function newForm(modelName, title, message) {
   var js = "";
   var html = "<h3>" + title + "</h3>" + message +
      "<input type='hidden' id='" + modelName + "_ID' /><table>";
   for (var fieldName in models[modelName].fields) {
      var field = models[modelName].fields[fieldName];
      if (field.edittype === undefined) {
         continue;
      }
      html += "<tr><td style='width:230px;line-height:2em'><b>";
      if (field.longLabel !== undefined) {
         html += field.longLabel;
      } else {
         html += field.label;
      }
      if (field.required) {
         html += "<sup alt='" + t("mandatory_field") + "'>*</sup>";
      }
      html += "&nbsp;:</b></td><td style='width:350px'>";
      var fieldId = modelName + "_" + fieldName;
      if (field.edittype === "text") {
         html += "<input type='text' style='width:350px' id='" + fieldId + "' />";
      } else if (field.edittype === "password") {
         html += "<input type='password'  style='width:350px' id='" + fieldId + "' />";
      } else if (field.edittype === "select") {
         html += "<select id='" + fieldId + "'>";
         html += "<option value='0'>" + t("select") + "</option>";
         var optionValue, optionName;
         if (typeof field.editoptions.value === "string") {
            if (modelName == "group" && fieldName == "contestID" && !field.editoptions.value) {
               jqAlert(t("contest_needed_for_group"));
               return;
            }
            var optionsList = field.editoptions.value.split(";");
            for (var iOption = 0; iOption < optionsList.length; iOption++)  {
               var optionParts = optionsList[iOption].split(":");
               if (fieldName == "contestID") {
                  var contest = getContestFromID(optionParts[0]);
                  if (contest && contest.status == 'PreRanking') {
                     continue;
                  }
               }
               optionValue = optionParts[0];
               optionName = optionParts[1];
               html += "<option value='" + optionValue + "'>" + optionName + "</option>";
            }
         } else {
            for (optionValue in field.editoptions.value) {
               optionName = field.editoptions.value[optionValue];
               html += "<option value='" + optionValue + "'>" + optionName + "</option>";
            }
         }
         html += "</select>";
      } else if (field.edittype === "ac-email") {
         html += "<input type='text' id='" + fieldId + "' />@";
         html += "<select id='" + fieldId + "_domain'>";
         html += "<option value='undefined'>" + t("region") + "</option>";
         for (var iDomain = 0; iDomain < domains.length; iDomain++) {
            var allowedDomain = domains[iDomain];
            html += "<option value='" + allowedDomain + "'>" + allowedDomain + "</option>";
         }
         html += "</select>";
      } else if (field.edittype === "datetime") {
         html += "<input id='" + fieldId + "_date' type='text' /> ";
         html += " à ";
         html += getSelectHours(fieldId) + ":" + getSelectMinutes(fieldId);
         js += "$('#" + fieldId + "_date').datepicker({ dateFormat: 'dd/mm/yy' });";
      }
      html += "</td><td style='width:500px;text-align:justify'>";
      if (field.comment !== undefined) {
         html += "<i>" + field.comment + "</i>";
      }
      html += "<br/></td></tr>";
   }
   html += "</table>";
   html += "<input id='buttonValidate_" + modelName + "' type='button' value='OK' onclick='validateForm(\"" + modelName + "\")' />";
   html += "<input id='buttonCancel_" + modelName + "' type='button' value='Annuler' onclick='endEditForm(\"" + modelName + "\", 0 , {})' />";
   html += "<div id='edit_form_error' style='color:red'></div>";
   $("#edit_form").html(html);
   eval(js);
   showForm(modelName);
}

function loadOneRecord(tableName, recordID, callback) {
   return $.post("jqGridData.php", {oper: "selectOne", tableName: tableName, recordID: recordID},
      function(data) {
         if (data.success) {
            callback(data.items[recordID]);
         } else {
            jqAlert(t("error_while_loading"));
         }
      }, "json"
   );
}

function editGroup() {
   var groupID = jQuery("#grid_group").jqGrid('getGridParam','selrow');
   if (groupID === null) {
      jqAlert(t("warning_no_group_selected"));
      return;
   }
   if (isAdmin()) {
      loadOneRecord("group", groupID, function(item) {
         editForm("group", t("edit_group"), item);
      });

   } else {
      if (groups[groupID].userID != loggedUser.ID) {
         jqAlert(t("only_group_creator_can_edit"));
      } else {
         editForm("group", t("edit_group"), groups[groupID]);
      }
   }
}

function regradeGroup() {
   var groupID = jQuery("#grid_group").jqGrid('getGridParam','selrow');
   if (groupID === null) {
      jqAlert(t("warning_no_group_selected"));
      return;
   }

   // TODO: Do regrading
}

function printGroupCertificates() {
   var groupID = jQuery("#grid_group").jqGrid('getGridParam','selrow');
   if (groupID === null) {
      jqAlert(t("warning_no_group_selected"));
      return;
   }
   var group = groups[groupID];
   if (group.participationType != 'Official' || group.contestPrintCertificates != 1) {
      jqAlert(t("group_print_certificates_impossible"));
      return;
   }
   window.open("printCertificates.php?schoolID="+group.schoolID+"&contestID="+group.contestID+"&groupID=" + groupID, "printGroup" + groupID, 'width=700,height=600,menubar=yes,status=yes,toolbar=yes,scrollbars=yes,resizable=yes');
}

function printSchoolCertificates(contestID) {
   var schoolID = jQuery("#grid_school").jqGrid('getGridParam','selrow');
   if (schoolID === null) {
      jqAlert(t("warning_no_school_selected"));
      return false;
   }
   window.open("printCertificates.php?schoolID="+schoolID+"&contestID="+contestID, "printSchool" + schoolID, 'width=700,height=600,menubar=yes,status=yes,toolbar=yes,scrollbars=yes,resizable=yes');
   return false;
}

function printGroup() {
   var groupID = jQuery("#grid_group").jqGrid('getGridParam','selrow');
   if (groupID === null) {
      jqAlert(t("warning_no_group_selected"));
      return;
   }
   window.open("notice.php?groupID=" + groupID, "printGroup" + groupID, 'width=700,height=600');
}

function printGroupAll() {
   window.open("notice.php", "printGroupAll", 'width=700,height=600');
}

function getDateFromSQL(dateSQL) {
   var dateJS = dateSQL.replace(/(\d+)-(\d+)-(\d+)/, "$3/$2/$1");
   return dateJS;
}

function editForm(modelName, title, item) {
   newForm(modelName, title, "");
   $("#" + modelName + "_ID").val(item.ID);
   var fields = models[modelName].fields;
   for (var fieldName in fields) {
      var field = fields[fieldName];
      if (field.edittype !== "datetime") {
         $("#" + modelName + "_" + fieldName).val(item[fieldName]);
      } else {
         if ((item[fieldName]) && (item[fieldName].length > 0)) {
            var parts = item[fieldName].split(' ');

            $("#" + modelName + "_" + fieldName + "_date").val(getDateFromSQL(parts[0]));
            var timeParts = parts[1].split(':');
            $("#" + modelName + "_" + fieldName + "_hours").val(parseInt(timeParts[0]));
            $("#" + modelName + "_" + fieldName + "_minutes").val(parseInt(timeParts[1]));
         }
      }
   }
   showForm(modelName);
}

function checkUser(user, isCreate) {
   if (user.officialEmail !== "") {
      var firstAt = user.officialEmail.indexOf("@");
      if (user.officialEmail.indexOf("@", firstAt + 1) > 0) {
         $("#edit_form_error").html(t("invalid_officialEmail"));
         return false;
      }
   }
   var minPasswordLength = 6;
   if (user.password != user.password2) {
      $("#edit_form_error").html(t("passwords_different"));
      return false;
   }
   if (isCreate || (user.password.length > 0)) {
      if (user.password.length < minPasswordLength) {
         $("#edit_form_error").html(t("password_min_length_1") + minPasswordLength + t("password_min_length_2"));
         return false;
      }
   }
   if ((user.officialEmail === "") && (user.alternativeEmail === "")) {
      $("#edit_form_error").html(t("one_email_required"));
      return false;
   }
   if (!isCreate) {
      if ((loggedUser.officialEmailValidated == "1") && (user.officialEmail != loggedUser.officialEmail)) {
         $("#edit_form_error").html(t("officialEmail_readonly"));
         return false;
      }
   }
   return true;
}

function isPositiveInteger(value) {
   return ((isInteger(value)) && (value > 0));
}

function isInteger(value) {
   var intRegex = /^\d+$/;
   return (intRegex.test(value));
}

function jqAlert(message, closeFunction, buttons) {
    var dialog = $('<div></div>')
      .html(message)
      .dialog({
         modal: true,
         autoOpen: false,
         title: t("warning"),
         close: closeFunction,
         buttons: buttons
      });
   dialog.dialog('open');
}

function getSQLFromJSDate(d) {
   return d.getFullYear() +
      "-" + ("0" + (d.getMonth() + 1)).slice(-2) +
      "-" + ("0" + d.getDate()).slice(-2) +
      " " + ("0" + d.getHours()).slice(-2) +
      ":" + ("0" + d.getMinutes()).slice(-2) +
      ":" + ("0" + d.getSeconds()).slice(-2);
}

function getSQLFromDate(date) {
   try {
      return date.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$2-$1");
   } catch(e) {
      return "";
   }
}


function validateForm(modelName) {
   var item = {};
   item.ID = $("#" + modelName + "_ID").val();
   var fields = models[modelName].fields;
   for (var fieldName in fields) {
      var field = fields[fieldName];
      item[fieldName] = $("#" + modelName + "_" + fieldName).val();
      if (field.edittype === "datetime") {
         var date = $("#" + modelName + "_" + fieldName + "_date").val();
         date = getSQLFromDate(date);
         var hours = $("#" + modelName + "_" + fieldName + "_hours").val();
         if (!hours) {
            hours = "00";
         }
         var minutes = $("#" + modelName + "_" + fieldName + "_minutes").val();
         if (!minutes) {
            minutes = "00";
         }
         if ((parseInt(hours) > 23) || (parseInt(minutes) > 59)) {
            jqAlert(t("start_time_invalid"));
            return;
         }
         item[fieldName] = date + " " + hours + ":" + minutes;
      } else if (field.edittype === "ac-email") {
         if ($("#" + modelName + "_" + fieldName + "_domain").val() === "undefined") {
            if (item[fieldName] !== "") {
               jqAlert(t("official_email_invalid"));
               return;
            }
            item[fieldName] = "";
         }
         else {
            var domain = $("#" + modelName + "_" + fieldName + "_domain").val();
            item[fieldName] += "@" +  domain;
         }
      } else if (field.required) {
         if (item[fieldName] === "" || item[fieldName] === "0") {
            jqAlert(t("field_missing_1") + field.label + t("field_missing_2"));
            return;
         }
      }
      if (field.subtype === "int") {
         if (!isInteger(item[fieldName])) {
            jqAlert(t("field_not_integer_1") + field.label + t("field_not_integer_2"));
            return;
         }
      }
      if (field.subtype === "positiveint") {
         if (!isPositiveInteger(item[fieldName])) {
            jqAlert(t("field_not_positive_1") + field.label + t("field_not_positive_2"));
            return;
         }
      }
   }
   if (modelName === "user_create") {
      if (!checkUser(item, true)) {
         return;
      }
   } else if (modelName === "user_edit") {
      if (!checkUser(item, false)) {
         return;
      }
   } else if (modelName === "group") {
      // TODO: prevent changing group level if already started
      if (!item.schoolID) {
         return;
      }
      var contest = contests[item.contestID];
      if ((contest.status != "RunningContest") && (contest.status != "FutureContest") && (contest.status != "PreRanking")) {
         if (item.participationType == "Official") {
            alert(t("official_contests_restricted"));
            return;
         }
      }
   }
   $("#edit_form_error").html("");
   $("#buttonValidate_" + modelName).attr("disabled", true);
   $("#buttonCancel_" + modelName).attr("disabled", true);
   var oper = "insert";
   if (item.ID) {
      oper = "update";
   }
   $.post("jqGridData.php", {tableName:models[modelName].tableName, oper: oper, record:item},
      function(data) {
         if (!data.success) {
            if (data.message !== undefined) {
               jqAlert(data.message);
            } else {
               jqAlert("Erreur");
            }
            $("#buttonValidate_" + modelName).attr("disabled", false);
            $("#buttonCancel_" + modelName).attr("disabled", false);
            return;
         }
         endEditForm(modelName, data.recordID, item);
         if (modelName === "user_create") {
            if (item.officialEmail) {
               jqAlert(t("you_will_get_email"));
            } else {
               jqAlert(t("no_official_email_1") + getMailToManualValidation(t("contact_us")) + t("no_official_email_2"));
            }
         }
      }, "json"
   );
}

function endEditForm(modelName, recordID, item) {
   if (modelName === "school") {
      endEditSchool(recordID, item);
   } else if (modelName === "group") {
      endEditGroup(recordID);
      if (!isAdmin()) {
         if (groups[recordID]) {
            item.userID = groups[recordID].userID; // TODO: do this in a generic way!
         } else {
            item.userID = loggedUser.ID;
         }
         item.ID = recordID;
         groups[recordID] = item;
      }
   } else if (modelName === "user_edit") {
      endEditUser(recordID, item);
   }
   $("#edit_form").hide();
   $("#main_screen").show();   
   $("#headerWarning").show();
}

function newSchool() {
//   $("#selectSchool").val(0);
   newForm("school", t("school_details"), "");
}

function editUser() {
   editForm("user_edit", t("edit_user"), loggedUser);
   var officialEmail = loggedUser.officialEmail;
   if (!officialEmail) {
      return;
   }
   var parts = officialEmail.split("@");
   var leftPart = parts[0];

   $("#user_edit_officialEmail").val(leftPart);
   $("#user_edit_officialEmail_domain").val(parts[1]);
}

function searchSchool() {
   $("#main_screen").hide();
   $("#headerWarning").hide();
   $("#divSchoolSearch").show();
   loadSchoolSearch();
}

function endSearchSchool() {
   $("#main_screen").show();
   $("#headerWarning").show();
   $("#divSchoolSearch").hide();
}

function selectSchool() {
   $("#divSchoolSearch").show();
   var schoolID = jQuery("#grid_school_search").jqGrid('getGridParam','selrow');
   if (!schoolID) {
      jqAlert(t("warning_no_school_selected"));
      return false;
   }
   var params = {schoolID: schoolID, userID: loggedUser.ID};
   newItem("school_user", params, function(data) {
      loadSchools().done(function() {
         models.group = getGroupsColModel();
         $('#grid_school').trigger('reloadGrid');   
         $('#grid_colleagues').trigger('reloadGrid');   
      });
   });
   endSearchSchool();
}

function editSchool() {
   newForm("school", t("school_details"), "");
}

function endEditSchool(schoolID) {
   loadSchools().done(function() {
      models.group = getGroupsColModel();
      $('#grid_school').trigger('reloadGrid');
      //selectSchool(schoolID);
   });
}

function endEditGroup(groupID) {
   loadContests().done(function() {
      models.group = getGroupsColModel();
      $('#grid_group').jqGrid('setGridParam', {colModel:jqGridModel("group")}).trigger('reloadGrid');
   });
}

function endEditUser(userID, user) {
   if (loggedUser.ID === userID) {
      loadUser(user);
      var fields = ["gender", "firstName", "lastName", "officialEmail", "alternativeEmail"];
      for (var i = 0; i < fields.length; i++)
         loggedUser[fields[i]] = user[fields[i]];
   }
}

function warningUsers(users) {
   if (!users || !users.length) {
      return;
   }
   var msg = t("several_users_for_school");
      for (var iUser = 0; iUser < users.length; iUser++) {
         msg += "<li>" + users[iUser].firstName + " " + users[iUser].lastName + "<br/>";
      }
   msg += "<br/>" + t("users_groups_readonly") + "<br/>";
   jqAlert(msg);
}

function login() {
   disableButton("buttonLogin");
   var email = $("#email").val();
   var password = $("#password").val();
   $.post("login.php", {email: email, password: password},
      function(data) {
         $("#login_error").html();
         if (!data.success) {
            if (data.message !== undefined) {
               $("#login_error").html(data.message);
            } else {
               jqAlert(t("invalid_identifiers"));
            }
            enableButton("buttonLogin");
            return;
         }
         logUser(data.user);
         warningUsers(data.schoolUsers);
      }, "json"
   );
}

function recover() {
   disableButton("buttonRecover");
   var email = $("#recoverEmail").val();
   $.post("recover.php", {action:"sendMail", email: email},
      function(data) {
         $("#login_error").html();
         if (!data.success) {
            if (data.message !== undefined) {
               $("#login_error").html(data.message);
            } else {
               jqAlert(t("unknown_email"));
            }
            enableButton("buttonRecover");
            return;
         } else {
            jqAlert(t("recover_email_sent_1") + email + t("recover_email_sent_2"));
         }
      }, "json"
   );
}

function changePassword(email, recoverCode) {
   var password1 = $("#newPassword1").val();
   var password2 = $("#newPassword2").val();

   if (password1 != password2) {
      jqAlert(t("passwords_different"));
      return false;
   }
   var minPasswordLength = 6;
   if (password1.length < minPasswordLength) {
      jqAlert(t("password_min_length_1") + minPasswordLength + t("password_min_length_2"));
      return false;
   }
   disableButton("buttonChangePassword");
   $.post("recover.php", {action:"changePassword", email: email, recoverCode: recoverCode, password: password1},
      function(data) {
         if (!data.success) {
            if (data.message !== undefined) {
               $jqAlert(data.message);
            } else {
               jqAlert(t("unknown_email"));
            }
            enableButton("buttonChangePassword");
            return;
         } else {
            jqAlert(t("password_changed"), function() {window.location.replace(t("index_url"));});
         }
      }, "json"
   );
}

function getMailTo(subject, body, message) {
  return "<a href=\"mailto:" + config.infoEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body) + "\">" + message + "</a>";
}

function getMailToManualValidation(message) {
   var subject = t("email_subject_no_official_email");
   var body = t("email_body_no_official_email");
   return getMailTo(subject, body, message);
}

function newUser() {
   initModels(false);
   var message = "<p>" + t("warning_official_email_required") + getMailToManualValidation(t("contact_us")) + "</p>";

   newForm("user_create", t("user_registration"), message);
}

/* API for certificates generation : in the future, should be a real class... */
Number.prototype.pad = function(size){
      if(typeof(size) !== "number"){size = 2;}
      var s = String(this);
      while (s.length < size) s = "0" + s;
      return s;
    };

function getDateFromSQLFormat(string) {
  var d = new Date(Date.parse(string));
    return d.getDate().pad() + "/" + (d.getMonth() + 1).pad() + "/" + d.getFullYear() + " à " + d.getHours().pad() + "h" + d.getMinutes().pad(); 
}

function printAlgoreaCodes() {
   window.open('awardsPrint.php', "printAlgoreaCodes", 'width=700,height=600');
}

function init() {
   initErrorHandler();
   i18n.init({
      lng: config.defaultLanguage,
      fallbackLng: [config.defaultLanguage],
      getAsync: true,
      resGetPath: config.i18nResourcePath,
      fallbackNS: 'translation',
      ns: {
         namespaces: config.customStringsName ? [config.customStringsName, 'translation', 'country' + config.countryCode] : ['translation', 'country' + config.countryCode],
         defaultNs: config.customStringsName ? config.customStringsName : 'translation',
      },
      useDataAttrOptions: true
   }, function () {
      var newRegions = {};
      for (var i=0; i < regions.length; i++) {
         newRegions[regions[i].split(':')[1]] = i18n.t(regions[i]);
      }
      window.regions = newRegions;
      $("#login_link_to_home").attr('data-i18n-options',
         '{"contestPresentationURL": "' + config.contestPresentationURL + '"}');
      $("title").i18n();
      $("body").i18n();
      if (config.maintenanceUntil) {
         $("#main_screen").html(t('maintenance_until', {end: config.maintenanceUntil}));
      }
   });
   if (config.maintenanceUntil) {
      return;
   }
   isLogged();
   window.domains = [];
   $.getJSON('regions/' + config.countryCode + '/domains.json', function(data) {
      window.domains = data.domains;
   });
   if (typeof $.jgrid !== 'undefined') {
      $.jgrid.defaults = $.extend($.jgrid.defaults, { autoencode: true });
   }
   if (window.config.useAlgoreaCodes) {
      $('#linkExportAlgoreaCodes').show();
      $('#buttonGenerateAlgoreaCodes').show();
   }
   $('input[type=button]', this).attr('disabled', false);
}
