const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const readline = require("readline");
const {
    addDays,
    startOfWeek,
    eachWeekOfInterval,
    format,
    getYear,
} = require("date-fns");

const settings = {
    ordner: "C:\\Users\\Phillip Stecher\\Desktop\\Coding\\Githubs\\AusbildungsnachweisSchreiber\\Ausbildungsnachweise",
    startDatum: new Date("2022-11-28"),
    schule: "https://asopo.webuntis.com/timetable-students-my/", //? + {Date}
    arbeit: "http://jira.mediabeam.com/secure/Tempo.jspa#/my-work/week?type=LIST&date=", //? + {Date}
    gepruefteDateienPfad: "gepruefteDateien.txt",
    ausbildungsStart: 2021,
};

let bereitsGepruefteDateien = [];

function ladeGepruefteDateien() {
    if (fs.existsSync(settings.gepruefteDateienPfad)) {
        const dateien = fs.readFileSync(settings.gepruefteDateienPfad, "utf8");
        bereitsGepruefteDateien = dateien.split("\n").filter((line) => line);
    }
}

function speichereGepruefteDateien() {
    fs.writeFileSync(
        settings.gepruefteDateienPfad,
        bereitsGepruefteDateien.join("\n"),
        "utf8"
    );
}

function extrahiereDatumAusPfad(dateipfad) {
    const dateiTeile = dateipfad.split("\\");
    const jahrSegment = dateiTeile[dateiTeile.length - 3]; // "1. Jahr", "2. Jahr", etc.
    const monatSegment = dateiTeile[dateiTeile.length - 2]; // "11Monat - Juni", etc.

    const ausbildungsjahr = parseInt(jahrSegment.split(".")[0]);
    const monatIndex = parseInt(monatSegment.split("Monat")[0]); // Monate sind basierend auf der Liste 'monate'
    const datumSegment = path.basename(dateipfad).split("-")[0];
    const [tag, monat] = datumSegment.split(".").map(Number);

    let jahr = settings.ausbildungsStart + ausbildungsjahr - 1;
    if (monatIndex > 5) {
        // Für Monate Januar bis Juli im nächsten Kalenderjahr
        jahr++;
    }

    return new Date(jahr, monat - 1, tag); // Monate sind 0-basiert in JavaScript
}

async function pruefePdfDatei(dateipfad) {
    if (bereitsGepruefteDateien.includes(dateipfad)) {
        return []; // Überspringe, wenn die Datei bereits geprüft wurde
    }
    try {
        const pdfDaten = fs.readFileSync(dateipfad);
        const pdfDoc = await PDFDocument.load(pdfDaten);

        // Formular aus der geladenen PDF-Datei holen
        const form = pdfDoc.getForm();

        // Hier müsste die Logik implementiert werden, um die PDF-Felder zu lesen und zu prüfen.
        // Dies hängt von der Struktur der PDF und der Bibliothek pdf-lib ab.

        var field1 = form.getTextField("Betriebliche Tätigkeit")?.getText();
        var field2 = form
            .getTextField(
                "Unterweisungen betrieblicher Unterricht sonstige Schulungen"
            )
            ?.getText();
        var field3 = form
            .getTextField("Berufsschule - Unterrichtsthemen")
            ?.getText();

        var field1Empty = !field1;
        var field2Empty = !field2;
        var field3Empty = !field3;

        if (!field1Empty && !field2Empty && !field3Empty) {
            //! Jump und datei als fertig abspeichern
            return [];
        } else if (field1Empty && field2Empty && field3Empty) {
            //! Komplett ausfüllen lassen
            return [1, 2, 3];
        } else if (!field1Empty && !field3Empty && field2Empty) {
            //! Füllen mit "-"
            return [2];
        } else {
            //! Leeren felder ausfüllen lassen
            //? Wenn Field1 vollständig dann NICHT "settings.arbeit" anzeigen
            //? Wenn Field3 vollständig dann nicht "settings.schule" anzeigen
            var result = [];

            if (field1Empty) result.push(1);
            if (field2Empty) result.push(2);
            if (field3Empty) result.push(3);
            return result;
        }

        // console.log(`Geprüft: ${dateipfad}`);
    } catch (error) {
        console.error(`Fehler beim Prüfen der Datei ${dateipfad}:`, error);
        return [];
    }
}

async function durchsucheOrdner(ordner) {
    const dateienZuBearbeiten = [];
    const fertigeDateien = [];

    const dateien = fs.readdirSync(ordner);
    for (const datei of dateien) {
        const vollerPfad = path.join(ordner, datei);
        const dateiStatus = fs.lstatSync(vollerPfad);

        if (dateiStatus.isDirectory()) {
            const unterordnerResultate = await durchsucheOrdner(vollerPfad);
            dateienZuBearbeiten.push(
                ...unterordnerResultate.dateienZuBearbeiten
            );
            fertigeDateien.push(...unterordnerResultate.fertigeDateien);
        } else if (
            datei.endsWith(".pdf") &&
            !datei.includes("Ausbildungsnachweis-Base.pdf")
        ) {
            const pdfResult = await pruefePdfDatei(vollerPfad);
            if (pdfResult.length == 0) {
                fertigeDateien.push(vollerPfad);
            } else {
                dateienZuBearbeiten.push({
                    path: vollerPfad,
                    toFill: pdfResult,
                });
            }
        }
    }

    return { dateienZuBearbeiten, fertigeDateien };
}

