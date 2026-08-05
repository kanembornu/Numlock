function doGet() {

  var template =
    HtmlService.createTemplateFromFile("190.View.Index");

  template.appName = PROJECT_CONFIG.APP_NAME;
  template.version = PROJECT_CONFIG.VERSION;
  template.releaseLabel = PROJECT_CONFIG.RELEASE_LABEL;
  template.environment = PROJECT_CONFIG.ENVIRONMENT;

  return template
    .evaluate()
    .setTitle("Numlock Dashboard")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}
