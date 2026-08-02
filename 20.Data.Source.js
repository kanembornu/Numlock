function getTransactionData(ss) {
  return ss
    .getSheetByName("Transaction")
    .getDataRange()
    .getValues();
}

function getPriceMap(ss) {
  var helperSheet = ss.getSheetByName("Helper");
  var data = helperSheet.getDataRange().getValues();
  var headers = data[0];
  var map = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var productName = String(row[0]).trim();

    if (productName === "") {
      continue;
    }

    map[productName] = {};

    for (var j = 1; j < headers.length; j++) {
      var columnName = String(headers[j]).trim();
      var value = row[j];

      if (
        columnName.indexOf("P") === 0
      ) {
        value = Number(value) || 0;
      }

      map[productName][columnName] = value;
    }
  }
  return map;
}
