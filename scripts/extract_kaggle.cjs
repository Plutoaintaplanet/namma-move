const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ARCHIVE = path.join(__dirname, '..', 'archive.zip');
const OUT_DIR = path.join(__dirname, '..', 'src', 'data');
const TMP_DIR = path.join(__dirname, '..', 'kaggle_tmp');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

console.log("Reading archive.zip...");
let zip;
try {
    zip = new AdmZip(ARCHIVE);
} catch (e) {
    console.error("Failed to read archive.zip", e);
    process.exit(1);
}

console.log("Extracting bmtc.zip...");
zip.extractEntryTo("bmtc.zip", TMP_DIR, false, true);

const bmtcZipPath = path.join(TMP_DIR, 'bmtc.zip');
console.log("Reading bmtc.zip...");
let gtfsZip;
try {
    gtfsZip = new AdmZip(bmtcZipPath);
} catch (e) {
    console.error("Failed to read bmtc.zip", e);
    process.exit(1);
}

console.log("Extracting GTFS files...");
gtfsZip.extractAllTo(TMP_DIR, true);

console.log("Files ready in", TMP_DIR);
