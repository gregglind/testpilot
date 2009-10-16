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

const TYPE_INT_32 = 0;
const TYPE_DOUBLE = 1;

const TabsExperimentConstants = {
  // constants for event_code
  OPEN_EVENT: 1,
  CLOSE_EVENT: 2,
  DRAG_EVENT: 3,
  DROP_EVENT: 4,
  SWITCH_EVENT: 5,
  LOAD_EVENT: 6,
  STARTUP_EVENT: 7,
  SHUTDOWN_EVENT: 8,
  OPEN_WINDOW_EVENT: 9,
  CLOSE_WINDOW_EVENT: 10,

  // constants for ui_method
  UI_CLICK: 1,
  UI_KEYBOARD: 2,
  UI_MENU: 3,
  UI_LINK: 4,
  UI_URLENTRY: 5,
  UI_SEARCH: 6,
  UI_BOOKMARK: 7,
  UI_HISTORY: 8
};

// TODO: Firefox blurs/focuses, i.e. user switches application?
// Tabs that are 'permanenly open'

const TABS_EXPERIMENT_FILE = "testpilot_tabs_experiment_results.sqlite";
/* In this schema, each row represents a single UI event. */

const TABS_TABLE_NAME = "testpilot_tabs_experiment";

// event.timeStamp is milliseconds since epoch

var TABS_EXPERIMENT_COLUMNS =  [{property: "event_code", type: TYPE_INT_32},
                                {property: "tab_position", type: TYPE_INT_32},
                                {property: "tab_window", type: TYPE_INT_32},
                                {property: "ui_method", type: TYPE_INT_32},
                                {property: "tab_site_hash", type: TYPE_INT_32},
                                {property: "num_tabs", type: TYPE_INT_32},
                                {property: "timestamp", type: TYPE_DOUBLE}];

function ExperimentDataStore(fileName, tableName, columns) {
  this._init(fileName, tableName, columns);
}
ExperimentDataStore.prototype = {
  _init: function EDS__init(fileName, tableName, columns) {
    this._fileName = fileName;
    this._tableName = tableName;
    this._columns = columns;
    let file = _dirSvc.get("ProfD", Ci.nsIFile);
    file.append(this._fileName);
    // openDatabase creates the file if it's not there yet:
    this._connection = DbUtils.openDatabase(file);
    // Create schema based on columns:
    let schemaClauses = [];
    for (let i = 0; i < this._columns.length; i++) {
      let colName = this._columns[i].property;
      let colType;
      switch( this._columns[i].type) {
      case TYPE_INT_32: case TYPE_DOUBLE:
        colType = "INTEGER";
        break;
        // TODO string types etc.
      }
      schemaClauses.push( colName + " " + colType );
    }
    let schema = "CREATE TABLE " + this._tableName + "("
                  + schemaClauses.join(", ") + ");";
    // CreateTable creates the table only if it does not already exist:
    this._connection = DbUtils.createTable(this._connection, this._tableName,
                                           schema);
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
    let i;
    let columnNumbers = [ ("?" + i) for (i in this._columns)];
    let insertSql = "INSERT INTO " + this._tableName + " VALUES (";
    insertSql += columnNumbers.join(", ") + ")\"";
    let insStmt = this._createStatement(insertSql);
    for (i = 0; i < this._columns.length; i++) {
      let datum =  uiEvent[this._columns[i].property];
      switch (this._columns[i].type) {
        case TYPE_INT_32:
          insStmt.bindInt32Parameter( i, datum);
        break;
        case TYPE_DOUBLE:
          insStmt.bindDoubleParameter( i, datum);
        break;
        // etc.  String types?
      }
    }
    insStmt.execute();
    insStmt.finalize();
  },

  getAllDataAsJSON: function EDS_getAllDataAsJSON() {
    // Note this works without knowing what the schema is
    let selectSql = "SELECT * FROM " + this._tableName;
    let selStmt = this._createStatement(selectSql);
    let records = [];
    let i;
    while (selStmt.executeStep()) {
      let newRecord = {};
      let numCols = selStmt.columnCount; // or this._columns.length ?
      for (i = 0; i < numCols; i++) {
        let colName = this._columns[i].property;
        switch (this._columns[i].type) {
          case TYPE_INT_32:
            newRecord[colName] = selStmt.getInt32(i);
          break;
          case TYPE_DOUBLE:
            newRecord[colName] = selStmt.getDouble(i);
          break;
          // etc.  String types?
        }
      }
      records.push(newRecord);
    }
    selStmt.finalize();
    return records;
  },

  getAllDataAsCSV: function EDS_getAllDataAsCSV() {
    let rows = [];
    let i, j;
    let colNames = [ this._columns[i].property for (i in this._columns) ];
    rows.push( colNames.join(", ") );
    let contentData = this.getAllDataAsJSON();
    for (i = 0; i < contentData.length; i++) {
      let jsonRow = contentData[i];
      let cells = [];
      for (j = 0; j < this._columns.length; j++) {
        cells.push( jsonRow[ this._columns[j].property ] );
      }
      rows.push( cells.join(",") );
    }
    return rows;
    // Note it returns rows unjoined, so that metadata can be easily inserted.
  },

  wipeAllData: function EDS_wipeAllData() {
    dump("ExperimentDataStore.wipeAllData called.\n");
    let wipeSql = "DELETE FROM " + this._tableName;
    let wipeStmt = this._createStatement(wipeSql);
    wipeStmt.execute();
    wipeStmt.finalize();
    dump("ExperimentDataStore.wipeAllData complete.\n");
  }
};

// TODO Make sure this is only run once even if module imported multiple times:
var TabsExperimentDataStore = new ExperimentDataStore(TABS_EXPERIMENT_FILE,
						      TABS_TABLE_NAME,
						      TABS_EXPERIMENT_COLUMNS);

