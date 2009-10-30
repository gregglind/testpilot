EXPORTED_SYMBOLS = ["testTheDataStore"];


function testTheDataStore() {

  Components.utils.import("resource://testpilot/modules/experiment_data_store.js");

  var columns =  [{property: "prop_a", type: TYPE_INT_32},
                  {property: "prop_b", type: TYPE_INT_32},
                  {property: "prop_c", type: TYPE_DOUBLE}
                  ];


  var fileName = "testpilot_storage_unit_test.sqlite";
  var tableName = "testpilot_storage_unit_test";

  var store = new ExperimentDataStore(fileName, tableName, columns);

  store.storeEvent({prop_a: 13, prop_b: 27, prop_c: 0.001});
  store.storeEvent({prop_a: 26, prop_b: 18, prop_c: 0.002});
  store.storeEvent({prop_a: 39, prop_b: 9, prop_c: 0.003});
  store.storeEvent({prop_a: 52, prop_b: 0, prop_c: 0.004});

  var json = store.getAllDataAsJSON(); // test output
  var expectedJson = [{prop_a: 13, prop_b: 27, prop_c: 0.001},
                      {prop_a: 26, prop_b: 18, prop_c: 0.002},
                      {prop_a: 39, prop_b: 9, prop_c: 0.003},
                      {prop_a: 52, prop_b: 0, prop_c: 0.004}];

  if (JSON.stringify(json) == JSON.stringify(expectedJson)) {
    dump("UNIT TEST SUCCESS - we got the JSON we expected.\n");
  } else {
    dump("UNIT TEST FAILURE - JSON does not match.\n");
    dump("Expected: " + JSON.stringify(expectedJson) + "\n");
    dump("But got: "  + JSON.stringify(json) + "\n");
  }

  // TODO test getAllDataAsCSV as well.
  store.wipeAllData();

  json = store.getAllDataAsJSON();
  expectedJson = [];

  if (JSON.stringify(json) == JSON.stringify(expectedJson)) {
    dump("UNIT TEST SUCCESS - we got the JSON we expected.");
  } else {
    dump("UNIT TEST FAILURE - JSON does not match.");
  }

};