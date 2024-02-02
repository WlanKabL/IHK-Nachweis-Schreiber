const fs = require("fs");
var cp = require("child_process");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const readline = require("readline");
const { WebUntis } = require("webuntis");
const axios = require("axios");
const {
    addDays,
    startOfWeek,
    eachWeekOfInterval,
    format,
    getYear,
} = require("date-fns");

const untis = new WebUntis(
    "BK-Ahaus",
    "stec132861",
    "p27062003s",
    "asopo.webuntis.com"
);

const settings = {
    folder: "C:\\Users\\Phillip Stecher\\Desktop\\Coding\\Githubs\\AusbildungsnachweisSchreiber\\Ausbildungsnachweise",
    startDate: new Date("2022-11-28"),
    schoolUrl: "https://asopo.webuntis.com/timetable-students-my/", //? + {Date}
    workUrl:
        "http://jira.mediabeam.com/secure/Tempo.jspa#/my-work/week?type=LIST&date=", //? + {Date}
    checkedFilesPath: "gepruefteDateien.txt",
    trainingStartYear: 2021,
};
var loginToken = "";

let alreadyCheckedFiles = [];

function loadCheckedFiles() {
    if (fs.existsSync(settings.checkedFilesPath)) {
        const files = fs.readFileSync(settings.checkedFilesPath, "utf8");
        alreadyCheckedFiles = files.split("\n").filter((line) => line);
    }
}

function saveCheckedFiles() {
    fs.writeFileSync(
        settings.checkedFilesPath,
        alreadyCheckedFiles.join("\n"),
        "utf8"
    );
}

function extractDateFromPath(filePath) {
    const fileParts = filePath.split("\\");
    const yearSegment = fileParts[fileParts.length - 3]; // "1. Jahr", "2. Jahr", etc.
    const monthSegment = fileParts[fileParts.length - 2]; // "11Monat - Juni", etc.

    const trainingYear = parseInt(yearSegment.split(".")[0]);
    const monthIndex = parseInt(monthSegment.split("Monat")[0]); // Monate sind basierend auf der Liste 'monate'
    const dateSegment = path.basename(filePath).split("-")[0];
    const endDateSegment = path
        .basename(filePath)
        .split("-")[1]
        .split("-NR")[0];
    const [day, month] = dateSegment.split(".").map(Number);
    const [endDay, endMonth] = endDateSegment.split(".").map(Number);

    let year = settings.trainingStartYear + trainingYear - 1;
    let endYear = year;
    if (monthIndex > 5) {
        // Für Monate Januar bis Juli im nächsten Kalenderjahr
        year++;
    }
    if (monthIndex > 5 && endMonth <= 7) {
        endYear++;
    }

    return {
        weekStartDate: new Date(year, month - 1, day),
        weekEndDate: new Date(endYear, endMonth - 1, endDay),
    };
}

async function pruefePdfDatei(filePath) {
    if (alreadyCheckedFiles.includes(path.basename(filePath))) {
        return []; // Überspringe, wenn die Datei bereits geprüft wurde
    }
    try {
        const pdfData = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfData);

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
            //! Jump und file als fertig abspeichern
            return [];
        } else if (field1Empty && field2Empty && field3Empty) {
            //! Komplett ausfüllen lassen
            return [1, 2, 3];
        } else if (!field1Empty && !field3Empty && field2Empty) {
            //! Füllen mit "-"
            return [2];
        } else {
            //! Leeren felder ausfüllen lassen
            //? Wenn Field1 vollständig dann NICHT "settings.workUrl" anzeigen
            //? Wenn Field3 vollständig dann nicht "settings.schoolUrl" anzeigen
            var result = [];

            if (field1Empty) result.push(1);
            if (field2Empty) result.push(2);
            if (field3Empty) result.push(3);
            return result;
        }

        // console.log(`Geprüft: ${filePath}`);
    } catch (error) {
        console.error(`Fehler beim Prüfen der Datei ${filePath}:`, error);
        return [];
    }
}

