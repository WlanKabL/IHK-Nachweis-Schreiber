const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");

async function fillPdf() {
    // PDF-Datei laden
    const formPdfBytes = fs.readFileSync("./PDF_TEST.pdf");
    const pdfDoc = await PDFDocument.load(formPdfBytes);

    // Formular aus der geladenen PDF-Datei holen
    const form = pdfDoc.getForm();

    // Namen der ausfüllbaren Felder (ersetzen Sie diese mit den tatsächlichen Namen Ihrer Felder)
    const name = form.getTextField("Text3");
    const number = form.getTextField("Ausbildungsnachweis Nr");
    const abteilung = form.getTextField("Abteilung");

    const from = form.getTextField("Ausbildungsnachweis vom");
    const to = form.getTextField("Ausbildungsnachweis bis");

    const year = form.getTextField("Ausbildungsjahr");

    const signDateAuszubildener = form.getTextField(
        "Datum Unterschrift Auszubildender"
    );
    const signDateAusbilder = form.getTextField("Datum Unterschrift Ausbilder");

    // Felder ausfüllen
    name.setText("Mustermann, Max");
    number.setText("69");
    abteilung.setText("Arbeit");

    from.setText("1.2.3");
    to.setText("4.5.6");

    year.setText("3");

    signDateAuszubildener.setText("4.5.6");
    signDateAusbilder.setText("4.5.6");

    // Falls nötig, Formular-Elemente unsichtbar machen
    // form.flatten();

    // Geänderte PDF speichern
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync("./Filled_PDF_TEST.pdf", pdfBytes);
}

// fillPdf().catch((err) => {
//     console.error("Error filling PDF:", err);
// });

async function printFieldNames() {
    const pdfDoc = await PDFDocument.load(fs.readFileSync("./PDF_TEST.pdf"));
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    fields.forEach((field) => {
        console.log(`Field name: ${field.getName()}`);
    });
}

printFieldNames().catch((err) => {
    console.error("Error reading PDF:", err);
});
