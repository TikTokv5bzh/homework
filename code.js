// Spreadsheet ID - REPLACE WITH YOUR SPREADSHEET ID

const SPREADSHEET_ID = '187X81P4PuE4QGUbSZ4KrmBd7Kgjy4WUicxauaZulVVw'; // <<<==== استبدل هذا بمعرف جدول البيانات الخاص بك

const SHEET_NAME = 'الواجبات'; // اسم الورقة التي تحتوي على البيانات (تأكد أنه يطابق اسم الورقة في Google Sheet تماماً)



// Drive Folder Names - These will use Gregorian dates for subfolder names

const LOGS_FOLDER_NAME = 'سجل_الواجبات'; // For delete logs (CSV)

const IMAGE_FOLDER_NAME = 'صور_الواجبات'; // For saved images (single or all)

const SEPARATE_DATA_FOLDER_NAME = 'جميع_بيانات_الواجبات_CSV'; // For CSV exports (if needed later)



/**

 * Serves the HTML page.

 */

function doGet(e) {

  return HtmlService.createTemplateFromFile('index')

      .evaluate()

      .setTitle("المغيرة بن شعبة")

      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

}



/**

 * Includes HTML content from other files.

 */

function include(filename) {

  return HtmlService.createHtmlOutputFromFile(filename)

      .getContent();

}



/**

 * Dummy function called on HTML page load to ensure script is loaded and authorized.

 */

function onLoad() {

   return 'Script loaded and authorized.';

}



/**

 * Gets a list of all unique class and section combinations from the sheet.

 * Assumes Class is index 0 and Section is index 1 now.

 */

function getAllClassSectionCombinations() {

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {

    Logger.log(`Worksheet "${SHEET_NAME}" not found for getting combinations.`);

    return [];

  }



  const range = sheet.getDataRange();

  const values = range.getValues();



  if (values.length <= 1) { return []; }



  const headerRow = values[0];

  // Indices are now based on the 6-column structure

  const classColIndex = headerRow.indexOf('الصف الدراسي'); // Should be index 0

  const sectionColIndex = headerRow.indexOf('الشعبة'); // Should be index 1



   if (classColIndex === -1 || sectionColIndex === -1) {

        Logger.log("Required columns (الصف الدراسي or الشعبة) not found in header for getting combinations.");

        return [];

    }



  const combinationsSet = new Set();



  for (let i = 1; i < values.length; i++) {

    const row = values[i];

     if (row.length > Math.max(classColIndex, sectionColIndex)) {

        const classValue = String(row[classColIndex] || '').trim();

        const sectionValue = String(row[sectionColIndex] || '').trim();

        if (classValue && sectionValue) {

            combinationsSet.add(`${classValue}-${sectionValue}`);

        }

     }

  }



  const combinationsArray = Array.from(combinationsSet).map(item => {

      const [classStr, sectionStr] = item.split('-');

      return { class: classStr, section: sectionStr };

  });



  combinationsArray.sort((a, b) => {

      const classCompare = a.class.localeCompare(b.class);

      if (classCompare !== 0) return classCompare;

      return a.section.localeCompare(b.section);

  });



  return combinationsArray;

}





/**

 * Gets homework data, filtered by class and section.

 * Returns rows starting from الصف الدراسي (6 columns total).

 */

function getHomeworkData(classFilter, sectionFilter) {

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {

    throw new Error(`Worksheet "${SHEET_NAME}" not found.`);

  }



  const range = sheet.getDataRange();

  const values = range.getValues();



  if (values.length <= 1) { return []; }



  const headerRow = values[0];

  // Indices based on 6-column structure

  const classColIndex = headerRow.indexOf('الصف الدراسي'); // Index 0

  const sectionColIndex = headerRow.indexOf('الشعبة');     // Index 1



   if (classColIndex === -1 || sectionColIndex === -1) {

        throw new Error("Required filtering columns (الصف الدراسي or الشعبة) not found in the header row.");

    }



  const filteredData = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    if (row.length > Math.max(classColIndex, sectionColIndex)) {

        const rowClass = String(row[classColIndex] || '').trim();

        const rowSection = String(row[sectionColIndex] || '').trim();



        if (rowClass === classFilter && rowSection === sectionFilter) {

          // Return the row data as it is (6 columns)

          filteredData.push(row);

        }

    } else {

        Logger.log(`Skipping incomplete row at index ${i} in sheet: ${JSON.stringify(row)}`);

    }

  }



  return filteredData;

}