async function searchFolder(folder) {
    const filesToProcess = [];
    const finishedFiles = [];

    const files = fs.readdirSync(folder);
    for (const file of files) {
        const fullPath = path.join(folder, file);
        const fileStatus = fs.lstatSync(fullPath);

        if (fileStatus.isDirectory()) {
            const subfolderResults = await searchFolder(fullPath);
            filesToProcess.push(...subfolderResults.filesToProcess);
            finishedFiles.push(...subfolderResults.finishedFiles);
        } else if (
            file.endsWith(".pdf") &&
            !file.includes("Ausbildungsnachweis-Base.pdf")
        ) {
            const pdfResult = await pruefePdfDatei(fullPath);
            if (pdfResult.length == 0) {
                finishedFiles.push(path.basename(fullPath));
            } else {
                filesToProcess.push({
                    path: fullPath,
                    toFill: pdfResult,
                });
            }
        }
    }

    return { filesToProcess, finishedFiles };
}

function generateWorkLink(date) {
    return `${settings.workUrl}${format(date, "yyyy-MM-dd")}`;
}

function generateSchoolLink(date) {
    return `${settings.schoolUrl}${format(date, "yyyy-MM-dd")}`;
}

function askQuestion(question, multiline = false) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        if (!multiline) {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
        } else {
            console.log(question);
            const answers = [];
            rl.on("line", (line) => {
                if (line === "\\e") {
                    rl.close();
                } else {
                    answers.push(line);
                }
            }).on("close", () => {
                resolve(answers.join("\n"));
            });
        }
    });
}

