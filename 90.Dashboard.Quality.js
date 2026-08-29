function buildDataQualityDiagnostics(scopedData, sourceQuality) {

  var definitions = [
    {
      code: "INVALID_DATE",
      label: "Invalid transaction date",
      severity: "High"
    },
    {
      code: "UNKNOWN_TRANSACTION_TYPE",
      label: "Unknown transaction type",
      severity: "High"
    },
    {
      code: "MISSING_SALES_PRODUCT",
      label: "Missing Sales product",
      severity: "Medium"
    },
    {
      code: "MISSING_PURCHASE_CATEGORY",
      label: "Missing Purchase category",
      severity: "Medium"
    },
    {
      code: "INVALID_QUANTITY",
      label: "Invalid Sales quantity",
      severity: "Medium"
    },
    {
      code: "INVALID_PURCHASE_AMOUNT",
      label: "Invalid Purchase amount",
      severity: "Medium"
    },
    {
      code: "UNRESOLVED_FOREIGN_KEY",
      label: "Unresolved canonical master relationship",
      severity: "Medium"
    },
    {
      code: "MALFORMED_CANONICAL_RECORD",
      label: "Malformed canonical ledger record",
      severity: "Medium"
    }
  ];

  var rows =
    scopedData || [];

  var sourceInspection =
    sourceQuality || null;

  var invalidDateRowIndexes =
    sourceInspection &&
    Array.isArray(sourceInspection.invalidDateRowIndexes)
      ? sourceInspection.invalidDateRowIndexes
      : [];

  var counts = {};
  var issueRowKeys = {};
  var scopedIssueRows = 0;
  var issueCount = 0;
  var hasHighSeverityIssue = false;

  definitions.forEach(function(definition)
  {
    counts[definition.code] = 0;
  });

  rows.forEach(function(row, rowIndex)
  {
    var rowIssues = [];
    var value = row || {};
    var transactionDate =
      new Date(value.date);

    if (
      !sourceInspection &&
      (
        value.date == null ||
        value.date === "" ||
        isNaN(transactionDate.getTime())
      )
    )
    {
      rowIssues.push("INVALID_DATE");
    }

    if (
      value.transactionType !== "Sales" &&
      value.transactionType !== "Purchase"
    )
    {
      rowIssues.push("UNKNOWN_TRANSACTION_TYPE");
    }

    if (value.transactionType === "Sales")
    {
      if (String(value.product || "").trim() === "")
      {
        rowIssues.push("MISSING_SALES_PRODUCT");
      }

      var quantitySource =
        value.dataQualitySource
          ? value.dataQualitySource.quantity
          : value.qty;

      var quantity =
        Number(quantitySource);

      if (!isFinite(quantity) || quantity < 0)
      {
        rowIssues.push("INVALID_QUANTITY");
      }
    }

    if (value.transactionType === "Purchase")
    {
      if (String(value.purchaseCategory || "").trim() === "")
      {
        rowIssues.push("MISSING_PURCHASE_CATEGORY");
      }

      var purchaseAmountSource =
        value.dataQualitySource
          ? value.dataQualitySource.purchaseAmount
          : value.expense;

      if (!isFinite(Number(purchaseAmountSource)))
      {
        rowIssues.push("INVALID_PURCHASE_AMOUNT");
      }
    }

    if (rowIssues.length)
    {
      scopedIssueRows++;

      var scopedRowKey =
        value.sourceRowIndex != null
          ? "source:" + value.sourceRowIndex
          : "scoped:" + rowIndex;

      issueRowKeys[scopedRowKey] = true;
    }

    rowIssues.forEach(function(code)
    {
      counts[code]++;
      issueCount++;
    });
  });

  invalidDateRowIndexes.forEach(function(sourceRowIndex)
  {
    counts.INVALID_DATE++;
    issueCount++;
    issueRowKeys["source:" + sourceRowIndex] = true;
  });

  [
    ["UNRESOLVED_FOREIGN_KEY", "unresolvedForeignKeys"],
    ["MALFORMED_CANONICAL_RECORD", "malformedRows"]
  ].forEach(function(mapping)
  {
    var count = Number(sourceInspection && sourceInspection[mapping[1]]) || 0;
    counts[mapping[0]] += count;
    issueCount += count;

    for (var index = 0; index < count; index++)
    {
      issueRowKeys["canonical:" + mapping[1] + ":" + index] = true;
    }
  });

  var issues =
    definitions
      .filter(function(definition)
      {
        return counts[definition.code] > 0;
      })
      .map(function(definition)
      {
        if (definition.severity === "High")
        {
          hasHighSeverityIssue = true;
        }

        return {
          code: definition.code,
          label: definition.label,
          count: counts[definition.code],
          severity: definition.severity
        };
      });

  return {
    totalRows: rows.length,
    validRows:
      Math.max(
        rows.length - scopedIssueRows,
        0
      ),
    issueRows:
      Object.keys(issueRowKeys).length,
    issueCount: issueCount,
    status:
      issueCount === 0
        ? "Good"
        : hasHighSeverityIssue
          ? "Critical"
          : "Attention",
    issues: issues,
    lifecycle: {
      inactiveCanonicalRows:
        Number(sourceInspection && sourceInspection.inactiveLedgerRows) || 0
    },
    scope: {
      sourceRows:
        sourceInspection
          ? sourceInspection.sourceRows
          : rows.length,
      scopedRows: rows.length,
      excludedInvalidDateRows:
        invalidDateRowIndexes.length
    }
  };
}