/**

 * Checks if homework exists for the given class, section, and period.

 * If it exists, returns its row index. If not, saves the new homework.

 * Uses Class, Section, Period for checking.

 */

function saveOrCheckHomework(data) {

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheetByName(SHEET_NAME);

   if (!sheet) {

    throw new Error(`Worksheet "${SHEET_NAME}" not found.`);

  }



  const range = sheet.getDataRange();

  const values = range.getValues();



  // Find column indices based on current 6-column header

  const headerRow = values[0];

  const classColIndex = headerRow.indexOf('الصف الدراسي'); // Index 0

  const sectionColIndex = headerRow.indexOf('الشعبة');     // Index 1

  const periodColIndex = headerRow.indexOf('الحصة');      // Index 2

  const subjectColIndex = headerRow.indexOf('المادة');     // Index 3

  const lessonColIndex = headerRow.indexOf('الدرس');  // Index 4

  const homeworkColIndex = headerRow.indexOf('الواجب');    // Index 5



   const requiredHeaderIndices = [classColIndex, sectionColIndex, periodColIndex, subjectColIndex, lessonColIndex, homeworkColIndex];

   if (requiredHeaderIndices.some(index => index === -1)) {

       const missingCols = requiredHeaderIndices.map((index, i) => index === -1 ? ['الصف الدراسي', 'الشعبة', 'الحصة', 'المادة', 'الدرس', 'الواجب'][i] : null).filter(name => name !== null);

       throw new Error(`One or more required columns not found in the header row: ${missingCols.join(', ')}. Please ensure header row matches exactly.`);

   }



  // Check for existing entry based on Class, Section, Period only

  let existingRowIndex = -1;

  for (let i = 1; i < values.length; i++) { // Start from row 2 (index 1)

      const row = values[i];

      if (row.length > Math.max(classColIndex, sectionColIndex, periodColIndex)) {

           const rowClass = String(row[classColIndex] || '').trim();

           const rowSection = String(row[sectionColIndex] || '').trim();

           const rowPeriod = String(row[periodColIndex] || '').trim();



           if (rowClass === data.class &&

               rowSection === data.section &&

               rowPeriod === data.period) {

                 existingRowIndex = i + 1; // Sheet row index (1-based)

                 break;

           }

      }

  }



  if (existingRowIndex !== -1) {

      // Duplicate found based on Class, Section, Period

      return {

          status: 'duplicate',

          rowIndex: existingRowIndex, // Send the actual row index (1-based)

          class: data.class,

          section: data.section,

          period: data.period

       };

  } else {

      // No duplicate found, append new row

      const newRow = new Array(headerRow.length).fill(''); // Create based on actual header length (6)



      newRow[classColIndex] = data.class;

      newRow[sectionColIndex] = data.section;

      newRow[periodColIndex] = data.period;

      newRow[subjectColIndex] = data.subject;

      newRow[lessonColIndex] = data.lessonTitle;

      newRow[homeworkColIndex] = data.homework;



      sheet.appendRow(newRow);

      return { status: 'success', message: 'تم حفظ الواجب بنجاح!' };

  }

}



/**

 * Updates an existing homework entry in the specified row.

 * Updates only Subject, Lesson, Homework.

 */

