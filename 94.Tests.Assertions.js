function assertFiniteNumbers(value, path)
{
  if (typeof value === "number")
  {
    if (!isFinite(value))
    {
      throw new Error(
        "Sparse dataset produced a non-finite number at " +
        path
      );
    }

    return;
  }

  if (!value || typeof value !== "object")
  {
    return;
  }

  Object.keys(value).forEach(function(key)
  {
    assertFiniteNumbers(
      value[key],
      path + "." + key
    );
  });
}

function assertRequiredProperties(value, requiredProperties, fixtureName)
{
  requiredProperties.forEach(function(property)
  {
    if (!Object.prototype.hasOwnProperty.call(value, property))
    {
      throw new Error(
        "Sparse dataset response missing " +
        property +
        " for " +
        fixtureName
      );
    }
  });
}

function assertThrowsMessage(callback, expectedMessage)
{
  var thrown = null;

  try
  {
    callback();
  }
  catch (error)
  {
    thrown = error;
  }

  if (!thrown)
  {
    throw new Error(
      "Expected error was not thrown: " +
      expectedMessage
    );
  }

  if (thrown.message !== expectedMessage)
  {
    throw new Error(
      "Unexpected error message: expected=" +
      expectedMessage +
      ", actual=" +
      thrown.message
    );
  }

  return thrown;
}

function assertSourceContains(source, token, scenarioName)
{
  if (source.indexOf(token) === -1)
  {
    throw new Error(
      "Source contract missing " +
      scenarioName +
      ": " +
      token
    );
  }
}

function getAssembledFrontendSource(includeDiagnostics)
{
  var transactionsStateSource =
    HtmlService.createHtmlOutputFromFile("192.View.Transactions.State").getContent();
  var transactionsRenderSource =
    HtmlService.createHtmlOutputFromFile("193.View.Transactions.Render").getContent();
  var transactionsFormsSource =
    HtmlService.createHtmlOutputFromFile("194.View.Transactions.Forms").getContent();
  var transactionsActionsSource =
    HtmlService.createHtmlOutputFromFile("195.View.Transactions.Actions").getContent();
  var dashboardRenderSource =
    HtmlService.createHtmlOutputFromFile("196.View.Dashboard.Render").getContent();
  var dashboardChartsSource =
    HtmlService.createHtmlOutputFromFile("197.View.Dashboard.Charts").getContent();
  var dashboardControllerSource =
    HtmlService.createHtmlOutputFromFile("198.View.Dashboard.Controller").getContent();
  var source = HtmlService.createHtmlOutputFromFile("190.View.Index").getContent()
    .replace("<?!= include('192.View.Transactions.State'); ?>", transactionsStateSource)
    .replace("<?!= include('193.View.Transactions.Render'); ?>", transactionsRenderSource)
    .replace("<?!= include('194.View.Transactions.Forms'); ?>", transactionsFormsSource)
    .replace("<?!= include('195.View.Transactions.Actions'); ?>", transactionsActionsSource)
    .replace("<?!= include('196.View.Dashboard.Render'); ?>", dashboardRenderSource)
    .replace("<?!= include('197.View.Dashboard.Charts'); ?>", dashboardChartsSource)
    .replace("<?!= include('198.View.Dashboard.Controller'); ?>", dashboardControllerSource);

  return includeDiagnostics
    ? source.replace(
      "<?!= include('191.View.Diagnostics'); ?>",
      HtmlService.createHtmlOutputFromFile("191.View.Diagnostics").getContent()
    )
    : source;
}

function assertSourceContainsOnce(source, token, scenarioName)
{
  var firstIndex = source.indexOf(token);
  var lastIndex = source.lastIndexOf(token);

  if (firstIndex === -1 || firstIndex !== lastIndex)
  {
    throw new Error(
      "Source contract expected one " +
      scenarioName +
      ": " +
      token
    );
  }
}

function assertSourceOccurrenceCount(source, token, expectedCount, scenarioName)
{
  var actualCount = source.split(token).length - 1;

  if (actualCount !== expectedCount)
  {
    throw new Error(
      "Source contract expected " +
      expectedCount +
      " " +
      scenarioName +
      ": " +
      token +
      ", actual=" +
      actualCount
    );
  }
}

function getSourceRegion(source, startToken, endToken, scenarioName)
{
  var startIndex = source.indexOf(startToken);

  if (startIndex === -1)
  {
    throw new Error(
      "Source contract missing " +
      scenarioName +
      " start boundary: " +
      startToken
    );
  }

  var firstEndIndex = source.indexOf(endToken);

  if (firstEndIndex === -1)
  {
    throw new Error(
      "Source contract missing " +
      scenarioName +
      " end boundary: " +
      endToken
    );
  }

  var endIndex = source.indexOf(
    endToken,
    startIndex + startToken.length
  );

  if (endIndex === -1)
  {
    throw new Error(
      "Source contract invalid " +
      scenarioName +
      " boundary order: start=" +
      startToken +
      ", end=" +
      endToken
    );
  }

  if (endIndex <= startIndex)
  {
    throw new Error(
      "Source contract invalid " +
      scenarioName +
      " boundary order: start=" +
      startToken +
      ", end=" +
      endToken
    );
  }

  return source.slice(startIndex, endIndex);
}

function assertSourceExcludes(source, token, scenarioName)
{
  if (source.indexOf(token) !== -1)
  {
    throw new Error(
      "Source contract unexpectedly exposes " +
      scenarioName +
      ": " +
      token
    );
  }
}
