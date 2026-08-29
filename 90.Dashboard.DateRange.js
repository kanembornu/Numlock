function normalizeDashboardDateFilter(filter) {

  var normalized =
    filter == null
      ? ""
      : String(filter).trim();

  var allowed = {
    today: true,
    last7days: true,
    currentMonth: true,
    previousMonth: true,
    currentYear: true,
    previousYear: true,
    customMonth: true,
    customYear: true,
    custom: true
  };

  return allowed[normalized]
    ? normalized
    : "currentYear";
}

function createDashboardDateKey(year, month, day) {

  var date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return date.getUTCFullYear() +
    "-" +
    ("0" + (date.getUTCMonth() + 1)).slice(-2) +
    "-" +
    ("0" + date.getUTCDate()).slice(-2);
}

function shiftDashboardDateKey(dateKey, days) {

  var parts =
    dateKey.split("-");

  return createDashboardDateKey(
    Number(parts[0]),
    Number(parts[1]),
    Number(parts[2]) + days
  );
}

function validateDashboardDateKey(value, fieldName) {

  var text =
    value == null
      ? ""
      : String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
  {
    throw new Error(
      fieldName +
      " must be a valid YYYY-MM-DD date"
    );
  }

  var parts =
    text.split("-");

  if (
    createDashboardDateKey(
      Number(parts[0]),
      Number(parts[1]),
      Number(parts[2])
    ) !== text
  )
  {
    throw new Error(
      fieldName +
      " must be a valid YYYY-MM-DD date"
    );
  }

  return text;
}

