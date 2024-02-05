const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const {
    addDays,
    startOfWeek,
    eachWeekOfInterval,
    format,
    getYear,
} = require("date-fns");

const settings = {
    dauer: 3,
    startYear: 2021,
    benutzer: "Stecher, Philipp",
    abteilung: "Anwendungsentwicklung",
    ordner: "C:\\Users\\Phillip Stecher\\Desktop\\Coding\\Githubs\\AusbildungsnachweisSchreiber\\Ausbildungsnachweise",
};

const monate = [
    "1Monat - August",
    "2Monat - September",
    "3Monat - Oktober",
    "4Monat - November",
    "5Monat - Dezember",
    "6Monat - Januar",
    "7Monat - Februar",
    "8Monat - März",
    "9Monat - April",
    "10Monat - Mai",
    "11Monat - Juni",
    "12Monat - Juli",
];

function findeLetztesDatumUndNummer() {
    let letztesDatum = new Date("2024-01-29"); // 25. November 2022
    let letzteNummer = 0;

    for (var year = 0; year < settings.dauer; year++) {
        monate.forEach((monat, index) => {
            const ordnerPfad = path.join(
                settings.ordner,
                year + 1 + ". Jahr",
                monat
            );

            if (fs.existsSync(ordnerPfad)) {
                const dateien = fs.readdirSync(ordnerPfad);
                dateien.forEach((datei) => {
                    if (datei.endsWith(".pdf")) {
                        const teile = datei.split("-NR");
                        const nummer = parseInt(
                            teile[1].replace(".pdf", ""),
                            10
                        );
                        if (nummer > letzteNummer) {
                            letzteNummer = nummer;
                            // Datum aus dem Dateinamen extrahieren
                            const datumsTeil = teile[0].split("-");
                            const endDatum = datumsTeil[1];
                            const endDatumSplit = endDatum.split(".");

                            var jahr = settings.startYear + year;
                            if ((index + 1) > 5) {
                                // Monate Januar bis Juli
                                jahr++;
                            }

                            letztesDatum = new Date(
                                jahr,
                                endDatumSplit[1] - 1,
                                endDatumSplit[0]
                            );
                        }
                    }
                });
            } else {
                console.warn(`Ordner nicht gefunden: ${ordnerPfad}`);
            }
        });
    }

    return { letztesDatum, letzteNummer };
}

function berechneFehlendeWochen(letztesDatum, letzteNummer) {
    const heute = new Date();
    // Ermittle den Montag der Woche, die auf das letzte Datum folgt
    const startDatum = startOfWeek(addDays(letztesDatum, 3), {
        weekStartsOn: 1,
    });
    const wochenintervalle = eachWeekOfInterval({
        start: startDatum,
        end: heute,
    });

    wochenintervalle.shift();

    return wochenintervalle.map((woche, index) => {
        const wocheStart = startOfWeek(woche, { weekStartsOn: 1 });
        // Setze das Ende der Woche manuell auf Freitag
        const wocheEnde = addDays(wocheStart, 4);
        const ausbildungsjahr =
            wocheStart.getMonth() >= 7
                ? getYear(wocheStart) - settings.startYear + 1
                : getYear(wocheStart) - settings.startYear;
        const monatIndex =
            wocheStart.getMonth() >= 7
                ? wocheStart.getMonth() - 7
                : wocheStart.getMonth() + 5;

        return {
            startDatum: format(wocheStart, "dd.MM"),
            endDatum: format(wocheEnde, "dd.MM"),
            monatOrdner: monate[monatIndex],
            jahrOrdner: `${ausbildungsjahr}. Jahr`,
            nummer: letzteNummer + index + 1,
            startJahr: getYear(wocheStart),
            endJahr: getYear(wocheEnde),
        };
    });
}

function kopiereUndBenenneUm(woche) {
    const quelle = path.join(settings.ordner, `Ausbildungsnachweis-Base.pdf`);
    const zielOrdner = path.join(
        settings.ordner,
        woche.jahrOrdner,
        woche.monatOrdner
    );
    const dateiName = `${woche.startDatum}-${woche.endDatum}-NR${woche.nummer}.pdf`;
    const zielDatei = path.join(zielOrdner, dateiName);

    fillPdf(quelle, zielDatei, woche);
}

async function fillPdf(source, target, data) {
    try {
        const pdfDoc = await PDFDocument.load(fs.readFileSync(source));
        const form = pdfDoc.getForm();

        form.getTextField("Text3").setText(settings.benutzer);
        form.getTextField("Ausbildungsnachweis Nr").setText(
            data.nummer.toString()
        );
        form.getTextField("Abteilung").setText(settings.abteilung);
        form.getTextField("Ausbildungsnachweis vom").setText(
            `${data.startDatum}.${data.startJahr}`
        );
        form.getTextField("Ausbildungsnachweis bis").setText(
            `${data.endDatum}.${data.endJahr}`
        );
        form.getTextField("Ausbildungsjahr").setText(
            data.jahrOrdner.substr(0, 1)
        );
        form.getTextField("Datum Unterschrift Auszubildender").setText(
            `${data.endDatum}.${data.endJahr}`
        );
        form.getTextField("Datum Unterschrift Ausbilder").setText(
            `${data.endDatum}.${data.endJahr}`
        );

        // console.log(target);
        fs.writeFileSync(target, await pdfDoc.save());
    } catch (error) {
        console.error("Error filling PDF:", error);
    }
}

function main() {
    const { letztesDatum, letzteNummer } = findeLetztesDatumUndNummer();

    for (var x = 0; x <= settings.dauer; x++) {}

    const fehlendeWochen = berechneFehlendeWochen(letztesDatum, letzteNummer);

    console.log("Fehlende Nachweise: " + fehlendeWochen.length);
    console.log(
        `Letzter Nachweis: ${letztesDatum.getDate()}.${
            letztesDatum.getMonth() + 1
        }.${letztesDatum.getFullYear()}`
    );

    fehlendeWochen.forEach((woche) => {
        kopiereUndBenenneUm(woche);
    });
}

main();