async function getFields(pdfToFill) {
    var result = {};

    // Beispiel: Frage den Benutzer nach Informationen
    if (pdfToFill.toFill.includes(1)) {
        result.field1 = await askQuestion(
            "Betriebliche Tätigkeit (beende mit '\\e'):",
            true
        );
    }

    if (pdfToFill.toFill.includes(2)) {
        var filled = await askQuestion(
            "Unterweisungen (beende mit '\\e'):",
            true
        );
        result.field2 = filled.trim() || "-";
    }

    if (pdfToFill.toFill.includes(3)) {
        //! Automatic / Manuell toggle
        var automaticToggle = await askQuestion(
            "Berufsschule ([Default] Automatic | [M] Manuell):\n"
        );

        if (automaticToggle.toLowerCase().trim() == "m") {
            result.field3 = await askQuestion(
                "Berufsschule (Unterrichtsthemen) (beende mit '\\e'):",
                true
            );
        } else {
            var calendarEntries = await getTeachingContent(
                format(pdfToFill.startDate, "yyyy.MM.dd"),
                format(pdfToFill.endDate, "yyyy.MM.dd")
            );
            // console.log(calendarEntries);
            result.field3 = calendarEntries;
        }
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

async function fetchData(school, session, startDate, endDate) {
    var startString = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
    var endString = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");
    var elementId = "7134";
    var elementType = "5";
    var homeworkOption = "DUE";

    const url = `https://asopo.webuntis.com/WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=${elementId}&elementType=${elementType}&endDateTime=${endString}&homeworkOption=${homeworkOption}&startDateTime=${startString}`;
    const headers = {
        accept: "application/json, text/plain, */*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        authorization: `Bearer ${loginToken}`,
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua":
            '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "x-webuntis-api-school-year-id": "25",
        cookie: `schoolname="${school}"; JSESSIONID=${session}`,
        Referer:
            "https://asopo.webuntis.com/timetable-students-my/2024-02-01/modal/details/2017161/false/7134/5/2024-02-01T09%3A45%3A00%2B01%3A00/2024-02-01T10%3A30%3A00%2B01%3A00/details",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    };

    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function convertArrayToString(calendarEntries) {
    const subjectContents = {};

    // Organisiere die Einträge nach Fächern
    calendarEntries.forEach((entry) => {
        if (!subjectContents[entry.subject]) {
            subjectContents[entry.subject] = [];
        }
        subjectContents[entry.subject].push(entry.teachingContent);
    });

    // Konvertiere das Objekt in einen String
    let resultString = "";
    for (const [subject, contents] of Object.entries(subjectContents)) {
        // Füge den Fachnamen hinzu
        resultString += `${subject}:\n`;

        if (contents.length > 1) {
            // Mehrere Einträge für das Fach vorhanden, füge sie getrennt hinzu
            resultString += `${contents.join("\n")}\n`;
        } else {
            // Nur ein Eintrag vorhanden, füge ihn direkt hinzu
            resultString += `${contents[0]}\n`;
        }
    }

    return resultString.trim(); // Entferne zusätzliche Leerzeichen am Ende des Strings
}

async function getTeachingContent(start, end) {
    const timetable = await untis.getOwnTimetableForRange(
        new Date(start), //Week Start
        new Date(end) // Wekk end
    );

    // Filtern Sie abgesagte Termine und extrahieren Sie die Daten
    var dateList = timetable
        .filter((t) => t.code !== "cancelled")
        .map((t) => {
            let date = t.date.toString();
            return `${date.substr(0, 4)}-${date.substr(4, 2)}-${date.substr(
                6,
                2
            )}`;
        });

    // Entfernen Sie Duplikate
    var uniqueDates = [...new Set(dateList)];
    uniqueDates.sort();

    // Gruppieren Sie die Daten basierend auf ihrer zeitlichen Nähe
    var dateGroups = [];
    var currentGroups = [];

    uniqueDates.forEach((date, index) => {
        var dateObject = new Date(date);

        if (
            !currentGroups.length ||
            dateObject - new Date(currentGroups[currentGroups.length - 1]) <=
                2 * 24 * 60 * 60 * 1000
        ) {
            currentGroups.push(date);
        } else {
            dateGroups.push(currentGroups);
            currentGroups = [date];
        }

        if (index === uniqueDates.length - 1) {
            dateGroups.push(currentGroups);
        }
    });

    var allCalendarEntries = [];

    for (var date of uniqueDates) {
        var data = await fetchData(
            untis.schoolbase64,
            untis.sessionInformation.sessionId,
            new Date(`${date}T00:00:00`),
            new Date(`${date}T23:59:59`)
        ).catch(console.error);

        if (data && data.calendarEntries) {
            allCalendarEntries.push(...data.calendarEntries);
        }
    }

    // Filtern der abgesagten Termine
    const calendarEntries = allCalendarEntries
        .filter((entry) => entry.status !== "CANCELLED")
        .map((entry) => {
            return {
                subject: entry.subject
                    ? entry.subject.shortName || entry.subject.displayName
                    : "Unbekannt",
                teachingContent:
                    entry.teachingContent || entry.notesAll || "Keine Inhalte abrufbar.",
            };
        });

    return convertArrayToString(calendarEntries);
}

async function main() {
    console.log("Logging in...");
    await untis.login();
    loginToken = await untis._getJWT(true);

    console.log("Parsing files...");
    loadCheckedFiles();

    const { filesToProcess, finishedFiles } = await searchFolder(
        settings.folder
    );

    console.log("Fertige Dateien:", finishedFiles.length);
    console.log("Zu bearbeitende Dateien:", filesToProcess.length);

    // var awnser = await askQuestion("[C] Continue | [P] Print Tree:\n");

    alreadyCheckedFiles = finishedFiles;
    saveCheckedFiles();

    //! Show interface
    // console.clear();
    // process.stdout.write("clear");
    // cp.execSync("clear");
    for (const pdfToFill of filesToProcess) {
        console.clear();

        var { weekStartDate, weekEndDate } = extractDateFromPath(
            pdfToFill.path
        );
        // var weekStartDate = new Date("2024-01-22");
        // var weekEndDate = new Date("2024-01-26");

        pdfToFill.startDate = weekStartDate;
        pdfToFill.endDate = weekEndDate;

        console.log(
            `Nachweis: ${format(weekStartDate, "dd.MM.yyyy")} - ${format(
                weekEndDate,
                "dd.MM.yyyy"
            )}`
        );
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
                console.log(generateWorkLink(weekStartDate));
            }
            if (pdfToFill.toFill.includes(3)) {
                console.log(generateSchoolLink(weekStartDate));
            }
            console.log("");
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
        const editSuccess = await editPdfFile(pdfToFill, data);

        // Save pdf

        // Save as finished pdf to settings.checkedFilesPath with APPEND for performence!!!
        if (editSuccess) {
            fs.appendFileSync(
                settings.checkedFilesPath,
                `\n${path.basename(pdfToFill.path)}`
            );
        }
    }
}

main().catch(console.error);
