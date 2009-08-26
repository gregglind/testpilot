/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Test Pilot.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jono X <jono@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

EXPORTED_SYMBOLS = ["ExperimentDataStore", "TabsExperimentConstants", "TabsExperimentDataStore"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://testpilot/modules/dbutils.js");
var _dirSvc = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties);
var _storSvc = Cc["@mozilla.org/storage/service;1"]
                 .getService(Ci.mozIStorageService);

const TabsExperimentConstants = {
  OPEN_EVENT: 1,
  CLOSE_EVENT: 2,
  DRAG_EVENT: 3,
  SWITCH_EVENT: 4,
  LOAD_EVENT: 5,
  QUIT_EVENT: 6,
  RESTORE_EVENT: 7,

  NEWTAB_BUTTON: 1,
  NEWTAB_MENU: 2,
  NEWTAB_KEYBOARD: 3,
  NEWTAB_LINK: 4,

  SWITCH_BY_CLICK: 1,
  SWITCH_BY_KEY: 2
};

const TABS_EXPERIMENT_FILE = "testpilot_tabs_experiment_results.sqlite";
/* In this schema, each row represents a single UI event. */

const TABS_TABLE_NAME = "testpilot_tabs_experiment";

// event.timeStamp is milliseconds since epoch
// This schema is subject to change before the Tabs Experiment is released:
const TABS_EXPERIMENT_SCHEMA = 
  "CREATE TABLE " + TABS_TABLE_NAME + "(" +
  " event_code INTEGER," +
  " tab_position INTEGER," +
  " tab_parent_position INTEGER," +
  " tab_window INTEGER," +
  " tab_parent_window INTEGER," +
  " ui_method INTEGER," +
  " tab_site_hash INTEGER," +
  " num_tabs INTEGER," +
  " timestamp INTEGER);"; // is there a different data type better for timestamp?
// For all fields, 0 means unspecified

function ExperimentDataStore(fileName, tableName, schema) {
  this._init(fileName, tableName, schema);
}
ExperimentDataStore.prototype = {
  _init: function EDS__init(fileName, tableName, schema) {
    this._fileName = fileName;
    this._tableName = tableName;
    this._schema = schema;
    let file = _dirSvc.get("ProfD", Ci.nsIFile);
    file.append(this._fileName);
    // openDatabase creates the file if it's not there yet:
    this._connection = DbUtils.openDatabase(file);
    // CreateTable creates the table only if it does not already exist:
    this._connection = DbUtils.createTable(this._connection, this._tableName, this._schema);
  },

  _createStatement: function _createStatement(selectSql) {
    try {
      var selStmt = this._connection.createStatement(selectSql);
      return selStmt;
    } catch (e) {
      throw new Error(this._connection.lastErrorString);
    }
  },

  storeEvent: function EDS_storeEvent( uiEvent ) {
    // uiEvent is assumed to have attribute names matching db columns
    // TODO rewrite this to be schema-independent.
    let insertSql = "INSERT INTO " + this._tableName +
                    " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)";
    let insStmt = this._createStatement(insertSql);
    // If uiEvent is missing some of these fields, they end up as 0.
    insStmt.bindInt32Parameter(0, uiEvent.event_code);
    insStmt.bindInt32Parameter(1, uiEvent.tab_position);
    insStmt.bindInt32Parameter(2, uiEvent.tab_parent_position);
    insStmt.bindInt32Parameter(3, uiEvent.tab_window);
    insStmt.bindInt32Parameter(4, uiEvent.tab_parent_window);
    insStmt.bindInt32Parameter(5, uiEvent.ui_method);
    insStmt.bindInt32Parameter(6, uiEvent.tab_site_hash);
    insStmt.bindInt32Parameter(7, uiEvent.num_tabs);
    insStmt.bindDoubleParameter(8, uiEvent.timestamp);
    insStmt.execute();
    insStmt.finalize();
  },

  barfAllData: function EDS_barfAllData() {
    // Note this works without knowing what the schema is
    let selectSql = "SELECT * FROM " + this._tableName;
    let selStmt = this._createStatement(selectSql);
    let records = [];
    let i;
    while (selStmt.executeStep()) {
      let newRecord = {};
      let numCols = selStmt.columnCount;
      for (i = 0; i < numCols; i++) {
	let colName = selStmt.getColumnName(i);
	newRecord[colName] = selStmt.getInt32(i);
      }
      records.push(newRecord);
    }
    selStmt.finalize();
    // convert object to JSON string
    let nativeJSON = Cc["@mozilla.org/dom/json;1"]
                 .createInstance(Ci.nsIJSON);
    return nativeJSON.encode(records);
  },

  wipeAllData: function EDS_wipeAllData() {
    let wipeSql = "DELETE FROM " + this._tableName;
    let wipeStmt = this._createStatement(wipeSql);
    wipeStmt.execute();
    wipeStmt.finalize();
  }
};

// TODO Make sure this is only run once even if module imported multiple times:
var TabsExperimentDataStore = new ExperimentDataStore(TABS_EXPERIMENT_FILE, 
						      TABS_TABLE_NAME,
						      TABS_EXPERIMENT_SCHEMA);

