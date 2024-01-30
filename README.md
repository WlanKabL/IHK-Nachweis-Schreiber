# IHK Ausbildungsnachweis Schreiber

Dieses Skript generiert automatisch Ausbildungsnachweise basierend auf vorgegebenen Daten und Vorlagen. Es ist speziell dafür entwickelt, die Verwaltung von Ausbildungsnachweisen zu vereinfachen.

## Konfiguration

### Settings

Das Skript verwendet ein `settings`-Objekt, um die Konfiguration anzupassen. Die folgenden Einstellungen können nach Bedarf geändert werden:

```
const settings = {
    dauer: 3,
    startYear: 2023,
    benutzer: "Mustermann, Max",
    abteilung: "Anwendungsentwicklung",
    ordner: "C:\\Pfad\\zum\\Ausbildungsnachweise-Ordner",
};
```

### Datei- und Ordnerstruktur

Die Dateien und Ordner müssen wie folgt strukturiert sein, damit das Skript korrekt funktioniert:

- Hauptordner (angegeben im `ordner` in den `settings`)
    - `1. Jahr`
        - `1Monat - August`
            - `01.08-05.08-NR1.pdf`
            - ...
        - `2Monat - September`
        - ...
        - `12Monat - Juli`
    - `2. Jahr`
        - `1Monat - August`
        - ...
    - `Ausbildungsnachweis-Base.pdf`: Vorlage für die Ausbildungsnachweise

Jeder Unterordner für das jeweilige Ausbildungsjahr sollte die Monate enthalten, wie in den `monate` im Skript definiert. Die Vorlage für die Ausbildungsnachweise sollte im Hauptordner unter dem Namen `Ausbildungsnachweis-Base.pdf` gespeichert sein.

## Endgültige PDF-Datei

Das Skript generiert PDF-Dateien, die nach dem Schema `Startdatum-Enddatum-NRNummer.pdf` benannt sind. Zum Beispiel: `01.08-05.08-NR1.pdf`. Die Informationen wie Startdatum, Enddatum, Ausbildungsjahr, Auszubildender, Abteilung und Nummer des Ausbildungsnachweises werden automatisch in die PDF eingetragen.

## Installation

Bevor Sie das Skript verwenden, stellen Sie sicher, dass Node.js auf Ihrem System installiert ist. Führen Sie dann die folgenden Befehle in Ihrem Terminal aus:

1. Installieren Sie die notwendigen Pakete:
```
npm i 
```

2. Führen Sie das Skript aus:
```
node index.js
```

## Verwendung

Führen Sie das Skript einfach aus, nachdem Sie die `settings` und die Datei- und Ordnerstruktur entsprechend Ihrer Anforderungen konfiguriert haben. Das Skript erzeugt die fehlenden Ausbildungsnachweise automatisch basierend auf den vorgegebenen Daten.