function updateHomework(data, rowIndex) {

   const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

   const sheet = ss.getSheetByName(SHEET_NAME);

   if (!sheet) {

     throw new Error(`Worksheet "${SHEET_NAME}" not found.`);

   }

   if (rowIndex < 2) {

       throw new Error(`Invalid row index provided for update: ${rowIndex}`);

   }



   // Find column indices based on 6-column header

   const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

   const subjectColIndex = headerRow.indexOf('المادة');     // Index 3

   const lessonColIndex = headerRow.indexOf('الدرس');  // Index 4

   const homeworkColIndex = headerRow.indexOf('الواجب');    // Index 5



    if (subjectColIndex === -1 || lessonColIndex === -1 || homeworkColIndex === -1) {

         throw new Error("Could not find Subject, Lesson Title, or Homework columns for update.");

    }



    try {

        // Add 1 to column index because getRange uses 1-based column numbers

        sheet.getRange(rowIndex, subjectColIndex + 1).setValue(data.subject);

        sheet.getRange(rowIndex, lessonColIndex + 1).setValue(data.lessonTitle);

        sheet.getRange(rowIndex, homeworkColIndex + 1).setValue(data.homework);

        SpreadsheetApp.flush();

        return 'تم تحديث الواجب بنجاح!';

    } catch (e) {

        Logger.log(`Error updating row ${rowIndex}: ${e}`);

        throw new Error(`فشل تحديث الصف ${rowIndex}: ${e.message}`);

    }

}





/**

 * Deletes all homework data from the sheet.

 * Optionally saves a log (all data) to Google Drive before deleting.

 * The log file name and folder name use Gregorian date.

 */

function deleteHomework(saveLog) {

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheetByName(SHEET_NAME);

   if (!sheet) {

    throw new Error(`Worksheet "${SHEET_NAME}" not found.`);

  }



  const range = sheet.getDataRange();

  const values = range.getValues();



  if (values.length <= 1) {

    return 'لا توجد بيانات لحذفها.';

  }



  if (saveLog) {

    try {

      const dataToLog = values;

      let logContent = dataToLog.map(row =>

        row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')

      ).join('\n');



      const rootFolder = DriveApp.getRootFolder();

      const logsFolders = rootFolder.getFoldersByName(LOGS_FOLDER_NAME);

      let logsFolder = logsFolders.hasNext() ? logsFolders.next() : rootFolder.createFolder(LOGS_FOLDER_NAME);



      const today = new Date();

      const dateFolderFormat = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

      const dateFolders = logsFolder.getFoldersByName(dateFolderFormat);

      let dateFolder = dateFolders.hasNext() ? dateFolders.next() : logsFolder.createFolder(dateFolderFormat);



      const filename = `all_data_deleted_log_${dateFolderFormat}_${Date.now()}.csv`;

      dateFolder.createFile(filename, logContent, MimeType.CSV);

      Logger.log(`All data deleted log saved to ${dateFolderFormat}/${filename}`);



    } catch (e) {

      Logger.log('Error saving delete log: ' + e.message);

       return `فشل حفظ السجل أثناء الحذف: ${e.message}. تم حذف البيانات.`;

    }

  }



   if (sheet.getLastRow() > 1) {

        sheet.deleteRows(2, sheet.getLastRow() - 1);

   }



  return saveLog ? 'تم حذف جميع البيانات مع حفظ سجل.' : 'تم حذف جميع البيانات.';

}



/**

 * Saves an image (base64 data) to Google Drive.

 * The image file name and folder name use Gregorian date.

 */

function saveImageToDrive(imageData, filename) {

  try {

    const base64Data = imageData.split(',')[1];

    const decodedData = Utilities.base64Decode(base64Data);

    const blob = Utilities.newBlob(decodedData, 'image/png', filename);



    const rootFolder = DriveApp.getRootFolder();

    const imageFolders = rootFolder.getFoldersByName(IMAGE_FOLDER_NAME);

    let imageFolder = imageFolders.hasNext() ? imageFolders.next() : rootFolder.createFolder(IMAGE_FOLDER_NAME);



    const today = new Date();

    const dateFolderFormat = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const dateFolders = imageFolder.getFoldersByName(dateFolderFormat);

    let dateFolder = dateFolders.hasNext() ? dateFolders.next() : imageFolder.createFolder(dateFolderFormat);



    dateFolder.createFile(blob);



    return `تم حفظ الصورة في Google Drive في مجلد ${IMAGE_FOLDER_NAME}/${dateFolderFormat}/${filename}`;



  } catch (e) {

    Logger.log('Error saving image to Drive: ' + e.message);

    throw new Error('فشل حفظ الصورة في Google Drive: ' + e.message);

  }

}
