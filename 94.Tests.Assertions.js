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
