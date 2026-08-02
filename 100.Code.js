function doGet() {

  return HtmlService
    .createTemplateFromFile("190.View.Index")
    .evaluate()
    .setTitle("Numlock Dashboard")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}