function generateWorkLink(date) {
    return `${settings.arbeit}${format(date, "yyyy-MM-dd")}`;
}

function generateSchoolLink(date) {
    return `${settings.schule}${format(date, "yyyy-MM-dd")}`;
}

function askQuestion(frage, mehrzeilig = false) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        if (!mehrzeilig) {
            rl.question(frage, (antwort) => {
                rl.close();
                resolve(antwort);
            });
        } else {
            console.log(frage);
            const antworten = [];
            rl.on("line", (line) => {
                if (line === "\\ende") {
                    rl.close();
                } else {
                    antworten.push(line);
                }
            }).on("close", () => {
                resolve(antworten.join("\n"));
            });
        }
    });
}

async function getFields(pdfToFill) {
    // console.log(`Bearbeite: ${pdfToFill.path}`);
    var result = {};

    // Beispiel: Frage den Benutzer nach Informationen
    if (pdfToFill.toFill.includes(1)) {
        result.field1 = await askQuestion("Betriebliche Tätigkeit (beende mit '\\ende'):\n", true);
    }

    if (pdfToFill.toFill.includes(2)) {
        var filled = await askQuestion(
            "Unterweisungen (beende mit '\\ende'):\n",
            true
        );

        if (!filled) {
            result.field2 = "-";
        } else {
            result.field2 = filled;
        }
    }

    if (pdfToFill.toFill.includes(3)) {
        result.field3 = await askQuestion(
            "Berufsschule (Unterrichtsthemen) (beende mit '\\ende'):\n",
            true
        );
    }

    return result;
}

async function editPdfFile(pdfToFill, data) {
    try {
        const existingPdfBytes = fs.readFileSync(pdfToFill.path);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();

        // Setze die Werte in die PDF-Formularfelder
        if (data.field1) {
            var field = form.getTextField("Betriebliche Tätigkeit");
            field.setFontSize(12);
            field.setText(data.field1);
        }
        if (data.field2) {
            var field = form.getTextField(
                "Unterweisungen betrieblicher Unterricht sonstige Schulungen"
            );
            field.setFontSize(12);
            field.setText(data.field2);
        }
        if (data.field3) {
            var field = form.getTextField("Berufsschule - Unterrichtsthemen");
            field.setFontSize(12);
            field.setText(data.field3);
        }

        // form.flatten(); // Optional: Macht das Formular uneditierbar

        // Speichere das bearbeitete PDF
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(pdfToFill.path, pdfBytes);

        console.log(`PDF bearbeitet: ${pdfToFill.path}`);
        return true;
    } catch (error) {
        console.error(`Fehler beim Bearbeiten der PDF: ${error}`);
        return false;
    }
}

async function main() {
    ladeGepruefteDateien();

    const { dateienZuBearbeiten, fertigeDateien } = await durchsucheOrdner(
        settings.ordner
    );
    // console.log("Fertige Dateien:", fertigeDateien);

    bereitsGepruefteDateien = fertigeDateien;
    speichereGepruefteDateien();

    // console.log("Zu bearbeitende Dateien:", dateienZuBearbeiten);
    //! Show interface
    for (const pdfToFill of dateienZuBearbeiten) {
        // console.clear();

        var wocheStartDatum = extrahiereDatumAusPfad(pdfToFill.path);
        console.log("Nachweis: " + format(wocheStartDatum, "dd.MM.yyyy"));
        console.log("\n");

        var data;
        if (pdfToFill.toFill.length == 1 && pdfToFill.toFill[0] === 2) {
            data = {
                field2: "-",
            };
        } else {
            // generate links to click
            console.log("Links:");
            if (pdfToFill.toFill.includes(1)) {
                console.log(generateWorkLink(wocheStartDatum));
            }
            if (pdfToFill.toFill.includes(3)) {
                console.log(generateSchoolLink(wocheStartDatum));
            }
            console.log("\n");
            // Get Information from user
            data = await getFields(pdfToFill);

            console.log(data);
            var awnser = await askQuestion(
                "Continue? Type something to repeat:\n"
            );
            while (!!awnser) {
                console.log("\n\n");
                data = await getFields(pdfToFill);
                console.log(data);
                awnser = await askQuestion(
                    "\n\nContinue? Type something to repeat:\n"
                );
            }
        }

        // Write Information to pdf
        const erfolg = await editPdfFile(pdfToFill, data);

        // Save pdf

        // Save as finished pdf to settings.gepruefteDateienPfad with APPEND for performence!!!
        if (erfolg) {
            fs.appendFileSync(
                settings.gepruefteDateienPfad,
                `\n${pdfToFill.path}`
            );
        }
    }
}

main().catch(console.error);
