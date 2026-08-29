function normalizeLayoutDebugParameter(event) {

  return String(
    event && event.parameter
      ? event.parameter.debugLayout || ""
      : ""
  ) === "1";

}

function include(filename) {

  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();

}

function doGet(e) {

  var template =
    HtmlService.createTemplateFromFile("190.View.Index");

  template.appName = PROJECT_CONFIG.APP_NAME;
  template.version = PROJECT_CONFIG.VERSION;
  template.releaseLabel = PROJECT_CONFIG.RELEASE_LABEL;
  template.environment = PROJECT_CONFIG.ENVIRONMENT;
  template.layoutDebugEnabled =
    normalizeLayoutDebugParameter(e);

  return template
    .evaluate()
    .setTitle("Numlock Dashboard")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}
