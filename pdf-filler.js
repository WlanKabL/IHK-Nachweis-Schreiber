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
    "username",
    "password",
    "asopo.webuntis.com"
);

const settings = {
    folder: "Path",
    startDate: new Date("2022-11-28"),
    schoolUrl: "https://asopo.webuntis.com/timetable-students-my/", //? + {Date}
    workUrl:
        "http://jira.mediabeam.com/secure/Tempo.jspa#/my-work/week?type=LIST&date=", //? + {Date}
    checkedFilesPath: "gepruefteDateien.txt",
    trainingStartYear: 2021,
};

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
    const daySegment = path.basename(filePath).split("-")[0];
    const [day, month] = daySegment.split(".").map(Number);

    let year = settings.trainingStartYear + trainingYear - 1;
    if (monthIndex > 5) {
        // Für Monate Januar bis Juli im nächsten Kalenderjahr
        year++;
    }

    return new Date(year, month - 1, day); // Monate sind 0-basiert in JavaScript
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
    // console.log(`Bearbeite: ${pdfToFill.path}`);
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

        if (!filled) {
            result.field2 = "-";
        } else {
            result.field2 = filled;
        }
    }

    if (pdfToFill.toFill.includes(3)) {
        result.field3 = await askQuestion(
            "Berufsschule (Unterrichtsthemen) (beende mit '\\e'):",
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

var jwt = "";

async function fetchData(school, session) {
    const url =
        "https://asopo.webuntis.com/WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=7134&elementType=5&endDateTime=2024-02-01T10%3A30%3A00&homeworkOption=DUE&startDateTime=2024-02-01T09%3A45%3A00";
    const headers = {
        accept: "application/json, text/plain, */*",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        authorization: `Bearer ${jwt}`,
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
        console.log(response.data.calendarEntries);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

async function main() {
    await untis.login();
    const timetable = await untis.getOwnTimetableForRange(
        new Date("2024-01-22"),
        new Date("2024-01-28")
    );
    var test = timetable[3];
    var abc = await untis.getHomeWorkAndLessons(
        new Date("2024-01-22"),
        new Date("2024-01-28"),
        true
    );
    var fach = test.su.name;

    jwt = await untis._getJWT(true);

    fetchData(untis.schoolbase64, untis.sessionInformation.sessionId);

    return;
    loadCheckedFiles();

    const { filesToProcess, finishedFiles } = await searchFolder(
        settings.folder
    );
    // console.log("Fertige Dateien:", finishedFiles);

    alreadyCheckedFiles = finishedFiles;
    saveCheckedFiles();

    // console.log("Zu bearbeitende Dateien:", filesToProcess);
    //! Show interface
    console.clear();
    process.stdout.write("clear");
    cp.execSync("clear");
    for (const pdfToFill of filesToProcess) {
        console.clear();

        var weekStartDate = extractDateFromPath(pdfToFill.path);
        console.log("Nachweis: " + format(weekStartDate, "dd.MM.yyyy"));
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
