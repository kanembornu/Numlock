function doGet() {

  var template =
    HtmlService.createTemplateFromFile("190.View.Index");

  template.version = PROJECT_CONFIG.VERSION;

  return template
    .evaluate()
    .setTitle("Numlock Dashboard")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}