function resolveDashboardDateRange(filter, customStart, customEnd, referenceDate) {

  var normalizedFilter =
    normalizeDashboardDateFilter(filter);

  var timezone =
    Session.getScriptTimeZone();

  if (!timezone)
  {
    throw new Error(
      "Dashboard date filter requires a project timezone"
    );
  }

  var today =
    Utilities.formatDate(
      referenceDate || new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  var todayParts =
    today.split("-");

  var year =
    Number(todayParts[0]);

  var month =
    Number(todayParts[1]);

  var startDate;
  var endDate;
  var label;

  if (normalizedFilter === "today")
  {
    startDate = today;
    endDate = today;
    label = "Today";
  }
  else if (normalizedFilter === "last7days")
  {
    startDate =
      shiftDashboardDateKey(
        today,
        -6
      );
    endDate = today;
    label = "Last 7 Days";
  }
  else if (normalizedFilter === "currentMonth")
  {
    startDate =
      createDashboardDateKey(
        year,
        month,
        1
      );
    endDate = today;
    label = "Current Month";
  }
  else if (normalizedFilter === "previousMonth")
  {
    endDate =
      shiftDashboardDateKey(
        createDashboardDateKey(
          year,
          month,
          1
        ),
        -1
      );

    var previousParts =
      endDate.split("-");

    startDate =
      createDashboardDateKey(
        Number(previousParts[0]),
        Number(previousParts[1]),
        1
      );
    label = "Previous Month";
  }
  else if (normalizedFilter === "previousYear")
  {
    startDate = createDashboardDateKey(year - 1, 1, 1);
    endDate = createDashboardDateKey(year - 1, 12, 31);
    label = "Previous Year";
  }
  else if (normalizedFilter === "customMonth")
  {
    var customMonthValue = String(customStart || "").trim();

    if (!/^\d{4}-\d{2}$/.test(customMonthValue))
    {
      throw new Error("customStart must be a valid YYYY-MM month");
    }

    var customMonthParts = customMonthValue.split("-");
    var customMonthYear = Number(customMonthParts[0]);
    var customMonthNumber = Number(customMonthParts[1]);

    if (customMonthNumber < 1 || customMonthNumber > 12)
    {
      throw new Error("customStart must be a valid YYYY-MM month");
    }

    startDate = createDashboardDateKey(customMonthYear, customMonthNumber, 1);
    endDate = getDashboardMonthEndDateKey(customMonthYear, customMonthNumber);
    label = "Custom Month";
  }
  else if (normalizedFilter === "customYear")
  {
    var customYearValue = String(customStart || "").trim();

    if (!/^\d{4}$/.test(customYearValue))
    {
      throw new Error("customStart must be a valid YYYY year");
    }

    var customYearNumber = Number(customYearValue);
    startDate = createDashboardDateKey(customYearNumber, 1, 1);
    endDate = createDashboardDateKey(customYearNumber, 12, 31);
    label = "Custom Year";
  }
  else if (normalizedFilter === "custom")
  {
    startDate =
      validateDashboardDateKey(
        customStart,
        "customStart"
      );

    endDate =
      validateDashboardDateKey(
        customEnd,
        "customEnd"
      );

    if (startDate > endDate)
    {
      throw new Error(
        "customStart must not be after customEnd"
      );
    }

    label =
      "Custom: " +
      startDate +
      " to " +
      endDate;
  }
  else
  {
    startDate =
      createDashboardDateKey(
        year,
        1,
        1
      );
    endDate = today;
    label = "Current Year";
  }

  return {
    filter: normalizedFilter,
    startDate: startDate,
    endDate: endDate,
    label: label
  };
}

function filterTransactionsByDateRange(data, range) {
  return (data || []).filter(function(row)
  {
    var dateKey = row && row.dateKey;
    if (!dateKey) {
      var date = new Date(row && row.date);
      if (isNaN(date.getTime())) return false;
      dateKey = canonicalDateKey(date);
    }

    return dateKey >= range.startDate &&
      dateKey <= range.endDate;
  });
}

function getDashboardMonthEndDateKey(year, month) {

  return shiftDashboardDateKey(
    createDashboardDateKey(
      year,
      month + 1,
      1
    ),
    -1
  );
}

function createCappedDashboardDateKey(year, month, day) {

  var monthEnd =
    getDashboardMonthEndDateKey(
      year,
      month
    );

  var maximumDay =
    Number(
      monthEnd.split("-")[2]
    );

  return createDashboardDateKey(
    year,
    month,
    Math.min(day, maximumDay)
  );
}

function getDashboardDateRangeDuration(range) {

  var startParts =
    range.startDate.split("-");

  var endParts =
    range.endDate.split("-");

  var startTime =
    Date.UTC(
      Number(startParts[0]),
      Number(startParts[1]) - 1,
      Number(startParts[2])
    );

  var endTime =
    Date.UTC(
      Number(endParts[0]),
      Number(endParts[1]) - 1,
      Number(endParts[2])
    );

  return Math.floor(
    (endTime - startTime) /
    86400000
  ) + 1;
}

function resolvePreviousComparisonDateRange(currentRange) {

  var filter =
    currentRange.filter;

  var startParts =
    currentRange.startDate.split("-");

  var endParts =
    currentRange.endDate.split("-");

  var startYear =
    Number(startParts[0]);

  var startMonth =
    Number(startParts[1]);

  var endYear =
    Number(endParts[0]);

  var endMonth =
    Number(endParts[1]);

  var endDay =
    Number(endParts[2]);

  var previousStart;
  var previousEnd;

  if (filter === "currentMonth")
  {
    previousStart =
      createDashboardDateKey(
        startYear,
        startMonth - 1,
        1
      );

    previousEnd =
      createCappedDashboardDateKey(
        startYear,
        startMonth - 1,
        endDay
      );
  }
  else if (
    filter === "previousMonth" ||
    filter === "customMonth"
  )
  {
    previousEnd =
      shiftDashboardDateKey(
        currentRange.startDate,
        -1
      );

    var priorMonthParts =
      previousEnd.split("-");

    previousStart =
      createDashboardDateKey(
        Number(priorMonthParts[0]),
        Number(priorMonthParts[1]),
        1
      );
  }
  else if (
    filter === "currentYear" ||
    filter === "previousYear" ||
    filter === "customYear"
  )
  {
    previousStart =
      createDashboardDateKey(
        startYear - 1,
        1,
        1
      );

    previousEnd =
      createCappedDashboardDateKey(
        endYear - 1,
        endMonth,
        endDay
      );
  }
  else
  {
    var duration =
      getDashboardDateRangeDuration(
        currentRange
      );

    previousEnd =
      shiftDashboardDateKey(
        currentRange.startDate,
        -1
      );

    previousStart =
      shiftDashboardDateKey(
        previousEnd,
        -(duration - 1)
      );
  }

  return {
    startDate: previousStart,
    endDate: previousEnd,
    label:
      "Compared with " +
      previousStart +
      " to " +
      previousEnd
  };
}

function filterTransactionsByComparisonRange(data, range) {

  return filterTransactionsByDateRange(
    data,
    range
  );
}
